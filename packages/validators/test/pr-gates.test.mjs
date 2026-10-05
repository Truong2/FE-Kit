import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { evaluatePrGates, hasCommandEvidence, evaluateWorkflowGates } from '../src/gates.mjs';
import { parseWorkflowStatus, parseFrontMatterLoose } from '../src/parse.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EVIDENCE = `# Báo cáo test

## 1. Command evidence log

| Command | Đã chạy thật? | Kết quả | Thời điểm | Ghi chú |
|---|---|---|---|---|
| \`npm test\` | Có | Passed | 2026-10-05 10:00 |  |

## 2. Coverage theo SRS/checklist
`;

const TEMPLATE_ONLY = `## 1. Command evidence log

| Command | Đã chạy thật? | Kết quả | Thời điểm | Ghi chú |
|---|---|---|---|---|
|  | Có / Không | Passed / Failed / Not run |  |  |
`;

function io(files) {
  return { exists: (rel) => rel in files, read: (rel) => files[rel] || '' };
}

const ALL_FILES = {
  'output/review-report.md': '# Review',
  'output/test-summary.md': EVIDENCE,
  'output/pr-summary.md': '# PR',
  'tracking/workflow-status.md': '---\n---\n',
};

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

describe('hasCommandEvidence', () => {
  it('nhận dòng command đã chạy thật', () => {
    expect(hasCommandEvidence(EVIDENCE)).toBe(true);
  });

  it('không tính dòng template, dòng chưa chạy và file thiếu bảng', () => {
    expect(hasCommandEvidence(TEMPLATE_ONLY)).toBe(false);
    expect(hasCommandEvidence(EVIDENCE.replace('| Có |', '| Không |'))).toBe(false);
    expect(hasCommandEvidence('# Báo cáo test')).toBe(false);
  });
});

describe('evaluatePrGates', () => {
  it('pass khi đủ artifact, evidence và status', () => {
    expect(evaluatePrGates({ data: READY, ...io(ALL_FILES) })).toMatchObject({ ok: true, errors: [] });
  });

  it('chấp nhận `passed` cho command evidence (CLI cũ từng từ chối)', () => {
    const data = { ...READY, command_evidence_status: 'passed', test_command_log_status: 'passed' };
    expect(evaluatePrGates({ data, ...io(ALL_FILES) }).ok).toBe(true);
  });

  it('fail khi status khai completed nhưng test-summary không có dòng thật', () => {
    const files = { ...ALL_FILES, 'output/test-summary.md': TEMPLATE_ONLY };
    const r = evaluatePrGates({ data: READY, ...io(files) });
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/chưa có dòng command đã chạy thật/);
  });

  it('field tự khai vắng mặt thì dựa vào evidence thật', () => {
    const { command_evidence_status, test_command_log_status, ...data } = READY;
    expect(evaluatePrGates({ data, ...io(ALL_FILES) }).ok).toBe(true);
    const files = { ...ALL_FILES, 'output/test-summary.md': TEMPLATE_ONLY };
    expect(evaluatePrGates({ data, ...io(files) }).ok).toBe(false);
  });

  it('scope diff tính từ git thắng field tự khai', () => {
    const r = evaluatePrGates({ data: READY, ...io(ALL_FILES), scope: { outOfPlan: ['src/store/global.ts'] } });
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/src\/store\/global\.ts/);

    const { scope_diff_status, ...noSelfReport } = READY;
    expect(evaluatePrGates({ data: noSelfReport, ...io(ALL_FILES), scope: { outOfPlan: [] } }).ok).toBe(true);
    expect(evaluatePrGates({ data: noSelfReport, ...io(ALL_FILES) }).ok).toBe(false);
  });

  it('fail khi thiếu artifact, còn bug High hoặc pr_status chưa ready', () => {
    const { 'output/pr-summary.md': _omit, ...missing } = ALL_FILES;
    expect(evaluatePrGates({ data: READY, ...io(missing) }).errors).toContain('Thiếu output/pr-summary.md');
    expect(evaluatePrGates({ data: { ...READY, high_issues_open: 1 }, ...io(ALL_FILES) }).ok).toBe(false);
    expect(evaluatePrGates({ data: { ...READY, pr_status: 'not_started' }, ...io(ALL_FILES) }).ok).toBe(false);
  });

  it('task Figma cần UI match review', () => {
    const data = { ...READY, figma_required: true, ui_match_review_status: 'not_started' };
    expect(evaluatePrGates({ data, ...io(ALL_FILES) }).ok).toBe(false);
    const ok = { ...READY, figma_required: true, ui_match_review_status: 'passed', playwright_screenshot_diff_status: 'manual_review' };
    expect(evaluatePrGates({ data: ok, ...io(ALL_FILES) }).ok).toBe(true);
  });
});

