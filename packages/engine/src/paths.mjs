import path from 'node:path';

/**
 * Resolver đường dẫn task dùng chung cho CLI, MCP server và hook.
 *
 * LỊCH SỬ: MCP server tự viết `resolveTaskDir` và coi mọi chuỗi không chứa
 * `/` là tên trần — nên path Windows (`docs\tasks\T-1`) bị ghép thành
 * `docs/tasks/docs\tasks\T-1`. Từ v2.0.0 đây là bản DUY NHẤT.
 */

/** Đưa path về dạng POSIX (`/`) để so khớp và ghi vào artifact. */
export function toPosix(p) {
  return String(p ?? '').replace(/\\/g, '/');
}

/** `child` có nằm trong (hoặc trùng) `parent` không. Windows so khớp không phân biệt hoa/thường. */
export function isPathInside(parent, child) {
  let a = path.resolve(parent);
  let b = path.resolve(child);
  if (process.platform === 'win32') {
    a = a.toLowerCase();
    b = b.toLowerCase();
  }
  return b === a || b.startsWith(a.endsWith(path.sep) ? a : a + path.sep);
}

/**
 * Trả về đường dẫn tuyệt đối của task folder, chặn path traversal.
 *
 * @param {string} workspaceRoot đường dẫn repo dự án
 * @param {string} taskFolder tên task, path tương đối hoặc tuyệt đối
 * @param {{ tasksRoot: string }} opts thư mục chứa task folder (tương đối workspace), dùng khi chỉ có tên task
 */
export function resolveTaskDir(workspaceRoot, taskFolder, { tasksRoot }) {
  const root = path.resolve(workspaceRoot);
  const input = String(taskFolder ?? '').trim().replace(/^["']|["']$/g, '');
  if (!input) throw new Error('Thiếu task folder.');

  const posix = toPosix(input).replace(/\/+$/, '');
  const candidate = path.isAbsolute(input)
    ? path.resolve(input)
    : path.resolve(root, posix.includes('/') ? posix : `${tasksRoot}/${posix}`);

  if (!isPathInside(root, candidate)) {
    throw new Error(`Task path nằm ngoài workspace: ${taskFolder}`);
  }
  return candidate;
}

/** Path tương đối dạng POSIX của `target` so với `root` (rỗng nếu nằm ngoài). */
export function relativePosix(root, target) {
  if (!isPathInside(root, target)) return '';
  return toPosix(path.relative(path.resolve(root), path.resolve(target)));
}
