/**
 * Hook runtime của Frontend Delivery Kit — lớp gate "cứng" khi agent đang chạy.
 *
 * Trước v2.0.0 mọi gate chỉ nằm trong prompt. Script này được Claude Code gọi
 * theo sự kiện (xem hooks.json) và:
 *   - ghi nhớ mode FE đang chạy trong phiên (marker theo session_id);
 *   - chặn agent không phải developer sửa source (luật theo vai, không cần marker);
 *   - chặn cook/bugfix/quick sửa source khi gate của task chưa mở;
 *   - hỏi xác nhận người dùng khi agent tự bật `human_override: true`;
 *   - không cho mode kết thúc khi workflow-status.md chưa được cập nhật hợp lệ;
 *   - ghi sự kiện (mở/kết thúc mode, bị chặn, bị từ chối sửa) vào tracking/run-log.jsonl của task.
 *
 * Mức thực thi qua biến môi trường FE_KIT_HOOKS: `off` | `warn` | `enforce`
 * (khi chạy `claude plugin eval`: EVAL_FE_KIT_HOOKS, xem `level()`).
 *
 * Nguyên tắc an toàn: mọi lỗi nội bộ đều thoát 0 và không in gì — hook hỏng
 * không được làm hỏng phiên làm việc của người dùng.
 *
 * File được esbuild bundle (kèm validators) vào plugins/fe/hooks/.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseFrontMatterLoose,
  countOpenBlockingQuestions,
  evaluateModeEntry,
  normalizeCommand,
  evaluateModeCompletion,
  scopeDiffForTask,
  listChangedFiles,
  snapshotFiles,
  filesTouchedSince,
  resolveTaskDir,
  relativePosix,
  isPathInside,
  COMMANDS,
  SOURCE_EDIT_COMMANDS,
  AGENT_FOR_COMMAND,
  SOURCE_EDIT_AGENT,
  KIT_WRITABLE_PREFIXES,
  appendRunLog,
  hashSession,
} from '@frontend-delivery-kit/validators';

// esbuild `define` thay hằng này khi bundle; chạy trực tiếp từ source thì là 'dev'.
const KIT_VERSION = typeof __FE_KIT_VERSION__ !== 'undefined' ? __FE_KIT_VERSION__ : 'dev';

/** Mặc định khi không set FE_KIT_HOOKS. Đổi sang 'enforce' sau khi eval hành vi đạt ngưỡng. */
const DEFAULT_LEVEL = 'warn';

/** Marker cũ hơn ngưỡng này coi như mode đã bị bỏ dở, không còn hiệu lực. */
const MARKER_TTL_MS = 4 * 60 * 60 * 1000;

const KIT_AGENT_PREFIX = 'frontend-';

/**
 * `claude plugin eval` chỉ chuyển biến `EVAL_*` (cùng một allowlist) vào phiên
 * được đánh giá, nên `FE_KIT_HOOKS` của workflow eval không tới được hook.
 * `EVAL_FE_KIT_HOOKS` là kênh dành riêng cho eval; `FE_KIT_HOOKS` luôn thắng.
 */
function level() {
  const v = String(process.env.FE_KIT_HOOKS || process.env.EVAL_FE_KIT_HOOKS || '').trim().toLowerCase();
  return ['off', 'warn', 'enforce'].includes(v) ? v : DEFAULT_LEVEL;
}

function stateDir() {
  const base = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'fe-kit-hooks');
  return path.join(base, 'sessions');
}

function markerPath(sessionId) {
  return path.join(stateDir(), `${String(sessionId || 'unknown').replace(/[^A-Za-z0-9_.-]/g, '_')}.json`);
}

function readMarker(sessionId) {
  try {
    const m = JSON.parse(fs.readFileSync(markerPath(sessionId), 'utf8'));
    if (Date.now() - Number(m.startedAt || 0) > MARKER_TTL_MS) return null;
    return m;
  } catch {
    return null;
  }
}

function writeMarker(sessionId, marker) {
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(markerPath(sessionId), JSON.stringify(marker, null, 2));
}

