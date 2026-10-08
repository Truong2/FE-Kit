/**
 * Run-log của task FE: engine ghi/đọc, file này gắn `pack: 'fe'` vào mọi bản ghi.
 */
import { appendRunLog as appendRunLogIn } from '@frontend-delivery-kit/engine';
import manifest from './manifest.gen.mjs';

export {
  readRunLog,
  codesOf,
  hashSession,
  RunLogRecordSchema,
  RUNLOG_FILE,
  RUNLOG_EVENTS,
  RUNLOG_MAX_BYTES,
  RUNLOG_VERSION,
} from '@frontend-delivery-kit/engine';

/**
 * Ghi một sự kiện vào run-log của task. Không bao giờ throw và không tạo thư mục.
 * @param {string} taskDir
 * @param {object} record
 * @returns {boolean}
 */
export function appendRunLog(taskDir, record) {
  return appendRunLogIn(taskDir, { pack: manifest.id, ...record });
}
