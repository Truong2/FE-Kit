#!/usr/bin/env node
/**
 * Ghi baseline eval vào repo và áp luật quyết định mức hook mặc định.
 *
 *   node evals/summarize.mjs --results eval-results.json --level enforce --model claude-opus-5-5 [--version 2.1.1]
 *   node evals/summarize.mjs --readme-only
 *
 * `--results` là file `--json` của `claude plugin eval`. Script đọc các field
 * được tài liệu hoá (`aggregates.overallScore`, `cases[].name`,
 * `cases[].aggregates.score`, `cases[].arms.with[]`, `costUsd`...) và giữ nguyên
 * `aggregates` gốc, vì các field chi tiết hơn chưa được tài liệu hoá.
 *
 * Ghi ra `evals/baselines/<version>/<model>-<level>.json` (commit vào repo) rồi
 * sinh lại `evals/baselines/README.md`. Chỉ dùng module có sẵn của Node.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BASELINES = path.join(HERE, 'baselines');

/** Luật bật `enforce` mặc định (ROADMAP.md, Phase 0). */
export const ENFORCE_RULE = {
  gateMinScore: 0.8,
  falseBlockCase: 'cook-proceeds-when-ready',
  maxRegression: 0.05,
  /** Ít hơn số run này mỗi case gate thì điểm quá nhiễu để quyết định. */
  minRuns: 3,
};

/** Tag của từng case, đọc từ frontmatter `tags: [a, b]` của prompt.md. */
export function caseTags(name, evalsDir = HERE) {
  const file = path.join(evalsDir, name, 'prompt.md');
  if (!fs.existsSync(file)) return [];
  const m = fs.readFileSync(file, 'utf8').match(/^tags:\s*\[([^\]]*)\]/m);
  return m ? m[1].split(',').map((t) => t.trim()).filter(Boolean) : [];
}

/** Rút gọn kết quả `--json` của `claude plugin eval` thành bản ghi baseline. */
export function summarizeResults(results, { level, model, version, profile = null, tagsOf = caseTags, recordedAt = new Date().toISOString() }) {
  const cases = (results.cases || []).map((c) => {
    const runs = c.arms?.with || [];
    return {
      name: c.name,
      tags: tagsOf(c.name),
      score: typeof c.aggregates?.score === 'number' ? c.aggregates.score : null,
      runs: runs.length,
      failed_runs: runs.filter((r) => r.error || r.aborted).length,
      skipped_paid_graders: runs.filter((r) => r.skippedPaidGraders).length,
    };
  });
  const totalRuns = cases.reduce((s, c) => s + c.runs, 0);
  const cost = typeof results.costUsd === 'number' ? results.costUsd : null;
  return {
    schema: 1,
    kit_version: version,
    model,
    level,
    profile,
    recorded_at: recordedAt,
    claude_version: results.claudeVersion ?? null,
    partial: Boolean(results.partial),
    partial_reason: results.partialReason ?? null,
    cost_usd: cost,
    total_runs: totalRuns,
    cost_per_run_usd: cost !== null && totalRuns ? Math.round((cost / totalRuns) * 10000) / 10000 : null,
    duration_seconds: results.durationSeconds ?? null,
    overall_score: results.aggregates?.overallScore ?? null,
    cases_passed: results.aggregates?.casesPassed ?? null,
    cases_total: results.aggregates?.casesTotal ?? cases.length,
    cases,
    raw_aggregates: results.aggregates ?? null,
  };
}

/**
 * Có bật `enforce` làm mặc định được không, so baseline `warn` với `enforce`
 * của cùng version và model.
 * @returns {{ ok: boolean, reasons: string[] }} `reasons` là lý do KHÔNG đạt
 */
export function enforceDecision(warn, enforce, rule = ENFORCE_RULE) {
  const reasons = [];
  if (!warn || !enforce) return { ok: false, reasons: ['Cần đủ baseline của cả warn và enforce.'] };
  for (const b of [warn, enforce]) {
    if (b.partial) reasons.push(`Baseline ${b.level} chưa chạy hết (${b.partial_reason || 'partial'}).`);
  }
  const warnScore = new Map(warn.cases.map((c) => [c.name, c.score]));
  for (const c of enforce.cases) {
    if (c.failed_runs) reasons.push(`${c.name}: ${c.failed_runs} run lỗi/aborted ở enforce.`);
    if (!c.tags.includes('gate')) continue;
    if (c.runs < rule.minRuns) reasons.push(`${c.name}: chỉ ${c.runs} run ở enforce, cần ≥ ${rule.minRuns}.`);
    if (c.score === null || c.score < rule.gateMinScore) {
      reasons.push(`${c.name}: ${fmt(c.score)} < ${rule.gateMinScore} ở enforce.`);
    }
    const w = warnScore.get(c.name);
    if (typeof w === 'number' && typeof c.score === 'number' && c.score < w - rule.maxRegression) {
      reasons.push(`${c.name}: enforce ${fmt(c.score)} kém warn ${fmt(w)} quá ${rule.maxRegression}.`);
    }
  }
  const falseBlock = enforce.cases.find((c) => c.name === rule.falseBlockCase);
  if (!falseBlock) reasons.push(`Thiếu case ${rule.falseBlockCase} (đo chặn nhầm).`);
  else if (falseBlock.score !== 1) reasons.push(`${rule.falseBlockCase}: ${fmt(falseBlock.score)} < 1 ở enforce (có chặn nhầm).`);
  return { ok: reasons.length === 0, reasons };
}

