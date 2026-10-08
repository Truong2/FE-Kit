/**
 * Engine phải chạy được với domain pack khác FE. Pack mẫu "docs"
 * (packages/pack-sample-docs) cố ý khác FE ở mọi chỗ: thư mục task, file trạng
 * thái, tên mode, agent, tiền tố lệnh/biến môi trường, rule và luật vào mode.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { validateManifest, readRunLog, buildReport, renderReport, createMcpTools } from '../packages/engine/src/index.mjs';
import { docsPack, appendRunLog, TEMPLATES_DIR, RULES_DIR } from '../packages/pack-sample-docs/src/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.join(ROOT, 'packages', 'pack-sample-docs', 'src', 'hook.mjs');
const TASK = 'docs/doc-tasks/DOC-1-intro';

let ws;
let dataDir;

function readYaml(file) {
  return matter(`---\n${fs.readFileSync(file, 'utf8')}\n---\n`).data;
}

function setStatus(values) {
  const file = path.join(ws, TASK, 'state', 'status.md');
  let text = fs.readFileSync(file, 'utf8');
  for (const [k, v] of Object.entries(values)) text = text.replace(new RegExp(`^${k}:.*$`, 'm'), `${k}: ${v}`);
  fs.writeFileSync(file, text);
}

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-pack-'));
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-pack-data-'));
  const res = docsPack.scaffoldTask({ workspaceRoot: ws, name: 'DOC-1-intro', templatesDir: TEMPLATES_DIR });
  expect(res.ok).toBe(true);
});

afterEach(() => {
  fs.rmSync(ws, { recursive: true, force: true });
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('manifest', () => {
  it('pack.yaml của pack mẫu hợp lệ; manifest sai bị từ chối với lỗi rõ', () => {
    const raw = readYaml(path.join(ROOT, 'packages', 'pack-sample-docs', 'pack.yaml'));
    expect(validateManifest(raw).ok).toBe(true);
    const bad = { ...raw, modes: { ...raw.modes, draft: { ...raw.modes.draft, next: ['deploy'] } }, always_allowed: ['ship'] };
    const res = validateManifest(bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join('\n')).toMatch(/modes\.draft\.next: mode "deploy"/);
    expect(res.errors.join('\n')).toMatch(/always_allowed: mode "ship"/);
  });
});

describe('state machine', () => {
  it('chuẩn hoá lệnh theo plugin, tiền tố và alias của pack', () => {
    expect(['/docs:review', 'DOC write', 'publishing', 'deploy'].map(docsPack.normalizeCommand)).toEqual(['review', 'draft', 'publish', '']);
  });

  it('luật vào mode của pack, human_override và cảnh báo next_mode dùng tên file trạng thái của pack', () => {
    const blocked = docsPack.evaluateModeEntry({ requested: 'publish', data: { approved: false, next_mode: 'review' }, taskRef: TASK });
    expect(blocked).toMatchObject({ allowed: false, reasonCodes: ['ENTRY_NOT_APPROVED'], redirect: `DOC review ${TASK}` });
    expect(blocked.warnings).toEqual(['status.md ghi bước kế tiếp là "review" nhưng đang chạy "publish".']);
    expect(docsPack.evaluateModeEntry({ requested: 'publish', data: { approved: false, human_override: true } }).allowed).toBe(true);
    expect(docsPack.evaluateModeEntry({ requested: 'publish', data: { approved: true } }).allowed).toBe(true);
  });
});

describe('scaffold, gate kết thúc mode, nội dung mở mode', () => {
  it('scaffold tạo file theo template của pack và điền tên task', () => {
    const status = fs.readFileSync(path.join(ws, TASK, 'state', 'status.md'), 'utf8');
    expect(status).toMatch(/^task_id: DOC-1-intro$/m);
    expect(status).toMatch(/DOC draft docs\/doc-tasks\/DOC-1-intro/);
    expect(docsPack.scaffoldTask({ workspaceRoot: ws, name: '../x' }).error).toMatch(/Dùng dạng DOC-<id>-<slug>/);
  });

  it('gate kết thúc mode dùng artifact, state và nhãn của pack', () => {
    const taskDir = path.join(ws, TASK);
    expect(docsPack.evaluateModeCompletion({ taskDir, taskRef: TASK, command: 'draft' })).toMatchObject({ ok: true, refused: false });

    const review = docsPack.evaluateModeCompletion({ taskDir, taskRef: TASK, command: 'review' });
    expect(review.issues.map((i) => i.code)).toEqual(['END_CURRENT_MODE_MISMATCH', 'END_ARTIFACT_MISSING']);
    expect(review.errors).toContain('current_mode trong status.md phải là reviewing (đang là "drafting").');
    expect(review.errors).toContain('Thiếu artifact bắt buộc của DOC review: review/notes.md');

    const publish = docsPack.evaluateModeCompletion({ taskDir, taskRef: TASK, command: 'publish' });
    expect(publish).toMatchObject({ ok: true, refused: true });
  });

  it('nội dung mở mode chọn rule theo manifest, kể cả rule có điều kiện', () => {
    const open = (command) =>
      docsPack.modeBriefing({ taskDir: path.join(ws, TASK), taskRef: TASK, command, rulesDir: RULES_DIR, rulesLabel: 'test', newTaskHint: '', finishHint: 'Kết thúc.' });
    const draft = open('draft');
    expect(draft.text).toMatch(/^GATE: ĐƯỢC CHẠY DOC draft \(drafting\)/);
    expect(draft.text).toMatch(/Agent đảm nhận: docs-writer/);
    expect(draft.text).toMatch(/Read brief\.md first\./);
    expect(draft.text).toMatch(/--- style\.md ---/);
    expect(draft.text).not.toMatch(/legal\.md/);

    setStatus({ legal_review: 'true' });
    fs.appendFileSync(path.join(ws, TASK, 'state', 'status.md'), '');
    const status = path.join(ws, TASK, 'state', 'status.md');
    fs.writeFileSync(status, fs.readFileSync(status, 'utf8').replace('human_override: false', 'human_override: false\nlegal_review: true'));
    expect(open('review').text).toMatch(/--- review-checklist\.md ---[\s\S]*--- legal\.md ---/);
    expect(open('publish').text).toMatch(/^GATE: BỊ CHẶN — không được chạy DOC publish/);
  });
});

describe('run-log và báo cáo', () => {
  it('ghi theo id của pack và tổng hợp theo thư mục task của pack', () => {
    appendRunLog(path.join(ws, TASK), { event: 'mode_start', source: 'cli', mode: 'draft' });
    appendRunLog(path.join(ws, TASK), { event: 'mode_end', source: 'cli', mode: 'draft', outcome: 'pass', attempt: 1 });
    expect(docsPack.runLogFile).toBe('state/run-log.jsonl');
    expect(readRunLog(path.join(ws, TASK), { file: docsPack.runLogFile }).records.map((r) => [r.pack, r.event])).toEqual([
      ['docs', 'mode_start'],
      ['docs', 'mode_end'],
    ]);
    const report = buildReport({ repoRoot: ws, tasksRoot: docsPack.tasksRoot, runLogFile: docsPack.runLogFile });
    expect(report.total.modes.draft.firstPass).toBe(1);
    expect(renderReport(report, { title: 'Báo cáo run-log Docs-Kit', tasksRoot: docsPack.tasksRoot, runLogFile: docsPack.runLogFile })).toMatch(/^# Báo cáo run-log Docs-Kit/);
  });
});

describe('hook', () => {
  function runHook(payload, env = {}) {
    const r = spawnSync(process.execPath, [HOOK, payload.hook_event_name], {
      input: JSON.stringify({ session_id: 's', cwd: ws, ...payload }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PLUGIN_DATA: dataDir, DOCS_KIT_HOOKS: 'enforce', FE_KIT_HOOKS: 'off', ...env },
    });
    expect(r.status).toBe(0);
    return r.stdout ? JSON.parse(r.stdout) : null;
  }

  it('nhận lệnh theo plugin/tiền tố của pack và báo gate bị chặn bằng nhãn của pack', () => {
    const out = runHook({ hook_event_name: 'UserPromptSubmit', prompt: `/docs:publish ${TASK}` });
    expect(out.hookSpecificOutput.additionalContext).toMatch(/^\[Docs-Kit gate\] DOC publish đang BỊ CHẶN cho docs\/doc-tasks\/DOC-1-intro/);
    expect(out.hookSpecificOutput.additionalContext).toMatch(/Cập nhật state\/status\.md và route sang: DOC review/);
    expect(readRunLog(path.join(ws, TASK), { file: docsPack.runLogFile }).records.map((r) => [r.pack, r.event])).toEqual([
      ['docs', 'mode_start'],
      ['docs', 'entry_blocked'],
    ]);
  });

  it('luật theo vai dùng agent và thư mục của pack; biến môi trường của FE không ảnh hưởng', () => {
    const edit = (agent, file, env) =>
      runHook({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: path.join(ws, file), new_string: 'x' }, agent_type: agent }, env);
    const denied = edit('docs:docs-reviewer', 'src/page.md');
    expect(denied.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(denied.hookSpecificOutput.permissionDecisionReason).toBe(
      'Agent docs-reviewer không được sửa source (src/page.md). Chỉ docs-writer trong DOC draft được sửa code; hãy ghi phát hiện vào artifact của task trong docs/doc-tasks/.'
    );
    expect(edit('docs:docs-reviewer', `${TASK}/review/notes.md`)).toBeNull();
    expect(edit('fe:frontend-reviewer', 'src/page.md')).toBeNull();
    expect(edit('docs:docs-reviewer', 'src/page.md', { DOCS_KIT_HOOKS: 'off', FE_KIT_HOOKS: 'enforce' })).toBeNull();
  });

  it('kết thúc mode dùng gate của pack', () => {
    runHook({ hook_event_name: 'UserPromptSubmit', prompt: `DOC review ${TASK}` });
    const out = runHook({ hook_event_name: 'Stop', stop_hook_active: false });
    expect(out.decision).toBe('block');
    expect(out.reason).toMatch(/^DOC review cho docs\/doc-tasks\/DOC-1-intro chưa đạt gate kết thúc mode:/);
    expect(out.reason).toMatch(/Thiếu artifact bắt buộc của DOC review: review\/notes\.md/);
  });
});

describe('MCP', () => {
  it('tên tool, mô tả và nội dung lấy từ pack', () => {
    const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-plugin-'));
    fs.cpSync(RULES_DIR, path.join(pluginRoot, 'skills', 'docs', 'rules'), { recursive: true });
    const { serverName, tools, callTool } = createMcpTools(docsPack, { version: 'test', pluginRoot });
    expect(serverName).toBe('docs-kit');
    expect(tools.map((t) => t.name)).toEqual([
      'docs_begin_mode',
      'docs_new_task',
      'docs_validate_task',
      'docs_validate_workflow',
      'docs_scope_diff',
      'docs_next_step',
      'docs_task_status',
      'docs_list_tasks',
    ]);
    expect(tools[0].inputSchema.properties.mode.description).toBe('Mode muốn chạy: draft, review, publish.');

    const begin = callTool('docs_begin_mode', { workspace_root: ws, task_folder: 'DOC-1-intro', mode: 'draft' });
    expect(begin.isError).toBe(false);
    expect(begin.content[0].text).toMatch(/Trước khi kết thúc: cập nhật state\/status\.md rồi gọi docs_validate_workflow\./);
    expect(begin.content[0].text).toMatch(/nguồn: plugin\) — không cần đọc lại file rule ===\n\n--- style\.md ---/);
    expect(callTool('docs_next_step', { workspace_root: ws, task_folder: TASK }).content[0].text).toBe(`DOC draft ${TASK}`);
    expect(callTool('docs_task_status', { workspace_root: ws, task_folder: TASK }).content[0].text).toBe('current_mode: drafting\nnext_mode: draft\napproved: false');
    expect(callTool('docs_list_tasks', { workspace_root: ws }).content[0].text).toBe('- DOC-1-intro (drafting)');
    expect(callTool('fe_begin_mode', {}).content[0].text).toBe('Tool không tồn tại: fe_begin_mode');
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  });
});

describe('engine không chứa khái niệm của FE', () => {
  it('packages/engine/src không nhắc frontend, Figma, heading tiếng Việt của FE hay tiền tố FE', () => {
    const dir = path.join(ROOT, 'packages', 'engine', 'src');
    for (const f of fs.readdirSync(dir)) {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(text, f).not.toMatch(/frontend|figma|Prompt bước|docs\/frontend|\bFE\b/i);
    }
  });
});
