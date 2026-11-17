/**
 * Cập nhật field của file trạng thái task mà không viết lại cả file.
 *
 * Agent trước đây phải đọc rồi ghi lại toàn bộ file trạng thái ở mỗi mode: tốn
 * token output và hay hỏng schema. Module này sửa đúng dòng `key: value` trong
 * frontmatter (giữ comment `# …` cuối dòng, thứ tự và dòng trống của template),
 * thay đoạn prompt trong mục "bước tiếp theo" của body, rồi kiểm lại bằng
 * parser của pack trước khi ghi. Không hợp lệ thì không ghi gì.
 */
import fs from 'node:fs';
import path from 'node:path';

const KEY_RE = /^[a-z][a-z0-9_]*$/;
const PLAIN_RE = /^[A-Za-z_][A-Za-z0-9_./-]*$/;
const YAML_WORDS = /^(true|false|null|yes|no|on|off|y|n|~)$/i;

/** Giá trị → scalar YAML một dòng. Chuỗi đơn giản để trần, còn lại dùng nháy đơn. */
export function yamlScalar(value) {
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Giá trị số không hợp lệ: ${value}`);
    return String(value);
  }
  if (typeof value !== 'string') throw new Error(`Chỉ nhận chuỗi, số hoặc boolean (nhận ${value === null ? 'null' : typeof value}).`);
  if (/[\r\n]/.test(value)) throw new Error('Giá trị phải nằm trên một dòng.');
  if (PLAIN_RE.test(value) && !YAML_WORDS.test(value)) return value;
  return `'${value.replace(/'/g, "''")}'`;
}

/** Tách phần value và comment cuối dòng (` # …`) của một dòng `key: value`, bỏ qua `#` nằm trong nháy. */
function splitComment(rest) {
  let quote = '';
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (quote) {
      if (ch === '\\' && quote === '"') i++;
      else if (ch === quote) {
        if (quote === "'" && rest[i + 1] === "'") i++;
        else quote = '';
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#' && i > 0 && /\s/.test(rest[i - 1])) {
      const start = rest.slice(0, i).search(/\s+$/);
      return rest.slice(start);
    }
  }
  return '';
}

/**
 * Đặt các field cấp cao nhất trong YAML frontmatter.
 * Dòng đã có: thay value, giữ comment cuối dòng. Chưa có: chèn trước dòng `---` đóng.
 *
 * @param {string} raw nội dung file
 * @param {Record<string, string|number|boolean>} fields
 * @returns {string}
 */
export function setFrontMatterFields(raw, fields) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  if (!/^﻿?---\s*$/.test(lines[0] || '')) throw new Error('File không có YAML frontmatter.');
  const close = lines.findIndex((line, i) => i > 0 && /^---\s*$/.test(line));
  if (close < 0) throw new Error('Frontmatter thiếu dòng `---` đóng.');

  const added = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!KEY_RE.test(key)) throw new Error(`Tên field không hợp lệ: "${key}".`);
    const scalar = yamlScalar(value);
    const idx = lines.findIndex((line, i) => i > 0 && i < close && line.startsWith(`${key}:`));
    if (idx >= 0) {
      const rest = lines[idx].slice(key.length + 1);
      lines[idx] = `${key}: ${scalar}${splitComment(rest)}`;
    } else {
      added.push(`${key}: ${scalar}`);
    }
  }
  lines.splice(close, 0, ...added);
  return lines.join(eol);
}

/**
 * Thay đoạn nội dung đầu tiên của mục `## <heading>` (giữ các dòng ghi chú `>` phía sau).
 * Mục chưa có thì thêm vào cuối file.
 */
export function setBodySection(raw, heading, text) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const isHeading = (line) => line.trim() === `## ${heading}`;
  const start = lines.findIndex(isHeading);
  if (start < 0) {
    const trimmed = raw.replace(/\s+$/, '');
    return `${trimmed}${eol}${eol}## ${heading}${eol}${eol}${text}${eol}`;
  }
  let end = lines.findIndex((line, i) => i > start && /^##\s/.test(line));
  if (end < 0) end = lines.length;

  // Đoạn prompt cũ: các dòng không rỗng liền nhau đầu tiên, trừ dòng ghi chú `>`.
  let first = start + 1;
  while (first < end && !lines[first].trim()) first++;
  let last = first;
  while (last < end && lines[last].trim() && !lines[last].trimStart().startsWith('>')) last++;

  if (first >= end || lines[first].trimStart().startsWith('>')) {
    lines.splice(start + 1, 0, '', text);
  } else {
    lines.splice(first, last - first, text);
  }
  return lines.join(eol);
}

/**
 * @param {object} pack cần `statusFile`, `parseStatus` và `statusUpdate`
 *   (`{ protectedFields, timestampField, nextPromptField, nextPromptHeading }`)
 * @returns {(taskDir: string, input: { fields?: object, nextPrompt?: string, now?: Date }) =>
 *   { ok: true, file: string, changed: string[] } | { ok: false, errors: string[] }}
 */
export function createStatusUpdater(pack) {
  const cfg = pack.statusUpdate;
  return function updateStatus(taskDir, { fields = {}, nextPrompt, now = new Date() } = {}) {
    const file = path.join(taskDir, pack.statusFile);
    if (!fs.existsSync(file)) return { ok: false, errors: [`Thiếu ${pack.statusFile}.`] };
    if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) {
      return { ok: false, errors: ['`fields` phải là object { field: giá trị }.'] };
    }

    const errors = [];
    for (const key of Object.keys(fields)) {
      if (!KEY_RE.test(key)) errors.push(`Tên field không hợp lệ: "${key}".`);
      if (cfg.protectedFields.includes(key)) {
        errors.push(`Không được đặt "${key}" qua tool: field này cần người dùng xác nhận khi sửa trực tiếp file.`);
      }
      if (key === cfg.nextPromptField) errors.push(`Đặt "${key}" bằng tham số next_prompt, không đặt trong fields.`);
      if (key === cfg.timestampField) errors.push(`"${key}" được ghi tự động.`);
    }
    if (nextPrompt !== undefined && (typeof nextPrompt !== 'string' || !nextPrompt.trim())) {
      errors.push('`next_prompt` phải là chuỗi khác rỗng.');
    }
    if (!Object.keys(fields).length && nextPrompt === undefined) errors.push('Không có field nào để cập nhật.');
    if (errors.length) return { ok: false, errors };

    const all = { ...fields };
    // Path trong prompt luôn dùng `/` (`\` trong YAML/Markdown dễ thành escape).
    const prompt = nextPrompt === undefined ? undefined : nextPrompt.trim().replace(/\\/g, '/');
    if (prompt !== undefined) all[cfg.nextPromptField] = prompt;
    all[cfg.timestampField] = now.toISOString();

    let text = fs.readFileSync(file, 'utf8');
    try {
      text = setFrontMatterFields(text, all);
      if (prompt !== undefined) text = setBodySection(text, cfg.nextPromptHeading, prompt);
    } catch (err) {
      return { ok: false, errors: [err.message] };
    }
    const parsed = pack.parseStatus(text);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };

    fs.writeFileSync(file, text);
    return { ok: true, file, changed: Object.keys(all) };
  };
}
