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

/** `level: null` = không set FE_KIT_HOOKS; `env` thêm biến cho riêng lần gọi. */
function runHook(payload, { level = 'enforce', env = {} } = {}) {
  const base = { ...process.env, CLAUDE_PLUGIN_DATA: dataDir };
  delete base.FE_KIT_HOOKS;
  delete base.EVAL_FE_KIT_HOOKS;
  if (level !== null) base.FE_KIT_HOOKS = level;
  const r = spawnSync(process.execPath, [HOOK, payload.hook_event_name], {
    input: JSON.stringify({ session_id: 'test-session', cwd: workspace, ...payload }),
    encoding: 'utf8',
    env: { ...base, ...env },
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

  it('không set biến nào thì mặc định warn', () => {
    const out = edit('src/App.tsx', { agent_type: 'fe:frontend-tester' }, { level: null });
    expect(out.systemMessage).toMatch(/FE-Kit cảnh báo/);
    expect(out.hookSpecificOutput).toBeUndefined();
  });

  it('phiên của claude plugin eval: đọc EVAL_FE_KIT_HOOKS, nhưng FE_KIT_HOOKS vẫn thắng', () => {
    const enforced = edit('src/App.tsx', { agent_type: 'fe:frontend-tester' }, { level: null, env: { EVAL_FE_KIT_HOOKS: 'enforce' } });
    expect(enforced.hookSpecificOutput.permissionDecision).toBe('deny');

    const warned = edit('src/App.tsx', { agent_type: 'fe:frontend-tester' }, { level: 'warn', env: { EVAL_FE_KIT_HOOKS: 'enforce' } });
    expect(warned.hookSpecificOutput).toBeUndefined();
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

describe('scope cuối cook khi workspace có thay đổi từ trước', () => {
  const git = (...a) => spawnSync('git', a, { cwd: workspace, encoding: 'utf8' });

  /** Task sẵn sàng cook, plan chỉ khai `src/features/order/`; `src/legacy.ts` đã commit rồi bị người dùng sửa dở. */
  function gitTask() {
    const task = addTask('task-ready-to-cook');
    fs.appendFileSync(
      path.join(workspace, task, 'planning', 'implementation-plan.md'),
      '\n## 7. File sẽ tạo / cập nhật\n\n| File | Hành động | Lý do | Checklist ref |\n|---|---|---|---|\n| `src/features/order/` | Tạo | Màn hình huỷ đơn | IMP-01 |\n'
    );
    fs.mkdirSync(path.join(workspace, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'src', 'legacy.ts'), 'export const a = 1;\n');
    git('init', '-q');
    git('add', '-A');
    git('-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(workspace, 'src', 'legacy.ts'), 'export const a = 2; // người dùng đang sửa\n');
    return task;
  }

  function finishCook(task) {
    fs.mkdirSync(path.join(workspace, 'src', 'features', 'order'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'src', 'features', 'order', 'CancelButton.tsx'), 'export {};\n');
    updateStatus(task, { current_mode: 'implementation-mode', next_mode: 'review' });
    return runHook({ hook_event_name: 'Stop', stop_hook_active: false });
  }

  it('file đã dirty từ trước bị sửa thêm ngoài plan thì bị báo, nói rõ là thay đổi của người dùng', () => {
    const task = gitTask();
    begin(`/fe:cook ${task}`);
    fs.appendFileSync(path.join(workspace, 'src', 'legacy.ts'), 'export const b = 3;\n');

    const out = finishCook(task);
    expect(out.decision).toBe('block');
    expect(out.reason).toMatch(/src\/legacy\.ts/);
    expect(out.reason).toMatch(/thay đổi chưa commit của người dùng/);
    // Hook chỉ đọc: thay đổi của người dùng vẫn còn nguyên.
    expect(fs.readFileSync(path.join(workspace, 'src', 'legacy.ts'), 'utf8')).toMatch(/người dùng đang sửa/);
  });

  it('file đã dirty từ trước mà mode không đụng tới thì không bị tính', () => {
    const task = gitTask();
    begin(`/fe:cook ${task}`);
    expect(finishCook(task)).toBeNull();
  });

  it('marker kiểu v2.0.x (chỉ có danh sách path) vẫn chạy, so theo path như trước', () => {
    const task = gitTask();
    fs.mkdirSync(path.join(dataDir, 'sessions'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'sessions', 'test-session.json'),
      JSON.stringify({
        task: path.join(workspace, task),
        taskRef: task,
        workspace,
        command: 'cook',
        startedAt: Date.now(),
        status: 'pending',
        delegated: false,
        baselineChanged: ['src/legacy.ts'],
      })
    );
    fs.appendFileSync(path.join(workspace, 'src', 'legacy.ts'), 'export const b = 3;\n');
    expect(finishCook(task)).toBeNull();
  });
});

describe('hành vi biên của marker', () => {
  function writeMarker(fields) {
    fs.mkdirSync(path.join(dataDir, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'sessions', 'test-session.json'), JSON.stringify(fields));
  }

  it('marker quá 4 giờ coi như không có mode: không chặn sửa source, không kiểm kết thúc', () => {
    const task = addTask('task-blocked-question');
    writeMarker({
      task: path.join(workspace, task),
      taskRef: task,
      workspace,
      command: 'cook',
      startedAt: Date.now() - 5 * 60 * 60 * 1000,
      status: 'pending',
      delegated: false,
      baseline: {},
    });
    expect(edit('src/App.tsx', { agent_type: 'fe:frontend-developer' })).toBeNull();
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false })).toBeNull();
  });

  it('bắt đầu lệnh FE khác khi mode trước chưa qua gate kết thúc thì cảnh báo', () => {
    const a = addTask('task-ready-to-cook', 'FE-1');
    const b = addTask('task-ready-to-cook', 'FE-2');
    begin(`/fe:cook ${a}`);
    const out = begin(`/fe:plan ${b}`);
    expect(out.systemMessage).toMatch(/FE cook cho docs\/frontend-tasks\/FE-1 chưa qua gate kết thúc/);
    expect(marker()).toMatchObject({ command: 'plan', taskRef: b, status: 'pending' });
  });

  it('không cảnh báo khi mode trước đã đóng hoặc lặp lại cùng mode', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:plan ${task}`);
    expect(begin(`/fe:plan ${task}`)).toBeNull();
    updateStatus(task, { current_mode: 'planning-mode' });
    runHook({ hook_event_name: 'Stop', stop_hook_active: false });
    expect(marker().status).toBe('done');
    expect(begin(`/fe:plan ${task}`)).toBeNull();
    expect(marker().status).toBe('pending');
  });

  it('cảnh báo chuyển mode và gate bị chặn đi chung một output JSON', () => {
    const a = addTask('task-ready-to-cook', 'FE-1');
    const b = addTask('task-blocked-question', 'FE-2');
    begin(`/fe:plan ${a}`);
    const out = begin(`/fe:cook ${b}`);
    expect(out.systemMessage).toMatch(/chưa qua gate kết thúc/);
    expect(out.hookSpecificOutput.additionalContext).toMatch(/BỊ CHẶN/);
  });

  it('mode bỏ dở rồi hỏi việc khác: Stop chặn đúng một lần, lần sau thả ra và đóng marker', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:plan ${task}`);
    const file = path.join(workspace, task, 'tracking', 'workflow-status.md');
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(file, past, past);

    expect(begin('Giải thích giúp file vite.config.ts')).toBeNull(); // không phải lệnh FE: marker giữ nguyên
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false }).decision).toBe('block');
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: true }).systemMessage).toMatch(/chưa đạt gate/);
    expect(marker().status).toBe('done');
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false })).toBeNull();
  });
});

