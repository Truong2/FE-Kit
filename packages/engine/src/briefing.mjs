import fs from 'node:fs';
import path from 'node:path';
import { parseFrontMatterLoose } from './frontmatter.mjs';

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

/**
 * Nội dung trả cho agent khi mở một mode: verdict của gate, agent đảm nhận,
 * artifact bắt buộc và nguyên văn rule của mode. Bản DUY NHẤT cho tool
 * `<prefix>_begin_mode` của MCP và lệnh `mode begin` của CLI.
 *
 * @param {object} pack
 * @param {string} pack.statusFile path file trạng thái trong task folder
 * @param {(command: string) => string} pack.label nhãn của lệnh trong thông báo
 * @param {(raw: string) => { ok: boolean, data?: object, errors?: string[] }} pack.parseStatus parse có kiểm schema
 * @param {(ctx: { data: object, read: (rel: string) => string }) => object} pack.entryInputs
 * @param {Function} pack.evaluateModeEntry
 * @param {Record<string, string | null>} pack.agentFor lệnh → agent (null = main thread)
 * @param {Record<string, string[]>} pack.requiredArtifacts
 * @param {(command: string, data: object) => string[]} pack.rulesFor file rule cần nạp
 * @param {string} pack.readInputsHint câu hướng dẫn agent đọc input của task
 */
export function createModeBriefing(pack) {
  const statusName = path.posix.basename(pack.statusFile);

  /**
   * @param {object} params
   * @param {string} params.taskDir đường dẫn tuyệt đối tới task folder
   * @param {string} params.taskRef path task để in ra (tương đối workspace)
   * @param {string} params.command lệnh đã chuẩn hoá
   * @param {string} params.rulesDir thư mục chứa file rule
   * @param {string} params.rulesLabel nguồn rule để in ra
   * @param {string} params.newTaskHint câu hướng dẫn tạo task khi chưa có file trạng thái
   * @param {string} params.finishHint câu hướng dẫn trước khi kết thúc mode
   * @returns {{ ok: boolean, entry: object | null, text: string }}
   */
  return function modeBriefing({ taskDir, taskRef, command, rulesDir, rulesLabel, newTaskHint, finishHint }) {
    const lines = [];

    const statusPath = path.join(taskDir, pack.statusFile);
    if (!fs.existsSync(statusPath)) {
      lines.push(`GATE: CHƯA CÓ TASK FOLDER HỢP LỆ (${taskRef}/${pack.statusFile} không tồn tại).`);
      lines.push(newTaskHint);
      return { ok: false, entry: null, text: lines.join('\n') };
    }

    const raw = fs.readFileSync(statusPath, 'utf8');
    const strict = pack.parseStatus(raw);
    const data = strict.ok ? strict.data : parseFrontMatterLoose(raw).data;
    const read = (rel) => readIfExists(path.join(taskDir, rel));
    const entry = pack.evaluateModeEntry({ requested: command, data, ...pack.entryInputs({ data, read }), taskRef });

    if (entry.allowed) {
      lines.push(`GATE: ĐƯỢC CHẠY ${pack.label(command)} (${entry.mode}) cho ${taskRef}.`);
    } else {
      lines.push(`GATE: BỊ CHẶN — không được chạy ${pack.label(command)} cho ${taskRef}.`);
      for (const r of entry.reasons) lines.push(`- ${r}`);
      lines.push(`Việc phải làm: cập nhật ${pack.statusFile} (next_mode, next_prompt) và dừng. Prompt đúng: ${entry.redirect}`);
      lines.push('Không sửa source code trong lượt này.');
    }
    for (const w of entry.warnings) lines.push(`Cảnh báo: ${w}`);
    if (!strict.ok) {
      lines.push('', `${statusName} chưa hợp lệ schema (sửa trong lượt này):`);
      for (const e of strict.errors.slice(0, 10)) lines.push(`- ${e}`);
    }

    if (entry.allowed) {
      const agent = pack.agentFor[command];
      lines.push('', `Agent đảm nhận: ${agent ? agent : 'main thread (inline)'}`);
      lines.push('', 'Artifact bắt buộc khi kết thúc mode (tương đối task folder):');
      for (const rel of pack.requiredArtifacts[command]) lines.push(`- ${rel}`);
      lines.push(pack.readInputsHint);
      lines.push(finishHint);

      // Trả nguyên văn rule thay vì đường dẫn: rule của plugin nằm trong cache
      // ngoài workspace, agent Read sẽ bị hỏi quyền (hoặc bị từ chối khi chạy headless).
      lines.push('', `=== RULE ÁP DỤNG CHO ${pack.label(command)} (nguồn: ${rulesLabel}) — không cần đọc lại file rule ===`);
      for (const file of pack.rulesFor(command, data)) {
        const body = readIfExists(path.join(rulesDir, file)).trim();
        if (body) lines.push('', `--- ${file} ---`, body);
      }
    }
    return { ok: entry.allowed, entry, text: lines.join('\n') };
  };
}
