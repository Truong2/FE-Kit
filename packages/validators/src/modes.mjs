/**
 * Dữ liệu theo mode: artifact bắt buộc và rule cần nạp.
 * Nguồn: `core/rules/mode-output-contract.md` và mục "Rule loading theo mode"
 * của `core/SKILL.md`. MCP tool `fe_begin_mode` và hook cùng đọc bảng này,
 * nên sửa contract thì sửa ở đây.
 */

const STATUS = 'tracking/workflow-status.md';

/** Giữ chỗ cho thư mục screenshot Figma; mọi task đều có, kể cả task không có Figma. */
export const TASK_GITKEEP = 'output/figma-reference-screenshots/.gitkeep';

/** Artifact Markdown bắt buộc của mọi task. Gate workflow kiểm danh sách này. */
export const REQUIRED_TASK_DOCS = [
  'task.md',
  'planning/implementation-plan.md',
  'planning/build-checklist.md',
  'planning/questions.md',
  STATUS,
];

/**
 * File bắt buộc của mọi task: bản duy nhất cho validate-task (CLI, MCP, gói
 * ChatGPT skill). Khớp `required_task_files` trong `kit.yaml`.
 */
export const REQUIRED_TASK_FILES = [...REQUIRED_TASK_DOCS, TASK_GITKEEP];

/** File chỉ có khi mode tương ứng đã chạy. Khớp `conditional_task_files` trong `kit.yaml`. */
export const CONDITIONAL_TASK_FILES = [
  'tracking/input-sync-report.md',
  'tracking/cr-impact-report.md',
  'tracking/review-bugs.md',
  'output/figma-extraction-summary.md',
  'output/review-report.md',
  'output/test-summary.md',
  'output/pr-summary.md',
  'output/ui-figma-review-report.md',
];

/** Artifact phải tồn tại khi mode kết thúc (path tương đối trong task folder). */
export const MODE_REQUIRED_ARTIFACTS = {
  plan: [
    'task.md',
    'planning/implementation-plan.md',
    'planning/build-checklist.md',
    'planning/questions.md',
    STATUS,
  ],
  quick: [STATUS],
  'input-sync': ['tracking/input-sync-report.md', 'planning/questions.md', STATUS],
  figma: ['output/figma-extraction-summary.md', STATUS],
  cook: ['planning/build-checklist.md', STATUS],
  review: ['output/review-report.md', STATUS],
  bugfix: ['tracking/review-bugs.md', STATUS],
  test: ['output/test-summary.md', STATUS],
  'figma-review': ['output/ui-figma-review-report.md', STATUS],
  pr: ['output/pr-summary.md', STATUS],
};

/**
 * Subagent đảm nhận từng mode. `null` = chạy inline ở main thread.
 * Generator dùng bảng này để chèn đoạn delegation vào command của plugin;
 * hook dùng để biết SubagentStop nào thuộc mode đang chạy.
 */
export const AGENT_FOR_COMMAND = {
  plan: 'frontend-planner',
  'input-sync': 'frontend-planner',
  figma: 'frontend-figma-specialist',
  'figma-review': 'frontend-figma-specialist',
  cook: 'frontend-developer',
  bugfix: 'frontend-developer',
  review: 'frontend-reviewer',
  test: 'frontend-tester',
  pr: 'frontend-release-manager',
  quick: null,
};

/** Agent duy nhất được sửa source code của dự án. */
export const SOURCE_EDIT_AGENT = 'frontend-developer';

/** Path (POSIX, tương đối workspace) mà mọi agent của kit đều được ghi. */
export const KIT_WRITABLE_PREFIXES = ['docs/frontend-tasks/', 'docs/frontend-context/'];

const ALWAYS_RULES = [
  'core.md',
  'mode-output-contract.md',
  'plan-input-ledger-contract.md',
  'question-resolution-contract.md',
  'vietnamese-output.md',
  'efficiency-budget-contract.md',
  'untrusted-input-contract.md',
];

const RULES_BY_COMMAND = {
  'srs-api-contract.md': ['plan', 'input-sync', 'cook', 'quick', 'bugfix', 'review'],
  'clean-code-contract.md': ['cook', 'quick', 'bugfix', 'review'],
  'evidence-scope-contract.md': ['cook', 'review', 'test', 'figma-review', 'pr'],
  'review-bug-contract.md': ['review', 'bugfix', 'pr'],
};

const FIGMA_RULE = 'figma-ui-contract.md';
const FIGMA_ALWAYS = ['figma', 'figma-review'];
const FIGMA_WHEN_REQUIRED = ['plan', 'cook', 'quick', 'bugfix', 'review', 'pr'];

/**
 * Tên file rule cần đọc cho một mode.
 * @param {string} command lệnh đã chuẩn hoá (`plan`, `cook`, ...)
 * @param {{ figmaRequired?: boolean }} [opts]
 */
export function rulesForMode(command, { figmaRequired = false } = {}) {
  const rules = [...ALWAYS_RULES];
  for (const [rule, commands] of Object.entries(RULES_BY_COMMAND)) {
    if (commands.includes(command)) rules.push(rule);
  }
  if (FIGMA_ALWAYS.includes(command) || (figmaRequired && FIGMA_WHEN_REQUIRED.includes(command))) {
    rules.push(FIGMA_RULE);
  }
  return rules;
}

/** Mọi file rule mà ít nhất một mode có thể nạp. `doctor` kiểm repo dự án có đủ các file này. */
export function allRuleFiles() {
  return [...ALWAYS_RULES, ...Object.keys(RULES_BY_COMMAND), FIGMA_RULE];
}
