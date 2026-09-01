import matter from 'gray-matter';
import { WorkflowStatusSchema } from './schema.mjs';

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