describe('tương thích ngược của schema v2', () => {
  const fixture = (name) => path.join(__dirname, 'fixtures', name, 'tracking', 'workflow-status.md');

  it('fixture v1.x đầy đủ field vẫn parse được', () => {
    for (const name of ['task-blocked-question', 'task-ready-to-cook']) {
      expect(parseWorkflowStatus(fs.readFileSync(fixture(name), 'utf8')).ok).toBe(true);
    }
  });

  it('frontmatter bỏ các field tự khai vẫn hợp lệ', () => {
    const raw = fs.readFileSync(fixture('task-ready-to-cook'), 'utf8');
    const selfReported = /^(token_budget_status|required_files_read_status|scope_diff_status|command_evidence_status|test_command_log_status|playwright_screenshot_diff_status|cook_status|review_report_status|test_summary_status|pr_summary_status|input_sync_report_status|figma_summary_status|ui_figma_review_report_status|rule_contract_application_status|clean_code_gate_status):.*\r?\n/gm;
    const trimmed = raw.replace(selfReported, '');
    expect(trimmed).not.toMatch(/token_budget_status/);
    const parsed = parseWorkflowStatus(trimmed);
    expect(parsed.ok).toBe(true);
    const gates = evaluateWorkflowGates({ data: parsed.data, body: parsed.body, exists: () => true, read: () => '' });
    expect(gates.errors).toEqual([]);
  });

  it('chấp nhận giá trị partial/manual_review/waived mà template đã dùng', () => {
    const raw = fs
      .readFileSync(fixture('task-ready-to-cook'), 'utf8')
      .replace(/^command_evidence_status:.*$/m, 'command_evidence_status: partial')
      .replace(/^playwright_screenshot_diff_status:.*$/m, 'playwright_screenshot_diff_status: manual_review');
    expect(parseWorkflowStatus(raw).ok).toBe(true);
  });

  it('Critical/High còn mở thì không được route sang test/pr', () => {
    const raw = fs
      .readFileSync(fixture('task-ready-to-cook'), 'utf8')
      .replace(/^high_issues_open:.*$/m, 'high_issues_open: 1')
      .replace(/^next_mode:.*$/m, 'next_mode: pr');
    const parsed = parseWorkflowStatus(raw);
    const gates = evaluateWorkflowGates({ data: parsed.data, body: parsed.body, exists: () => true, read: () => '' });
    expect(gates.errors.join('\n')).toMatch(/Critical\/High/);
  });
});

describe('parseFrontMatterLoose', () => {
  it('đọc frontmatter CRLF và giá trị có dấu hai chấm mà không kiểm schema', () => {
    const raw = '---\r\ntask_id: FE-1\r\nnext_prompt: "FE plan docs/frontend-tasks/FE-1: bản nháp"\r\nextra_field: 3\r\n---\r\n\r\n# Nội dung\r\n';
    const r = parseFrontMatterLoose(raw);
    expect(r.hasFrontMatter).toBe(true);
    expect(r.data).toMatchObject({ task_id: 'FE-1', extra_field: 3 });
    expect(r.data.next_prompt).toMatch(/bản nháp/);
  });

  it('báo không có frontmatter thay vì ném lỗi', () => {
    expect(parseFrontMatterLoose('# Không có frontmatter')).toMatchObject({ hasFrontMatter: false, data: {} });
  });
});
