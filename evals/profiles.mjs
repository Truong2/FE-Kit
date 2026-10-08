/**
 * Các mức chạy eval hành vi, từ rẻ đến đắt. Nguồn duy nhất cho cả
 * `node evals/run.mjs <profile>` (chạy trên máy) và `plugin-evals.yml` (CI).
 *
 * Chi phí tỉ lệ với số lượt chạy = số case × `runs` × số mức hook; mỗi lượt là
 * một phiên Claude Code đầy đủ (main thread + subagent). Hook gần như không tốn
 * token (chỉ chèn vài dòng cảnh báo), nên đòn bẩy là số lượt, model và số turn.
 *
 * Model: chỉ dùng Sonnet và Opus, không dùng Haiku. Profile kiểm dây chuyền
 * (`pilot`, `smoke`) chạy Sonnet; profile ra quyết định (`gate`, `full`) chạy
 * Opus bản cao nhất.
 *
 * - `levels`: mỗi phần tử là một mức hook; `tag` (nếu có) chỉ chạy case mang
 *   tag đó ở mức này. Luật bật `enforce` chỉ xét case `gate`, nên `full` chạy
 *   case không phải gate ở một mức.
 * - `baseline`: kết quả có được ghi vào `evals/baselines/` hay không. Profile rẻ
 *   chạy quá ít lần để áp luật `enforce`, nên chỉ in tóm tắt.
 * - `maxCostUsd`: trần cứng cho mỗi mức (`--max-cost-usd`).
 */
export const SONNET = 'claude-sonnet-5-5';
export const OPUS = 'claude-opus-5-5';

export const PROFILES = {
  pilot: {
    description: 'Đo chi phí thật của một lượt: 1 case, 1 lần, mức enforce.',
    model: SONNET,
    runs: 1,
    levels: [{ level: 'enforce', cases: 'cook-refuses-when-blocked' }],
    maxCostUsd: 1,
    baseline: false,
  },
  smoke: {
    description: 'Mọi case chạy 1 lần trên Sonnet ở mức warn: kiểm scaffold và grader còn chạy đúng.',
    model: SONNET,
    runs: 1,
    levels: [{ level: 'warn' }],
    maxCostUsd: 5,
    baseline: false,
  },
  gate: {
    description: 'Case gate × 3 lần × warn và enforce trên Opus: đủ để áp luật bật enforce.',
    model: OPUS,
    runs: 3,
    levels: [
      { level: 'warn', tag: 'gate' },
      { level: 'enforce', tag: 'gate' },
    ],
    maxCostUsd: 10,
    baseline: true,
  },
  full: {
    description: 'Trước release, trên Opus: mọi case × 5 lần ở warn, case gate × 5 lần ở enforce.',
    model: OPUS,
    runs: 5,
    levels: [{ level: 'warn' }, { level: 'enforce', tag: 'gate' }],
    maxCostUsd: 30,
    baseline: true,
  },
};

/** Model chấm grader `llm`. */
export const JUDGE_MODEL = SONNET;

/** Tool được cấp cho phiên eval; case tự giới hạn thêm bằng `allowed_tools`. */
export const ALLOW_TOOLS = ['Write', 'Edit', 'mcp__plugin_fe_frontend-delivery__*'];

export function getProfile(name) {
  const profile = PROFILES[name];
  if (!profile) throw new Error(`Không có profile "${name}". Chọn: ${Object.keys(PROFILES).join(', ')}.`);
  return profile;
}

/**
 * Tham số cho `claude plugin eval` ở một mức hook của profile.
 * @returns {string[]}
 */
export function evalArgs(name, { level, model, json, outputDir, maxCostUsd, keepTemp = false, plugin = './plugins/fe', onlyCase } = {}) {
  const profile = getProfile(name);
  const leg = profile.levels.find((l) => l.level === level);
  if (!leg) throw new Error(`Profile "${name}" không chạy mức "${level}".`);
  // `--eval-dir` phải nằm trong thư mục plugin: run.mjs truyền `plugin` là bản sao tạm có kèm evals/.
  const args = ['plugin', 'eval', plugin, '--eval-dir', 'evals', '--ablation', 'none', '--scaffold'];
  args.push('--allow-tools', ...ALLOW_TOOLS);
  args.push('--allow-real-servers', '--trust-plugin');
  // `onlyCase` (cờ --case của run.mjs) thay bộ lọc của profile: chạy lại một case lẻ.
  if (onlyCase) args.push('--case', onlyCase);
  else if (leg.cases) args.push('--case', leg.cases);
  if (leg.tag && !onlyCase) args.push('--tag', leg.tag);
  args.push('--runs', String(profile.runs));
  args.push('--model', model || profile.model);
  args.push('--judge-model', JUDGE_MODEL);
  args.push('--threshold', '0');
  args.push('--max-cost-usd', String(maxCostUsd ?? profile.maxCostUsd));
  args.push('--no-publish');
  if (keepTemp) args.push('--keep-temp');
  if (json) args.push('--json', json);
  if (outputDir) args.push('--output-dir', outputDir);
  return args;
}

/** Ước lượng số lượt chạy của profile khi biết số case theo tag (để in trước khi chạy). */
export function plannedRuns(name, countCases) {
  const profile = getProfile(name);
  return profile.levels.reduce((sum, leg) => sum + countCases(leg) * profile.runs, 0);
}
