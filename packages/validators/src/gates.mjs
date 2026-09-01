/**
 * Gate logic dùng chung cho FE plan/cook/review/pr workflow.
 *
 * LỊCH SỬ: logic này trước đây tồn tại 2 bản gần như y hệt —
 * `countOpenBlockingQuestionsInTask` trong bin/fe-kit.mjs và
 * `countOpenBlockingQuestions` trong scripts/validate-workflow.ts.
 * Từ v1.0.0, đây là bản DUY NHẤT; cả CLI lẫn script standalone đều
 * import từ đây để tránh drift.
 */

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
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function evaluateWorkflowGates({ data, body, exists, read }) {
  const errors = [];

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
    if (!['passed', 'documented', 'not_required'].includes(tokenBudget)) {
      errors.push('build_ready=true yêu cầu token_budget_status=passed/documented/not_required.');
    }
    if (!['passed', 'documented', 'not_required'].includes(requiredRead)) {
      errors.push('build_ready=true yêu cầu required_files_read_status=passed/documented/not_required.');
    }
    if (
      bool(data.srs_required) &&
      !['completed', 'passed', 'not_required'].includes(norm(data.srs_trace_matrix_status))
    ) {
      errors.push('build_ready=true yêu cầu SRS trace completed/passed/not_required.');
    }
    if (
      bool(data.figma_required) &&
      !['passed', 'not_required'].includes(norm(data.figma_gate_status)) &&
      !['waived', 'substituted'].includes(norm(data.figma_gate_status))
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

  return { ok: errors.length === 0, errors };
}
