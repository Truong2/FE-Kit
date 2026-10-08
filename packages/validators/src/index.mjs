import fs from 'node:fs';
import path from 'node:path';
import { parseWorkflowStatus, parseFrontMatterLoose } from './parse.mjs';
import {
  evaluateWorkflowGates,
  evaluatePrGates,
  countOpenBlockingQuestions,
  hasCommandEvidence,
  summarizeCommandEvidence,
  realQuestionCell,
} from './gates.mjs';
import { WorkflowStatusSchema, GateStatus, CoreMode } from './schema.mjs';
import { computeScopeDiff, parsePlannedFiles, listChangedFiles, detectBaseRef } from './scope.mjs';
import { evaluateModeEntry, COMMAND_TO_MODE } from './transitions.mjs';
import { MODE_REQUIRED_ARTIFACTS } from './modes.mjs';

function taskIo(taskDir) {
  const exists = (rel) => fs.existsSync(path.join(taskDir, rel));
  const read = (rel) => {
    const p = path.join(taskDir, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };
  return { exists, read };
}

function loadWorkflow(taskDir) {
  const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
  if (!fs.existsSync(workflowPath)) {
    const errors = ['Thiếu tracking/workflow-status.md'];
    return { ok: false, errors, issues: [{ code: 'STATUS_MISSING', message: errors[0] }] };
  }
  const parsed = parseWorkflowStatus(fs.readFileSync(workflowPath, 'utf8'));
  if (parsed.ok) return parsed;
  return { ...parsed, issues: parsed.errors.map((message) => ({ code: 'STATUS_SCHEMA_INVALID', message })) };
}

/**
 * Tính scope diff của task từ git. Trả `null` khi không tính được (không có
 * git, không diff được base) để caller rơi về field tự khai.
 *
 * @param {string} taskDir
 * @param {{ repoRoot: string, base?: string, changedFiles?: string[] }} opts
 */
export function scopeDiffForTask(taskDir, { repoRoot, base = '', changedFiles } = {}) {
  let files = changedFiles;
  if (!files) {
    const changed = listChangedFiles({ cwd: repoRoot, base });
    if (!changed.ok) return null;
    files = changed.files;
  }
  const { read } = taskIo(taskDir);
  const plannedFiles = parsePlannedFiles(read('planning/implementation-plan.md'));
  const result = computeScopeDiff({ plannedFiles, changedFiles: files });

  // PR gộp nhiều task: file thuộc plan của task khác không tính là "ngoài plan" của task này.
  const otherPlanned = plannedFilesOfSiblingTasks(taskDir);
  if (otherPlanned.length && result.outOfPlan.length) {
    const others = computeScopeDiff({ plannedFiles: otherPlanned, changedFiles: result.outOfPlan, ignore: [] });
    result.outOfPlan = others.outOfPlan;
    result.otherTasks = others.inScope;
    result.ok = result.outOfPlan.length === 0;
  }
  return { ...result, plannedFiles };
}

/** File/glob khai trong plan của các task folder cùng cấp (docs/frontend-tasks/*). */
function plannedFilesOfSiblingTasks(taskDir) {
  const parent = path.dirname(taskDir);
  if (!fs.existsSync(parent)) return [];
  const self = path.basename(taskDir);
  const planned = [];
  for (const ent of fs.readdirSync(parent, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name === self) continue;
    const plan = path.join(parent, ent.name, 'planning', 'implementation-plan.md');
    if (fs.existsSync(plan)) planned.push(...parsePlannedFiles(fs.readFileSync(plan, 'utf8')));
  }
  return planned;
}

/**
 * Validate workflow-status.md của một task folder trên filesystem thật.
 * Đây là hàm CLI (`fe-kit validate-workflow`) và CI (`fe-kit doctor --strict`)
 * nên gọi trực tiếp — không tự viết lại logic đọc file.
 *
 * @param {string} taskDir đường dẫn tuyệt đối tới task folder
 * @param {{ scope?: object }} [opts] truyền `scope` (từ `scopeDiffForTask`) để kiểm tra file sửa ngoài plan
 * @returns {{ ok: boolean, errors: string[], issues: { code: string, message: string }[], warnings?: string[] }}
 */
export function validateWorkflow(taskDir, { scope } = {}) {
  const parsed = loadWorkflow(taskDir);
  if (!parsed.ok) return parsed;
  return evaluateWorkflowGates({ data: parsed.data, body: parsed.body, ...taskIo(taskDir), scope });
}

/**
 * Gate kết thúc mode: bản DUY NHẤT cho hook (`SubagentStop`/`Stop`) và CLI
 * `fe-kit mode end`.
 *
 * - Mode bị gate từ chối lúc vào: không đòi artifact; chỉ cần workflow-status.md
 *   hiện có route đúng (`refused: true`).
 * - Mode được chạy: workflow-status.md phải được sửa sau `startedAt` (nếu biết),
 *   `current_mode` đúng mode, đủ artifact bắt buộc, rồi qua validator.
 *
 * @param {object} p
 * @param {string} p.taskDir đường dẫn tuyệt đối tới task folder
 * @param {string} p.taskRef path task để in ra
 * @param {string} p.command lệnh đã chuẩn hoá
 * @param {number} [p.startedAt] thời điểm mở mode (ms)
 * @param {object} [p.scope] scope diff caller đã tính, truyền cho validator
 * @param {string} [p.repoRoot] có (và không truyền `scope`) thì validator tự tính scope như `validateWorkflowAtGate`
 * @param {string} [p.base] base ref cho `repoRoot`
 * @param {{ code: string, message: string }[]} [p.extraIssues] lỗi riêng của caller, xếp trước lỗi của validator
 * @returns {{ ok: boolean, refused: boolean, issues: { code: string, message: string }[], errors: string[] }}
 */
export function evaluateModeCompletion({ taskDir, taskRef, command, startedAt, scope, repoRoot, base, extraIssues = [] }) {
  const done = (issues, refused = false) => ({
    ok: issues.length === 0,
    refused,
    issues,
    errors: issues.map((i) => i.message),
  });
  const { read } = taskIo(taskDir);
  const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
  const raw = read('tracking/workflow-status.md');
  if (!raw) return done([{ code: 'END_STATUS_MISSING', message: `Chưa có ${taskRef}/tracking/workflow-status.md.` }]);
  const loose = parseFrontMatterLoose(raw);
  if (!loose.hasFrontMatter || loose.error) {
    return done([
      {
        code: 'END_STATUS_UNPARSEABLE',
        message: `tracking/workflow-status.md không parse được YAML frontmatter${loose.error ? `: ${loose.error}` : '.'}`,
      },
    ]);
  }
  const data = loose.data;

  // Mode bị gate từ chối: không đòi artifact của mode, và không đòi sửa file
  // nếu workflow-status.md hiện có đã route đúng (ép sửa chỉ sinh thêm lỗi).
  const entry = evaluateModeEntry({
    requested: command,
    data,
    openBlockingQuestions: countOpenBlockingQuestions(read('planning/questions.md')),
    taskRef,
  });
  if (!entry.allowed) {
    const refused = validateWorkflow(taskDir);
    if (refused.ok) return done([], true);
    return done(
      [
        {
          code: 'END_REFUSED_ROUTE_INVALID',
          message: `FE ${command} đang bị gate chặn (${entry.reasons.join(' ')}) nên không cần artifact của mode. Giữ nguyên current_mode; chỉ sửa workflow-status.md cho hợp lệ và route sang: ${entry.redirect}`,
        },
        ...refused.issues,
      ],
      true
    );
  }

  const issues = [];
  if (startedAt !== undefined) {
    let mtime = 0;
    try {
      mtime = fs.statSync(workflowPath).mtimeMs;
    } catch { /* đã kiểm tra tồn tại ở trên */ }
    if (mtime + 1000 < startedAt) {
      issues.push({
        code: 'END_STATUS_NOT_UPDATED',
        message: 'tracking/workflow-status.md chưa được cập nhật trong lượt này (không mode nào được kết thúc chỉ bằng chat).',
      });
    }
  }
  const expected = COMMAND_TO_MODE[command];
  if (String(data.current_mode || '') !== expected) {
    issues.push({
      code: 'END_CURRENT_MODE_MISMATCH',
      message: `current_mode trong workflow-status.md phải là ${expected} (đang là "${data.current_mode || ''}").`,
    });
  }
  for (const rel of MODE_REQUIRED_ARTIFACTS[command] || []) {
    if (!fs.existsSync(path.join(taskDir, rel))) {
      issues.push({ code: 'END_ARTIFACT_MISSING', message: `Thiếu artifact bắt buộc của FE ${command}: ${rel}` });
    }
  }
  issues.push(...extraIssues);

  const gates = repoRoot && !scope ? validateWorkflowAtGate(taskDir, { repoRoot, base }) : validateWorkflow(taskDir, { scope });
  if (!gates.ok) issues.push(...gates.issues);
  const seen = new Set();
  return done(issues.filter((i) => !seen.has(i.message) && seen.add(i.message)));
}

/** Mode sau cook: diff đã ổn định nên validate-workflow tự đối chiếu scope với git. */
export const SCOPE_CHECKED_MODES = ['review-mode', 'testing-mode', 'pr-ready-mode'];

/**
 * `validateWorkflow` tại điểm chuyển gate (MCP `fe_validate_workflow`).
 *
 * Khi task đang ở review/test/pr-ready, scope tính từ git thắng
 * `scope_diff_status` tự khai. Plan/input-sync/figma không tính scope để không
 * chặn nhầm vì thay đổi không liên quan trong working tree.
 *
 * @param {string} taskDir
 * @param {{ repoRoot?: string, base?: string }} [opts] `base` bỏ trống thì tự dò
 * @returns {{ ok: boolean, errors: string[], issues: { code: string, message: string }[], warnings: string[], scopeSource: 'git' | 'self_reported' | 'not_checked', base: string }}
 */
export function validateWorkflowAtGate(taskDir, { repoRoot, base } = {}) {
  const parsed = loadWorkflow(taskDir);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, issues: parsed.issues, warnings: [], scopeSource: 'not_checked', base: '' };

  const warnings = [];
  let scope;
  let scopeSource = 'not_checked';
  let usedBase = '';
  if (repoRoot && SCOPE_CHECKED_MODES.includes(String(parsed.data.current_mode || ''))) {
    usedBase = base || detectBaseRef(repoRoot);
    const diff = scopeDiffForTask(taskDir, { repoRoot, base: usedBase });
    if (!diff) {
      scopeSource = 'self_reported';
      warnings.push('Không tính được scope diff từ git (không phải git repo hoặc không diff được base); dùng scope_diff_status tự khai.');
    } else if (diff.plannedEmpty) {
      scopeSource = 'self_reported';
      warnings.push('implementation-plan.md chưa khai file nào ở mục "File sẽ tạo / cập nhật" nên không đối chiếu được scope với git; dùng scope_diff_status tự khai.');
    } else {
      scope = diff;
      scopeSource = 'git';
    }
  }

  const res = evaluateWorkflowGates({ data: parsed.data, body: parsed.body, ...taskIo(taskDir), scope });
  return { ...res, warnings: [...res.warnings, ...warnings], scopeSource, base: usedBase };
}

