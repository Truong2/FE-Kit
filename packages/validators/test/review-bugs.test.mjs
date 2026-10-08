import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIssueTable, countOpenIssuesBySeverity } from '../src/review-bugs.mjs';
import { evaluateWorkflowGates, evaluatePrGates } from '../src/gates.mjs';
import { evaluateModeEntry } from '../src/transitions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(__dirname, '..', '..', '..', 'core', 'templates');

const bugs = (rows, header = '| ID | Severity | Nhóm | File/evidence | Expected | Actual | Hướng xử lý | Nguyên nhân gốc | Owner | Trạng thái |') =>
  `# Danh sách bug từ review\n\n## Bug cần xử lý\n\n${header}\n|${header.split('|').slice(1, -1).map(() => '---').join('|')}|\n${rows.join('\n')}\n`;

const BUG_C1 = '| BUG-001 | Critical | api-contract | `src/a.ts` | 409 hiện lỗi | Không hiện | Map lỗi | implementation-error | Dev | Open |';
const BUG_H2 = '| BUG-002 | High | ui-figma | `src/b.tsx` | Đúng Figma | Lệch | Sửa spacing | figma-mismatch | Dev | Open |';
const BUG_L3 = '| BUG-003 | Low | clean-code | `src/c.ts` | Tên rõ | Tên mơ hồ | Đổi tên | rule-violation | Dev | Fixed |';

describe('parseIssueTable / countOpenIssuesBySeverity', () => {
  it('template gốc không có bug thật nào (dòng mẫu bị bỏ qua)', () => {
    const template = fs.readFileSync(path.join(TEMPLATES, 'tracking', 'review-bugs.md'), 'utf8');
    const report = fs.readFileSync(path.join(TEMPLATES, 'output', 'review-report.md'), 'utf8');
    expect(countOpenIssuesBySeverity(template, report)).toMatchObject({ critical: 0, high: 0, medium: 0, low: 0, confident: true, unknownStatusIds: [] });
  });

  it('đếm issue đang mở theo severity, bỏ issue đã đóng', () => {
    const r = countOpenIssuesBySeverity(bugs([BUG_C1, BUG_H2, BUG_L3]));
    expect(r).toMatchObject({ critical: 1, high: 1, low: 0, confident: true });
    expect(r.openIds.critical).toEqual(['BUG-001']);
    expect(r.unknownCategoryIds).toEqual([]);
    expect(r.unknownRootCauseIds).toEqual([]);
  });

  it('bảng "Trạng thái sau bugfix" ghi đè trạng thái theo Bug ID', () => {
    const md = bugs([BUG_C1, BUG_H2]) + '\n## Trạng thái sau bugfix\n\n| Bug ID | Trạng thái | Evidence fix |\n|---|---|---|\n| BUG-001 | Fixed | commit abc |\n';
    expect(countOpenIssuesBySeverity(md)).toMatchObject({ critical: 0, high: 1 });
  });

  it('bảng cũ 9 cột (chưa có Nguyên nhân gốc) vẫn đọc được, Nhóm tự do chỉ sinh cảnh báo', () => {
    const old = bugs(['| BUG-9 | High | SRS/API | `src/x.ts` | a | b | sửa | Dev | Open |'], '| ID | Severity | Nhóm | File/evidence | Expected | Actual | Hướng xử lý | Owner | Trạng thái |');
    const r = countOpenIssuesBySeverity(old);
    expect(r).toMatchObject({ high: 1, confident: true, unknownCategoryIds: ['BUG-9'], unknownRootCauseIds: [] });
  });

  it('gộp issue của review-report.md theo ID; review-bugs.md thắng khi trùng', () => {
    const report = '# Báo cáo review\n\n## 4. Issue phát hiện\n\n| ID | Severity | Nhóm | File/evidence | Expected | Actual | Owner | Trạng thái |\n|---|---|---|---|---|---|---|---|\n| BUG-001 | Critical | api-contract | a | b | c | Dev | Open |\n| ISS-7 | High | test | a | b | c | Dev | Open |\n';
    const closedInBugs = bugs([BUG_C1.replace('| Open |', '| Closed |')]);
    const r = countOpenIssuesBySeverity(closedInBugs, report);
    expect(r).toMatchObject({ critical: 0, high: 1 });
    expect(r.openIds.high).toEqual(['ISS-7']);
  });

  it('trạng thái trống/lạ là "không rõ"; thiếu cột Trạng thái thì không chắc', () => {
    expect(countOpenIssuesBySeverity(bugs([BUG_C1.replace('| Open |', '|  |')])).unknownStatusIds).toEqual(['BUG-001']);
    const noStatus = parseIssueTable('## Bug cần xử lý\n\n| ID | Severity | Ghi chú |\n|---|---|---|\n| BUG-1 | High | x |\n', /Bug cần xử lý/);
    expect(noStatus.confident).toBe(false);
  });
});

