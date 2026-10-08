/**
 * Run-log của task FE: engine ghi/đọc; file này gắn id của pack và path
 * `tracking/run-log.jsonl` (cạnh workflow-status.md) vào mọi lời gọi.
 */
import { appendRunLog as appendRunLogIn, readRunLog as readRunLogIn, runLogFileFor } from '@frontend-delivery-kit/engine';
import manifest from './manifest.gen.mjs';

export {
  codesOf,
  hashSession,
  RunLogRecordSchema,
  RUNLOG_EVENTS,
  RUNLOG_MAX_BYTES,
  RUNLOG_VERSION,
} from '@frontend-delivery-kit/engine';

/** Path run-log trong task folder FE. */
export const RUNLOG_FILE = runLogFileFor(manifest.status_file);

/**
 * Ghi một sự kiện vào run-log của task. Không bao giờ throw và không tạo thư mục.
 * @param {string} taskDir
 * @param {object} record
 * @returns {boolean}
 */
export function appendRunLog(taskDir, record) {
  return appendRunLogIn(taskDir, { pack: manifest.id, ...record }, { file: RUNLOG_FILE });
}

/**
 * Đọc run-log của task; dòng hỏng hoặc sai schema được đếm vào `skipped`.
 * @param {string} taskDir
 * @returns {{ records: object[], skipped: number }}
 */
export function readRunLog(taskDir) {
  return readRunLogIn(taskDir, { file: RUNLOG_FILE });
}