/** `fe:frontend-planner` → `frontend-planner`; agent không thuộc kit → ''. */
function kitAgentName(agentType) {
  const name = String(agentType || '').replace(/^fe:/, '');
  return name.startsWith(KIT_AGENT_PREFIX) ? name : '';
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function warn(message) {
  emit({ systemMessage: `[FE-Kit cảnh báo] ${message}` });
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

/** Ghi một sự kiện vào run-log của task. Lỗi ghi log không bao giờ đổi quyết định của hook. */
function logEvent(payload, taskDir, event, fields = {}) {
  try {
    appendRunLog(taskDir, {
      event,
      source: 'hook',
      actor: 'claude',
      kit: KIT_VERSION,
      level: level(),
      session: hashSession(payload.session_id),
      ...fields,
    });
  } catch {
    // appendRunLog đã tự nuốt lỗi; lớp này chỉ để chắc chắn.
  }
}

function loadTask(taskDir) {
  const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
  const raw = readFileSafe(workflowPath);
  const loose = parseFrontMatterLoose(raw);
  const openBlockingQuestions = countOpenBlockingQuestions(
    readFileSafe(path.join(taskDir, 'planning', 'questions.md'))
  );
  return { workflowPath, raw, loose, data: loose.data, openBlockingQuestions };
}

// ---------------------------------------------------------------------------
// Bắt đầu mode
// ---------------------------------------------------------------------------

/** Nhận `/fe:cook <task>` hoặc `FE cook <task>` ở ĐẦU prompt. Neo đầu chuỗi để không dính câu "Tiếp theo: FE cook ..." trong báo cáo của agent. */
function parseFePrompt(prompt) {
  const m = String(prompt || '').match(/^\s*(?:\/fe:|FE\s+)([a-z-]+)(?:\s+(\S+))?/i);
  if (!m) return null;
  const command = normalizeCommand(m[1]);
  if (!command || !m[2]) return null;
  return { command, taskArg: m[2] };
}

/**
 * Ghi marker cho mode vừa bắt đầu.
 * @returns {{ marker: object, replaced: object | null } | null} `replaced` là marker
 *   của mode trước còn `pending` (chưa qua gate kết thúc) vừa bị thay thế.
 */
function beginMode(payload, { command, taskArg, workspace }) {
  if (!COMMANDS.includes(command)) return null;
  let taskDir;
  try {
    taskDir = resolveTaskDir(workspace, taskArg);
  } catch {
    return null;
  }

  const existing = readMarker(payload.session_id);
  if (existing && existing.status === 'pending' && existing.task === taskDir && existing.command === command) {
    return { marker: existing, replaced: null }; // cùng mode đang chạy (vd subagent gọi lại fe_begin_mode): giữ startedAt
  }
  const replaced = existing && existing.status === 'pending' ? existing : null;

  const marker = {
    task: taskDir,
    taskRef: relativePosix(workspace, taskDir),
    workspace,
    command,
    startedAt: Date.now(),
    status: 'pending',
    delegated: false,
    // path → dấu vân tay nội dung của file đang dirty lúc mở mode
    baseline: {},
  };
  if (SOURCE_EDIT_COMMANDS.includes(command)) {
    const changed = listChangedFiles({ cwd: workspace });
    if (changed.ok) marker.baseline = snapshotFiles(workspace, changed.files);
  }
  writeMarker(payload.session_id, marker);
  logEvent(payload, taskDir, 'mode_start', { mode: command });
  if (replaced) logEvent(payload, replaced.task, 'mode_abandoned', { mode: replaced.command, replaced_by: command });
  return { marker, replaced };
}

function replacedMessage(replaced) {
  return (
    `[FE-Kit cảnh báo] FE ${replaced.command} cho ${replaced.taskRef} chưa qua gate kết thúc mode thì đã bắt đầu lệnh FE khác. ` +
    `Kiểm tra lại tracking/workflow-status.md của ${replaced.taskRef} trước khi tiếp tục task đó.`
  );
}

function onPrompt(payload) {
  const parsed = parseFePrompt(payload.prompt);
  if (!parsed) return;
  const workspace = path.resolve(payload.cwd || process.cwd());
  const begun = beginMode(payload, { ...parsed, workspace });
  if (!begun) return;
  const { marker, replaced } = begun;
  const out = replaced ? { systemMessage: replacedMessage(replaced) } : {};

  // Đưa verdict của gate vào ngữ cảnh ngay từ đầu, không phụ thuộc việc model có gọi fe_begin_mode hay không.
  const { data, openBlockingQuestions, raw } = loadTask(marker.task);
  const entry = raw
    ? evaluateModeEntry({ requested: marker.command, data, openBlockingQuestions, taskRef: marker.taskRef })
    : { allowed: true };
  if (!entry.allowed) {
    logEvent(payload, marker.task, 'entry_blocked', { mode: marker.command, codes: entry.reasonCodes });
    out.hookSpecificOutput = {
      hookEventName: payload.hook_event_name,
      additionalContext:
        `[FE-Kit gate] FE ${marker.command} đang BỊ CHẶN cho ${marker.taskRef}: ${entry.reasons.join(' ')} ` +
        `Không sửa source. Cập nhật tracking/workflow-status.md và route sang: ${entry.redirect}`,
    };
  }
  if (Object.keys(out).length) emit(out);
}

function onBeginModeTool(payload) {
  const input = payload.tool_input || {};
  const command = normalizeCommand(input.mode);
  if (!command || !input.task_folder) return;
  const workspace = path.resolve(input.workspace_root || payload.cwd || process.cwd());
  const begun = beginMode(payload, { command, taskArg: input.task_folder, workspace });
  if (begun?.replaced) emit({ systemMessage: replacedMessage(begun.replaced) });
}

// ---------------------------------------------------------------------------
// PreToolUse
// ---------------------------------------------------------------------------

function decide(payload, decision, reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  });
}