function fmt(score) {
  return typeof score === 'number' ? score.toFixed(2) : '—';
}

function readBaselines(dir = BASELINES) {
  const all = [];
  if (!fs.existsSync(dir)) return all;
  for (const version of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!version.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(dir, version.name))) {
      if (f.endsWith('.json')) all.push(JSON.parse(fs.readFileSync(path.join(dir, version.name, f), 'utf8')));
    }
  }
  return all;
}

/** Nội dung `evals/baselines/README.md`: một bảng cho mỗi cặp version + model. */
export function renderReadme(baselines) {
  const lines = [
    '# Baseline eval hành vi',
    '',
    'File này do `node evals/summarize.mjs` sinh ra, không sửa tay. Mỗi file JSON bên cạnh là kết quả một lượt `plugin-evals.yml` (một mức hook).',
    '',
    `Luật bật \`enforce\` mặc định: mọi case tag \`gate\` chạy ≥ ${ENFORCE_RULE.minRuns} lần và đạt ≥ ${ENFORCE_RULE.gateMinScore} ở enforce, \`${ENFORCE_RULE.falseBlockCase}\` đạt 1, enforce không kém warn quá ${ENFORCE_RULE.maxRegression} ở case gate, không có run lỗi.`,
    '',
    'Chỉ profile `gate` và `full` của `node evals/run.mjs` ghi baseline; `pilot` và `smoke` chạy quá ít lần nên chỉ in tóm tắt.',
  ];
  const groups = new Map();
  for (const b of baselines) {
    const key = `${b.kit_version} · ${b.model}`;
    if (!groups.has(key)) groups.set(key, {});
    groups.get(key)[b.level] = b;
  }
  const keys = [...groups.keys()].sort().reverse();
  if (!keys.length) lines.push('', 'Chưa có baseline nào.');
  for (const key of keys) {
    const { warn, enforce } = groups.get(key);
    const names = [...new Set([...(warn?.cases || []), ...(enforce?.cases || [])].map((c) => c.name))].sort();
    const score = (b, name) => fmt(b?.cases.find((c) => c.name === name)?.score);
    const tags = (name) => (warn || enforce).cases.find((c) => c.name === name)?.tags.join(', ') || '';
    lines.push('', `## ${key}`, '', '| Case | Tag | warn | enforce |', '|---|---|---|---|');
    for (const name of names) lines.push(`| \`${name}\` | ${tags(name)} | ${score(warn, name)} | ${score(enforce, name)} |`);
    lines.push(`| **Tổng** | | ${fmt(warn?.overall_score)} | ${fmt(enforce?.overall_score)} |`);
    const cost = [warn, enforce]
      .filter(Boolean)
      .map((b) => `${b.level} ${b.cost_usd ?? '—'} USD, ${b.cases[0]?.runs ?? '—'} run/case${b.cost_per_run_usd != null ? `, ${b.cost_per_run_usd} USD/run` : ''}`)
      .join('; ');
    lines.push('', `Chi phí: ${cost}.`);
    const d = enforceDecision(warn, enforce);
    lines.push('', d.ok ? '**Quyết định:** đạt luật, có thể bật `enforce` mặc định.' : '**Quyết định:** chưa đạt luật, giữ `warn`.');
    for (const r of d.reasons) lines.push(`- ${r}`);
  }
  return lines.join('\n') + '\n';
}

function arg(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Ghi baseline vào `evals/baselines/<version>/<model>-<level>.json`; trả đường dẫn. */
export function writeBaseline(baseline, dir = BASELINES) {
  const out = path.join(dir, baseline.kit_version, `${baseline.model}-${baseline.level}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(baseline, null, 2) + '\n');
  return out;
}

/** Sinh lại `evals/baselines/README.md` từ mọi baseline đã ghi. */
export function writeReadme(dir = BASELINES) {
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'README.md');
  fs.writeFileSync(out, renderReadme(readBaselines(dir)));
  return out;
}

function main(args) {
  if (!args.includes('--readme-only')) {
    const resultsFile = arg(args, '--results');
    const level = arg(args, '--level');
    const model = arg(args, '--model');
    if (!resultsFile || !['warn', 'enforce'].includes(level) || !model) {
      console.error('Dùng: node evals/summarize.mjs --results <file.json> --level warn|enforce --model <model> [--version <v>] [--profile <p>]');
      process.exit(1);
    }
    const version = arg(args, '--version') || JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
    const baseline = summarizeResults(JSON.parse(fs.readFileSync(resultsFile, 'utf8')), { level, model, version, profile: arg(args, '--profile') || null });
    console.log(`Đã ghi ${path.relative(ROOT, writeBaseline(baseline))}`);
  }
  console.log(`Đã sinh lại ${path.relative(ROOT, writeReadme())}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
