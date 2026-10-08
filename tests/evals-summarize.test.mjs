import { describe, it, expect } from 'vitest';
import { summarizeResults, enforceDecision, renderReadme, caseTags } from '../evals/summarize.mjs';

const TAGS = {
  'cook-proceeds-when-ready': ['gate', 'cook', 'false-block'],
  'cook-refuses-when-blocked': ['gate', 'cook'],
  'review-writes-report': ['review'],
};

function results(scores, extra = {}) {
  return {
    schemaVersion: 1,
    costUsd: 12.5,
    claudeVersion: '2.1.300',
    aggregates: { overallScore: 0.9, casesPassed: 3, casesTotal: 3 },
    cases: Object.entries(scores).map(([name, score]) => ({
      name,
      aggregates: { score },
      arms: { with: Array.from({ length: 5 }, () => ({})) },
    })),
    ...extra,
  };
}

const baseline = (level, scores, extra) =>
  summarizeResults(results(scores, extra), { level, model: 'm', version: '9.9.9', tagsOf: (n) => TAGS[n] || [], recordedAt: 'T' });

const GOOD = { 'cook-proceeds-when-ready': 1, 'cook-refuses-when-blocked': 0.9, 'review-writes-report': 0.6 };

describe('summarizeResults', () => {
  it('rút gọn field đã tài liệu hoá và giữ aggregates gốc', () => {
    const b = baseline('enforce', GOOD);
    expect(b).toMatchObject({ level: 'enforce', kit_version: '9.9.9', cost_usd: 12.5, overall_score: 0.9, cases_total: 3 });
    expect(b.cases[0]).toEqual({ name: 'cook-proceeds-when-ready', tags: TAGS['cook-proceeds-when-ready'], score: 1, runs: 5, failed_runs: 0, skipped_paid_graders: 0 });
    expect(b.raw_aggregates).toEqual(results(GOOD).aggregates);
  });

  it('đọc tag thật từ prompt.md của case', () => {
    expect(caseTags('cook-proceeds-when-ready')).toEqual(['gate', 'cook', 'false-block']);
  });
});

describe('enforceDecision', () => {
  it('đạt khi case gate ≥ 0.8, không chặn nhầm, không tụt so với warn', () => {
    expect(enforceDecision(baseline('warn', GOOD), baseline('enforce', GOOD))).toEqual({ ok: true, reasons: [] });
  });

  it('case không có tag gate được phép thấp', () => {
    const enforce = baseline('enforce', { ...GOOD, 'review-writes-report': 0.2 });
    expect(enforceDecision(baseline('warn', GOOD), enforce).ok).toBe(true);
  });

  it('không đạt khi case gate dưới ngưỡng', () => {
    const d = enforceDecision(baseline('warn', GOOD), baseline('enforce', { ...GOOD, 'cook-refuses-when-blocked': 0.7 }));
    expect(d.ok).toBe(false);
    expect(d.reasons.join('\n')).toMatch(/cook-refuses-when-blocked: 0.70 < 0.8/);
  });

  it('không đạt khi enforce chặn nhầm (case false-block < 1)', () => {
    const d = enforceDecision(baseline('warn', GOOD), baseline('enforce', { ...GOOD, 'cook-proceeds-when-ready': 0.8 }));
    expect(d.reasons.join('\n')).toMatch(/có chặn nhầm/);
  });

  it('không đạt khi enforce tụt quá 0.05 so với warn', () => {
    const warn = baseline('warn', { ...GOOD, 'cook-refuses-when-blocked': 1 });
    const d = enforceDecision(warn, baseline('enforce', { ...GOOD, 'cook-refuses-when-blocked': 0.9 }));
    expect(d.reasons.join('\n')).toMatch(/kém warn/);
  });

  it('không đạt khi thiếu một mức, baseline partial, hoặc có run lỗi', () => {
    expect(enforceDecision(null, baseline('enforce', GOOD)).ok).toBe(false);
    expect(enforceDecision(baseline('warn', GOOD), baseline('enforce', GOOD, { partial: true, partialReason: 'cost' })).reasons.join()).toMatch(/chưa chạy hết/);
    const broken = baseline('enforce', GOOD);
    broken.cases[1].failed_runs = 2;
    expect(enforceDecision(baseline('warn', GOOD), broken).reasons.join()).toMatch(/run lỗi/);
  });
});

describe('renderReadme', () => {
  it('in bảng warn/enforce và quyết định cho từng version + model', () => {
    const md = renderReadme([baseline('warn', GOOD), baseline('enforce', GOOD)]);
    expect(md).toMatch(/## 9\.9\.9 · m/);
    expect(md).toMatch(/\| `cook-refuses-when-blocked` \| gate, cook \| 0\.90 \| 0\.90 \|/);
    expect(md).toMatch(/có thể bật `enforce` mặc định/);
  });

  it('chưa có baseline thì nói rõ', () => {
    expect(renderReadme([])).toMatch(/Chưa có baseline nào/);
  });
});
