/**
 * Hook runtime của Frontend Delivery Kit — lớp gate "cứng" khi agent đang chạy.
 *
 * Trước v2.0.0 mọi gate chỉ nằm trong prompt. Script này được Claude Code gọi
 * theo sự kiện (xem hooks.json) và:
 *   - ghi nhớ mode FE đang chạy trong phiên (marker theo session_id);
 *   - chặn agent không phải developer sửa source (luật theo vai, không cần marker);
 *   - chặn cook/bugfix/quick sửa source khi gate của task chưa mở;
 *   - hỏi xác nhận người dùng khi agent tự bật `human_override: true`;
 *   - không cho mode kết thúc khi workflow-status.md chưa được cập nhật hợp lệ.
 *
 * Mức thực thi qua biến môi trường FE_KIT_HOOKS: `off` | `warn` | `enforce`.
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
  validateWorkflow,
  scopeDiffForTask,
  listChangedFiles,
  resolveTaskDir,
  relativePosix,
  isPathInside,
  COMMAND_TO_MODE,
  COMMANDS,
  SOURCE_EDIT_COMMANDS,
  MODE_REQUIRED_ARTIFACTS,
  AGENT_FOR_COMMAND,
  SOURCE_EDIT_AGENT,
  KIT_WRITABLE_PREFIXES,
} from '@frontend-delivery-kit/validators';

/** Mặc định khi không set FE_KIT_HOOKS. Đổi sang 'enforce' sau khi eval hành vi đạt ngưỡng. */
const DEFAULT_LEVEL = 'warn';

/** Marker cũ hơn ngưỡng này coi như mode đã bị bỏ dở, không còn hiệu lực. */
const MARKER_TTL_MS = 4 * 60 * 60 * 1000;

const KIT_AGENT_PREFIX = 'frontend-';

function level() {
  const v = String(process.env.FE_KIT_HOOKS || '').trim().toLowerCase();
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
    return existing; // cùng mode đang chạy (vd subagent gọi lại fe_begin_mode): giữ startedAt
  }

  const marker = {
    task: taskDir,
    taskRef: relativePosix(workspace, taskDir),
    workspace,
    command,
    startedAt: Date.now(),
    status: 'pending',
    delegated: false,
    baselineChanged: [],
  };
  if (SOURCE_EDIT_COMMANDS.includes(command)) {
    const changed = listChangedFiles({ cwd: workspace });
    if (changed.ok) marker.baselineChanged = changed.files;
  }
  writeMarker(payload.session_id, marker);
  return marker;
}

function onPrompt(payload) {
  const parsed = parseFePrompt(payload.prompt);
  if (!parsed) return;
  const workspace = path.resolve(payload.cwd || process.cwd());
  const marker = beginMode(payload, { ...parsed, workspace });
  if (!marker) return;

  // Đưa verdict của gate vào ngữ cảnh ngay từ đầu, không phụ thuộc việc model có gọi fe_begin_mode hay không.
  const { data, openBlockingQuestions, raw } = loadTask(marker.task);
  if (!raw) return;
  const entry = evaluateModeEntry({ requested: marker.command, data, openBlockingQuestions, taskRef: marker.taskRef });
  if (entry.allowed) return;
  emit({
    hookSpecificOutput: {
      hookEventName: payload.hook_event_name,
      additionalContext:
        `[FE-Kit gate] FE ${marker.command} đang BỊ CHẶN cho ${marker.taskRef}: ${entry.reasons.join(' ')} ` +
        `Không sửa source. Cập nhật tracking/workflow-status.md và route sang: ${entry.redirect}`,
    },
  });
}

