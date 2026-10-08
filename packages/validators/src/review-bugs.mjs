import { realQuestionCell } from './parse.mjs';

/**
 * Đếm issue đang mở từ bảng của `tracking/review-bugs.md` và
 * `output/review-report.md`, để gate không phải tin `critical_issues_open` /
 * `high_issues_open` tự khai.
 *
 * Cột được tìm theo tên header (có alias tiếng Anh), nên bảng cũ thiếu cột
 * "Nguyên nhân gốc" vẫn đọc được. `confident` = mọi bảng có dòng đều nhận diện
 * được cột ID, Severity và Trạng thái; khi không chắc, gate chỉ cảnh báo.
 */

export const ISSUE_SEVERITIES = ['critical', 'high', 'medium', 'low'];

/** Giá trị cột "Nhóm". Giá trị khác chỉ sinh cảnh báo. */
export const ISSUE_CATEGORIES = [
  'srs-logic',
  'api-contract',
  'error-handling',
  'ui-figma',
  'state-data',
  'a11y',
  'performance',
  'clean-code',
  'test',
  'scope',
  'other',
];

/** Giá trị cột "Nguyên nhân gốc". Giá trị khác chỉ sinh cảnh báo. */
export const ISSUE_ROOT_CAUSES = [
  'requirement-unclear',
  'plan-gap',
  'implementation-error',
  'missing-test',
  'figma-mismatch',
  'rule-violation',
  'environment',
  'other',
];

const COLUMN_ALIASES = {
  id: /^(id|bug id|issue id|mã)$/i,
  severity: /^(severity|mức độ|muc do)$/i,
  category: /^(nhóm|nhom|category|loại|loai)$/i,
  rootCause: /^(nguyên nhân gốc|nguyen nhan goc|root cause)$/i,
  status: /^(trạng thái|trang thai|status)$/i,
};

const SEVERITY_WORDS = [
  ['critical', /\b(critical|blocker)\b|nghiêm trọng|nghiem trong/i],
  ['high', /\bhigh\b|\bcao\b/i],
  ['medium', /\bmedium\b|trung bình|trung binh/i],
  ['low', /\blow\b|thấp|\bthap\b/i],
];

const CLOSED = /(fixed|closed|resolved|done|verified|accepted|won'?t ?fix|đã fix|da fix|đã sửa|da sua|đã đóng|da dong|đã xong|da xong|chấp nhận|chap nhan|không sửa|khong sua|hoàn tất|hoan tat)/i;
const OPEN = /(open|pending|blocked|in progress|reopen|mở|\bmo\b|đang|dang|chưa|chua|bị chặn|bi chan|cần sửa|can sua)/i;

/** Mức severity của ô; `null` nếu trống hoặc còn nguyên lựa chọn của template (vd `Critical / High / Medium / Low`). */
function severityOf(cell) {
  const found = SEVERITY_WORDS.filter(([, re]) => re.test(cell)).map(([s]) => s);
  return found.length === 1 ? found[0] : null;
}

/** `open` | `closed` | `unknown` (ô trống hoặc giá trị không nhận ra). */
function statusOf(cell) {
  const t = String(cell || '').trim();
  if (CLOSED.test(t)) return 'closed';
  if (OPEN.test(t)) return 'open';
  return 'unknown';
}

function splitRow(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim().replace(/^`|`$/g, ''));
}

/** Các dòng của bảng đầu tiên trong mục có heading khớp `headingRe`. */
function sectionTable(markdown, headingRe) {
  const lines = String(markdown || '').split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{2,3}\s/.test(l) && headingRe.test(l));
  if (start < 0) return null;
  const table = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,3}\s/.test(line)) break;
    if (/^\s*\|/.test(line)) table.push(line);
    else if (table.length) break;
  }
  if (table.length < 2) return null;
  const header = splitRow(table[0]);
  const rows = table.slice(1).filter((l) => !/^\s*\|\s*:?-+/.test(l)).map(splitRow);
  return { header, rows };
}

function columnIndex(header) {
  const index = {};
  header.forEach((name, i) => {
    for (const [key, re] of Object.entries(COLUMN_ALIASES)) {
      if (index[key] === undefined && re.test(name)) index[key] = i;
    }
  });
  return index;
}