/** Sự kiện run-log của task trong workspace tạm. */
function runLog(taskRel) {
  const file = path.join(workspace, taskRel, 'tracking', 'run-log.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const stale = (taskRel) => {
  const file = path.join(workspace, taskRel, 'tracking', 'workflow-status.md');
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(file, past, past);
};

describe('run-log', () => {
  it('mở mode và bị chặn khi kết thúc: chặn → chặn → thả ra, attempt tăng dần', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:plan ${task}`);
    stale(task);
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false }).decision).toBe('block');
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false }).decision).toBe('block');
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: true }).systemMessage).toMatch(/chưa đạt gate/);

    const events = runLog(task);
    expect(events.map((e) => [e.event, e.outcome, e.attempt])).toEqual([
      ['mode_start', undefined, undefined],
      ['mode_end', 'blocked', 1],
      ['mode_end', 'blocked', 2],
      ['mode_end', 'released', 3],
    ]);
    for (const e of events) {
      expect(e).toMatchObject({ v: 1, pack: 'fe', task: 'FE-1', mode: 'plan', source: 'hook', actor: 'claude', level: 'enforce' });
      expect(e.session).toMatch(/^[0-9a-f]{12}$/);
    }
    expect(events[1].codes).toContain('END_STATUS_NOT_UPDATED');
    expect(events[3].duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('kết thúc hợp lệ ghi mode_end pass; SubagentStop ghi tên agent', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:plan ${task}`);
    runHook({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'fe:frontend-planner' } });
    updateStatus(task, { current_mode: 'planning-mode' });
    expect(runHook({ hook_event_name: 'SubagentStop', agent_type: 'fe:frontend-planner', stop_hook_active: false })).toBeNull();

    const end = runLog(task).at(-1);
    expect(end).toMatchObject({ event: 'mode_end', outcome: 'pass', attempt: 1, agent: 'frontend-planner' });
    expect(end).not.toHaveProperty('codes');
  });

  it('gate chặn lúc vào mode và khi sửa source đều được ghi kèm reason code', () => {
    const task = addTask('task-blocked-question');
    begin(`/fe:cook ${task}`);
    edit('src/App.tsx', { agent_type: 'fe:frontend-developer' });
    edit('src/App.tsx', { agent_type: 'fe:frontend-developer' }, { level: 'warn' });

    const [start, blocked, denied, warned] = runLog(task);
    expect(start.event).toBe('mode_start');
    expect(blocked).toMatchObject({ event: 'entry_blocked', mode: 'cook' });
    expect(blocked.codes).toContain('ENTRY_QUESTIONS_BLOCKING');
    expect(denied).toMatchObject({ event: 'edit_denied', file: 'src/App.tsx', agent: 'frontend-developer' });
    expect(denied.codes).toEqual(expect.arrayContaining(['EDIT_GATE_CLOSED', 'ENTRY_QUESTIONS_BLOCKING']));
    expect(warned).toMatchObject({ event: 'edit_warned', level: 'warn' });
  });

  it('agent sai vai sửa source trong mode đang chạy: ghi EDIT_ROLE_FORBIDDEN', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:review ${task}`);
    edit('src/App.tsx', { agent_type: 'fe:frontend-reviewer' });
    expect(runLog(task).at(-1)).toMatchObject({ event: 'edit_denied', mode: 'review', codes: ['EDIT_ROLE_FORBIDDEN'] });
  });

  it('bật human_override và chuyển lệnh khi mode trước chưa xong đều được ghi', () => {
    const task = addTask('task-ready-to-cook');
    begin(`/fe:plan ${task}`);
    begin(`/fe:review ${task}`);
    runHook({
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: path.join(workspace, task, 'tracking', 'workflow-status.md'), old_string: 'human_override: false', new_string: 'human_override: true' },
    });
    const events = runLog(task).map((e) => [e.event, e.mode]);
    expect(events).toEqual([
      ['mode_start', 'plan'],
      ['mode_start', 'review'],
      ['mode_abandoned', 'plan'],
      ['override_requested', 'review'],
    ]);
  });

  it('không ghi được run-log thì hook vẫn thoát 0 và vẫn chặn', () => {
    const task = addTask('task-ready-to-cook');
    fs.mkdirSync(path.join(workspace, task, 'tracking', 'run-log.jsonl'));
    begin(`/fe:plan ${task}`);
    stale(task);
    expect(runHook({ hook_event_name: 'Stop', stop_hook_active: false }).decision).toBe('block');
  });

  it('FE_KIT_RUNLOG=off thì không ghi gì', () => {
    const task = addTask('task-blocked-question');
    begin(`/fe:cook ${task}`, { env: { FE_KIT_RUNLOG: 'off' } });
    expect(runLog(task)).toEqual([]);
  });
});

describe('mode chỉ đọc không được đổi source (kể cả qua shell)', () => {
  const git = (...a) => spawnSync('git', a, { cwd: workspace, encoding: 'utf8' });

  /** Workspace git có src/app.ts đã commit và src/user.ts người dùng đang sửa dở. */
  function gitWorkspace() {
    const task = addTask('task-ready-to-cook');
    fs.mkdirSync(path.join(workspace, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'src', 'app.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(workspace, 'src', 'user.ts'), 'export const u = 1;\n');
    git('init', '-q');
    git('add', '-A');
    git('-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(workspace, 'src', 'user.ts'), 'export const u = 2; // người dùng đang sửa\n');
    return task;
  }
  const endCodes = (task) => runLog(task).filter((e) => e.event === 'mode_end').at(-1)?.codes || [];

  it('review đổi file source (vd qua shell) thì không được kết thúc', () => {
    const task = gitWorkspace();
    begin(`/fe:review ${task}`);
    fs.writeFileSync(path.join(workspace, 'src', 'app.ts'), 'export const a = 2;\n'); // ghi thẳng, không qua Edit
    const out = runHook({ hook_event_name: 'Stop', stop_hook_active: false });
    expect(out.decision).toBe('block');
    expect(out.reason).toMatch(/FE review không được sửa source.*src\/app\.ts/);
    expect(endCodes(task)).toContain('END_SOURCE_TOUCHED_IN_READONLY_MODE');
  });

  it('không tính thay đổi có sẵn của người dùng, file ngoài source_paths hay artifact của task', () => {
    const task = gitWorkspace();
    begin(`/fe:review ${task}`);
    fs.mkdirSync(path.join(workspace, 'coverage'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'coverage', 'lcov.info'), 'x\n');
    fs.mkdirSync(path.join(workspace, task, 'output'), { recursive: true });
    fs.writeFileSync(path.join(workspace, task, 'output', 'review-report.md'), '# Review\n');
    runHook({ hook_event_name: 'Stop', stop_hook_active: false });
    expect(endCodes(task)).not.toContain('END_SOURCE_TOUCHED_IN_READONLY_MODE');
  });

  it('cảnh báo lệnh shell trông như ghi file của agent không phải developer', () => {
    const task = gitWorkspace();
    begin(`/fe:review ${task}`);
    const shell = (command, agent = 'fe:frontend-reviewer', opts) =>
      runHook({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, agent_type: agent }, opts);

    expect(shell('echo x > src/app.ts').systemMessage).toMatch(/có thể ghi file/);
    expect(shell("sed -i 's/a/b/' src/app.ts").systemMessage).toMatch(/có thể ghi file/);
    expect(shell('git checkout -- src/app.ts').systemMessage).toMatch(/có thể ghi file/);
    expect(runLog(task).filter((e) => e.event === 'edit_warned').at(-1)).toMatchObject({ codes: ['SHELL_WRITE_SUSPECTED'], mode: 'review' });

    for (const safe of ['git diff --stat', 'npm test 2>&1', 'cat src/app.ts | head -5', 'ls > /dev/null', 'node -e "[1].map((x) => x)"']) {
      expect(shell(safe), safe).toBeNull();
    }
    expect(shell('echo x > src/app.ts', 'fe:frontend-developer')).toBeNull();
    expect(shell('echo x > src/app.ts', 'Explore')).toBeNull();
    expect(shell('echo x > src/app.ts', 'fe:frontend-reviewer', { env: { FE_KIT_BASH_GUARD: 'off' } })).toBeNull();
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
