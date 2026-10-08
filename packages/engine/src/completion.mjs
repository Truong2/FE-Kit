import fs from 'node:fs';
import path from 'node:path';
import { parseFrontMatterLoose } from './frontmatter.mjs';

/**
 * Gate kết thúc mode: bản DUY NHẤT cho hook (`SubagentStop`/`Stop`) và lệnh
 * `mode end` của CLI.
 *
 * - Mode bị gate từ chối lúc vào: không đòi artifact; chỉ cần file trạng thái
 *   hiện có route đúng (`refused: true`).
 * - Mode được chạy: file trạng thái phải được sửa sau `startedAt` (nếu biết),
 *   `current_mode` đúng mode, đủ artifact bắt buộc, rồi qua validator của pack.
 *
 * @param {object} pack
 * @param {string} pack.statusFile path file trạng thái trong task folder
 * @param {(command: string) => string} pack.label nhãn của lệnh trong thông báo
 * @param {Record<string, string>} pack.commandToMode
 * @param {Record<string, string[]>} pack.requiredArtifacts
 * @param {(ctx: { data: object, read: (rel: string) => string }) => object} pack.entryInputs input thêm cho gate lúc vào mode
 * @param {Function} pack.evaluateModeEntry
 * @param {(taskDir: string, opts?: object) => object} pack.validateWorkflow
 * @param {(taskDir: string, opts?: object) => object} pack.validateWorkflowAtGate
 */
export function createModeCompletion(pack) {
  const statusName = path.posix.basename(pack.statusFile);

  /**
   * @param {object} p
   * @param {string} p.taskDir đường dẫn tuyệt đối tới task folder
   * @param {string} p.taskRef path task để in ra
   * @param {string} p.command lệnh đã chuẩn hoá
   * @param {number} [p.startedAt] thời điểm mở mode (ms)
   * @param {object} [p.scope] scope diff caller đã tính, truyền cho validator
   * @param {string} [p.repoRoot] có (và không truyền `scope`) thì validator tự tính scope tại điểm chuyển gate
   * @param {string} [p.base] base ref cho `repoRoot`
   * @param {{ code: string, message: string }[]} [p.extraIssues] lỗi riêng của caller, xếp trước lỗi của validator
   * @returns {{ ok: boolean, refused: boolean, issues: { code: string, message: string }[], errors: string[] }}
   */
  return function evaluateModeCompletion({ taskDir, taskRef, command, startedAt, scope, repoRoot, base, extraIssues = [] }) {
    const done = (issues, refused = false) => ({
      ok: issues.length === 0,
      refused,
      issues,
      errors: issues.map((i) => i.message),
    });
    const read = (rel) => {
      const p = path.join(taskDir, rel);
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    };
    const statusPath = path.join(taskDir, pack.statusFile);
    const raw = read(pack.statusFile);
    if (!raw) return done([{ code: 'END_STATUS_MISSING', message: `Chưa có ${taskRef}/${pack.statusFile}.` }]);
    const loose = parseFrontMatterLoose(raw);
    if (!loose.hasFrontMatter || loose.error) {
      return done([
        {
          code: 'END_STATUS_UNPARSEABLE',
          message: `${pack.statusFile} không parse được YAML frontmatter${loose.error ? `: ${loose.error}` : '.'}`,
        },
      ]);
    }
    const data = loose.data;

    // Mode bị gate từ chối: không đòi artifact của mode, và không đòi sửa file
    // nếu file trạng thái hiện có đã route đúng (ép sửa chỉ sinh thêm lỗi).
    const entry = pack.evaluateModeEntry({ requested: command, data, ...pack.entryInputs({ data, read }), taskRef });
    if (!entry.allowed) {
      const refused = pack.validateWorkflow(taskDir);
      if (refused.ok) return done([], true);
      return done(
        [
          {
            code: 'END_REFUSED_ROUTE_INVALID',
            message: `${pack.label(command)} đang bị gate chặn (${entry.reasons.join(' ')}) nên không cần artifact của mode. Giữ nguyên current_mode; chỉ sửa ${statusName} cho hợp lệ và route sang: ${entry.redirect}`,
          },
          ...refused.issues,
        ],
        true
      );
    }

    const issues = [];
    if (startedAt !== undefined) {
      let mtime = 0;
      try {
        mtime = fs.statSync(statusPath).mtimeMs;
      } catch { /* đã kiểm tra tồn tại ở trên */ }
      if (mtime + 1000 < startedAt) {
        issues.push({
          code: 'END_STATUS_NOT_UPDATED',
          message: `${pack.statusFile} chưa được cập nhật trong lượt này (không mode nào được kết thúc chỉ bằng chat).`,
        });
      }
    }
    const expected = pack.commandToMode[command];
    if (String(data.current_mode || '') !== expected) {
      issues.push({
        code: 'END_CURRENT_MODE_MISMATCH',
        message: `current_mode trong ${statusName} phải là ${expected} (đang là "${data.current_mode || ''}").`,
      });
    }
    for (const rel of pack.requiredArtifacts[command] || []) {
      if (!fs.existsSync(path.join(taskDir, rel))) {
        issues.push({ code: 'END_ARTIFACT_MISSING', message: `Thiếu artifact bắt buộc của ${pack.label(command)}: ${rel}` });
      }
    }
    issues.push(...extraIssues);

    const gates = repoRoot && !scope ? pack.validateWorkflowAtGate(taskDir, { repoRoot, base }) : pack.validateWorkflow(taskDir, { scope });
    if (!gates.ok) issues.push(...gates.issues);
    const seen = new Set();
    return done(issues.filter((i) => !seen.has(i.message) && seen.add(i.message)));
  };
}
