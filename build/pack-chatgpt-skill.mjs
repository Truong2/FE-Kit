#!/usr/bin/env node
/**
 * Đóng gói chatgpt-skill/frontend-delivery-standard/ thành dist/chatgpt-skill.zip.
 * Chạy sau `npm run build` (để chatgpt-skill/ đã đồng bộ với core/), trước khi
 * upload lên ChatGPT Skills UI. KHÔNG commit dist/ vào git — đây là release
 * artifact, sinh lại được bất cứ lúc nào từ source.
 *
 * Dùng: node build/pack-chatgpt-skill.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'chatgpt-skill');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'chatgpt-skill.zip');

if (!fs.existsSync(SRC)) {
  console.error('Thiếu chatgpt-skill/. Chạy npm run build trước.');
  process.exit(1);
}

fs.mkdirSync(DIST, { recursive: true });
fs.rmSync(OUT, { force: true });

try {
  // dùng `zip` có sẵn trên hầu hết CI runner (actions/setup-node image, macOS, Linux)
  execFileSync('zip', ['-r', OUT, 'frontend-delivery-standard'], { cwd: SRC, stdio: 'inherit' });
  console.log(`[pack-chatgpt-skill] Đã tạo ${path.relative(ROOT, OUT)}`);
} catch (err) {
  console.error('[pack-chatgpt-skill] Cần lệnh `zip` trong PATH. Lỗi:', err.message);
  process.exit(1);
}
