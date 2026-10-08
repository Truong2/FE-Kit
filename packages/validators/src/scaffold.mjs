/**
 * Tạo task folder FE từ template: bind thư mục task, danh sách template và
 * `.gitkeep` của FE vào `scaffoldTask` của engine.
 */
import { scaffoldTask as scaffoldTaskIn } from '@frontend-delivery-kit/engine';
import { REQUIRED_TASK_DOCS, TASK_GITKEEP } from './modes.mjs';
import { TASKS_ROOT } from './resolve.mjs';

export { isValidTaskName } from '@frontend-delivery-kit/engine';

/** Template copy vào task mới: đúng các artifact Markdown bắt buộc. */
export const TASK_TEMPLATE_FILES = REQUIRED_TASK_DOCS;

/**
 * @param {{ workspaceRoot: string, name: string, templatesDir: string }} params
 */
export function scaffoldTask({ workspaceRoot, name, templatesDir }) {
  return scaffoldTaskIn({
    workspaceRoot,
    name,
    templatesDir,
    tasksRoot: TASKS_ROOT,
    templateFiles: TASK_TEMPLATE_FILES,
    emptyFiles: [TASK_GITKEEP],
    nameHint: 'FE-<id>-<slug>',
  });
}
