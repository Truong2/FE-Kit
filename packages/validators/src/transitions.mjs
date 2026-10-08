/**
 * Bảng mode và luật chuyển mode của FE workflow.
 *
 * Validator snapshot (`evaluateWorkflowGates`) chỉ nhìn một thời điểm nên
 * không biết mode trước đó là gì. Vì vậy luật chuyển mode được kiểm tra ở
 * thời điểm BẮT ĐẦU mode (`evaluateModeEntry`): so mode được yêu cầu với
 * `next_mode` đã ghi và với các gate tính được từ file.
 */

/** Lệnh `FE <command>` → giá trị `current_mode` trong workflow-status.md. */
export const COMMAND_TO_MODE = {
  plan: 'planning-mode',
  quick: 'quick-mode',
  'input-sync': 'input-sync-mode',
  figma: 'figma-extraction-mode',
  'figma-review': 'figma-review-mode',
  cook: 'implementation-mode',
  bugfix: 'bugfix-mode',
  review: 'review-mode',
  test: 'testing-mode',
  pr: 'pr-ready-mode',
};

export const COMMANDS = Object.keys(COMMAND_TO_MODE);

const MODE_TO_COMMAND = Object.fromEntries(
  Object.entries(COMMAND_TO_MODE).map(([cmd, mode]) => [mode, cmd])
);

/** Tên lịch sử của adapter Codex. */
const COMMAND_ALIASES = { build: 'cook', 'figma-extract': 'figma', implement: 'cook' };

/** Giá trị `next_mode` nghĩa là "không còn bước bắt buộc". */
export const TERMINAL_NEXT_MODES = ['none', 'done', 'completed', 'merged'];

/** Mode được phép sửa source code của dự án. */
export const SOURCE_EDIT_COMMANDS = ['cook', 'bugfix', 'quick'];

/** Luôn chạy được vì chính chúng dùng để gỡ blocker. */
const ALWAYS_ALLOWED = ['plan', 'input-sync'];

/** Sau khi một mode kết thúc, `next_mode` hợp lý là gì. Lệch bảng này chỉ là cảnh báo. */
export const ALLOWED_NEXT = {
  plan: ['input-sync', 'figma', 'cook', 'plan', 'quick'],
  quick: ['review', 'test', 'pr', 'plan', 'input-sync'],
  'input-sync': ['plan', 'input-sync', 'figma', 'cook', 'bugfix', 'review'],
  figma: ['cook', 'plan', 'input-sync', 'figma'],
  cook: ['review', 'cook', 'input-sync', 'plan'],
  bugfix: ['review', 'bugfix', 'input-sync', 'test', 'figma-review'],
  review: ['bugfix', 'input-sync', 'figma-review', 'test', 'pr'],
  test: ['figma-review', 'pr', 'bugfix', 'input-sync', 'test'],
  'figma-review': ['pr', 'bugfix', 'input-sync', 'figma-review', 'test'],
  pr: ['bugfix', 'input-sync', 'pr'],
};

function norm(v) {
  return String(v ?? '').trim().toLowerCase();
}

function bool(v) {
  return v === true || norm(v) === 'true';
}

/**
 * Chuẩn hoá mọi cách viết về tên lệnh: `cook`, `FE cook`, `/fe:cook`,
 * `fe:cook`, `implementation-mode`, `build`. Trả về '' nếu không nhận ra.
 */
