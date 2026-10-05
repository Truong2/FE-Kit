import { describe, it, expect } from 'vitest';
import { summarizeCommandEvidence, hasCommandEvidence, evaluatePrGates, evaluateWorkflowGates } from '../src/gates.mjs';

const table = (...rows) =>
  [
    '## 1. Command evidence log',
    '',
    '| Command | Đã chạy thật? | Kết quả | Thời điểm | Ghi chú |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '## 2. Coverage theo SRS/checklist',
  ].join('\n');

describe('summarizeCommandEvidence', () => {
  it('phản ví dụ của memo: ô "Đã chạy thật?" và "Kết quả" trống không phải bằng chứng', () => {
    const md = table('| `npm test` |  |  |  |  |');
    expect(hasCommandEvidence(md)).toBe(false);
    expect(summarizeCommandEvidence(md).incomplete).toEqual(['npm test']);
  });

  it('dòng còn nguyên lựa chọn của template không được tính', () => {
    const md = table('| `npm test` | Có / Không | Passed / Failed / Not run |  |  |');
    expect(hasCommandEvidence(md)).toBe(false);
    expect(summarizeCommandEvidence(md).incomplete).toEqual(['npm test']);
  });

  it('Có + Passed/Failed là đã chạy, kể cả biến thể không dấu và kết quả có chú thích', () => {
    const md = table(
      '| `npm test` | Có | Passed | 2026-10-05 10:00 |  |',
      '| `npm run lint` | co | Đạt (0 warning) | 2026-10-05 10:01 |  |',
      '| `npm run typecheck` | Yes | Failed | 2026-10-05 10:02 |  |'
    );
    const s = summarizeCommandEvidence(md);
    expect(s.ran).toEqual(['npm test', 'npm run lint', 'npm run typecheck']);
    expect(s.incomplete).toEqual([]);
    expect(s.latestFailed).toEqual(['npm run typecheck']);
  });

  it('Không kèm lý do là chưa chạy, không phải bằng chứng', () => {
    const md = table('| `npx playwright test` | Không | Not run |  | Chưa có môi trường staging |');
    const s = summarizeCommandEvidence(md);
    expect(s.notRun).toEqual(['npx playwright test']);
    expect(hasCommandEvidence(md)).toBe(false);
  });

  it('Có nhưng kết quả Not run là dòng mâu thuẫn', () => {
    expect(summarizeCommandEvidence(table('| `npm test` | Có | Not run | 2026-10-05 |  |')).incomplete).toEqual(['npm test']);
  });

  it('thiếu thời điểm vẫn tính đã chạy nhưng bị ghi nhận', () => {
    const s = summarizeCommandEvidence(table('| `npm test` | Có | Passed |  |  |'));
    expect(s.ran).toEqual(['npm test']);
    expect(s.missingTime).toEqual(['npm test']);
  });

  it('chỉ lần chạy gần nhất của cùng lệnh quyết định trạng thái Failed', () => {
    const md = table('| `npm test` | Có | Failed | 10:00 |  |', '| `npm test` | Có | Passed | 10:30 | Chạy lại sau bugfix |');
    expect(summarizeCommandEvidence(md).latestFailed).toEqual([]);
  });
});

describe('gate dùng bảng evidence', () => {
  const READY = {
    review_status: 'passed',
    review_bug_status: 'none',
    bugfix_required: false,
    critical_issues_open: 0,
    high_issues_open: 0,
    scope_diff_status: 'passed',
    command_evidence_status: 'completed',
    test_command_log_status: 'completed',
    figma_required: false,
    pr_status: 'ready',
  };
  const files = (summary) => ({
    'output/review-report.md': '# Review',
    'output/test-summary.md': summary,
    'output/pr-summary.md': '# PR',
    'tracking/workflow-status.md': '---\n---\n',
  });
  const io = (f) => ({ exists: (rel) => rel in f, read: (rel) => f[rel] || '' });

  it('PR bị chặn khi dòng evidence duy nhất có ô trống', () => {
    const r = evaluatePrGates({ data: READY, ...io(files(table('| `npm test` |  |  |  |  |'))) });
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/chưa có dòng command đã chạy thật/);
    expect(r.warnings.join('\n')).toMatch(/thiếu dữ liệu/);
  });

  it('PR qua khi có dòng thật, cảnh báo dòng thiếu dữ liệu và lệnh còn Failed', () => {
    const md = table(
      '| `npm test` | Có | Passed | 10:00 |  |',
      '| `npm run lint` |  |  |  |  |',
      '| `npm run e2e` | Có | Failed | 10:05 | Flaky, đã báo QA |'
    );
    const r = evaluatePrGates({ data: READY, ...io(files(md)) });
    expect(r.ok).toBe(true);
    const w = r.warnings.join('\n');
    expect(w).toMatch(/npm run lint/);
    expect(w).toMatch(/Failed: npm run e2e/);
  });

  it('validateWorkflow cũng cảnh báo dòng thiếu dữ liệu', () => {
    const r = evaluateWorkflowGates({
      data: { command_evidence_status: 'completed' },
      body: '',
      ...io(files(table('| `npm test` | Có | Passed | 10:00 |  |', '| `npm run lint` | Có |  |  |  |'))),
    });
    expect(r.warnings.join('\n')).toMatch(/thiếu dữ liệu.*npm run lint/);
  });
});
