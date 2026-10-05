/**
 * Test hook runtime bằng cách chạy bản bundle thật (plugins/fe/hooks/fe-hook.mjs)
 * với payload JSON qua stdin, đúng cách Claude Code gọi. Chạy `npm run build`
 * trước nếu vừa sửa core/hooks hoặc packages/validators.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.join(ROOT, 'plugins', 'fe', 'hooks', 'fe-hook.mjs');
const FIXTURES = path.join(ROOT, 'packages', 'validators', 'test', 'fixtures');

let workspace;
let dataDir;

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Dựng workspace tạm có một task copy từ fixture; trả về path tương đối của task. */
function addTask(fixture, name = 'FE-1') {
  const rel = `docs/frontend-tasks/${name}`;
  copyDir(path.join(FIXTURES, fixture), path.join(workspace, rel));
  return rel;
}

function runHook(payload, { level = 'enforce' } = {}) {
  const r = spawnSync(process.execPath, [HOOK, payload.hook_event_name], {
    input: JSON.stringify({ session_id: 'test-session', cwd: workspace, ...payload }),
    encoding: 'utf8',
    env: { ...process.env, FE_KIT_HOOKS: level, CLAUDE_PLUGIN_DATA: dataDir },
  });
  expect(r.status).toBe(0); // hook không bao giờ được làm hỏng phiên
  return r.stdout ? JSON.parse(r.stdout) : null;
}

const marker = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions', 'test-session.json'), 'utf8'));
const begin = (prompt, opts) => runHook({ hook_event_name: 'UserPromptSubmit', prompt }, opts);
const edit = (file, extra = {}, opts) =>
  runHook({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: path.join(workspace, file), new_string: 'x' }, ...extra }, opts);

/** Sửa frontmatter của workflow-status.md và đẩy mtime về sau thời điểm bắt đầu mode. */
function updateStatus(taskRel, replacements) {
  const file = path.join(workspace, taskRel, 'tracking', 'workflow-status.md');
  let text = fs.readFileSync(file, 'utf8');
  for (const [key, value] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`^${key}:.*$`, 'm'), `${key}: ${value}`);
  }
  fs.writeFileSync(file, text);
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(file, future, future);
}

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-kit-ws-'));
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-kit-data-'));
});

afterEach(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('ghi nhớ mode đang chạy', () => {
  it('nhận /fe:cook và FE cook ở đầu prompt', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:cook ${task}`);
    expect(marker()).toMatchObject({ command: 'cook', taskRef: task, status: 'pending' });

    begin(`FE review ${task}`);
    expect(marker().command).toBe('review');
  });

  it('không dính câu "Tiếp theo: FE cook ..." nằm giữa prompt', () => {
    const task = addTask('task-ready-to-cook');
    begin(`Agent đã xong.\nTiếp theo: FE cook ${task}`);
    expect(fs.existsSync(path.join(dataDir, 'sessions', 'test-session.json'))).toBe(false);
  });

  it('báo gate bị chặn vào ngữ cảnh ngay khi bắt đầu', () => {
    const task = addTask('task-blocked-question');
    const out = begin(`/fe:cook ${task}`);
    expect(out.hookSpecificOutput.additionalContext).toMatch(/BỊ CHẶN/);
    expect(out.hookSpecificOutput.additionalContext).toMatch(/FE input-sync/);
  });

  it('PostToolUse của fe_begin_mode cũng ghi marker', () => {
    const task = addTask('task-ready-to-cook');
    runHook({
      hook_event_name: 'PostToolUse',
      tool_name: 'mcp__plugin_fe_frontend-delivery__fe_begin_mode',
      tool_input: { workspace_root: workspace, task_folder: task, mode: 'plan' },
    });
    expect(marker().command).toBe('plan');
  });
});

describe('PreToolUse: luật theo vai', () => {
  it('chặn agent không phải developer sửa source, không cần marker', () => {
    const out = edit('src/App.tsx', { agent_type: 'fe:frontend-reviewer' });
    expect(out.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(out.hookSpecificOutput.permissionDecisionReason).toMatch(/frontend-reviewer/);
  });

  it('cho mọi agent của kit ghi artifact trong docs/frontend-tasks', () => {
    expect(edit('docs/frontend-tasks/FE-1/output/review-report.md', { agent_type: 'fe:frontend-reviewer' })).toBeNull();
  });

  it('không can thiệp agent ngoài kit, main thread không có mode, hay file ngoài workspace', () => {
    expect(edit('src/App.tsx', { agent_type: 'Explore' })).toBeNull();
    expect(edit('src/App.tsx')).toBeNull();
    expect(
      runHook({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(os.tmpdir(), 'outside.md') }, agent_type: 'fe:frontend-planner' })
    ).toBeNull();
  });

  it('mức warn chỉ cảnh báo, mức off im lặng', () => {
    const warned = edit('src/App.tsx', { agent_type: 'fe:frontend-tester' }, { level: 'warn' });
    expect(warned.systemMessage).toMatch(/FE-Kit cảnh báo/);
    expect(warned.hookSpecificOutput).toBeUndefined();
    expect(edit('src/App.tsx', { agent_type: 'fe:frontend-tester' }, { level: 'off' })).toBeNull();
  });
});

describe('PreToolUse: luật theo gate của task', () => {
  it('chặn developer sửa source khi task còn câu hỏi blocking', () => {
    const task = addTask('task-blocked-question');
    begin(`/fe:cook ${task}`);
    const out = edit('src/App.tsx', { agent_type: 'fe:frontend-developer' });
    expect(out.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(out.hookSpecificOutput.permissionDecisionReason).toMatch(/FE input-sync/);
  });

  it('cho developer sửa source khi task sẵn sàng cook', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:cook ${task}`);
    expect(edit('src/App.tsx', { agent_type: 'fe:frontend-developer' })).toBeNull();
  });

  it('hỏi xác nhận khi agent bật human_override', () => {
    const task = addTask('task-blocked-question');
    const out = runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: path.join(workspace, task, 'tracking', 'workflow-status.md'), old_string: 'human_override: false', new_string: 'human_override: true' },
      agent_type: 'fe:frontend-developer',
    });
    expect(out.hookSpecificOutput.permissionDecision).toBe('ask');
  });
});

