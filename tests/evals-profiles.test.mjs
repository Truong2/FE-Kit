import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILES, JUDGE_MODEL, evalArgs, getProfile, plannedRuns } from '../evals/profiles.mjs';
import { countCasesFor, renderLegSummary } from '../evals/run.mjs';
import { ENFORCE_RULE, caseTags, summarizeResults } from '../evals/summarize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = fs
  .readdirSync(path.join(ROOT, 'evals'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'evals', d.name, 'prompt.md')))
  .map((d) => d.name);

const flag = (args, name) => args[args.indexOf(name) + 1];

describe('profile eval', () => {
  it('mọi mức của profile đều có case để chạy', () => {
    for (const [name, p] of Object.entries(PROFILES)) {
      for (const leg of p.levels) expect(countCasesFor(leg, CASES), `${name}/${leg.level}`).toBeGreaterThan(0);
    }
  });

  it('mọi lệnh đều có trần chi phí, không chạy nhánh không plugin và không publish', () => {
    for (const [name, p] of Object.entries(PROFILES)) {
      for (const { level } of p.levels) {
        const args = evalArgs(name, { level });
        expect(Number(flag(args, '--max-cost-usd'))).toBe(p.maxCostUsd);
        expect(flag(args, '--ablation')).toBe('none');
        expect(flag(args, '--runs')).toBe(String(p.runs));
        expect(args).toContain('--no-publish');
      }
    }
  });

  it('pilot chỉ chạy một lượt với trần 1 USD', () => {
    expect(plannedRuns('pilot', (l) => countCasesFor(l, CASES))).toBe(1);
    expect(PROFILES.pilot.maxCostUsd).toBe(1);
  });

  it('chỉ dùng Sonnet và Opus: kiểm dây chuyền trên Sonnet, ra quyết định trên Opus, chấm bằng Sonnet', () => {
    for (const [name, p] of Object.entries(PROFILES)) {
      for (const { level } of p.levels) {
        const args = evalArgs(name, { level });
        expect(flag(args, '--model'), name).toMatch(/^claude-(sonnet|opus)-/);
        expect(flag(args, '--judge-model')).toBe(JUDGE_MODEL);
      }
    }
    expect(JUDGE_MODEL).toMatch(/^claude-sonnet-/);
    for (const name of ['pilot', 'smoke']) expect(PROFILES[name].model, name).toMatch(/^claude-sonnet-/);
    for (const name of ['gate', 'full']) expect(PROFILES[name].model, name).toMatch(/^claude-opus-/);
  });

  it('smoke chạy mọi case một lần, trần 5 USD, không ghi baseline', () => {
    expect(plannedRuns('smoke', (l) => countCasesFor(l, CASES))).toBe(CASES.length);
    expect(PROFILES.smoke).toMatchObject({ maxCostUsd: 5, baseline: false });
  });

  it('profile ghi baseline đủ để áp luật enforce: case gate ở cả hai mức, đủ số run', () => {
    for (const [name, p] of Object.entries(PROFILES).filter(([, p]) => p.baseline)) {
      expect(p.runs, name).toBeGreaterThanOrEqual(ENFORCE_RULE.minRuns);
      for (const level of ['warn', 'enforce']) {
        const leg = p.levels.find((l) => l.level === level);
        expect(leg, `${name} thiếu ${level}`).toBeTruthy();
        expect([undefined, 'gate']).toContain(leg.tag);
        expect(leg.cases).toBeUndefined();
      }
      expect(caseTags(ENFORCE_RULE.falseBlockCase)).toContain('gate');
    }
  });

  it('gate rẻ hơn full: chỉ case gate', () => {
    const gate = plannedRuns('gate', (l) => countCasesFor(l, CASES));
    const full = plannedRuns('full', (l) => countCasesFor(l, CASES));
    expect(gate).toBeLessThan(full);
    expect(evalArgs('gate', { level: 'warn' })).toContain('--tag');
  });

  it('báo lỗi khi profile hoặc mức không tồn tại; cho đổi model và trần', () => {
    expect(() => getProfile('nope')).toThrow(/Không có profile/);
    expect(() => evalArgs('pilot', { level: 'warn' })).toThrow(/không chạy mức/);
    const args = evalArgs('pilot', { level: 'enforce', model: 'x', maxCostUsd: 0.5 });
    expect(flag(args, '--model')).toBe('x');
    expect(flag(args, '--max-cost-usd')).toBe('0.5');
  });

  it('tóm tắt in điểm và chi phí mỗi run', () => {
    const b = summarizeResults(
      { costUsd: 0.6, aggregates: { overallScore: 1 }, cases: [{ name: 'a', aggregates: { score: 1 }, arms: { with: [{}, {}] } }] },
      { level: 'warn', model: 'm', version: 'v', profile: 'smoke', tagsOf: () => [] },
    );
    expect(renderLegSummary('smoke', b)).toMatch(/Chi phí 0\.60 USD cho 2 run \(0\.30 USD\/run\)/);
  });

  it('workflow CI chạy qua evals/run.mjs với profile', () => {
    const yml = fs.readFileSync(path.join(ROOT, '.github/workflows/plugin-evals.yml'), 'utf8');
    expect(yml).toMatch(/node evals\/run\.mjs "\$PROFILE" --level "\$LEVEL"/);
    for (const name of Object.keys(PROFILES)) expect(yml).toContain(name);
  });
});