const none = { exists: () => false };
const withBugs = (md) => ({ exists: (rel) => rel === 'tracking/review-bugs.md', read: (rel) => (rel === 'tracking/review-bugs.md' ? md : '') });

describe('gate đối chiếu issue với field tự khai', () => {
  const data = { current_mode: 'review-mode', review_status: 'needs_bugfix', review_bug_status: 'open', bugfix_required: true, next_mode: 'bugfix' };

  it('ISSUES_COUNT_MISMATCH khi bảng còn Critical/High mà field ghi thấp hơn', () => {
    const r = evaluateWorkflowGates({ data: { ...data, critical_issues_open: 0, high_issues_open: 1 }, body: '', ...withBugs(bugs([BUG_C1, BUG_H2])) });
    const mismatch = r.issues.filter((i) => i.code === 'ISSUES_COUNT_MISMATCH');
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0].message).toMatch(/1 issue Critical đang mở \(BUG-001\) nhưng critical_issues_open=0/);
  });

  it('khớp số thì không báo', () => {
    const r = evaluateWorkflowGates({ data: { ...data, critical_issues_open: 1, high_issues_open: 1 }, body: '', ...withBugs(bugs([BUG_C1, BUG_H2])) });
    expect(r.issues.map((i) => i.code)).not.toContain('ISSUES_COUNT_MISMATCH');
  });

  it('header ID/Severity không nhận ra (đọc theo vị trí cột) thì chỉ cảnh báo', () => {
    const md = '## Bug cần xử lý\n\n| Mã lỗi | Mức | Trạng thái |\n|---|---|---|\n| BUG-1 | Critical | Open |\n';
    const r = evaluateWorkflowGates({ data: { ...data, critical_issues_open: 0 }, body: '', ...withBugs(md) });
    expect(r.issues.map((i) => i.code)).not.toContain('ISSUES_COUNT_MISMATCH');
    expect(r.warnings.join('\n')).toMatch(/chỉ cảnh báo/);
  });

  it('REVIEW_BUG_STATUS_MISMATCH khi review_bug_status đóng mà còn Critical/High mở', () => {
    const r = evaluateWorkflowGates({ data: { ...data, review_bug_status: 'resolved', critical_issues_open: 1 }, body: '', ...withBugs(bugs([BUG_C1])) });
    expect(r.issues.map((i) => i.code)).toContain('REVIEW_BUG_STATUS_MISMATCH');
    const ok = evaluateWorkflowGates({ data: { ...data, review_bug_status: 'resolved', critical_issues_open: 0 }, body: '', ...withBugs(bugs([BUG_L3])) });
    expect(ok.issues.map((i) => i.code)).not.toContain('REVIEW_BUG_STATUS_MISMATCH');
  });

  it('next_mode test/pr bị chặn theo số đếm từ bảng dù field ghi 0', () => {
    const r = evaluateWorkflowGates({ data: { ...data, next_mode: 'test', critical_issues_open: 0 }, body: '', ...withBugs(bugs([BUG_C1])) });
    expect(r.issues.map((i) => i.code)).toContain('NEXT_MODE_WITH_CRITICAL_HIGH');
  });

  it('PR gate và gate lúc vào pr dùng số đếm từ bảng', () => {
    const pr = evaluatePrGates({ data: { review_status: 'passed', critical_issues_open: 0 }, ...withBugs(bugs([BUG_H2])) });
    expect(pr.issues.map((i) => i.code)).toContain('PR_OPEN_BUGS');
    const clean = evaluatePrGates({ data: { review_status: 'passed' }, ...none, read: () => '' });
    expect(clean.issues.map((i) => i.code)).not.toContain('PR_OPEN_BUGS');

    const entry = evaluateModeEntry({ requested: 'pr', data: { review_status: 'passed' }, openIssues: { critical: 0, high: 1 } });
    expect(entry.reasonCodes).toEqual(['ENTRY_OPEN_BUGS']);
    expect(evaluateModeEntry({ requested: 'pr', data: { review_status: 'passed' }, openIssues: { critical: 0, high: 0 } }).allowed).toBe(true);
  });
});
