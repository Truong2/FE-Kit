import fs from 'node:fs';
import path from 'node:path';
import { TASKS_ROOT, isPathInside, toPosix } from './resolve.mjs';

/**
 * Tạo task folder chuẩn từ templates. Bản DUY NHẤT cho `fe-kit new-task` và
 * MCP tool `fe_new_task` (trước v2.0.0 lệnh /fe:new-task bảo agent tự copy
 * template bằng tay, không làm được khi template nằm trong cache của plugin).
 */

export const TASK_TEMPLATE_FILES = [
  'task.md',
  'planning/implementation-plan.md',
  'planning/build-checklist.md',
  'planning/questions.md',
  'tracking/workflow-status.md',
];

const GITKEEP = 'output/figma-reference-screenshots/.gitkeep';

/** Tên task hợp lệ: không có dấu phân cách thư mục, không bắt đầu bằng dấu chấm. */
export function isValidTaskName(name) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(String(name || ''));
}

/**
 * @param {object} params
 * @param {string} params.workspaceRoot repo dự án
 * @param {string} params.name tên task, vd `FE-123-login-form`
 * @param {string} params.templatesDir thư mục chứa template (override của repo hoặc bản của kit)
 * @returns {{ ok: true, taskDir: string, taskRef: string, created: string[], skipped: string[] } | { ok: false, error: string }}
 */
export function scaffoldTask({ workspaceRoot, name, templatesDir }) {
  if (!isValidTaskName(name)) {
    return { ok: false, error: `Tên task không hợp lệ: "${name}". Dùng dạng FE-<id>-<slug>, chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang.` };
  }
  const root = path.resolve(workspaceRoot);
  const taskDir = path.join(root, TASKS_ROOT, name);
  if (!isPathInside(root, taskDir)) return { ok: false, error: 'Task path nằm ngoài workspace.' };

  // Path ghi vào artifact luôn dùng `/`: trên Windows `\f` trong scalar YAML
  // nháy kép (`next_prompt: "FE plan docs\frontend-tasks\..."`) là escape không hợp lệ.
  const taskRef = toPosix(path.relative(root, taskDir));
  const fill = (text) =>
    text.replaceAll('<task-folder>', taskRef).replaceAll('<task-id>', name).replaceAll('<TASK_ID>', name);

  const created = [];
  const skipped = [];
  for (const rel of TASK_TEMPLATE_FILES) {
    const dest = path.join(taskDir, rel);
    if (fs.existsSync(dest)) {
      skipped.push(rel);
      continue;
    }
    const src = path.join(templatesDir, rel);
    const template = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : '';
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, fill(template));
    created.push(rel);
  }

  const gitkeep = path.join(taskDir, GITKEEP);
  if (!fs.existsSync(gitkeep)) {
    fs.mkdirSync(path.dirname(gitkeep), { recursive: true });
    fs.writeFileSync(gitkeep, '');
    created.push(GITKEEP);
  }
  return { ok: true, taskDir, taskRef, created, skipped };
}