/**
 * @param {object} [log] ghi run-log khi biết task: `{ taskDir, mode, codes, file }`
 */
function denyOrWarn(payload, reason, log) {
  const enforce = level() === 'enforce';
  if (log?.taskDir) {
    logEvent(payload, log.taskDir, enforce ? 'edit_denied' : 'edit_warned', {
      mode: log.mode,
      agent: kitAgentName(payload.agent_type) || undefined,
      codes: log.codes,
      file: log.file,
    });
  }
  if (enforce) decide(payload, 'deny', reason);
  else warn(reason);
}

function onDelegate(payload) {
  const marker = readMarker(payload.session_id);
  if (!marker || marker.status !== 'pending') return;
  const target = kitAgentName(payload.tool_input?.subagent_type);
  if (target && target === AGENT_FOR_COMMAND[marker.command]) {
    writeMarker(payload.session_id, { ...marker, delegated: true });
  }
}

/** Edit/Write này có bật `human_override: true` mà trước đó chưa bật không. */
function turnsOnHumanOverride(filePath, toolInput) {
  if (!/tracking[\\/]workflow-status\.md$/i.test(filePath)) return false;
  const incoming = [toolInput.content, toolInput.new_string, ...(toolInput.edits || []).map((e) => e?.new_string)]
    .filter(Boolean)
    .join('\n');
  if (!/^\s*human_override:\s*true\b/im.test(incoming)) return false;
  return parseFrontMatterLoose(readFileSafe(filePath)).data.human_override !== true;
}

