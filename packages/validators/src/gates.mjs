/**
 * Gate logic dùng chung cho FE plan/cook/review/pr workflow.
 *
 * LỊCH SỬ: logic này trước đây tồn tại 2 bản gần như y hệt —
 * `countOpenBlockingQuestionsInTask` trong bin/fe-kit.mjs và
 * `countOpenBlockingQuestions` trong scripts/validate-workflow.ts.
 * Từ v1.0.0, đây là bản DUY NHẤT; cả CLI lẫn script standalone đều
 * import từ đây để tránh drift.
 *
 * v2.0.0: thêm `evaluatePrGates` (trước đây CLI và core/scripts mỗi nơi
 * một bản, lệch tập giá trị hợp lệ), `hasCommandEvidence`, cảnh báo chuyển
 * mode, và kiểm tra scope diff tính từ git thay vì tin field tự khai.
 */
import { checkRecordedNextMode, normalizeCommand } from './transitions.mjs';

function norm(v) {
  return String(v ?? '').trim().toLowerCase();
}

function bool(v) {
  return v === true || norm(v) === 'true';
}

/**
 * Một ô trong bảng questions.md được coi là "có nội dung thật" nếu
 * không phải placeholder (N/A, dấu gạch ngang, chỗ trống, <...>).
 */
export function realQuestionCell(v) {
  const t = String(v ?? '').trim();
  if (!t) return false;
  if (/^(n\/a|na|không áp dụng|khong ap dung|none|-|—|\.\.\.)$/i.test(t)) return false;
  if (/^<.*>$/.test(t)) return false;
  return true;
}

/**
 * Đếm số câu hỏi blocking đang mở trong planning/questions.md.
 * @param {string} questionsMarkdown nội dung file questions.md (rỗng nếu chưa tồn tại)
 */
export function countOpenBlockingQuestions(questionsMarkdown) {
  const text = questionsMarkdown || '';
  const section = text.match(
    /##\s+Câu hỏi blocking[\s\S]*?(?=\n##\s+Câu hỏi non-blocking|\n##\s+Quyết định|$)/i
  );
  if (!section) return 0;

  let count = 0;
  for (const line of section[0].split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) continue;
    if (/^\s*\|\s*-+\s*\|/.test(line)) continue;
    if (/\|\s*ID\s*\|/i.test(line)) continue;

    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 9) continue;

    const status = cells[cells.length - 1] || '';
    const isOpen =
      /(open|pending|blocked|chưa trả lời|chua tra loi|bị chặn|bi chan|chưa rõ|chua ro)/i.test(
        status
      ) &&
      !/(resolved|closed|answered|done|đã trả lời|da tra loi|đã đóng|da dong|không áp dụng|khong ap dung)/i.test(
        status
      );
    const hasContent = [cells[0], cells[5], cells[6], cells[7], cells[8]].some(realQuestionCell);
    if (isOpen && hasContent) count += 1;
  }
  return count;
}

/**
 * `output/test-summary.md` có ít nhất một dòng command thật trong bảng
 * "Command evidence log" hay không. Dòng template để trống, hoặc dòng ghi
 * chưa chạy, không tính.
 */
export function hasCommandEvidence(testSummaryMarkdown) {
  const text = String(testSummaryMarkdown || '');
  const section = text.match(
    /^##\s+(?:\d+\.\s*)?Command evidence log[^\n]*\n([\s\S]*?)(?=\n##\s|(?![\s\S]))/im
  );
  if (!section) return false;

  for (const line of section[1].split(/\r?\n/)) {
    if (!/^\s*\|/.test(line) || /^\s*\|\s*:?-+/.test(line)) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim().replace(/^`|`$/g, ''));
    if (/^command$/i.test(cells[0] || '')) continue;
    if (!realQuestionCell(cells[0])) continue;

    const ran = cells[1] || '';
    const notRun = /^(không|khong|no|chưa chạy|chua chay|not run)$/i.test(ran) || /\/\s*không/i.test(ran);
    if (!notRun) return true;
  }
  return false;
}

const REQUIRED_TASK_FILES = [
  'task.md',
  'planning/implementation-plan.md',
  'planning/build-checklist.md',
  'planning/questions.md',
  'tracking/workflow-status.md',
];

const MD_FILES_WITHOUT_NEXT_PROMPT = [
  'task.md',
  'planning/implementation-plan.md',
  'planning/build-checklist.md',
  'planning/questions.md',
  'tracking/input-sync-report.md',
  'output/review-report.md',
  'output/test-summary.md',
  'output/pr-summary.md',
  'output/figma-extraction-summary.md',
  'output/ui-figma-review-report.md',
  'tracking/review-bugs.md',
];

