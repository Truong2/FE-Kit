import matter from 'gray-matter';
import { WorkflowStatusSchema } from './schema.mjs';

export { parseFrontMatterLoose, realCell as realQuestionCell } from '@frontend-delivery-kit/engine';

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
    const errors = result.error.issues.map((issue) => schemaIssueMessage(issue, frontMatter));
    return { ok: false, errors };
  }

  return { ok: true, data: result.data, body };
}

/**
 * Thông báo lỗi schema bằng tiếng Việt: tên trường, giá trị đang ghi và giá trị hợp lệ,
 * để agent sửa được ngay trong một lần.
 */
function schemaIssueMessage(issue, data) {
  const field = issue.path.join('.') || '(frontmatter)';
  const actual = issue.path.reduce((o, k) => (o == null ? undefined : o[k]), data);
  const shown = JSON.stringify(actual);
  if (issue.code === 'invalid_value' && Array.isArray(issue.values)) {
    return actual === undefined
      ? `workflow-status.md frontmatter — thiếu trường ${field}. Giá trị hợp lệ: ${issue.values.join(' | ')}.`
      : `workflow-status.md frontmatter — ${field} = ${shown} không hợp lệ. Giá trị hợp lệ: ${issue.values.join(' | ')}.`;
  }
  if (issue.code === 'invalid_type') {
    return actual === undefined
      ? `workflow-status.md frontmatter — thiếu trường ${field} (kiểu ${issue.expected}).`
      : `workflow-status.md frontmatter — ${field} = ${shown} sai kiểu, cần ${issue.expected}.`;
  }
  return `workflow-status.md frontmatter — ${field}: ${issue.message}`;
}
