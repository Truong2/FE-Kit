import fs from 'node:fs';
import path from 'node:path';
import { parseWorkflowStatus, parseFrontMatterLoose } from './parse.mjs';
import { countOpenBlockingQuestions, effectiveOpenIssues } from './gates.mjs';
import { countOpenIssuesInTask } from './review-bugs.mjs';
import { evaluateModeEntry } from './transitions.mjs';
import { AGENT_FOR_COMMAND, MODE_REQUIRED_ARTIFACTS, rulesForMode } from './modes.mjs';

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

/**
 * Nội dung trả cho agent khi mở một mode: verdict của gate, agent đảm nhận,
 * artifact bắt buộc và nguyên văn rule của mode. Bản DUY NHẤT cho MCP tool
 * `fe_begin_mode` và CLI `fe-kit mode begin`.
 *
 * @param {object} params
 * @param {string} params.taskDir đường dẫn tuyệt đối tới task folder
 * @param {string} params.taskRef path task để in ra (tương đối workspace)
 * @param {string} params.command lệnh đã chuẩn hoá (`plan`, `cook`, ...)
 * @param {string} params.rulesDir thư mục chứa file rule
 * @param {string} params.rulesLabel nguồn rule để in ra
 * @param {string} params.newTaskHint câu hướng dẫn tạo task khi chưa có workflow-status.md
 * @param {string} params.finishHint câu hướng dẫn trước khi kết thúc mode
 * @returns {{ ok: boolean, entry: object | null, text: string }}
 */
export function modeBriefing({ taskDir, taskRef, command, rulesDir, rulesLabel, newTaskHint, finishHint }) {
  const lines = [];

  const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
  if (!fs.existsSync(workflowPath)) {
    lines.push(`GATE: CHƯA CÓ TASK FOLDER HỢP LỆ (${taskRef}/tracking/workflow-status.md không tồn tại).`);
    lines.push(newTaskHint);
    return { ok: false, entry: null, text: lines.join('\n') };
  }

  const raw = fs.readFileSync(workflowPath, 'utf8');
  const strict = parseWorkflowStatus(raw);
  const data = strict.ok ? strict.data : parseFrontMatterLoose(raw).data;
  const openBlockingQuestions = countOpenBlockingQuestions(readIfExists(path.join(taskDir, 'planning', 'questions.md')));
  const openIssues = effectiveOpenIssues(data, countOpenIssuesInTask((rel) => readIfExists(path.join(taskDir, rel))));
  const entry = evaluateModeEntry({ requested: command, data, openBlockingQuestions, openIssues, taskRef });

  if (entry.allowed) {
    lines.push(`GATE: ĐƯỢC CHẠY FE ${command} (${entry.mode}) cho ${taskRef}.`);
  } else {
    lines.push(`GATE: BỊ CHẶN — không được chạy FE ${command} cho ${taskRef}.`);
    for (const r of entry.reasons) lines.push(`- ${r}`);
    lines.push(`Việc phải làm: cập nhật tracking/workflow-status.md (next_mode, next_prompt) và dừng. Prompt đúng: ${entry.redirect}`);
    lines.push('Không sửa source code trong lượt này.');
  }
  for (const w of entry.warnings) lines.push(`Cảnh báo: ${w}`);
  if (!strict.ok) {
    lines.push('', 'workflow-status.md chưa hợp lệ schema (sửa trong lượt này):');
    for (const e of strict.errors.slice(0, 10)) lines.push(`- ${e}`);
  }

  if (entry.allowed) {
    const agent = AGENT_FOR_COMMAND[command];
    lines.push('', `Agent đảm nhận: ${agent ? agent : 'main thread (inline)'}`);
    lines.push('', 'Artifact bắt buộc khi kết thúc mode (tương đối task folder):');
    for (const rel of MODE_REQUIRED_ARTIFACTS[command]) lines.push(`- ${rel}`);
    lines.push('Input cần đọc: mục "Input ledger bắt buộc cho FE plan" trong tracking/workflow-status.md.');
    lines.push(finishHint);

    // Trả nguyên văn rule thay vì đường dẫn: rule của plugin nằm trong cache
    // ngoài workspace, agent Read sẽ bị hỏi quyền (hoặc bị từ chối khi chạy headless).
    lines.push('', `=== RULE ÁP DỤNG CHO FE ${command} (nguồn: ${rulesLabel}) — không cần đọc lại file rule ===`);
    for (const file of rulesForMode(command, { figmaRequired: data.figma_required === true })) {
      const body = readIfExists(path.join(rulesDir, file)).trim();
      if (body) lines.push('', `--- ${file} ---`, body);
    }
  }
  return { ok: entry.allowed, entry, text: lines.join('\n') };
}
