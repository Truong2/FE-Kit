import matter from 'gray-matter';
import { WorkflowStatusSchema } from './schema.mjs';

/**
 * Đọc YAML frontmatter KHÔNG kiểm schema.
 *
 * Dùng cho các lệnh `check-*` đọc field nằm ngoài schema và cho hook (vốn
 * không được chặn chỉ vì file đang viết dở). Thay cho parser regex từng nằm
 * ở `bin/fe-kit.mjs`, vốn không xử lý CRLF, multiline hay giá trị có dấu `:`.
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
 * Parse + validate nội dung tracking/workflow-status.md.
 *
 * Trước đây mỗi nơi (CLI, ts-node script) tự viết regex
 * `/^([A-Za-z0-9_\-]+):\s*(.*)$/` để bóc frontmatter — không xử lý đúng
 * multiline, escape, hay giá trị chứa dấu `:`. gray-matter là YAML parser
 * thật (dùng js-yaml bên dưới), xử lý đúng chuẩn YAML.
 *
 * @param {string} raw nội dung file .md gốc
 * @returns {{ ok: true, data: object, body: string } | { ok: false, errors: string[] }}
 */
export function parseWorkflowStatus(raw) {
  let frontMatter;
  let body;
  try {
    const parsed = matter(raw);
    frontMatter = parsed.data;
    body = parsed.content;
  } catch (err) {
    return { ok: false, errors: [`Không parse được YAML frontmatter: ${err.message}`] };
  }

  const result = WorkflowStatusSchema.safeParse(frontMatter);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `workflow-status.md frontmatter — ${issue.path.join('.')}: ${issue.message}`
    );
    return { ok: false, errors };
  }

  return { ok: true, data: result.data, body };
}

/**
 * Một ô trong bảng questions.md được coi là "có nội dung thật" nếu
 * không phải placeholder (N/A, dấu gạch ngang, chỗ trống, <...>).
 */
export function realQuestionCell(v) {
  const t = String(v ?? '').trim();
  if (!t) return false;
  if (/^(n\/a|na|không áp dụng|khong ap dung|none|-|—|\.\.\.)$/i.test(t)) return false;
  if (/^<.*>$/.test(t)) return false;
  return true;
}