function onPreEdit(payload) {
  const toolInput = payload.tool_input || {};
  const rawPath = toolInput.file_path || toolInput.notebook_path;
  if (!rawPath) return;

  const marker = readMarker(payload.session_id);
  const workspace = marker?.workspace || path.resolve(payload.cwd || process.cwd());
  const filePath = path.resolve(workspace, rawPath);
  if (!isPathInside(workspace, filePath)) return; // file ngoài repo (plan, memory, scratch) không thuộc phạm vi kit

  if (turnsOnHumanOverride(filePath, toolInput)) {
    // filePath = <task>/tracking/workflow-status.md
    logEvent(payload, path.dirname(path.dirname(filePath)), 'override_requested', {
      mode: marker?.status === 'pending' ? marker.command : undefined,
    });
    decide(
      payload,
      'ask',
      'Agent đang bật human_override: true trong workflow-status.md. Field này bỏ qua gate của FE-Kit nên cần người dùng xác nhận.'
    );
    return;
  }

  const rel = relativePosix(workspace, filePath);
  if (KIT_WRITABLE_PREFIXES.some((prefix) => rel.startsWith(prefix))) return;

  // Luật theo vai — không cần marker, nên vẫn đúng khi agent được delegate chủ động.
  const agent = kitAgentName(payload.agent_type);
  if (agent && agent !== SOURCE_EDIT_AGENT) {
    const active = marker?.status === 'pending' ? marker : null;
    denyOrWarn(
      payload,
      `Agent ${agent} không được sửa source (${rel}). Chỉ ${SOURCE_EDIT_AGENT} trong FE cook/bugfix/quick được sửa code; hãy ghi phát hiện vào artifact của task trong docs/frontend-tasks/.`,
      { taskDir: active?.task, mode: active?.command, codes: ['EDIT_ROLE_FORBIDDEN'], file: rel }
    );
    return;
  }

  // Luật theo gate của task — chỉ áp dụng cho mode được phép sửa source.
  if (!marker || marker.status !== 'pending' || !SOURCE_EDIT_COMMANDS.includes(marker.command)) return;
  const { data, openBlockingQuestions, raw } = loadTask(marker.task);
  if (!raw) return;
  // quick không cần build_ready của plan đầy đủ, chỉ cần không còn blocker.
  const requested = marker.command === 'quick' ? 'quick' : marker.command;
  const entry = evaluateModeEntry({ requested, data, openBlockingQuestions, taskRef: marker.taskRef });
  if (entry.allowed) return;
  denyOrWarn(
    payload,
    `FE ${marker.command} chưa được sửa source cho ${marker.taskRef}: ${entry.reasons.join(' ')} Prompt đúng: ${entry.redirect}. ` +
      '(Nếu mode này đã bị huỷ, chạy lệnh FE khác hoặc đặt FE_KIT_HOOKS=off.)',
    { taskDir: marker.task, mode: marker.command, codes: ['EDIT_GATE_CLOSED', ...entry.reasonCodes], file: rel }
  );
}

// ---------------------------------------------------------------------------
// Stop / SubagentStop
// ---------------------------------------------------------------------------

/** Marker từ v2.0.x chỉ lưu danh sách path (`baselineChanged`): khi đó chỉ so theo path như trước. */
function baselineOf(marker) {
  if (marker.baseline && typeof marker.baseline === 'object') return marker.baseline;
  return Object.fromEntries((marker.baselineChanged || []).map((f) => [f, 'skipped']));
}

/**
 * Lý do mode chưa được coi là xong (rỗng = đạt), mỗi lý do kèm reason code.
 * Gate chung nằm ở `evaluateModeCompletion`; hook chỉ thêm phần chỉ hook biết:
 * file đã dirty từ trước khi mở mode mà bị sửa thêm ngoài plan.
 * @returns {{ code: string, message: string }[]}
 */
