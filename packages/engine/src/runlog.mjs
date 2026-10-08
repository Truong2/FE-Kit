import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';

/**
 * Run-log của task: mỗi sự kiện một dòng JSON trong `tracking/run-log.jsonl`.
 * Hook, MCP và CLI cùng ghi qua `appendRunLog`; `fe-kit report` đọc qua
 * `readRunLog`. File nằm trong task folder nên được commit cùng code và không
 * bị scope diff tính là file ngoài plan.
 *
 * Không ghi prompt, nội dung file hay input của người dùng: chỉ mode, kết quả,
 * reason code và path tương đối.
 */

export const RUNLOG_FILE = 'tracking/run-log.jsonl';
export const RUNLOG_VERSION = 1;

/** Quá ngưỡng này thì ngừng ghi, để log hỏng không làm phình repo. */
export const RUNLOG_MAX_BYTES = 5 * 1024 * 1024;
const MAX_RECORD_BYTES = 4096;

export const RUNLOG_EVENTS = [
  'mode_start',
  'mode_end',
  'entry_blocked',
  'edit_denied',
  'edit_warned',
  'override_requested',
  'mode_abandoned',
  'validate',
];

export const RunLogRecordSchema = z
  .object({
    v: z.literal(RUNLOG_VERSION),
    ts: z.string(),
    pack: z.string(),
    task: z.string(),
    event: z.enum(RUNLOG_EVENTS),
    mode: z.string().optional(),
    source: z.enum(['hook', 'mcp', 'cli']),
    actor: z.string().optional(),
    level: z.string().optional(),
    outcome: z.string().optional(),
    codes: z.array(z.string()).optional(),
    attempt: z.number().int().positive().optional(),
    duration_ms: z.number().nonnegative().optional(),
  })
  .passthrough();

/** Session id của Claude Code chỉ dùng để ghép sự kiện cùng phiên; không ghi nguyên văn. */
export function hashSession(sessionId) {
  if (!sessionId) return undefined;
  return crypto.createHash('sha256').update(String(sessionId)).digest('hex').slice(0, 12);
}

function enabled() {
  return String(process.env.FE_KIT_RUNLOG || '').trim().toLowerCase() !== 'off';
}

/**
 * Ghi một sự kiện vào run-log của task. Không bao giờ throw và không tạo thư
 * mục: task chưa có `tracking/` thì bỏ qua.
 *
 * @param {string} taskDir đường dẫn tuyệt đối tới task folder
 * @param {object} record field của sự kiện, phải có `pack` (id của domain pack); `v`, `ts`, `task` được điền nếu thiếu
 * @returns {boolean} đã ghi hay chưa
 */
export function appendRunLog(taskDir, record) {
  try {
    if (!enabled() || !taskDir) return false;
    const trackingDir = path.join(taskDir, 'tracking');
    if (!fs.statSync(trackingDir, { throwIfNoEntry: false })?.isDirectory()) return false;
    const file = path.join(taskDir, RUNLOG_FILE);
    const size = fs.statSync(file, { throwIfNoEntry: false })?.size || 0;
    if (size > RUNLOG_MAX_BYTES) return false;

    const full = {
      v: RUNLOG_VERSION,
      ts: new Date().toISOString(),
      pack: record?.pack,
      task: path.basename(taskDir),
      ...dropEmpty(record),
    };
    let line = JSON.stringify(full);
    if (Buffer.byteLength(line) > MAX_RECORD_BYTES) {
      // Danh sách dài (file ngoài plan, nhiều code) bị cắt, giữ phần nhận diện sự kiện.
      line = JSON.stringify({ ...full, codes: full.codes?.slice(0, 20), files: full.files?.slice(0, 20), truncated: true });
    }
    fs.appendFileSync(file, line + '\n');
    return true;
  } catch {
    return false;
  }
}

function dropEmpty(record) {
  return Object.fromEntries(
    Object.entries(record || {}).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
  );
}

/**
 * Đọc run-log của task. Dòng hỏng, dòng của version lạ hoặc sai schema bị bỏ
 * qua và được đếm vào `skipped`.
 *
 * @param {string} taskDir
 * @returns {{ records: object[], skipped: number }}
 */
export function readRunLog(taskDir) {
  const file = path.join(taskDir, RUNLOG_FILE);
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { records: [], skipped: 0 };
  }
  const records = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const parsed = RunLogRecordSchema.safeParse(JSON.parse(line));
      if (parsed.success) records.push(parsed.data);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { records, skipped };
}

/** Reason code của kết quả validator (`issues`) hoặc của gate lúc vào mode (`reasonCodes`). */
export function codesOf(result) {
  if (!result) return [];
  if (Array.isArray(result.reasonCodes)) return [...new Set(result.reasonCodes)];
  return [...new Set((result.issues || []).map((i) => i.code))];
}