/**
 * Đánh giá toàn bộ gate của một task dựa trên workflow-status.md đã
 * parse (schema-valid) + các file liên quan.
 *
 * @param {object} params
 * @param {object} params.data           frontmatter đã pass Zod schema
 * @param {string} params.body           phần body markdown của workflow-status.md
 * @param {(rel: string) => boolean} params.exists  kiểm tra file có tồn tại (relative path trong task folder)
 * @param {(rel: string) => string}  params.read    đọc nội dung file (rỗng nếu không tồn tại)
 * @param {{ outOfPlan: string[], plannedEmpty?: boolean }} [params.scope] kết quả `computeScopeDiff` nếu caller tính được
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function evaluateWorkflowGates({ data, body, exists, read, scope }) {
  const errors = [];
  const warnings = [];

  for (const rel of REQUIRED_TASK_FILES) {
    if (!exists(rel)) errors.push(`Thiếu ${rel}`);
  }

  if (!/^##\s+Prompt bước tiếp theo/im.test(body)) {
    errors.push('workflow-status.md thiếu mục Prompt bước tiếp theo.');
  }
  if (!/^##\s+Input ledger bắt buộc cho FE plan/im.test(body)) {
    errors.push('workflow-status.md thiếu mục Input ledger bắt buộc cho FE plan.');
  }

  const planDone =
    bool(data.build_ready) || norm(data.next_mode) === 'cook' || /FE\s+cook/i.test(String(data.next_prompt || ''));

  const questionsText = read('planning/questions.md');
  const openBlockingQuestions = Math.max(
    Number(data.blocking_questions_open || 0),
    countOpenBlockingQuestions(questionsText)
  );
  const questionGate = norm(data.questions_resolution_gate_status);
  const questionStatus = norm(data.questions_status);
  const questionBlocked =
    openBlockingQuestions > 0 ||
    ['open', 'blocked', 'pending', 'needs_answer', 'needs_answers'].includes(questionStatus) ||
    ['open', 'blocked', 'pending', 'needs_input_sync'].includes(questionGate) ||
    bool(data.input_sync_required) ||
    bool(data.plan_recheck_required_after_input_sync);

  if (planDone) {
    if (!['completed', 'documented', 'passed'].includes(norm(data.input_inventory_status))) {
      errors.push('Plan đã route sang cook/build_ready nhưng input_inventory_status chưa completed/documented/passed.');
    }
    if (!['completed', 'documented', 'passed'].includes(norm(data.plan_input_ledger_status))) {
      errors.push('Plan đã route sang cook/build_ready nhưng plan_input_ledger_status chưa completed/documented/passed.');
    }
    if (Number(data.missing_input_count || 0) > 0) {
      errors.push('Plan input ledger còn missing_input_count > 0. Cần hỏi/input-sync trước khi cook.');
    }
    if (!['passed', 'not_required'].includes(questionGate)) {
      errors.push('Plan đã route sang cook/build_ready nhưng questions_resolution_gate_status chưa passed/not_required.');
    }
  }

  if (questionBlocked) {
    if (bool(data.build_ready)) {
      errors.push('Không được build_ready=true khi còn câu hỏi blocking/open hoặc input-sync required.');
    }
    if (norm(data.next_mode) !== 'input-sync') {
      errors.push('Còn câu hỏi blocking/open hoặc input-sync required thì next_mode phải là input-sync.');
    }
    if (!/FE\s+input-sync/i.test(String(data.next_prompt || ''))) {
      errors.push('Còn câu hỏi blocking/open hoặc input-sync required thì next_prompt phải là FE input-sync <task-folder> <answer-or-cr>.');
    }
    if (!bool(data.input_sync_required)) {
      errors.push('Còn câu hỏi blocking/open thì input_sync_required phải true.');
    }
    if (openBlockingQuestions > 0 && !bool(data.plan_recheck_required_after_input_sync)) {
      errors.push('Còn câu hỏi blocking/open thì plan_recheck_required_after_input_sync phải true.');
    }
  }

  for (const rel of MD_FILES_WITHOUT_NEXT_PROMPT) {
    if (exists(rel) && /^##\s+Prompt bước tiếp theo/im.test(read(rel))) {
      errors.push(`${rel} không được chứa Prompt bước tiếp theo.`);
    }
  }

  const mode = norm(data.current_mode);
  const tokenBudget = norm(data.token_budget_status);
  const requiredRead = norm(data.required_files_read_status);
  const scopeDiff = norm(data.scope_diff_status);
  const commandEvidence = norm(data.command_evidence_status);
  const playwrightDiff = norm(data.playwright_screenshot_diff_status);

  const reviewRun =
    exists('output/review-report.md') ||
    mode === 'review-mode' ||
    ['passed', 'needs_bugfix', 'blocked', 'insufficient_evidence'].includes(norm(data.review_status));

  if (mode === 'input-sync-mode' && !exists('tracking/input-sync-report.md')) {
    errors.push('FE input-sync phải tạo/cập nhật tracking/input-sync-report.md.');
  }
  if (
    mode === 'figma-extraction-mode' ||
    (bool(data.figma_required) && ['passed', 'completed'].includes(norm(data.figma_gate_status)))
  ) {
    if (!exists('output/figma-extraction-summary.md')) {
      errors.push('FE figma/Figma required phải có output/figma-extraction-summary.md.');
    }
  }
  if (reviewRun) {
    if (!exists('output/review-report.md')) {
      errors.push('FE review phải tạo/cập nhật output/review-report.md.');
    }
    const needBug =
      bool(data.bugfix_required) ||
      Number(data.critical_issues_open || 0) > 0 ||
      Number(data.high_issues_open || 0) > 0 ||
      ['open', 'blocked'].includes(norm(data.review_bug_status));
    if (needBug && !exists('tracking/review-bugs.md')) {
      errors.push('Review có bug/Critical/High phải có tracking/review-bugs.md.');
    }
  }
  if (mode === 'testing-mode' && !exists('output/test-summary.md')) {
    errors.push('FE test phải tạo/cập nhật output/test-summary.md.');
  }
  if (
    (mode === 'figma-review-mode' || norm(data.ui_match_review_status) === 'passed') &&
    bool(data.figma_required) &&
    !exists('output/ui-figma-review-report.md')
  ) {
    errors.push('FE figma-review/UI passed phải có output/ui-figma-review-report.md.');
  }
  if (mode === 'pr-ready-mode' && !exists('output/pr-summary.md')) {
    errors.push('FE pr phải tạo/cập nhật output/pr-summary.md.');
  }

  if (bool(data.build_ready)) {
    if (openBlockingQuestions > 0) {
      errors.push('build_ready=true nhưng còn blocking question.');
    }
    // token_budget_status / required_files_read_status là field tự khai: từ
    // v2.0.0 không còn là điều kiện của build_ready, chỉ chặn khi tự báo fail.
    if (['failed', 'blocked'].includes(tokenBudget) || ['failed', 'blocked'].includes(requiredRead)) {
      errors.push('build_ready=true nhưng token_budget_status/required_files_read_status đang failed/blocked.');
    }
    if (
      bool(data.srs_required) &&
      !['completed', 'passed', 'not_required'].includes(norm(data.srs_trace_matrix_status))
    ) {
      errors.push('build_ready=true yêu cầu SRS trace completed/passed/not_required.');
    }
    if (
      bool(data.figma_required) &&
      !['passed', 'not_required', 'waived', 'substituted'].includes(norm(data.figma_gate_status))
    ) {
      errors.push('build_ready=true yêu cầu Figma gate passed/waived/not_required/substituted.');
    }
  }

  if (['failed', 'blocked'].includes(scopeDiff)) {
    errors.push('scope_diff_status=failed/blocked. Cần update plan/input-sync hoặc sửa diff.');
  }
  if (['failed', 'blocked'].includes(commandEvidence)) {
    errors.push('command_evidence_status=failed/blocked. Không được claim pass khi thiếu evidence.');
  }
  if (bool(data.figma_required) && ['failed', 'blocked'].includes(playwrightDiff)) {
    errors.push('playwright_screenshot_diff_status=failed/blocked cho task Figma/UI.');
  }

  // --- Sự thật tính được thắng field tự khai ---
  // Plan chưa khai bảng file (task tạo từ v1.x) thì không có gì để đối chiếu: bỏ qua.
  if (scope && !scope.plannedEmpty && scope.outOfPlan?.length) {
    errors.push(
      `Scope diff: có file sửa ngoài bảng "File sẽ tạo / cập nhật" của plan: ${scope.outOfPlan.join(', ')}. Cập nhật plan/input-sync hoặc hoàn tác.`
    );
  }
  if (
    ['passed', 'completed'].includes(commandEvidence) &&
    exists('output/test-summary.md') &&
    !hasCommandEvidence(read('output/test-summary.md'))
  ) {
    errors.push('command_evidence_status=passed/completed nhưng output/test-summary.md chưa có dòng command đã chạy thật.');
  }

  const criticalOrHigh = Number(data.critical_issues_open || 0) > 0 || Number(data.high_issues_open || 0) > 0;
  if (criticalOrHigh && ['test', 'pr'].includes(normalizeCommand(data.next_mode))) {
    errors.push('Còn issue Critical/High thì next_mode không được là test/pr; route sang bugfix, input-sync hoặc figma-review.');
  }
  warnings.push(...checkRecordedNextMode({ currentMode: data.current_mode, nextMode: data.next_mode }).warnings);

  return { ok: errors.length === 0, errors, warnings };
}

const PR_REQUIRED_FILES = [
  'output/review-report.md',
  'output/test-summary.md',
  'output/pr-summary.md',
  'tracking/workflow-status.md',
];

/**
 * Gate PR readiness. Bản DUY NHẤT cho `fe-kit validate-pr` và
 * `core/scripts/validate-pr.mjs`.
 *
 * Field tự khai (`scope_diff_status`, `command_evidence_status`,
 * `test_command_log_status`) chỉ còn là dự phòng: khi caller truyền `scope`
 * tính từ git, hoặc test-summary có dòng command thật, sự thật đó thắng.
 *
 * @param {object} params
 * @param {object} params.data frontmatter đã parse
 * @param {(rel: string) => boolean} params.exists
 * @param {(rel: string) => string} params.read
 * @param {{ outOfPlan: string[], plannedEmpty?: boolean }} [params.scope]
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function evaluatePrGates({ data, exists, read, scope }) {
  const errors = [];
  const warnings = [];

  for (const rel of PR_REQUIRED_FILES) {
    if (!exists(rel)) errors.push(`Thiếu ${rel}`);
  }

  if (!['passed', 'not_required'].includes(norm(data.review_status))) {
    errors.push('review_status phải passed/not_required trước PR.');
  }
  if (
    bool(data.bugfix_required) ||
    Number(data.critical_issues_open || 0) > 0 ||
    Number(data.high_issues_open || 0) > 0 ||
    ['open', 'blocked'].includes(norm(data.review_bug_status))
  ) {
    errors.push('Còn review bug/Critical/High trước PR.');
  }

  const scopeStatus = norm(data.scope_diff_status);
  if (scope && scope.plannedEmpty) {
    // Task tạo từ v1.x thường chưa có bảng file trong plan: không đối chiếu
    // được nên quay về field tự khai như v1.x, kèm cảnh báo.
    warnings.push('implementation-plan.md chưa khai file nào ở mục "File sẽ tạo / cập nhật" nên không đối chiếu được scope với git; dùng scope_diff_status tự khai.');
  }
  if (scope && !scope.plannedEmpty) {
    if (scope.outOfPlan?.length) {
      errors.push(`Scope diff: file sửa ngoài plan: ${scope.outOfPlan.join(', ')}.`);
    }
    if (['failed', 'blocked'].includes(scopeStatus)) errors.push('scope_diff_status=failed/blocked.');
  } else if (!['passed', 'not_required'].includes(scopeStatus)) {
    errors.push('scope_diff_status phải passed/not_required trước PR (không tính được scope diff từ git).');
  }

  const evidenceOk = hasCommandEvidence(read('output/test-summary.md'));
  for (const key of ['command_evidence_status', 'test_command_log_status']) {
    const value = norm(data[key]);
    if (value === 'not_required') continue;
    if (!value) {
      if (!evidenceOk) {
        errors.push(`Thiếu command evidence: output/test-summary.md chưa có dòng command đã chạy thật (${key} không khai).`);
      }
    } else if (!['completed', 'passed'].includes(value)) {
      errors.push(`${key} phải completed/passed/not_required trước PR.`);
    } else if (!evidenceOk) {
      errors.push(`${key}=${value} nhưng output/test-summary.md chưa có dòng command đã chạy thật.`);
    }
  }

  if (bool(data.figma_required)) {
    if (!['passed', 'waived', 'not_required'].includes(norm(data.ui_match_review_status))) {
      errors.push('Task UI/Figma cần ui_match_review_status=passed/waived/not_required trước PR.');
    }
    if (['critical', 'high', 'blocked'].includes(norm(data.ui_match_severity_status))) {
      errors.push('Còn UI mismatch Critical/High/Blocked trước PR.');
    }
    const playwright = norm(data.playwright_screenshot_diff_status);
    if (playwright && !['passed', 'manual_review', 'not_required', 'waived'].includes(playwright)) {
      errors.push('Task UI/Figma cần playwright_screenshot_diff_status=passed/manual_review/not_required/waived trước PR.');
    }
  }

  if (!['ready', 'opened', 'merged'].includes(norm(data.pr_status))) {
    errors.push('pr_status phải ready/opened/merged trước PR validation.');
  }

  return { ok: errors.length === 0, errors, warnings };
}
