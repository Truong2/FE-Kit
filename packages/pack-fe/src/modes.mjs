/**
 * Dữ liệu theo mode của FE: file của task, artifact bắt buộc, agent, rule cần
 * nạp. Nguồn là `packages/pack-fe/pack.yaml` (đã compile sang
 * `manifest.gen.mjs`); sửa dữ liệu thì sửa pack.yaml rồi `npm run build`.
 */
import { allRuleFilesOf, rulesForManifest } from '@frontend-delivery-kit/engine';
import manifest from './manifest.gen.mjs';

/** Giữ chỗ cho thư mục screenshot Figma; mọi task đều có, kể cả task không có Figma. */
export const TASK_GITKEEP = manifest.task_files.empty[0];

/** Artifact Markdown bắt buộc của mọi task. Gate workflow kiểm danh sách này. */
export const REQUIRED_TASK_DOCS = manifest.task_files.required_docs;

/** File bắt buộc của mọi task: bản duy nhất cho validate-task (CLI, MCP, gói ChatGPT skill). */
export const REQUIRED_TASK_FILES = [...REQUIRED_TASK_DOCS, ...manifest.task_files.empty];

/** File chỉ có khi mode tương ứng đã chạy. */
export const CONDITIONAL_TASK_FILES = manifest.task_files.conditional;

/** Artifact phải tồn tại khi mode kết thúc (path tương đối trong task folder). */
export const MODE_REQUIRED_ARTIFACTS = Object.fromEntries(Object.entries(manifest.modes).map(([cmd, m]) => [cmd, m.artifacts]));

/**
 * Subagent đảm nhận từng mode. `null` = chạy inline ở main thread.
 * Generator dùng bảng này để chèn đoạn delegation vào command của plugin;
 * hook dùng để biết SubagentStop nào thuộc mode đang chạy.
 */
export const AGENT_FOR_COMMAND = Object.fromEntries(Object.entries(manifest.modes).map(([cmd, m]) => [cmd, m.agent]));

/** Agent duy nhất được sửa source code của dự án. */
export const SOURCE_EDIT_AGENT = manifest.source_edit_agent;

/** Path (POSIX, tương đối workspace) mà mọi agent của kit đều được ghi. */
export const KIT_WRITABLE_PREFIXES = manifest.writable_prefixes;

/**
 * Tên file rule cần đọc cho một mode.
 * @param {string} command lệnh đã chuẩn hoá (`plan`, `cook`, ...)
 * @param {{ figmaRequired?: boolean }} [opts]
 */
export function rulesForMode(command, { figmaRequired = false } = {}) {
  return rulesForManifest(manifest, command, { figma_required: figmaRequired });
}

/** Mọi file rule mà ít nhất một mode có thể nạp. `doctor` kiểm repo dự án có đủ các file này. */
export function allRuleFiles() {
  return allRuleFilesOf(manifest);
}
