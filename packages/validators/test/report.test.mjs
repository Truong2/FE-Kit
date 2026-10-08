import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarizeRunLog, buildReport, renderReport } from '../src/report.mjs';
import { RUNLOG_FILE } from '../src/runlog.mjs';

const ev = (event, extra = {}) => ({ v: 1, ts: '2026-10-08T00:00:00.000Z', pack: 'fe', task: 'FE-1', source: 'hook', actor: 'claude', event, ...extra });

describe('summarizeRunLog', () => {
  it('đếm lượt hoàn tất, pass ngay lần đầu, vòng bị chặn và thời gian', () => {
    const s = summarizeRunLog([
      ev('mode_start', { mode: 'plan' }),
      ev('mode_end', { mode: 'plan', outcome: 'pass', attempt: 1, duration_ms: 60000 }),
      ev('mode_start', { mode: 'cook' }),
      ev('mode_end', { mode: 'cook', outcome: 'blocked', attempt: 1, codes: ['END_STATUS_NOT_UPDATED'] }),
      ev('mode_end', { mode: 'cook', outcome: 'blocked', attempt: 2, codes: ['END_STATUS_NOT_UPDATED'] }),
      ev('mode_end', { mode: 'cook', outcome: 'released', attempt: 3, duration_ms: 300000, codes: ['SCOPE_OUT_OF_PLAN'] }),
      ev('mode_start', { mode: 'review', source: 'cli', actor: 'codex' }),
      ev('mode_end', { mode: 'review', source: 'cli', actor: 'codex', outcome: 'failed', attempt: 1, codes: ['ARTIFACT_REVIEW_REPORT_MISSING'] }),
      ev('mode_end', { mode: 'review', source: 'cli', actor: 'codex', outcome: 'pass', attempt: 2, duration_ms: 1000 }),
    ]);
    expect(s.modes.plan).toMatchObject({ starts: 1, completed: 1, firstPass: 1, blocked: 0 });
    expect(s.modes.cook).toMatchObject({ starts: 1, completed: 1, firstPass: 0, blocked: 2, released: 1 });
    expect(s.modes.review).toMatchObject({ completed: 1, firstPass: 0, failed: 1 });
    expect(s.modes.cook.durationsMs).toEqual([300000]);
    expect(s.codes).toEqual({ END_STATUS_NOT_UPDATED: 2, SCOPE_OUT_OF_PLAN: 1, ARTIFACT_REVIEW_REPORT_MISSING: 1 });
    expect(s.actors).toEqual({ claude: 6, codex: 3 });
  });

  it('đếm chặn lúc vào mode, từ chối sửa file, override, mode bỏ dở và validate', () => {
    const s = summarizeRunLog([
      ev('entry_blocked', { mode: 'cook', codes: ['ENTRY_QUESTIONS_BLOCKING'] }),
      ev('edit_denied', { mode: 'cook', codes: ['EDIT_GATE_CLOSED', 'ENTRY_QUESTIONS_BLOCKING'] }),
      ev('edit_warned', { codes: ['EDIT_ROLE_FORBIDDEN'] }),
      ev('override_requested'),
      ev('mode_abandoned', { mode: 'review' }),
      ev('validate', { outcome: 'ok' }),
      ev('validate', { outcome: 'failed', codes: ['PR_STATUS_NOT_READY'] }),
    ]);
    expect(s.entryBlocked).toEqual({ ENTRY_QUESTIONS_BLOCKING: 1 });
    expect(s.denials).toEqual({ EDIT_GATE_CLOSED: 1, ENTRY_QUESTIONS_BLOCKING: 1, EDIT_ROLE_FORBIDDEN: 1 });
    expect(s.codes.ENTRY_QUESTIONS_BLOCKING).toBe(2);
    expect(s).toMatchObject({ overrides: 1, abandoned: 1, validates: { ok: 1, failed: 1 } });
  });

  it('since bỏ qua sự kiện cũ hơn', () => {
    const s = summarizeRunLog([ev('override_requested', { ts: '2026-01-01T00:00:00Z' }), ev('override_requested')], { since: '2026-06-01' });
    expect(s.overrides).toBe(1);
    expect(s.events).toBe(1);
  });
});

describe('buildReport / renderReport', () => {
  let repo;
  afterEach(() => repo && fs.rmSync(repo, { recursive: true, force: true }));

  function writeLog(task, records) {
    const dir = path.join(repo, 'docs', 'frontend-tasks', task, 'tracking');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'frontend-tasks', task, RUNLOG_FILE), records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  }

  it('repo chưa có run-log', () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-report-'));
    const report = buildReport({ repoRoot: repo });
    expect(report.tasks).toEqual([]);
    expect(renderReport(report)).toMatch(/Chưa có run-log nào/);
  });

  it('gộp theo repo và theo task, bỏ qua task không có log', () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-report-'));
    writeLog('FE-1', [ev('mode_start', { mode: 'plan' }), ev('mode_end', { mode: 'plan', outcome: 'pass', attempt: 1, duration_ms: 120000 })]);
    writeLog('FE-2', [ev('mode_end', { mode: 'cook', outcome: 'blocked', attempt: 1, codes: ['END_STATUS_NOT_UPDATED'], task: 'FE-2' })]);
    fs.mkdirSync(path.join(repo, 'docs', 'frontend-tasks', 'FE-3', 'tracking'), { recursive: true });

    const report = buildReport({ repoRoot: repo });
    expect(report.tasks.map((t) => t.task)).toEqual(['FE-1', 'FE-2']);
    expect(report.total.modes.plan.firstPass).toBe(1);

    const md = renderReport(report);
    expect(md).toMatch(/\| plan \| 1 \| 1 \| 1 \(100%\) \| 0 \| 0 \| 2\.0 phút \|/);
    expect(md).toMatch(/\| `END_STATUS_NOT_UPDATED` \| 1 \|/);
    expect(md).toMatch(/## Theo task/);
  });

  it('một task cụ thể vẫn có mục dù chưa có log', () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-report-'));
    const report = buildReport({ repoRoot: repo, task: 'docs/frontend-tasks/FE-9' });
    expect(report.tasks.map((t) => t.task)).toEqual(['FE-9']);
  });
});
