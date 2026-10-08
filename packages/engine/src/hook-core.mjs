/**
 * Hook runtime chung — lớp gate "cứng" khi agent đang chạy. Claude Code gọi
 * script hook của plugin theo sự kiện (xem hooks.json của pack); script đó chỉ
 * gọi `runHook(pack)`. Hook:
 *   - ghi nhớ mode đang chạy trong phiên (marker theo session_id);
 *   - chặn agent không phải agent sửa source của pack sửa source (luật theo vai, không cần marker);
 *   - chặn mode sửa source khi gate của task chưa mở;
 *   - hỏi xác nhận người dùng khi agent tự bật `human_override: true`;
 *   - không cho mode kết thúc khi file trạng thái chưa được cập nhật hợp lệ;
 *   - ghi sự kiện (mở/kết thúc mode, bị chặn, bị từ chối sửa) vào run-log của task;
 *   - cảnh báo lệnh shell trông như ghi file của agent không phải agent sửa
 *     source, và không cho mode chỉ đọc kết thúc khi file source bị đổi.
 *
 * Mức thực thi qua biến môi trường `<envPrefix>_HOOKS`: `off` | `warn` | `enforce`
 * (khi chạy `claude plugin eval`: `EVAL_<envPrefix>_HOOKS`, xem `level()`).
 *
 * Nguyên tắc an toàn: mọi lỗi nội bộ đều thoát 0 và không in gì — hook hỏng
 * không được làm hỏng phiên làm việc của người dùng.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseFrontMatterLoose } from './frontmatter.mjs';
import { relativePosix, isPathInside } from './paths.mjs';
import { listChangedFiles, snapshotFiles, filesTouchedSince } from './scope.mjs';
import { appendRunLog, hashSession } from './runlog.mjs';

/** Mặc định khi không set `<envPrefix>_HOOKS`. Đổi sang 'enforce' sau khi eval hành vi đạt ngưỡng. */
const DEFAULT_LEVEL = 'warn';

/** Marker cũ hơn ngưỡng này coi như mode đã bị bỏ dở, không còn hiệu lực. */
const MARKER_TTL_MS = 4 * 60 * 60 * 1000;

