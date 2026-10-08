/**
 * Resolver đường dẫn task của FE. Logic nằm trong engine; file này bind thư mục
 * task của FE và giữ nguyên API cũ.
 */
import { resolveTaskDir as resolveTaskDirIn } from '@frontend-delivery-kit/engine';
import manifest from './manifest.gen.mjs';

export { toPosix, isPathInside, relativePosix } from '@frontend-delivery-kit/engine';

export const TASKS_ROOT = manifest.tasks_root;

/**
 * Trả về đường dẫn tuyệt đối của task folder, chặn path traversal.
 *
 * @param {string} workspaceRoot đường dẫn repo dự án
 * @param {string} taskFolder tên task (`FE-123-abc`), path tương đối hoặc tuyệt đối
 */
export function resolveTaskDir(workspaceRoot, taskFolder) {
  return resolveTaskDirIn(workspaceRoot, taskFolder, { tasksRoot: TASKS_ROOT });
}
