import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { toPosix } from './resolve.mjs';

/**
 * Scope diff: so file thực sự thay đổi với bảng "File sẽ tạo / cập nhật"
 * trong planning/implementation-plan.md.
 *
 * Trước v2.0.0 `scope_diff_status` hoàn toàn do agent tự khai. Các hàm ở đây
 * tính lại sự thật; `computeScopeDiff` là hàm thuần để test, phần gọi git
 * (`listChangedFiles`) tách riêng và tự bỏ qua khi không có git.
 */

/** Thay đổi ở các path này không tính là "sửa ngoài plan". */
export const DEFAULT_SCOPE_IGNORE = [
  'docs/frontend-tasks/',
  'docs/frontend-context/',
  '.frontend-delivery/',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
];

function isPlaceholder(cell) {
  const t = String(cell ?? '').trim();
  if (!t) return true;
  if (/^(n\/a|na|không áp dụng|khong ap dung|none|-|—|\.\.\.)$/i.test(t)) return true;
  return /^<.*>$/.test(t);
}

function cleanPath(p) {
  return toPosix(p).trim().replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Đọc danh sách file/glob đã khai trong bảng "File sẽ tạo / cập nhật".
 * Một ô có thể chứa nhiều path trong backtick.
 */
export function parsePlannedFiles(planMarkdown) {
  const text = String(planMarkdown || '');
  // `(?![\s\S])` = hết file. Không dùng `$` vì cờ `m` làm nó khớp cuối mỗi dòng.
  const section = text.match(/^##\s+(?:\d+\.\s*)?File sẽ tạo\s*\/\s*cập nhật[^\n]*\n([\s\S]*?)(?=\n##\s|(?![\s\S]))/im);
  if (!section) return [];

  const files = [];
  for (const line of section[1].split(/\r?\n/)) {
    if (!/^\s*\|/.test(line) || /^\s*\|\s*:?-+/.test(line)) continue;
    const first = (line.split('|')[1] || '').trim();
    if (/^file$/i.test(first) || isPlaceholder(first)) continue;

    const ticked = [...first.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const candidates = ticked.length ? ticked : first.split(/[,;]|<br\s*\/?>/i);
    for (const c of candidates) {
      // Agent hay viết kèm chú thích ("src/services/auth.ts hoặc tương đương"):
      // lấy token đầu và chỉ nhận khi trông giống path.
      const p = cleanPath(c).split(/\s+/)[0] || '';
      if (p && !isPlaceholder(p) && /[/.]/.test(p)) files.push(p);
    }
  }
  return [...new Set(files)];
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\*\*\/?/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${pattern}$`);
}

function matchesPlanned(file, planned) {
  if (planned === file) return true;
  if (planned.endsWith('/')) return file.startsWith(planned);
  if (planned.includes('*')) return globToRegExp(planned).test(file);
  // Thư mục khai không có dấu `/` cuối, vd `src/features/login`
  return file.startsWith(planned + '/');
}

function isIgnored(file, ignore) {
  return ignore.some((rule) => (rule.endsWith('/') ? file.startsWith(rule) : file === rule || file.endsWith('/' + rule)));
}

/**
 * @param {object} params
 * @param {string[]} params.plannedFiles path/glob từ plan
 * @param {string[]} params.changedFiles file đã đổi (relative so với repo root)
 * @param {string[]} [params.ignore]
 * @returns {{ ok: boolean, plannedEmpty: boolean, inScope: string[], outOfPlan: string[], ignored: string[] }}
 */
export function computeScopeDiff({ plannedFiles = [], changedFiles = [], ignore = DEFAULT_SCOPE_IGNORE }) {
  const planned = plannedFiles.map(cleanPath).filter(Boolean);
  const inScope = [];
  const outOfPlan = [];
  const ignored = [];

  for (const raw of [...new Set(changedFiles.map(cleanPath).filter(Boolean))]) {
    if (isIgnored(raw, ignore)) ignored.push(raw);
    else if (planned.some((p) => matchesPlanned(raw, p))) inScope.push(raw);
    else outOfPlan.push(raw);
  }

  return {
    ok: outOfPlan.length === 0,
    plannedEmpty: planned.length === 0,
    inScope,
    outOfPlan,
    ignored,
  };
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.error || r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** Tìm base ref khi không được chỉ định: biến môi trường CI rồi tới nhánh mặc định. */
export function detectBaseRef(cwd, env = process.env) {
  if (env.FE_KIT_BASE_REF) return env.FE_KIT_BASE_REF;
  if (env.GITHUB_BASE_REF) return `origin/${env.GITHUB_BASE_REF}`;
  for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
    if (git(cwd, ['rev-parse', '--verify', '--quiet', ref])) return ref;
  }
  return '';
}

/**
 * Liệt kê file đã thay đổi. Có `base` thì gồm cả commit từ merge-base; luôn
 * gồm thay đổi chưa commit và file untracked.
 *
 * @returns {{ ok: true, files: string[], base: string } | { ok: false, reason: string }}
 */
export function listChangedFiles({ cwd, base = '' }) {
  if (!git(cwd, ['rev-parse', '--is-inside-work-tree'])) {
    return { ok: false, reason: 'Không phải git repo hoặc không có lệnh git.' };
  }
  const files = new Set();
  if (base) {
    const committed = git(cwd, ['diff', '--name-only', '--relative', `${base}...HEAD`]);
    if (!committed) return { ok: false, reason: `Không diff được với base ref "${base}".` };
    committed.forEach((f) => files.add(f));
  }
  // `--relative` để path cùng gốc `cwd` với `ls-files`, kể cả khi workspace là thư mục con của repo.
  for (const args of [
    ['diff', '--name-only', '--relative', 'HEAD'],
    ['ls-files', '--others', '--exclude-standard'],
  ]) {
    (git(cwd, args) || []).forEach((f) => files.add(f));
  }
  return { ok: true, files: [...files].map(toPosix), base };
}

const SNAPSHOT_MAX_FILES = 2000;
const SNAPSHOT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Dấu vân tay nội dung một file: sha1, `deleted` khi không tồn tại, hoặc
 * `unknown` khi không đọc được. File quá lớn dùng size + mtime thay cho hash.
 */
export function fingerprintFile(absPath) {
  try {
    const st = fs.statSync(absPath);
    if (!st.isFile()) return 'unknown';
    if (st.size > SNAPSHOT_MAX_BYTES) return `size:${st.size}:${st.mtimeMs}`;
    return crypto.createHash('sha1').update(fs.readFileSync(absPath)).digest('hex');
  } catch (e) {
    return e && e.code === 'ENOENT' ? 'deleted' : 'unknown';
  }
}

/**
 * Chụp nội dung các file đang thay đổi lúc mở mode, để cuối mode nhận ra file
 * vốn đã dirty mà bị sửa thêm. Chỉ đọc, không đụng file của người dùng.
 * Vượt quá giới hạn số file thì phần còn lại chỉ so theo path (`skipped`).
 *
 * @param {string} cwd
 * @param {string[]} files path relative so với `cwd`
 * @returns {Record<string, string>}
 */
export function snapshotFiles(cwd, files) {
  const snapshot = {};
  files.forEach((f, i) => {
    snapshot[f] = i < SNAPSHOT_MAX_FILES ? fingerprintFile(path.join(cwd, f)) : 'skipped';
  });
  return snapshot;
}

/**
 * File bị thay đổi kể từ lúc chụp `snapshot`:
 *   - file mới xuất hiện trong danh sách thay đổi;
 *   - file đã dirty từ trước mà nội dung khác đi;
 *   - file đã dirty từ trước mà nay sạch (bị hoàn tác về HEAD).
 *
 * @param {string} cwd
 * @param {Record<string, string>} snapshot kết quả của `snapshotFiles`
 * @param {string[]} currentFiles danh sách file đang thay đổi hiện tại
 * @returns {{ touched: string[], preDirtyTouched: string[] }}
 */
export function filesTouchedSince(cwd, snapshot, currentFiles) {
  const touched = [];
  const preDirtyTouched = [];
  const current = new Set(currentFiles);

  for (const f of current) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, f)) {
      touched.push(f);
      continue;
    }
    const before = snapshot[f];
    if (before === 'skipped') continue;
    if (before === 'unknown' || fingerprintFile(path.join(cwd, f)) !== before) {
      touched.push(f);
      preDirtyTouched.push(f);
    }
  }
  for (const f of Object.keys(snapshot)) {
    if (!current.has(f) && snapshot[f] !== 'skipped') {
      touched.push(f);
      preDirtyTouched.push(f);
    }
  }
  return { touched, preDirtyTouched };
}
