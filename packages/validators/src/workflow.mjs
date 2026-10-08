/**
 * Validate task FE trên filesystem thật: đọc workflow-status.md, tính scope từ
 * git và chạy gate workflow/PR của FE. CLI, MCP, hook và script dùng chung.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseWorkflowStatus } from './parse.mjs';
import { evaluateWorkflowGates, evaluatePrGates } from './gates.mjs';
import { computeScopeDiff, parsePlannedFiles, listChangedFiles, detectBaseRef } from './scope.mjs';
import { TASKS_ROOT } from './resolve.mjs';
import { PROJECT_CONFIG_DEFAULTS } from './project-config.mjs';

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

/**
 * File source đã đổi mà không task nào khai trong bảng "File sẽ tạo / cập nhật"
 * (PR chỉ sửa source, không gắn task). Chỉ xét file nằm dưới `sourcePaths`.
 * Trả `null` khi không tính được (không có git).
 *
 * @param {string} repoRoot
 * @param {{ base?: string, sourcePaths?: string[] }} [opts]
 * @returns {{ files: string[], base: string, plannedCount: number } | null}
 */
export function findUntrackedSourceChanges(repoRoot, { base = '', sourcePaths = PROJECT_CONFIG_DEFAULTS.source_paths } = {}) {
  const changed = listChangedFiles({ cwd: repoRoot, base });
  if (!changed.ok) return null;
  const planned = plannedFilesOfTasksIn(path.join(repoRoot, TASKS_ROOT));
  const diff = computeScopeDiff({ plannedFiles: planned, changedFiles: changed.files });
  const files = diff.outOfPlan.filter((f) => sourcePaths.some((p) => f.startsWith(p)));
  return { files, base: changed.base, plannedCount: planned.length };
}

/** File/glob khai trong plan của mọi task folder trực tiếp dưới `tasksRoot`, trừ `exclude`. */
function plannedFilesOfTasksIn(tasksRoot, exclude = '') {
  if (!fs.existsSync(tasksRoot)) return [];
  const planned = [];
  for (const ent of fs.readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name === exclude) continue;
    const plan = path.join(tasksRoot, ent.name, 'planning', 'implementation-plan.md');
    if (fs.existsSync(plan)) planned.push(...parsePlannedFiles(fs.readFileSync(plan, 'utf8')));
  }
  return planned;
}

/** File/glob khai trong plan của các task folder cùng cấp (docs/frontend-tasks/*). */
function plannedFilesOfSiblingTasks(taskDir) {
  return plannedFilesOfTasksIn(path.dirname(taskDir), path.basename(taskDir));
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