describe('Stop / SubagentStop', () => {
  it('chặn kết thúc khi workflow-status.md chưa được cập nhật', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:plan ${task}`);
    const file = path.join(workspace, task, 'tracking', 'workflow-status.md');
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(file, past, past);

    const out = runHook({ hook_event_name: 'Stop', stop_hook_active: false });
    expect(out.decision).toBe('block');
    expect(out.reason).toMatch(/chưa được cập nhật/);
    expect(marker().status).toBe('pending');
  });

  it('không lặp vô hạn: lần hai (stop_hook_active) thả ra kèm cảnh báo', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:plan ${task}`);
    const file = path.join(workspace, task, 'tracking', 'workflow-status.md');
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(file, past, past);

    const out = runHook({ hook_event_name: 'Stop', stop_hook_active: true });
    expect(out.decision).toBeUndefined();
    expect(out.systemMessage).toMatch(/chưa đạt gate/);
    expect(marker().status).toBe('done');
  });

  it('cho kết thúc khi plan đã cập nhật hợp lệ, và đóng marker', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:plan ${task}`);
    updateStatus(task, { current_mode: 'planning-mode' });

    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false })).toBeNull();
    expect(marker().status).toBe('done');
    // Mode đã đóng thì yêu cầu không liên quan sau đó không bị gate nữa.
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false })).toBeNull();
  });

  it('mode đã delegate thì Stop của main thread bỏ qua, SubagentStop đúng agent mới kiểm', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:review ${task}`);
    runHook({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'fe:frontend-reviewer', prompt: 'review' } });
    expect(marker().delegated).toBe(true);

    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false })).toBeNull();
    expect(runHook({ hook_event_name: 'SubagentStop', agent_type: 'Explore', stop_hook_active: false })).toBeNull();

    const out = runHook({ hook_event_name: 'SubagentStop', agent_type: 'fe:frontend-reviewer', stop_hook_active: false });
    expect(out.decision).toBe('block');
    expect(out.reason).toMatch(/output\/review-report\.md/);
  });

  it('mode bị gate từ chối: status đã route đúng thì không đòi artifact hay sửa file', () => {
    const task = addTask('task-blocked-question');
    begin(`/fe:cook ${task}`);
    const file = path.join(workspace, task, 'tracking', 'workflow-status.md');
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(file, past, past);

    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false })).toBeNull();
    expect(marker().status).toBe('done');
  });

  it('mode bị gate từ chối nhưng status route sai thì chặn và nêu prompt đúng', () => {
    const task = addTask('task-blocked-question');
    begin(`/fe:cook ${task}`);
    updateStatus(task, { next_mode: 'cook' });

    const out = runHook({ hook_event_name: 'Stop', stop_hook_active: false });
    expect(out.decision).toBe('block');
    expect(out.reason).toMatch(/Giữ nguyên current_mode/);
    expect(out.reason).toMatch(/FE input-sync/);
  });

  it('cook kết thúc được khi status hợp lệ (workspace không có git nên scope diff tự bỏ qua)', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:cook ${task}`);
    updateStatus(task, { current_mode: 'implementation-mode', next_mode: 'review' });
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false })).toBeNull();
  });
});

describe('an toàn', () => {
  it('payload hỏng hoặc sự kiện lạ không làm hook lỗi', () => {
    const r = spawnSync(process.execPath, [HOOK, 'Stop'], { input: 'không phải json', encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_DATA: dataDir } });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(runHook({ hook_event_name: 'SessionStart' })).toBeNull();
  });
});