/**
 * Đọc bảng issue trong một mục.
 * @param {string} markdown
 * @param {RegExp} headingRe heading của mục chứa bảng
 * @returns {{ rows: { id: string, severity: string, category: string, rootCause: string, status: string, hasCategory: boolean, hasRootCause: boolean }[], confident: boolean }}
 */
export function parseIssueTable(markdown, headingRe) {
  const table = sectionTable(markdown, headingRe);
  if (!table) return { rows: [], confident: true };
  const col = columnIndex(table.header);
  const confident = col.id !== undefined && col.severity !== undefined && col.status !== undefined;
  const rows = [];
  for (const cells of table.rows) {
    const id = cells[col.id ?? 0] || '';
    if (!realQuestionCell(id)) continue;
    const severity = severityOf(cells[col.severity ?? 1] || '');
    if (!severity) continue; // dòng mẫu của template hoặc chưa ghi severity
    rows.push({
      id,
      severity,
      category: col.category !== undefined ? cells[col.category] || '' : '',
      rootCause: col.rootCause !== undefined ? cells[col.rootCause] || '' : '',
      status: statusOf(col.status !== undefined ? cells[col.status] : ''),
      hasCategory: col.category !== undefined,
      hasRootCause: col.rootCause !== undefined,
    });
  }
  return { rows, confident: rows.length === 0 || confident };
}

/** Bảng "Trạng thái sau bugfix" của review-bugs.md: Bug ID → trạng thái mới. */
function statusOverrides(reviewBugsMd) {
  const table = sectionTable(reviewBugsMd, /Trạng thái sau bugfix|Status after bugfix/i);
  const map = new Map();
  if (!table) return map;
  const col = columnIndex(table.header);
  for (const cells of table.rows) {
    const id = cells[col.id ?? 0] || '';
    const status = statusOf(cells[col.status ?? 1]);
    if (realQuestionCell(id) && status !== 'unknown') map.set(id, status);
  }
  return map;
}

/**
 * Issue đang mở theo severity, gộp theo ID từ review-bugs.md (ưu tiên) và mục
 * "Issue phát hiện" của review-report.md.
 *
 * @param {string} reviewBugsMd nội dung `tracking/review-bugs.md` (rỗng nếu chưa có)
 * @param {string} reviewReportMd nội dung `output/review-report.md` (rỗng nếu chưa có)
 * @returns {{ critical: number, high: number, medium: number, low: number, openIds: Record<string, string[]>, unknownStatusIds: string[], unknownCategoryIds: string[], unknownRootCauseIds: string[], confident: boolean }}
 */
export function countOpenIssuesBySeverity(reviewBugsMd = '', reviewReportMd = '') {
  const bugs = parseIssueTable(reviewBugsMd, /Bug cần xử lý|Bugs?\b/i);
  const report = parseIssueTable(reviewReportMd, /Issue phát hiện|Issues?\b/i);
  const byId = new Map();
  for (const row of [...report.rows, ...bugs.rows]) byId.set(row.id, row); // review-bugs.md ghi sau nên thắng
  const overrides = statusOverrides(reviewBugsMd);

  const result = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    openIds: { critical: [], high: [], medium: [], low: [] },
    unknownStatusIds: [],
    unknownCategoryIds: [],
    unknownRootCauseIds: [],
    confident: bugs.confident && report.confident,
  };
  const categories = new Set(ISSUE_CATEGORIES);
  const rootCauses = new Set(ISSUE_ROOT_CAUSES);
  for (const row of byId.values()) {
    const status = overrides.get(row.id) || row.status;
    if (status === 'open') {
      result[row.severity] += 1;
      result.openIds[row.severity].push(row.id);
    } else if (status === 'unknown') {
      result.unknownStatusIds.push(row.id);
    }
    if (row.hasCategory && !categories.has(row.category.toLowerCase())) result.unknownCategoryIds.push(row.id);
    if (row.hasRootCause && !rootCauses.has(row.rootCause.toLowerCase())) result.unknownRootCauseIds.push(row.id);
  }
  return result;
}

/** `countOpenIssuesBySeverity` đọc thẳng từ task folder qua hàm `read(rel)`. */
export function countOpenIssuesInTask(read) {
  return countOpenIssuesBySeverity(read('tracking/review-bugs.md'), read('output/review-report.md'));
}
