import fs from 'node:fs';
import path from 'node:path';
import { isPathInside, toPosix } from './paths.mjs';

/**
 * Tạo task folder chuẩn từ templates. Bản DUY NHẤT cho lệnh `new-task` của CLI
 * và tool `<prefix>_new_task` của MCP (trước v2.0.0 agent phải tự copy template
 * bằng tay, không làm được khi template nằm trong cache của plugin).
 */

/** Tên task hợp lệ: không có dấu phân cách thư mục, không bắt đầu bằng dấu chấm. */
export function isValidTaskName(name) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(String(name || ''));
}

/**
 * @param {object} params
 * @param {string} params.workspaceRoot repo dự án
 * @param {string} params.name tên task
 * @param {string} params.templatesDir thư mục chứa template (override của repo hoặc bản của kit)
 * @param {string} params.tasksRoot thư mục chứa task folder (tương đối workspace)
 * @param {string[]} params.templateFiles file copy từ template (path tương đối task folder)
 * @param {string[]} [params.emptyFiles] file rỗng cần tạo (vd `.gitkeep`)
 * @param {string} params.nameHint dạng tên gợi ý trong thông báo lỗi
 * @returns {{ ok: true, taskDir: string, taskRef: string, created: string[], skipped: string[] } | { ok: false, error: string }}
 */
export function scaffoldTask({ workspaceRoot, name, templatesDir, tasksRoot, templateFiles, emptyFiles = [], nameHint }) {
  if (!isValidTaskName(name)) {
    return { ok: false, error: `Tên task không hợp lệ: "${name}". Dùng dạng ${nameHint}, chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang.` };
  }
  const root = path.resolve(workspaceRoot);
  const taskDir = path.join(root, tasksRoot, name);
  if (!isPathInside(root, taskDir)) return { ok: false, error: 'Task path nằm ngoài workspace.' };

  // Path ghi vào artifact luôn dùng `/`: trên Windows `\f` trong scalar YAML
  // nháy kép (`next_prompt: "... docs\tasks\..."`) là escape không hợp lệ.
  const taskRef = toPosix(path.relative(root, taskDir));
  const fill = (text) =>
    text.replaceAll('<task-folder>', taskRef).replaceAll('<task-id>', name).replaceAll('<TASK_ID>', name);

  const created = [];
  const skipped = [];
  for (const rel of templateFiles) {
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

  for (const rel of emptyFiles) {
    const file = path.join(taskDir, rel);
    if (fs.existsSync(file)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
    created.push(rel);
  }
  return { ok: true, taskDir, taskRef, created, skipped };
}
