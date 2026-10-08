#!/usr/bin/env node
/**
 * Chạy eval hành vi theo profile (xem `evals/profiles.mjs`) rồi in điểm và chi phí.
 *
 *   node evals/run.mjs <pilot|smoke|gate|full> [--model <m>] [--level warn|enforce]
 *                      [--max-cost-usd <n>] [--dry-run] [--print-levels]
 *
 * Chạy trên máy dùng credential của `claude` đang đăng nhập; CI dùng
 * `ANTHROPIC_API_KEY`. `CLAUDE_BIN` đổi lệnh `claude` (mặc định `claude`).
 * Profile có `baseline: true` thì ghi `evals/baselines/<version>/<model>-<level>.json`.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROFILES, getProfile, evalArgs, plannedRuns } from './profiles.mjs';
import { caseTags, summarizeResults, writeBaseline, writeReadme } from './summarize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function arg(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function caseNames() {
  return fs
    .readdirSync(HERE, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(HERE, d.name, 'prompt.md')))
    .map((d) => d.name);
}

/** Số case một mức hook của profile sẽ chạy. */
export function countCasesFor(leg, names = caseNames(), tagsOf = caseTags) {
  if (leg.cases) return names.filter((n) => n === leg.cases).length;
  if (leg.tag) return names.filter((n) => tagsOf(n).includes(leg.tag)).length;
  return names.length;
}

const fmtUsd = (n) => (typeof n === 'number' ? `${n.toFixed(2)} USD` : '—');
const fmtScore = (n) => (typeof n === 'number' ? n.toFixed(2) : '—');

/** Bảng markdown tóm tắt một mức hook: điểm, số run, chi phí. */
export function renderLegSummary(name, b) {
  const lines = [
    `### ${name} · ${b.level} · ${b.model}`,
    '',
    '| Case | Điểm | Run | Run lỗi |',
    '|---|---|---|---|',
    ...b.cases.map((c) => `| \`${c.name}\` | ${fmtScore(c.score)} | ${c.runs} | ${c.failed_runs} |`),
    '',
    `Tổng điểm ${fmtScore(b.overall_score)}. Chi phí ${fmtUsd(b.cost_usd)} cho ${b.total_runs} run (${fmtUsd(b.cost_per_run_usd)}/run).${b.partial ? ` Chạy dở: ${b.partial_reason || 'partial'}.` : ''}`,
  ];
  return lines.join('\n');
}

function main(args) {
  const name = args[0];
  if (!name || name.startsWith('-')) {
    console.error('Dùng: node evals/run.mjs <profile> [--model <m>] [--level warn|enforce] [--max-cost-usd <n>] [--dry-run]');
    for (const [k, p] of Object.entries(PROFILES)) console.error(`  ${k.padEnd(6)} ${p.description}`);
    process.exit(1);
  }
  const profile = getProfile(name);
  if (args.includes('--print-levels')) {
    console.log(JSON.stringify(profile.levels.map((l) => l.level)));
    return;
  }
  const model = arg(args, '--model') || profile.model;
  const only = arg(args, '--level');
  const maxCostUsd = arg(args, '--max-cost-usd') ? Number(arg(args, '--max-cost-usd')) : undefined;
  const legs = profile.levels.filter((l) => !only || l.level === only);
  if (!legs.length) throw new Error(`Profile "${name}" không chạy mức "${only}".`);

  const runs = legs.reduce((s, leg) => s + countCasesFor(leg) * profile.runs, 0);
  console.log(`Profile ${name}: ${profile.description}`);
  console.log(`Model ${model}. ${runs} lượt chạy (toàn profile: ${plannedRuns(name, (l) => countCasesFor(l))}). Trần ${maxCostUsd ?? profile.maxCostUsd} USD mỗi mức.`);

  const bin = process.env.CLAUDE_BIN || 'claude';
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let failed = false;

  for (const leg of legs) {
    const outDir = path.join(HERE, 'results', `${stamp}-${name}-${leg.level}`);
    const json = path.join(outDir, 'eval-results.json');
    const evalArgv = evalArgs(name, { level: leg.level, model, json, outputDir: outDir, maxCostUsd });
    console.log(`\n$ EVAL_FE_KIT_HOOKS=${leg.level} ${bin} ${evalArgv.join(' ')}`);
    if (args.includes('--dry-run')) continue;

    fs.mkdirSync(outDir, { recursive: true });
    const r = spawnSync(bin, evalArgv.map((a) => (process.platform === 'win32' && /[\s*]/.test(a) ? `"${a}"` : a)), {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, EVAL_FE_KIT_HOOKS: leg.level },
    });
    if (!fs.existsSync(json)) {
      console.error(`Không có ${path.relative(ROOT, json)} (eval lỗi trước khi ghi kết quả, exit ${r.status}).`);
      failed = true;
      continue;
    }
    const baseline = summarizeResults(JSON.parse(fs.readFileSync(json, 'utf8')), { level: leg.level, model, version, profile: name });
    const summary = renderLegSummary(name, baseline);
    console.log(`\n${summary}`);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n\n`);
    if (profile.baseline) console.log(`Đã ghi ${path.relative(ROOT, writeBaseline(baseline))}`);
  }
  if (profile.baseline && !args.includes('--dry-run')) writeReadme();
  if (failed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