export function normalizeCommand(value) {
  let v = norm(value);
  if (!v) return '';
  v = v.replace(/^\//, '').replace(/^fe[:\s]+/, '').split(/\s+/)[0];
  if (MODE_TO_COMMAND[v]) return MODE_TO_COMMAND[v];
  if (COMMAND_ALIASES[v]) return COMMAND_ALIASES[v];
  return COMMANDS.includes(v) ? v : '';
}

/**
 * Kiểm tra `next_mode` mà một mode vừa ghi ra. Không bao giờ trả lỗi cứng
 * cho giá trị lạ: task folder cũ ghi `next_mode` dạng chữ tự do.
 *
 * @returns {{ warnings: string[] }}
 */
export function checkRecordedNextMode({ currentMode, nextMode }) {
  const warnings = [];
  const raw = norm(nextMode);
  if (!raw || TERMINAL_NEXT_MODES.includes(raw)) return { warnings };

  const next = normalizeCommand(raw);
  if (!next) {
    warnings.push(`next_mode="${nextMode}" không thuộc danh sách mode đã biết (${COMMANDS.join(', ')}, none).`);
    return { warnings };
  }
  const current = normalizeCommand(currentMode);
  if (current && !ALLOWED_NEXT[current].includes(next)) {
    warnings.push(`next_mode="${next}" sau mode "${current}" là chuyển bước bất thường (thường là: ${ALLOWED_NEXT[current].join(', ')}).`);
  }
  return { warnings };
}

/**
 * Có được bắt đầu mode `requested` trên task này không.
 *
 * @param {object} params
 * @param {string} params.requested lệnh/mode được yêu cầu
 * @param {object} params.data frontmatter của workflow-status.md (đã parse)
 * @param {number} params.openBlockingQuestions số câu hỏi blocking mở đếm từ questions.md
 * @param {string} [params.taskRef] task folder để dựng prompt thay thế
 * @returns {{ allowed: boolean, command: string, mode: string, reasons: string[], reasonCodes: string[], warnings: string[], redirect: string }}
 *   `reasonCodes[i]` là reason code ổn định của `reasons[i]` (dùng cho run-log).
 */
export function evaluateModeEntry({ requested, data = {}, openBlockingQuestions = 0, taskRef = '<task-folder>' }) {
  const command = normalizeCommand(requested);
  const result = { allowed: true, command, mode: COMMAND_TO_MODE[command] || '', reasons: [], reasonCodes: [], warnings: [], redirect: '' };
  const block = (code, reason) => {
    result.reasons.push(reason);
    result.reasonCodes.push(code);
  };

  if (!command) {
    result.allowed = false;
    block('ENTRY_UNKNOWN_MODE', `Không nhận ra mode "${requested}". Mode hợp lệ: ${COMMANDS.join(', ')}.`);
    return result;
  }

  const blocking = Math.max(Number(data.blocking_questions_open || 0), Number(openBlockingQuestions || 0));
  const questionBlocked =
    blocking > 0 ||
    ['open', 'blocked', 'pending'].includes(norm(data.questions_status)) ||
    ['open', 'blocked', 'pending', 'needs_input_sync'].includes(norm(data.questions_resolution_gate_status)) ||
    bool(data.input_sync_required) ||
    bool(data.plan_recheck_required_after_input_sync);

  if (questionBlocked && !ALWAYS_ALLOWED.includes(command)) {
    block(
      blocking > 0 ? 'ENTRY_QUESTIONS_BLOCKING' : 'ENTRY_INPUT_SYNC_REQUIRED',
      blocking > 0
        ? `Còn ${blocking} câu hỏi blocking đang mở trong planning/questions.md.`
        : 'workflow-status.md đang yêu cầu input-sync (questions/input_sync_required/plan_recheck chưa đóng).'
    );
    result.redirect = `FE input-sync ${taskRef} <answer-or-cr>`;
  }

  if (command === 'cook') {
    if (!bool(data.build_ready)) {
      block('ENTRY_NOT_BUILD_READY', 'build_ready chưa true: plan chưa sẵn sàng để cook.');
      result.redirect ||= `FE plan ${taskRef}`;
    }
    const figmaGate = norm(data.figma_gate_status);
    if (bool(data.figma_required) && !['passed', 'waived', 'substituted', 'not_required'].includes(figmaGate)) {
      block('ENTRY_FIGMA_GATE_OPEN', `Task cần Figma nhưng figma_gate_status="${figmaGate || '(trống)'}".`);
      result.redirect ||= `FE figma ${taskRef}`;
    }
  }

  if (command === 'pr') {
    if (Number(data.critical_issues_open || 0) > 0 || Number(data.high_issues_open || 0) > 0 || bool(data.bugfix_required)) {
      block('ENTRY_OPEN_BUGS', 'Còn bug Critical/High hoặc bugfix_required=true.');
      result.redirect ||= `FE bugfix ${taskRef}`;
    }
    if (!['passed', 'not_required'].includes(norm(data.review_status))) {
      block('ENTRY_REVIEW_NOT_PASSED', `review_status="${norm(data.review_status) || '(trống)'}" — cần review passed trước PR.`);
      result.redirect ||= `FE review ${taskRef}`;
    }
  }

  const recorded = normalizeCommand(data.next_mode);
  if (recorded && recorded !== command && !ALWAYS_ALLOWED.includes(command)) {
    result.warnings.push(`workflow-status.md ghi bước kế tiếp là "${recorded}" nhưng đang chạy "${command}".`);
  }

  if (result.reasons.length) {
    // human_override là quyết định của người (hook hỏi xác nhận khi field này
    // được bật), nên hạ lỗi chặn xuống cảnh báo thay vì bỏ qua im lặng.
    if (bool(data.human_override)) {
      result.warnings.push(...result.reasons.map((r) => `[human_override] ${r}`));
      result.reasons = [];
      result.reasonCodes = [];
      result.redirect = '';
    } else {
      result.allowed = false;
    }
  }
  return result;
}
