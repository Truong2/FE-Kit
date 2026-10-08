import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseProposals,
  approvedProposalIds,
  validateProposals,
  validateRetroFolder,
  exportUpstreamProposals,
  teamRulesFor,
  buildRetroData,
  renderRetroSummary,
  TEAM_RULES_MAX_CHARS,
} from '../src/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'core', 'templates', 'retro', 'proposals.md'), 'utf8');

const proposals = (rows) =>
  `# Đề xuất\n\n## Đề xuất\n\n| ID | Bằng chứng | Đích | Thay đổi đề xuất | Metric theo dõi | Phạm vi | Trạng thái | Người duyệt |\n|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
const R1 = '| R-01 | 5 bug api-contract / plan-gap | team-rules.md#plan | Plan liệt kê mọi error code của API | api-contract / plan-gap | project | Proposed |  |';
const R2 = '| R-02 | ENTRY_QUESTIONS_BLOCKING 8 lần | rule:question-resolution-contract.md | Gom câu hỏi theo bên trả lời | ENTRY_QUESTIONS_BLOCKING | upstream | Approved | Lan |';

let dir;
afterEach(() => dir && fs.rmSync(dir, { recursive: true, force: true }));

describe('bảng đề xuất', () => {
  it('đọc template và bảng thật; ID đã duyệt gồm Approved và Applied', () => {
    expect(parseProposals(TEMPLATE).rows.map((r) => [r.id, r.status, r.scope])).toEqual([['R-01', 'proposed', 'project']]);
    const md = proposals([R1, R2, '| R-03 | x | y | z | m | project | Applied | Minh |', '| R-04 | x | y | z | m | project | Rejected | Minh |']);
    expect([...approvedProposalIds(md)]).toEqual(['R-02', 'R-03']);
  });

  it('gate: đề xuất đã duyệt phải có người duyệt', () => {
    expect(validateProposals(proposals([R1, R2]))).toMatchObject({ ok: true, issues: [] });
    const missing = validateProposals(proposals([R2.replace('| Lan |', '|  |')]));
    expect(missing.issues).toEqual([{ code: 'RETRO_APPROVAL_INCOMPLETE', message: 'Đề xuất R-02 đã duyệt nhưng thiếu Người duyệt.' }]);
    expect(validateProposals('# Không có bảng').issues.map((i) => i.code)).toEqual(['RETRO_PROPOSALS_TABLE_MISSING']);
  });

  it('cảnh báo trạng thái, phạm vi lạ và thiếu bằng chứng', () => {
    const res = validateProposals(proposals(['| R-09 |  | y | z | m | team | Done |  |']));
    expect(res.ok).toBe(true);
    expect(res.warnings).toEqual([
      'Đề xuất R-09 có Trạng thái lạ; dùng Proposed, Approved, Rejected hoặc Applied.',
      'Đề xuất R-09 có Phạm vi lạ; dùng project hoặc upstream.',
      'Đề xuất R-09 thiếu Bằng chứng.',
    ]);
  });

  it('thư mục retro phải đủ file; export chỉ lấy đề xuất upstream đã duyệt', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-retro-'));
    expect(validateRetroFolder(dir).issues.map((i) => i.message)).toEqual(['Thiếu retro-data.json', 'Thiếu retro-report.md', 'Thiếu proposals.md']);
    for (const f of ['retro-data.json', 'retro-report.md']) fs.writeFileSync(path.join(dir, f), '{}');
    fs.writeFileSync(path.join(dir, 'proposals.md'), proposals([R1, R2]));
    expect(validateRetroFolder(dir).ok).toBe(true);

    const exported = exportUpstreamProposals(proposals([R1, R2]));
    expect(exported).toMatch(/^# Đề xuất cho FE-Kit/);
    expect(exported).toMatch(/## R-02: Gom câu hỏi theo bên trả lời/);
    expect(exported).not.toMatch(/R-01/);
    expect(exportUpstreamProposals(proposals([R1]))).toBe('');
  });
});

describe('rule của team', () => {
  function teamRules(text) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-team-'));
    fs.mkdirSync(path.join(dir, 'docs', 'frontend-context'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'frontend-context', 'team-rules.md'), text);
  }

  it('nạp mục của mode và mục Mọi mode; mode khác thì không', () => {
    teamRules('# Rule của team\n\n## Mọi mode\n\n- Luôn ghi nguồn.\n\n## cook, bugfix\n\n- Dùng apiClient.\n\n## review\n\n- Kiểm a11y.\n');
    const cook = teamRulesFor({ workspaceRoot: dir, command: 'cook' });
    expect(cook.text).toBe('## Mọi mode\n\n- Luôn ghi nguồn.\n\n## cook, bugfix\n\n- Dùng apiClient.');
    expect(cook).toMatchObject({ source: 'docs/frontend-context/team-rules.md', truncated: false });
    expect(teamRulesFor({ workspaceRoot: dir, command: 'review' }).text).toMatch(/Kiểm a11y/);
    expect(teamRulesFor({ workspaceRoot: dir, command: 'review' }).text).not.toMatch(/apiClient/);
  });

  it('không có file hoặc không có mục phù hợp thì không nạp; vượt trần thì cắt', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-team-'));
    expect(teamRulesFor({ workspaceRoot: dir, command: 'cook' })).toBeNull();
    fs.rmSync(dir, { recursive: true });
    teamRules('## review\n\n- x\n');
    expect(teamRulesFor({ workspaceRoot: dir, command: 'cook' })).toBeNull();
    fs.rmSync(dir, { recursive: true });
    teamRules(`## cook\n\n${'- dài\n'.repeat(2000)}`);
    const long = teamRulesFor({ workspaceRoot: dir, command: 'cook' });
    expect(long.truncated).toBe(true);
    expect(long.text.length).toBeLessThanOrEqual(TEAM_RULES_MAX_CHARS);
  });
});

