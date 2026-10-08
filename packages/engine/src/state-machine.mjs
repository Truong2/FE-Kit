/**
 * State machine của mode: chuẩn hoá tên lệnh, luật chuyển `next_mode`, và gate
 * lúc bắt đầu mode. Bảng mode và luật chặn riêng của domain do pack cung cấp.
 *
 * Validator snapshot (gate của workflow) chỉ nhìn một thời điểm nên không biết
 * mode trước đó là gì; vì vậy luật chuyển mode được kiểm ở thời điểm BẮT ĐẦU
 * mode: so mode được yêu cầu với `next_mode` đã ghi và với luật của pack.
 */

function norm(v) {
  return String(v ?? '').trim().toLowerCase();
}

function bool(v) {
  return v === true || norm(v) === 'true';
}

/**
 * @param {object} spec
 * @param {Record<string, string>} spec.commandToMode lệnh → giá trị `current_mode`
 * @param {Record<string, string[]>} spec.allowedNext lệnh → các `next_mode` hợp lý (lệch chỉ cảnh báo)
 * @param {Record<string, string>} [spec.aliases] tên lịch sử → lệnh
 * @param {string[]} spec.terminalNext giá trị `next_mode` nghĩa là "không còn bước bắt buộc"
 * @param {string[]} spec.alwaysAllowed lệnh luôn chạy được vì dùng để gỡ blocker
 * @param {string} spec.commandPrefix regex (chuỗi) của tiền tố lệnh cần bỏ, vd `fe[:\\s]+`
 * @param {string} spec.statusFileName tên file trạng thái để in trong cảnh báo
 * @param {(ctx: object) => { code: string, reason: string, redirect?: string }[]} spec.entryRules
 *   luật chặn của pack, theo thứ tự; redirect đầu tiên được dùng
 */
export function createStateMachine(spec) {
  const COMMAND_TO_MODE = spec.commandToMode;
  const COMMANDS = Object.keys(COMMAND_TO_MODE);
  const ALLOWED_NEXT = spec.allowedNext;
  const ALIASES = spec.aliases || {};
  const TERMINAL_NEXT = spec.terminalNext;
  const ALWAYS_ALLOWED = spec.alwaysAllowed;
  const MODE_TO_COMMAND = Object.fromEntries(Object.entries(COMMAND_TO_MODE).map(([cmd, mode]) => [mode, cmd]));
  const prefixRe = new RegExp(`^${spec.commandPrefix}`);

  /**
   * Chuẩn hoá mọi cách viết về tên lệnh (`cook`, `<prefix> cook`, `/<plugin>:cook`,
   * tên mode, alias). Trả về '' nếu không nhận ra.
   */
  function normalizeCommand(value) {
    let v = norm(value);
    if (!v) return '';
    v = v.replace(/^\//, '').replace(prefixRe, '').split(/\s+/)[0];
    if (MODE_TO_COMMAND[v]) return MODE_TO_COMMAND[v];
    if (ALIASES[v]) return ALIASES[v];
    return COMMANDS.includes(v) ? v : '';
  }

  /**
   * Kiểm tra `next_mode` mà một mode vừa ghi ra. Không bao giờ trả lỗi cứng
   * cho giá trị lạ: task folder cũ ghi `next_mode` dạng chữ tự do.
   *
   * @returns {{ warnings: string[] }}
   */
  function checkRecordedNextMode({ currentMode, nextMode }) {
    const warnings = [];
    const raw = norm(nextMode);
    if (!raw || TERMINAL_NEXT.includes(raw)) return { warnings };

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
   * @param {object} params.data frontmatter của file trạng thái (đã parse)
   * @param {string} [params.taskRef] task folder để dựng prompt thay thế
   *   Các field khác của `params` (vd số câu hỏi đang mở) được chuyển nguyên cho `entryRules`.
   * @returns {{ allowed: boolean, command: string, mode: string, reasons: string[], reasonCodes: string[], warnings: string[], redirect: string }}
   *   `reasonCodes[i]` là reason code ổn định của `reasons[i]` (dùng cho run-log).
   */
  function evaluateModeEntry({ requested, data = {}, taskRef = '<task-folder>', ...inputs }) {
    const command = normalizeCommand(requested);
    const result = { allowed: true, command, mode: COMMAND_TO_MODE[command] || '', reasons: [], reasonCodes: [], warnings: [], redirect: '' };

    if (!command) {
      result.allowed = false;
      result.reasons.push(`Không nhận ra mode "${requested}". Mode hợp lệ: ${COMMANDS.join(', ')}.`);
      result.reasonCodes.push('ENTRY_UNKNOWN_MODE');
      return result;
    }

    for (const rule of spec.entryRules({ command, data, taskRef, alwaysAllowed: ALWAYS_ALLOWED, bool, norm, ...inputs })) {
      result.reasons.push(rule.reason);
      result.reasonCodes.push(rule.code);
      if (rule.redirect && !result.redirect) result.redirect = rule.redirect;
    }

    const recorded = normalizeCommand(data.next_mode);
    if (recorded && recorded !== command && !ALWAYS_ALLOWED.includes(command)) {
      result.warnings.push(`${spec.statusFileName} ghi bước kế tiếp là "${recorded}" nhưng đang chạy "${command}".`);
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

  return { COMMAND_TO_MODE, COMMANDS, ALLOWED_NEXT, TERMINAL_NEXT, normalizeCommand, checkRecordedNextMode, evaluateModeEntry };
}