/** Lệnh shell trông như ghi/xoá/khôi phục file. Chỉ dùng để cảnh báo sớm; kiểm chính là so nội dung file khi kết thúc mode. */
const SHELL_WRITE =
  /(^|[;&|(]\s*)(rm|mv|cp|tee|touch|truncate|dd)\s|(^|[^0-9&>=-])>>?\s*(?!\/dev\/null|&|nul\b)[^\s&|;=]|\bsed\s+(-[a-z]*i|--in-place)|\bgit\s+(checkout|restore|reset|apply|stash|clean)\b|\b(Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|New-Item)\b/i;

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {object} pack domain pack (xem `fePack` trong validators)
 * @param {{ version?: string }} [opts]
 * @returns {Record<string, (payload: object) => void>} handler theo tên sự kiện
 */
export function createHookHandlers(pack, { version = 'dev' } = {}) {
  const env = (name) => process.env[`${pack.envPrefix}_${name}`];
  const statusName = path.posix.basename(pack.statusFile);
  const promptRe = new RegExp(`^\\s*(?:\\/${escapeRe(pack.pluginName)}:|${escapeRe(pack.promptPrefix)}\\s+)([a-z-]+)(?:\\s+(\\S+))?`, 'i');
  const statusFileRe = new RegExp(`${pack.statusFile.split('/').map(escapeRe).join('[\\\\/]')}$`, 'i');
  const pluginAgentRe = new RegExp(`^${escapeRe(pack.pluginName)}:`);

  /**
   * `claude plugin eval` chỉ chuyển biến `EVAL_*` (cùng một allowlist) vào phiên
   * được đánh giá, nên `<envPrefix>_HOOKS` của workflow eval không tới được hook.
   * `EVAL_<envPrefix>_HOOKS` là kênh dành riêng cho eval; biến chính luôn thắng.
   */
  function level() {
    const v = String(env('HOOKS') || process.env[`EVAL_${pack.envPrefix}_HOOKS`] || '').trim().toLowerCase();
    return ['off', 'warn', 'enforce'].includes(v) ? v : DEFAULT_LEVEL;
  }

  function stateDir() {
    const base = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), `${pack.id}-kit-hooks`);
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

  /** `<plugin>:<agent>` → `<agent>`; agent không thuộc pack → ''. */
  function kitAgentName(agentType) {
    const name = String(agentType || '').replace(pluginAgentRe, '');
    return name.startsWith(pack.agentPrefix) ? name : '';
  }

  function emit(obj) {
    process.stdout.write(JSON.stringify(obj));
  }

  function warn(message) {
    emit({ systemMessage: `[${pack.displayName} cảnh báo] ${message}` });
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
        pack: pack.id,
        event,
        source: 'hook',
        actor: 'claude',
        kit: version,
        level: level(),
        session: hashSession(payload.session_id),
        ...fields,
      });
    } catch {
      // appendRunLog đã tự nuốt lỗi; lớp này chỉ để chắc chắn.
    }
  }

  function loadTask(taskDir) {
    const raw = readFileSafe(path.join(taskDir, pack.statusFile));
    const loose = parseFrontMatterLoose(raw);
    const inputs = pack.entryInputs({ data: loose.data, read: (rel) => readFileSafe(path.join(taskDir, rel)) });
    return { raw, loose, data: loose.data, inputs };
  }

  // -------------------------------------------------------------------------
  // Bắt đầu mode
  // -------------------------------------------------------------------------

  /** Nhận `/<plugin>:<mode> <task>` hoặc `<prefix> <mode> <task>` ở ĐẦU prompt. Neo đầu chuỗi để không dính câu "Tiếp theo: ..." trong báo cáo của agent. */
  function parseModePrompt(prompt) {
    const m = String(prompt || '').match(promptRe);
    if (!m) return null;
    const command = pack.normalizeCommand(m[1]);
    if (!command || !m[2]) return null;
    return { command, taskArg: m[2] };
  }

  /**
   * Ghi marker cho mode vừa bắt đầu.
   * @returns {{ marker: object, replaced: object | null } | null} `replaced` là marker
   *   của mode trước còn `pending` (chưa qua gate kết thúc) vừa bị thay thế.
   */
  function beginMode(payload, { command, taskArg, workspace }) {
    if (!pack.commands.includes(command)) return null;
    let taskDir;
    try {
      taskDir = pack.resolveTaskDir(workspace, taskArg);
    } catch {
      return null;
    }

    const existing = readMarker(payload.session_id);
    if (existing && existing.status === 'pending' && existing.task === taskDir && existing.command === command) {
      return { marker: existing, replaced: null }; // cùng mode đang chạy (vd subagent gọi lại tool mở mode): giữ startedAt
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
    // Chụp mọi mode: mode sửa source cần để tách thay đổi có sẵn của người dùng,
    // mode chỉ đọc cần để phát hiện source bị đổi qua shell.
    const changed = listChangedFiles({ cwd: workspace });
    if (changed.ok) marker.baseline = snapshotFiles(workspace, changed.files);
    writeMarker(payload.session_id, marker);
    logEvent(payload, taskDir, 'mode_start', { mode: command });
    if (replaced) logEvent(payload, replaced.task, 'mode_abandoned', { mode: replaced.command, replaced_by: command });
    return { marker, replaced };
  }

  function replacedMessage(replaced) {
    return (
      `[${pack.displayName} cảnh báo] ${pack.label(replaced.command)} cho ${replaced.taskRef} chưa qua gate kết thúc mode thì đã bắt đầu lệnh ${pack.promptPrefix} khác. ` +
      `Kiểm tra lại ${pack.statusFile} của ${replaced.taskRef} trước khi tiếp tục task đó.`
    );
  }

  function onPrompt(payload) {
    const parsed = parseModePrompt(payload.prompt);
    if (!parsed) return;
    const workspace = path.resolve(payload.cwd || process.cwd());
    const begun = beginMode(payload, { ...parsed, workspace });
    if (!begun) return;
    const { marker, replaced } = begun;
    const out = replaced ? { systemMessage: replacedMessage(replaced) } : {};

    // Đưa verdict của gate vào ngữ cảnh ngay từ đầu, không phụ thuộc việc model có gọi tool mở mode hay không.
    const { data, inputs, raw } = loadTask(marker.task);
    const entry = raw ? pack.evaluateModeEntry({ requested: marker.command, data, ...inputs, taskRef: marker.taskRef }) : { allowed: true };
    if (!entry.allowed) {
      logEvent(payload, marker.task, 'entry_blocked', { mode: marker.command, codes: entry.reasonCodes });
      out.hookSpecificOutput = {
        hookEventName: payload.hook_event_name,
        additionalContext:
          `[${pack.displayName} gate] ${pack.label(marker.command)} đang BỊ CHẶN cho ${marker.taskRef}: ${entry.reasons.join(' ')} ` +
          `Không sửa source. Cập nhật ${pack.statusFile} và route sang: ${entry.redirect}`,
      };
    }
    if (Object.keys(out).length) emit(out);
  }

  function onBeginModeTool(payload) {
    const input = payload.tool_input || {};
    const command = pack.normalizeCommand(input.mode);
    if (!command || !input.task_folder) return;
    const workspace = path.resolve(input.workspace_root || payload.cwd || process.cwd());
    const begun = beginMode(payload, { command, taskArg: input.task_folder, workspace });
    if (begun?.replaced) emit({ systemMessage: replacedMessage(begun.replaced) });
  }

  // -------------------------------------------------------------------------
  // PreToolUse
  // -------------------------------------------------------------------------

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
    if (target && target === pack.agentFor[marker.command]) {
      writeMarker(payload.session_id, { ...marker, delegated: true });
    }
  }

  /** Edit/Write này có bật `human_override: true` mà trước đó chưa bật không. */
  function turnsOnHumanOverride(filePath, toolInput) {
    if (!statusFileRe.test(filePath)) return false;
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
      // filePath = <task>/<statusFile>
      const taskDir = pack.statusFile.split('/').reduce((dir) => path.dirname(dir), filePath);
      logEvent(payload, taskDir, 'override_requested', {
        mode: marker?.status === 'pending' ? marker.command : undefined,
      });
      decide(
        payload,
        'ask',
        `Agent đang bật human_override: true trong ${statusName}. Field này bỏ qua gate của ${pack.displayName} nên cần người dùng xác nhận.`
      );
      return;
    }

    const rel = relativePosix(workspace, filePath);
    if (pack.writablePrefixes.some((prefix) => rel.startsWith(prefix))) return;

    // Luật theo vai — không cần marker, nên vẫn đúng khi agent được delegate chủ động.
    const agent = kitAgentName(payload.agent_type);
    if (agent && agent !== pack.sourceEditAgent) {
      const active = marker?.status === 'pending' ? marker : null;
      denyOrWarn(
        payload,
        `Agent ${agent} không được sửa source (${rel}). Chỉ ${pack.sourceEditAgent} trong ${pack.label(pack.sourceEditCommands.join('/'))} được sửa code; hãy ghi phát hiện vào artifact của task trong ${pack.tasksRoot}/.`,
        { taskDir: active?.task, mode: active?.command, codes: ['EDIT_ROLE_FORBIDDEN'], file: rel }
      );
      return;
    }

    // Luật theo gate của task — chỉ áp dụng cho mode được phép sửa source.
    if (!marker || marker.status !== 'pending' || !pack.sourceEditCommands.includes(marker.command)) return;
    const { data, inputs, raw } = loadTask(marker.task);
    if (!raw) return;
    const entry = pack.evaluateModeEntry({
      requested: marker.command,
      data,
      openBlockingQuestions: inputs.openBlockingQuestions,
      taskRef: marker.taskRef,
    });
    if (entry.allowed) return;
    denyOrWarn(
      payload,
      `${pack.label(marker.command)} chưa được sửa source cho ${marker.taskRef}: ${entry.reasons.join(' ')} Prompt đúng: ${entry.redirect}. ` +
        `(Nếu mode này đã bị huỷ, chạy lệnh ${pack.promptPrefix} khác hoặc đặt ${pack.envPrefix}_HOOKS=off.)`,
      { taskDir: marker.task, mode: marker.command, codes: ['EDIT_GATE_CLOSED', ...entry.reasonCodes], file: rel }
    );
  }

  function shellGuardEnabled() {
    return String(env('BASH_GUARD') || '').trim().toLowerCase() !== 'off';
  }

  /** Agent của pack không phải agent sửa source chạy lệnh shell trông như ghi file: chỉ cảnh báo. */
  function onShell(payload) {
    if (!shellGuardEnabled()) return;
    const agent = kitAgentName(payload.agent_type);
    if (!agent || agent === pack.sourceEditAgent) return;
    const command = String(payload.tool_input?.command || '');
    if (!SHELL_WRITE.test(command)) return;
    const marker = readMarker(payload.session_id);
    if (marker?.status === 'pending') {
      logEvent(payload, marker.task, 'edit_warned', { mode: marker.command, agent, codes: ['SHELL_WRITE_SUSPECTED'] });
    }
    warn(
      `Agent ${agent} đang chạy lệnh shell có thể ghi file. Agent này không được sửa source; chỉ ghi artifact trong ${pack.tasksRoot}/. ` +
        'Source bị đổi trong mode sẽ bị chặn khi kết thúc mode.'
    );
  }

  // -------------------------------------------------------------------------
  // Stop / SubagentStop
  // -------------------------------------------------------------------------

  /** Marker từ v2.0.x chỉ lưu danh sách path (`baselineChanged`): khi đó chỉ so theo path như trước. */
  function baselineOf(marker) {
    if (marker.baseline && typeof marker.baseline === 'object') return marker.baseline;
    return Object.fromEntries((marker.baselineChanged || []).map((f) => [f, 'skipped']));
  }

  /**
   * File source (theo `source_paths` trong cấu hình repo của pack) bị đổi kể từ
   * lúc mở mode. Marker cũ không có baseline (mở trước v2.3.0) thì bỏ qua.
   */
  function sourceTouchedInReadOnlyMode(marker) {
    if (!marker.baseline || typeof marker.baseline !== 'object') return [];
    const changed = listChangedFiles({ cwd: marker.workspace });
    if (!changed.ok) return [];
    const { touched } = filesTouchedSince(marker.workspace, marker.baseline, changed.files);
    const { source_paths: sourcePaths } = pack.loadProjectConfig(marker.workspace).config;
    return touched.filter((f) => !pack.writablePrefixes.some((p) => f.startsWith(p)) && sourcePaths.some((p) => f.startsWith(p)));
  }

  /**
   * Lý do mode chưa được coi là xong (rỗng = đạt), mỗi lý do kèm reason code.
   * Gate chung nằm ở `evaluateModeCompletion`; hook chỉ thêm phần chỉ hook biết:
   * source bị đổi trong mode chỉ đọc, và file đã dirty từ trước bị sửa thêm ngoài plan.
   * @returns {{ code: string, message: string }[]}
   */
  function completionProblems(marker) {
    let scope;
    const extraIssues = [];
    if (!pack.sourceEditCommands.includes(marker.command)) {
      const touched = sourceTouchedInReadOnlyMode(marker);
      if (touched.length) {
        extraIssues.push({
          code: 'END_SOURCE_TOUCHED_IN_READONLY_MODE',
          message:
            `${pack.label(marker.command)} không được sửa source, nhưng các file sau đã bị đổi trong mode này: ${touched.join(', ')}. ` +
            `Hoàn tác phần mode này đã sửa (không đụng thay đổi có sẵn của người dùng) và ghi phát hiện vào artifact để route ${pack.sourceFixRoute}.`,
        });
      }
    } else {
      const changed = listChangedFiles({ cwd: marker.workspace });
      if (changed.ok) {
        const { touched, preDirtyTouched } = filesTouchedSince(marker.workspace, baselineOf(marker), changed.files);
        const diff = pack.scopeDiffForTask(marker.task, { repoRoot: marker.workspace, changedFiles: touched });
        if (diff && !diff.plannedEmpty) {
          scope = diff;
          const userFiles = diff.outOfPlan.filter((f) => preDirtyTouched.includes(f));
          if (userFiles.length) {
            extraIssues.push({
              code: 'END_PREDIRTY_OUT_OF_PLAN',
              message:
                `Các file sau đã có thay đổi chưa commit của người dùng từ trước ${pack.label(marker.command)} và bị sửa thêm trong mode này, ngoài plan: ${userFiles.join(', ')}. ` +
                `Không hoàn tác thay đổi gốc của người dùng; chỉ gỡ phần mode này đã sửa, hoặc cập nhật plan qua ${pack.planUpdateRoute}.`,
            });
          }
        }
      }
    }
    return pack.evaluateModeCompletion({
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
      `${pack.label(marker.command)} cho ${marker.taskRef} chưa đạt gate kết thúc mode:\n- ${messages.join('\n- ')}\n` +
      `Sửa các điểm trên (cập nhật artifact và ${pack.statusFile}) rồi mới kết thúc.`;

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
    if (!agent || agent !== pack.agentFor[marker.command]) return;
    finishMode(payload, marker);
  }

  function onStop(payload) {
    const marker = readMarker(payload.session_id);
    if (!marker || marker.status !== 'pending') return;
    if (marker.delegated) return; // SubagentStop chịu trách nhiệm
    finishMode(payload, marker);
  }

  return {
    level,
    handlers: {
      UserPromptSubmit: onPrompt,
      UserPromptExpansion: onPrompt,
      PostToolUse: onBeginModeTool,
      PreToolUse(payload) {
        if (/^(Agent|Task)$/.test(payload.tool_name || '')) onDelegate(payload);
        else if (/^(Bash|PowerShell)$/.test(payload.tool_name || '')) onShell(payload);
        else onPreEdit(payload);
      },
      SubagentStop: onSubagentStop,
      Stop: onStop,
    },
  };
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Điểm vào của script hook: đọc payload từ stdin, chạy handler của sự kiện,
 * luôn thoát 0.
 * @param {object} pack
 * @param {{ version?: string }} [opts]
 */
export function runHook(pack, opts = {}) {
  const debugFile = process.env[`${pack.envPrefix}_HOOKS_DEBUG`];
  try {
    const raw = readStdin();
    if (debugFile) fs.appendFileSync(debugFile, raw.trim() + '\n');
    const { level, handlers } = createHookHandlers(pack, opts);
    if (level() !== 'off') {
      const payload = JSON.parse(raw || '{}');
      const handler = handlers[payload.hook_event_name || process.argv[2]];
      if (handler) handler(payload);
    }
  } catch (err) {
    if (debugFile) fs.appendFileSync(debugFile, `ERROR ${err.stack || err}\n`);
  }
  process.exit(0);
}
