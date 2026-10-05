import fs from 'node:fs';
import path from 'node:path';
import { parseWorkflowStatus, parseFrontMatterLoose } from './parse.mjs';
import {
  evaluateWorkflowGates,
  evaluatePrGates,
  countOpenBlockingQuestions,
  hasCommandEvidence,
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
  return { ...computeScopeDiff({ plannedFiles, changedFiles: files }), plannedFiles };
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
  realQuestionCell,
  computeScopeDiff,
  parsePlannedFiles,
  listChangedFiles,
  detectBaseRef,
  WorkflowStatusSchema,
  GateStatus,
  CoreMode,
};
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
  rulesForMode,
} from './modes.mjs';
