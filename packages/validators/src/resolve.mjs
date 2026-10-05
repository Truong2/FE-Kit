import path from 'node:path';

/**
 * Resolver đường dẫn task dùng chung cho CLI, MCP server và hook.
 *
 * LỊCH SỬ: MCP server tự viết `resolveTaskDir` và coi mọi chuỗi không chứa
 * `/` là tên trần — nên `docs\frontend-tasks\FE-1` (path Windows) bị ghép
 * thành `docs/frontend-tasks/docs\frontend-tasks\FE-1`. Từ v2.0.0 đây là bản
 * DUY NHẤT.
 */

export const TASKS_ROOT = 'docs/frontend-tasks';

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
 * @param {string} taskFolder tên task (`FE-123-abc`), path tương đối hoặc tuyệt đối
 */
export function resolveTaskDir(workspaceRoot, taskFolder) {
  const root = path.resolve(workspaceRoot);
  const input = String(taskFolder ?? '').trim().replace(/^["']|["']$/g, '');
  if (!input) throw new Error('Thiếu task folder.');

  const posix = toPosix(input).replace(/\/+$/, '');
  const candidate = path.isAbsolute(input)
    ? path.resolve(input)
    : path.resolve(root, posix.includes('/') ? posix : `${TASKS_ROOT}/${posix}`);

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