/**
 * Validate PR readiness: toàn bộ gate workflow + gate PR.
 *
 * @param {string} taskDir
 * @param {{ scope?: object }} [opts]
 * @returns {{ ok: boolean, errors: string[], issues: { code: string, message: string }[], warnings: string[] }}
 */
export function validatePr(taskDir, { scope } = {}) {
  const parsed = loadWorkflow(taskDir);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, issues: parsed.issues, warnings: [] };
  const io = taskIo(taskDir);
  const workflow = evaluateWorkflowGates({ data: parsed.data, body: parsed.body, ...io });
  const pr = evaluatePrGates({ data: parsed.data, ...io, scope });
  const errors = [...workflow.errors, ...pr.errors];
  const issues = [...workflow.issues, ...pr.issues];
  return { ok: errors.length === 0, errors, issues, warnings: [...workflow.warnings, ...pr.warnings] };
}

export {
  parseWorkflowStatus,
  parseFrontMatterLoose,
  evaluateWorkflowGates,
  evaluatePrGates,
  countOpenBlockingQuestions,
  hasCommandEvidence,
  summarizeCommandEvidence,
  realQuestionCell,
  computeScopeDiff,
  parsePlannedFiles,
  listChangedFiles,
  detectBaseRef,
  WorkflowStatusSchema,
  GateStatus,
  CoreMode,
};
export { snapshotFiles, filesTouchedSince, fingerprintFile } from './scope.mjs';
export {
  appendRunLog,
  readRunLog,
  codesOf,
  hashSession,
  RunLogRecordSchema,
  RUNLOG_FILE,
  RUNLOG_EVENTS,
} from './runlog.mjs';
export { summarizeRunLog, buildReport, renderReport } from './report.mjs';
export { modeBriefing } from './briefing.mjs';
export { resolveTaskDir, isPathInside, relativePosix, toPosix, TASKS_ROOT } from './resolve.mjs';
export { scaffoldTask, isValidTaskName, TASK_TEMPLATE_FILES } from './scaffold.mjs';
export {
  COMMAND_TO_MODE,
  COMMANDS,
  ALLOWED_NEXT,
  SOURCE_EDIT_COMMANDS,
  normalizeCommand,
  evaluateModeEntry,
  checkRecordedNextMode,
} from './transitions.mjs';
export {
  MODE_REQUIRED_ARTIFACTS,
  AGENT_FOR_COMMAND,
  SOURCE_EDIT_AGENT,
  KIT_WRITABLE_PREFIXES,
  REQUIRED_TASK_DOCS,
  REQUIRED_TASK_FILES,
  CONDITIONAL_TASK_FILES,
  TASK_GITKEEP,
  rulesForMode,
  allRuleFiles,
} from './modes.mjs';
