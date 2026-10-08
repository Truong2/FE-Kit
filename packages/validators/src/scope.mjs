/**
 * Scope diff của FE: bind thư mục artifact và heading bảng file của plan FE vào
 * scope diff của engine. Giữ nguyên API cũ.
 */
import {
  computeScopeDiff as computeScopeDiffIn,
  parsePlannedFiles as parsePlannedFilesIn,
  LOCKFILE_IGNORE,
} from '@frontend-delivery-kit/engine';

export { detectBaseRef, listChangedFiles, fingerprintFile, snapshotFiles, filesTouchedSince } from '@frontend-delivery-kit/engine';

/** Thay đổi ở các path này không tính là "sửa ngoài plan". */
export const DEFAULT_SCOPE_IGNORE = ['docs/frontend-tasks/', 'docs/frontend-context/', '.frontend-delivery/', ...LOCKFILE_IGNORE];

/** Tên mục chứa bảng file trong `planning/implementation-plan.md` (regex). */
export const PLANNED_FILES_HEADING = 'File sẽ tạo\\s*\\/\\s*cập nhật';

/** Đọc danh sách file/glob đã khai trong bảng "File sẽ tạo / cập nhật". */
export function parsePlannedFiles(planMarkdown) {
  return parsePlannedFilesIn(planMarkdown, { heading: PLANNED_FILES_HEADING });
}

/**
 * @param {object} params
 * @param {string[]} params.plannedFiles path/glob từ plan
 * @param {string[]} params.changedFiles file đã đổi (relative so với repo root)
 * @param {string[]} [params.ignore]
 * @returns {{ ok: boolean, plannedEmpty: boolean, inScope: string[], outOfPlan: string[], ignored: string[] }}
 */
export function computeScopeDiff({ plannedFiles, changedFiles, ignore }) {
  return computeScopeDiffIn({ plannedFiles, changedFiles, ignore: ignore ?? DEFAULT_SCOPE_IGNORE });
}
