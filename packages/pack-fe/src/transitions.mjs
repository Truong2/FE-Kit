/**
 * Bảng mode và luật chặn lúc vào mode của FE workflow. State machine chung
 * (chuẩn hoá lệnh, cảnh báo `next_mode`, `human_override`) nằm trong engine.
 */
import { createStateMachine, commandToModeOf } from '@frontend-delivery-kit/engine';
import manifest from './manifest.gen.mjs';

/** Lệnh `FE <command>` → giá trị `current_mode` trong workflow-status.md. */
export const COMMAND_TO_MODE = commandToModeOf(manifest);

export const COMMANDS = Object.keys(COMMAND_TO_MODE);

/** Tên lịch sử của adapter Codex. */
export const COMMAND_ALIASES = manifest.aliases;

/** Giá trị `next_mode` nghĩa là "không còn bước bắt buộc". */
export const TERMINAL_NEXT_MODES = manifest.terminal_next;

/** Mode được phép sửa source code của dự án. */
export const SOURCE_EDIT_COMMANDS = manifest.source_edit_modes;

/** Luôn chạy được vì chính chúng dùng để gỡ blocker. */
export const ALWAYS_ALLOWED = manifest.always_allowed;

/** Sau khi một mode kết thúc, `next_mode` hợp lý là gì. Lệch bảng này chỉ là cảnh báo. */
export const ALLOWED_NEXT = Object.fromEntries(Object.entries(manifest.modes).map(([cmd, m]) => [cmd, m.next]));

/**
 * Luật chặn lúc vào mode của FE, theo thứ tự: câu hỏi blocking/input-sync, rồi
 * điều kiện riêng của cook và pr.
 */
function feEntryRules({ command, data, taskRef, alwaysAllowed, bool, norm, openBlockingQuestions = 0, openIssues }) {
  const rules = [];
  const blocking = Math.max(Number(data.blocking_questions_open || 0), Number(openBlockingQuestions || 0));
  const questionBlocked =
    blocking > 0 ||
    ['open', 'blocked', 'pending'].includes(norm(data.questions_status)) ||
    ['open', 'blocked', 'pending', 'needs_input_sync'].includes(norm(data.questions_resolution_gate_status)) ||
    bool(data.input_sync_required) ||
    bool(data.plan_recheck_required_after_input_sync);

  if (questionBlocked && !alwaysAllowed.includes(command)) {
    rules.push({
      code: blocking > 0 ? 'ENTRY_QUESTIONS_BLOCKING' : 'ENTRY_INPUT_SYNC_REQUIRED',
      reason:
        blocking > 0
          ? `Còn ${blocking} câu hỏi blocking đang mở trong planning/questions.md.`
          : 'workflow-status.md đang yêu cầu input-sync (questions/input_sync_required/plan_recheck chưa đóng).',
      redirect: `FE input-sync ${taskRef} <answer-or-cr>`,
    });
  }

  if (command === 'cook') {
    if (!bool(data.build_ready)) {
      rules.push({ code: 'ENTRY_NOT_BUILD_READY', reason: 'build_ready chưa true: plan chưa sẵn sàng để cook.', redirect: `FE plan ${taskRef}` });
    }
    const figmaGate = norm(data.figma_gate_status);
    if (bool(data.figma_required) && !['passed', 'waived', 'substituted', 'not_required'].includes(figmaGate)) {
      rules.push({
        code: 'ENTRY_FIGMA_GATE_OPEN',
        reason: `Task cần Figma nhưng figma_gate_status="${figmaGate || '(trống)'}".`,
        redirect: `FE figma ${taskRef}`,
      });
    }
  }

  if (command === 'pr') {
    const critical = Math.max(Number(data.critical_issues_open || 0), Number(openIssues?.critical || 0));
    const high = Math.max(Number(data.high_issues_open || 0), Number(openIssues?.high || 0));
    if (critical > 0 || high > 0 || bool(data.bugfix_required)) {
      rules.push({ code: 'ENTRY_OPEN_BUGS', reason: 'Còn bug Critical/High hoặc bugfix_required=true.', redirect: `FE bugfix ${taskRef}` });
    }
    if (!['passed', 'not_required'].includes(norm(data.review_status))) {
      rules.push({
        code: 'ENTRY_REVIEW_NOT_PASSED',
        reason: `review_status="${norm(data.review_status) || '(trống)'}" — cần review passed trước PR.`,
        redirect: `FE review ${taskRef}`,
      });
    }
  }
  return rules;
}

const machine = createStateMachine({
  commandToMode: COMMAND_TO_MODE,
  allowedNext: ALLOWED_NEXT,
  aliases: COMMAND_ALIASES,
  terminalNext: TERMINAL_NEXT_MODES,
  alwaysAllowed: ALWAYS_ALLOWED,
  commandPrefix: `${manifest.plugin}[:\\s]+`,
  statusFileName: manifest.status_file.split('/').pop(),
  entryRules: feEntryRules,
});

/**
 * Chuẩn hoá mọi cách viết về tên lệnh: `cook`, `FE cook`, `/fe:cook`,
 * `fe:cook`, `implementation-mode`, `build`. Trả về '' nếu không nhận ra.
 */
export const normalizeCommand = machine.normalizeCommand;

/**
 * Kiểm tra `next_mode` mà một mode vừa ghi ra. Không bao giờ trả lỗi cứng
 * cho giá trị lạ: task folder cũ ghi `next_mode` dạng chữ tự do.
 */
export const checkRecordedNextMode = machine.checkRecordedNextMode;

/**
 * Có được bắt đầu mode `requested` trên task này không.
 *
 * @param {object} params
 * @param {string} params.requested lệnh/mode được yêu cầu
 * @param {object} params.data frontmatter của workflow-status.md (đã parse)
 * @param {number} params.openBlockingQuestions số câu hỏi blocking mở đếm từ questions.md
 * @param {string} [params.taskRef] task folder để dựng prompt thay thế
 * @param {{ critical: number, high: number }} [params.openIssues] issue đang mở đếm từ bảng issue (`countOpenIssuesInTask`)
 * @returns {{ allowed: boolean, command: string, mode: string, reasons: string[], reasonCodes: string[], warnings: string[], redirect: string }}
 */
export const evaluateModeEntry = machine.evaluateModeEntry;