function completionProblems(marker) {
  let scope;
  const extraIssues = [];
  if (SOURCE_EDIT_COMMANDS.includes(marker.command)) {
    const changed = listChangedFiles({ cwd: marker.workspace });
    if (changed.ok) {
      const { touched, preDirtyTouched } = filesTouchedSince(marker.workspace, baselineOf(marker), changed.files);
      const diff = scopeDiffForTask(marker.task, { repoRoot: marker.workspace, changedFiles: touched });
      if (diff && !diff.plannedEmpty) {
        scope = diff;
        const userFiles = diff.outOfPlan.filter((f) => preDirtyTouched.includes(f));
        if (userFiles.length) {
          extraIssues.push({
            code: 'END_PREDIRTY_OUT_OF_PLAN',
            message:
              `Các file sau đã có thay đổi chưa commit của người dùng từ trước FE ${marker.command} và bị sửa thêm trong mode này, ngoài plan: ${userFiles.join(', ')}. ` +
              'Không hoàn tác thay đổi gốc của người dùng; chỉ gỡ phần mode này đã sửa, hoặc cập nhật plan qua input-sync.',
          });
        }
      }
    }
  }
  return evaluateModeCompletion({
    taskDir: marker.task,
    taskRef: marker.taskRef,
    command: marker.command,
    startedAt: Number(marker.startedAt || 0),
    scope,
    extraIssues,
  }).issues;
}

function finishMode(payload, marker) {
  const problems = completionProblems(marker);
  // Lần kiểm thứ mấy của mode này: tăng mỗi lần hook chặn kết thúc.
  const attempt = (marker.blocks || 0) + 1;
  const logEnd = (outcome) =>
    logEvent(payload, marker.task, 'mode_end', {
      mode: marker.command,
      agent: kitAgentName(payload.agent_type) || undefined,
      outcome,
      attempt,
      duration_ms: Math.max(0, Date.now() - Number(marker.startedAt || 0)),
      codes: [...new Set(problems.map((p) => p.code))],
    });

  if (!problems.length) {
    writeMarker(payload.session_id, { ...marker, status: 'done' });
    logEnd('pass');
    return;
  }

  const messages = problems.map((p) => p.message);
  const reason =
    `FE ${marker.command} cho ${marker.taskRef} chưa đạt gate kết thúc mode:\n- ${messages.join('\n- ')}\n` +
    'Sửa các điểm trên (cập nhật artifact và tracking/workflow-status.md) rồi mới kết thúc.';

  // Đã bị chặn một lần mà vẫn chưa đạt: thả ra để tránh vòng lặp, nhưng báo cho người dùng.
  if (level() !== 'enforce' || payload.stop_hook_active) {
    writeMarker(payload.session_id, { ...marker, status: 'done', unresolved: messages });
    logEnd('released');
    warn(reason);
    return;
  }
  writeMarker(payload.session_id, { ...marker, blocks: attempt });
  logEnd('blocked');
  emit({ decision: 'block', reason });
}

function onSubagentStop(payload) {
  const marker = readMarker(payload.session_id);
  if (!marker || marker.status !== 'pending') return;
  const agent = kitAgentName(payload.agent_type);
  if (!agent || agent !== AGENT_FOR_COMMAND[marker.command]) return;
  finishMode(payload, marker);
}

function onStop(payload) {
  const marker = readMarker(payload.session_id);
  if (!marker || marker.status !== 'pending') return;
  if (marker.delegated) return; // SubagentStop chịu trách nhiệm
  finishMode(payload, marker);
}

// ---------------------------------------------------------------------------

const HANDLERS = {
  UserPromptSubmit: onPrompt,
  UserPromptExpansion: onPrompt,
  PostToolUse: onBeginModeTool,
  PreToolUse(payload) {
    if (/^(Agent|Task)$/.test(payload.tool_name || '')) onDelegate(payload);
    else onPreEdit(payload);
  },
  SubagentStop: onSubagentStop,
  Stop: onStop,
};

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

try {
  const raw = readStdin();
  if (process.env.FE_KIT_HOOKS_DEBUG) {
    fs.appendFileSync(process.env.FE_KIT_HOOKS_DEBUG, raw.trim() + '\n');
  }
  if (level() !== 'off') {
    const payload = JSON.parse(raw || '{}');
    const handler = HANDLERS[payload.hook_event_name || process.argv[2]];
    if (handler) handler(payload);
  }
} catch (err) {
  if (process.env.FE_KIT_HOOKS_DEBUG) {
    fs.appendFileSync(process.env.FE_KIT_HOOKS_DEBUG, `ERROR ${err.stack || err}\n`);
  }
}
process.exit(0);