describe('số liệu retro', () => {
  function task(name, { bugs, log }) {
    const t = path.join(dir, 'docs', 'frontend-tasks', name);
    fs.mkdirSync(path.join(t, 'tracking'), { recursive: true });
    if (bugs) {
      fs.writeFileSync(
        path.join(t, 'tracking', 'review-bugs.md'),
        `## Bug cần xử lý\n\n| ID | Severity | Nhóm | File/evidence | Expected | Actual | Hướng xử lý | Nguyên nhân gốc | Owner | Trạng thái |\n|---|---|---|---|---|---|---|---|---|---|\n${bugs.join('\n')}\n`
      );
    }
    if (log) fs.writeFileSync(path.join(t, 'tracking', 'run-log.jsonl'), log.map((r) => JSON.stringify({ v: 1, pack: 'fe', task: name, source: 'hook', ...r })).join('\n') + '\n');
  }

  it('gộp run-log và bug của mọi task theo nhóm và nguyên nhân gốc', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-retro-data-'));
    task('FE-1', {
      bugs: ['| B1 | High | api-contract | a | b | c | d | plan-gap | Dev | Open |', '| B2 | Low | clean-code | a | b | c | d | rule-violation | Dev | Fixed |'],
      log: [
        { ts: '2026-10-01T00:00:00Z', event: 'mode_end', mode: 'cook', outcome: 'blocked', attempt: 1, codes: ['SCOPE_OUT_OF_PLAN'] },
        { ts: '2026-10-01T00:01:00Z', event: 'mode_end', mode: 'cook', outcome: 'pass', attempt: 2 },
      ],
    });
    task('FE-2', { bugs: ['| B1 | Critical | api-contract | a | b | c | d | plan-gap | Dev | Open |'], log: [{ ts: '2026-09-01T00:00:00Z', event: 'mode_end', mode: 'plan', outcome: 'pass', attempt: 1 }] });
    task('FE-3', {});

    const data = buildRetroData(dir, { now: new Date('2026-10-08T00:00:00Z') });
    expect(data).toMatchObject({ schema: 1, generated_at: '2026-10-08T00:00:00.000Z', tasks_total: 3, tasks_included: 3 });
    expect(data.issues).toMatchObject({ total: 3, open: 2, by_category_root_cause: { 'api-contract / plan-gap': 2, 'clean-code / rule-violation': 1 } });
    expect(data.runlog.top_codes).toEqual([['SCOPE_OUT_OF_PLAN', 1]]);
    expect(data.runlog.modes.cook).toMatchObject({ completed: 1, first_pass: 0, blocked: 1 });
    expect(data.per_task.find((t) => t.task === 'FE-1')).toMatchObject({ loops: 1, issues: 2, open_issues: 1 });

    const recent = buildRetroData(dir, { since: '2026-09-15' });
    expect(recent.per_task.map((t) => t.task)).toEqual(['FE-1']);
    expect(renderRetroSummary(data)).toMatch(/\| api-contract \/ plan-gap \| 2 \|/);
  });
});
