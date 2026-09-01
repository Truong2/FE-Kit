import fs from 'node:fs';
import path from 'node:path';
import { parseWorkflowStatus } from './parse.mjs';
import { evaluateWorkflowGates, countOpenBlockingQuestions, realQuestionCell } from './gates.mjs';
import { WorkflowStatusSchema, GateStatus, CoreMode } from './schema.mjs';

/**
 * Validate workflow-status.md của một task folder trên filesystem thật.
 * Đây là hàm CLI (`fe-kit validate-workflow`) và CI (`fe-kit doctor --strict`)
 * nên gọi trực tiếp — không tự viết lại logic đọc file.
 *
 * @param {string} taskDir đường dẫn tuyệt đối tới task folder
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateWorkflow(taskDir) {
  const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
  if (!fs.existsSync(workflowPath)) {
    return { ok: false, errors: ['Thiếu tracking/workflow-status.md'] };
  }

  const raw = fs.readFileSync(workflowPath, 'utf8');
  const parsed = parseWorkflowStatus(raw);
  if (!parsed.ok) return parsed;

  const exists = (rel) => fs.existsSync(path.join(taskDir, rel));
  const read = (rel) => {
    const p = path.join(taskDir, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };

  return evaluateWorkflowGates({ data: parsed.data, body: parsed.body, exists, read });
}

export {
  parseWorkflowStatus,
  evaluateWorkflowGates,
  countOpenBlockingQuestions,
  realQuestionCell,
  WorkflowStatusSchema,
  GateStatus,
  CoreMode,
};
