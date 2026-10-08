import matter from 'gray-matter';

/**
 * Đọc YAML frontmatter KHÔNG kiểm schema.
 *
 * Dùng cho các lệnh đọc field nằm ngoài schema và cho hook (vốn không được
 * chặn chỉ vì file đang viết dở). Thay cho parser regex cũ, vốn không xử lý
 * CRLF, multiline hay giá trị có dấu `:`.
 *
 * @returns {{ data: object, body: string, hasFrontMatter: boolean, error?: string }}
 */
export function parseFrontMatterLoose(raw) {
  const text = String(raw ?? '');
  const hasFrontMatter = /^﻿?---\r?\n/.test(text);
  if (!hasFrontMatter) return { data: {}, body: text, hasFrontMatter: false };
  try {
    const parsed = matter(text);
    return { data: parsed.data || {}, body: parsed.content, hasFrontMatter: true };
  } catch (err) {
    return { data: {}, body: text, hasFrontMatter: true, error: err.message };
  }
}

/**
 * Một ô trong bảng Markdown được coi là "có nội dung thật" nếu không phải
 * placeholder (N/A, dấu gạch ngang, chỗ trống, <...>).
 */
export function realCell(v) {
  const t = String(v ?? '').trim();
  if (!t) return false;
  if (/^(n\/a|na|không áp dụng|khong ap dung|none|-|—|\.\.\.)$/i.test(t)) return false;
  if (/^<.*>$/.test(t)) return false;
  return true;
}