function onBeginModeTool(payload) {
  const input = payload.tool_input || {};
  const command = normalizeCommand(input.mode);
  if (!command || !input.task_folder) return;
  const workspace = path.resolve(input.workspace_root || payload.cwd || process.cwd());
  beginMode(payload, { command, taskArg: input.task_folder, workspace });
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

function denyOrWarn(payload, reason) {
  if (level() === 'enforce') decide(payload, 'deny', reason);
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
    denyOrWarn(
      payload,
      `Agent ${agent} không được sửa source (${rel}). Chỉ ${SOURCE_EDIT_AGENT} trong FE cook/bugfix/quick được sửa code; hãy ghi phát hiện vào artifact của task trong docs/frontend-tasks/.`
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
      '(Nếu mode này đã bị huỷ, chạy lệnh FE khác hoặc đặt FE_KIT_HOOKS=off.)'
  );
}

// ---------------------------------------------------------------------------
// Stop / SubagentStop
// ---------------------------------------------------------------------------

/** Trả về danh sách lý do mode chưa được coi là xong (rỗng = đạt). */
function completionProblems(marker) {
  const problems = [];
  const { workflowPath, raw, loose, data, openBlockingQuestions } = loadTask(marker.task);

  if (!raw) return [`Chưa có ${marker.taskRef}/tracking/workflow-status.md.`];
  if (!loose.hasFrontMatter || loose.error) {
    return [`tracking/workflow-status.md không parse được YAML frontmatter${loose.error ? `: ${loose.error}` : '.'}`];
  }

  // Mode bị gate từ chối: không đòi artifact của mode, và không đòi sửa file
  // nếu workflow-status.md hiện có đã route đúng (ép sửa chỉ sinh thêm lỗi).
  const entry = evaluateModeEntry({ requested: marker.command, data, openBlockingQuestions, taskRef: marker.taskRef });
  if (!entry.allowed) {
    const refused = validateWorkflow(marker.task);
    if (refused.ok) return [];
    return [
      `FE ${marker.command} đang bị gate chặn (${entry.reasons.join(' ')}) nên không cần artifact của mode. Giữ nguyên current_mode; chỉ sửa workflow-status.md cho hợp lệ và route sang: ${entry.redirect}`,
      ...refused.errors,
    ];
  }

  let mtime = 0;
  try {
    mtime = fs.statSync(workflowPath).mtimeMs;
  } catch { /* đã kiểm tra tồn tại ở trên */ }
  if (mtime + 1000 < marker.startedAt) {
    problems.push('tracking/workflow-status.md chưa được cập nhật trong lượt này (không mode nào được kết thúc chỉ bằng chat).');
  }

  const expected = COMMAND_TO_MODE[marker.command];
  if (String(data.current_mode || '') !== expected) {
    problems.push(`current_mode trong workflow-status.md phải là ${expected} (đang là "${data.current_mode || ''}").`);
  }
  for (const rel of MODE_REQUIRED_ARTIFACTS[marker.command] || []) {
    if (!fs.existsSync(path.join(marker.task, rel))) problems.push(`Thiếu artifact bắt buộc của FE ${marker.command}: ${rel}`);
  }

  let scope;
  if (SOURCE_EDIT_COMMANDS.includes(marker.command)) {
    const changed = listChangedFiles({ cwd: marker.workspace });
    if (changed.ok) {
      const baseline = new Set(marker.baselineChanged || []);
      const delta = changed.files.filter((f) => !baseline.has(f));
      const diff = scopeDiffForTask(marker.task, { repoRoot: marker.workspace, changedFiles: delta });
      if (diff && !diff.plannedEmpty) scope = diff;
    }
  }

  const gates = validateWorkflow(marker.task, { scope });
  if (!gates.ok) problems.push(...gates.errors);
  return [...new Set(problems)];
}

function finishMode(payload, marker) {
  const problems = completionProblems(marker);
  if (!problems.length) {
    writeMarker(payload.session_id, { ...marker, status: 'done' });
    return;
  }

  const reason =
    `FE ${marker.command} cho ${marker.taskRef} chưa đạt gate kết thúc mode:\n- ${problems.join('\n- ')}\n` +
    'Sửa các điểm trên (cập nhật artifact và tracking/workflow-status.md) rồi mới kết thúc.';

  // Đã bị chặn một lần mà vẫn chưa đạt: thả ra để tránh vòng lặp, nhưng báo cho người dùng.
  if (level() !== 'enforce' || payload.stop_hook_active) {
    writeMarker(payload.session_id, { ...marker, status: 'done', unresolved: problems });
    warn(reason);
    return;
  }
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
