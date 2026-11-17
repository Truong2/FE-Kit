/**
 * Tạo task folder FE từ template: bind thư mục task, danh sách template và
 * `.gitkeep` của FE vào `scaffoldTask` của engine.
 */
import { scaffoldTask as scaffoldTaskIn } from '@frontend-delivery-kit/engine';
import { REQUIRED_TASK_DOCS, TASK_GITKEEP } from './modes.mjs';
import { TASKS_ROOT } from './resolve.mjs';
import manifest from './manifest.gen.mjs';

export { isValidTaskName } from '@frontend-delivery-kit/engine';

/** Template copy vào task mới: đúng các artifact Markdown bắt buộc. */
export const TASK_TEMPLATE_FILES = REQUIRED_TASK_DOCS;

/** Bản template thay thế theo mức rủi ro (`task_files.variants` trong pack.yaml). */
export const TASK_VARIANTS = manifest.task_files.variants;

/**
 * @param {{ workspaceRoot: string, name: string, templatesDir: string, variant?: string }} params
 *   `variant`: giá trị của `TASK_VARIANTS.param` (vd `low`); không có trong `dirs` thì dùng template đầy đủ
 */
export function scaffoldTask({ workspaceRoot, name, templatesDir, variant }) {
  return scaffoldTaskIn({
    variantDir: TASK_VARIANTS?.dirs?.[variant],
    workspaceRoot,
    name,
    templatesDir,
    tasksRoot: TASKS_ROOT,
    templateFiles: TASK_TEMPLATE_FILES,
    emptyFiles: [TASK_GITKEEP],
    nameHint: manifest.task_name_hint,
  });
}
