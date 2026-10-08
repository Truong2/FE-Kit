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
    return { ok: false, errors: ['Thiếu tracking/workflow-status.md'] };
  }
  return parseWorkflowStatus(fs.readFileSync(workflowPath, 'utf8'));
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
 * @returns {{ ok: boolean, errors: string[], warnings?: string[] }}
 */
export function validateWorkflow(taskDir, { scope } = {}) {
  const parsed = loadWorkflow(taskDir);
  if (!parsed.ok) return parsed;
  return evaluateWorkflowGates({ data: parsed.data, body: parsed.body, ...taskIo(taskDir), scope });
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
 * @returns {{ ok: boolean, errors: string[], warnings: string[], scopeSource: 'git' | 'self_reported' | 'not_checked', base: string }}
 */
export function validateWorkflowAtGate(taskDir, { repoRoot, base } = {}) {
  const parsed = loadWorkflow(taskDir);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: [], scopeSource: 'not_checked', base: '' };

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
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validatePr(taskDir, { scope } = {}) {
  const parsed = loadWorkflow(taskDir);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: [] };
  const io = taskIo(taskDir);
  const workflow = evaluateWorkflowGates({ data: parsed.data, body: parsed.body, ...io });
  const pr = evaluatePrGates({ data: parsed.data, ...io, scope });
  const errors = [...workflow.errors, ...pr.errors];
  return { ok: errors.length === 0, errors, warnings: [...workflow.warnings, ...pr.warnings] };
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
