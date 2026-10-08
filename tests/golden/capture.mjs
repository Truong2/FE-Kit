/**
 * Golden capture cho bước tách engine/pack (ROADMAP Phase 3): chụp output của
 * validators, hook, MCP và CLI trên nhiều trạng thái task. Refactor không được
 * đổi bất kỳ byte nào trong kết quả này.
 *
 *   node tests/golden/capture.mjs        ghi lại tests/golden/golden.json
 *   tests/golden.test.mjs                so kết quả hiện tại với file đó
 *
 * Hook, MCP, CLI chạy bằng bản bundle nên phải `npm run build` trước.
 * Output được chuẩn hoá (path tạm, dấu `\`, CRLF) để golden tạo trên Windows
 * vẫn khớp trên CI Linux.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = path.join(ROOT, 'packages', 'validators', 'test', 'fixtures');
const HOOK = path.join(ROOT, 'plugins', 'fe', 'hooks', 'fe-hook.mjs');
const MCP = path.join(ROOT, 'plugins', 'fe', 'mcp', 'fe-kit-mcp.mjs');
const CLI = path.join(ROOT, 'standalone', 'fe-kit.mjs');
export const GOLDEN_FILE = path.join(ROOT, 'tests', 'golden', 'golden.json');

const COMMANDS = ['plan', 'quick', 'input-sync', 'figma', 'figma-review', 'cook', 'bugfix', 'review', 'test', 'pr'];

const MUTATIONS = {
  base: {},
  'mode:plan': { current_mode: 'planning-mode' },
  'mode:review': { current_mode: 'review-mode' },
  'mode:test': { current_mode: 'testing-mode' },
  'mode:pr': { current_mode: 'pr-ready-mode' },
  'mode:input-sync': { current_mode: 'input-sync-mode' },
  'mode:figma': { current_mode: 'figma-extraction-mode' },
  'mode:figma-review': { current_mode: 'figma-review-mode' },
  'not-ready': { build_ready: 'false' },
  'next:cook': { next_mode: 'cook', next_prompt: '"FE cook docs/frontend-tasks/FE-G"' },
  'next:test-with-critical': { next_mode: 'test', critical_issues_open: '1' },
  'review-passed-pr-ready': { review_status: 'passed', pr_status: 'ready' },
  'bugfix-required': { bugfix_required: 'true', review_bug_status: 'open' },
  'figma-required-open': { figma_required: 'true', figma_gate_status: 'pending' },
  'figma-required-passed': { figma_required: 'true', figma_gate_status: 'passed' },
  'scope-failed': { scope_diff_status: 'failed' },
  'evidence-failed': { command_evidence_status: 'failed' },
  'questions-open': { questions_status: 'open' },
  'input-sync-required': { input_sync_required: 'true' },
  'human-override': { human_override: 'true', build_ready: 'false' },
  'srs-trace-missing': { srs_trace_matrix_status: 'in_progress' },
  'budget-failed': { token_budget_status: 'failed' },
  'schema-invalid': { current_mode: 'deploy-mode' },
};

const FILE_VARIANTS = {
  'review-report': { 'output/review-report.md': '# Báo cáo review\n' },
  'open-critical-bug': {
    'tracking/review-bugs.md':
      '# Danh sách bug từ review\n\n## Bug cần xử lý\n\n| ID | Severity | Nhóm | File/evidence | Expected | Actual | Hướng xử lý | Nguyên nhân gốc | Owner | Trạng thái |\n|---|---|---|---|---|---|---|---|---|---|\n| BUG-1 | Critical | api-contract | a | b | c | d | plan-gap | Dev | Open |\n',
  },
  'test-evidence': {
    'output/test-summary.md': '# Báo cáo test\n\n## 1. Command evidence log\n\n| Command | Đã chạy thật? | Kết quả | Thời điểm | Ghi chú |\n|---|---|---|---|---|\n| `npm test` | Có | Passed | 2026-10-08 10:00 |  |\n',
  },
  'prompt-outside-status': { 'task.md': '# Task\n\n## Prompt bước tiếp theo\n\nFE cook x\n' },
  'pr-ready-files': {
    'output/review-report.md': '# Báo cáo review\n',
    'output/pr-summary.md': '# PR\n',
    'output/test-summary.md': '## 1. Command evidence log\n\n| Command | Đã chạy thật? | Kết quả |\n|---|---|---|\n| `npm test` | Có | Passed |\n',
  },
};

// --- tiện ích -------------------------------------------------------------------

function makeNormalizer(dirs) {
  const variants = dirs.flatMap((d) => [d, d.replace(/\\/g, '/'), fs.realpathSync.native?.(d) ?? d]).filter(Boolean);
  const unique = [...new Set(variants)].sort((a, b) => b.length - a.length);
  return function normalize(value) {
    if (typeof value === 'string') {
      let s = value.replace(/\r\n/g, '\n');
      for (const d of unique) s = s.split(d).join('<WS>');
      return s.replace(/\\/g, '/');
    }
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
    return value;
  };
}

function copyFixture(name, dest) {
  fs.cpSync(path.join(FIXTURES, name), dest, { recursive: true });
}

function setStatus(taskDir, values) {
  const file = path.join(taskDir, 'tracking', 'workflow-status.md');
  let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const [k, v] of Object.entries(values)) text = text.replace(new RegExp(`^${k}:.*$`, 'm'), () => `${k}: ${v}`);
  fs.writeFileSync(file, text);
}

function writeFiles(taskDir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(taskDir, rel)), { recursive: true });
    fs.writeFileSync(path.join(taskDir, rel), text);
  }
}

const ENV = (() => {
  const env = { ...process.env, FE_KIT_RUNLOG: 'off', FE_KIT_HOOKS: 'enforce' };
  for (const k of ['CI', 'GITHUB_ACTIONS', 'GITHUB_BASE_REF', 'FE_KIT_BASE_REF', 'EVAL_FE_KIT_HOOKS', 'FE_KIT_BASH_GUARD', 'FE_KIT_HOOKS_DEBUG']) delete env[k];
  return env;
})();

// --- validators (in-process) ------------------------------------------------------

async function captureValidators(root) {
  const v = await import(pathToFileURL(path.join(ROOT, 'packages', 'validators', 'src', 'index.mjs')).href);
  const out = {};
  const cases = [];
  for (const fixture of ['task-ready-to-cook', 'task-blocked-question']) {
    for (const m of Object.keys(MUTATIONS)) cases.push({ fixture, mutation: m, files: null });
  }
  for (const f of Object.keys(FILE_VARIANTS)) {
    for (const m of ['base', 'mode:review', 'mode:pr', 'review-passed-pr-ready']) cases.push({ fixture: 'task-ready-to-cook', mutation: m, files: f });
  }
  for (const [i, c] of cases.entries()) {
    const taskDir = path.join(root, 'docs', 'frontend-tasks', `FE-G${i}`);
    copyFixture(c.fixture, taskDir);
    setStatus(taskDir, MUTATIONS[c.mutation]);
    if (c.files) writeFiles(taskDir, FILE_VARIANTS[c.files]);
    const key = `${c.fixture} ${c.mutation}${c.files ? ` +${c.files}` : ''}`;
    const loose = v.parseFrontMatterLoose(fs.readFileSync(path.join(taskDir, 'tracking', 'workflow-status.md'), 'utf8'));
    const read = (rel) => (fs.existsSync(path.join(taskDir, rel)) ? fs.readFileSync(path.join(taskDir, rel), 'utf8') : '');
    const openBlockingQuestions = v.countOpenBlockingQuestions(read('planning/questions.md'));
    const openIssues = v.effectiveOpenIssues(loose.data, v.countOpenIssuesInTask(read));
    out[key] = {
      workflow: v.validateWorkflow(taskDir),
      pr: v.validatePr(taskDir),
      entry: Object.fromEntries(
        COMMANDS.map((cmd) => [cmd, v.evaluateModeEntry({ requested: cmd, data: loose.data, openBlockingQuestions, openIssues, taskRef: `docs/frontend-tasks/FE-G${i}` })])
      ),
      completion: Object.fromEntries(
        ['plan', 'cook', 'review', 'pr'].map((cmd) => [cmd, v.evaluateModeCompletion({ taskDir, taskRef: `docs/frontend-tasks/FE-G${i}`, command: cmd })])
      ),
    };
  }
  out['rulesForMode'] = Object.fromEntries(COMMANDS.flatMap((c) => [[c, v.rulesForMode(c)], [`${c}+figma`, v.rulesForMode(c, { figmaRequired: true })]]));
  out['normalizeCommand'] = Object.fromEntries(
    ['cook', 'FE cook x', '/fe:input-sync', 'fe:figma-review', 'implementation-mode', 'build', 'figma-extract', 'none', '', 'deploy'].map((s) => [s, v.normalizeCommand(s)])
  );
  out['checkRecordedNextMode'] = Object.fromEntries(
    ['planning-mode', 'implementation-mode', 'review-mode', 'pr-ready-mode'].flatMap((cur) =>
      ['cook', 'review', 'pr', 'none', 'deploy'].map((next) => [`${cur}->${next}`, v.checkRecordedNextMode({ currentMode: cur, nextMode: next })])
    )
  );
  out['constants'] = {
    COMMAND_TO_MODE: v.COMMAND_TO_MODE,
    ALLOWED_NEXT: v.ALLOWED_NEXT,
    SOURCE_EDIT_COMMANDS: v.SOURCE_EDIT_COMMANDS,
    MODE_REQUIRED_ARTIFACTS: v.MODE_REQUIRED_ARTIFACTS,
    AGENT_FOR_COMMAND: v.AGENT_FOR_COMMAND,
    KIT_WRITABLE_PREFIXES: v.KIT_WRITABLE_PREFIXES,
    REQUIRED_TASK_FILES: v.REQUIRED_TASK_FILES,
    CONDITIONAL_TASK_FILES: v.CONDITIONAL_TASK_FILES,
    TASKS_ROOT: v.TASKS_ROOT,
    allRuleFiles: v.allRuleFiles(),
  };
  // So kiểu tập con trong golden.test.mjs: thêm export mới được, bỏ export cũ thì không.
  out['exports'] = Object.keys(v).sort();
  return out;
}

// --- hook ---------------------------------------------------------------------------

function captureHook(root) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-golden-hook-data-'));
  const run = (payload) => {
    const r = spawnSync(process.execPath, [HOOK, payload.hook_event_name], {
      input: JSON.stringify({ session_id: 'golden', cwd: root, ...payload }),
      encoding: 'utf8',
      env: { ...ENV, CLAUDE_PLUGIN_DATA: dataDir },
    });
    return { status: r.status, stdout: r.stdout ? JSON.parse(r.stdout) : null };
  };
  const blocked = 'docs/frontend-tasks/H-blocked';
  const ready = 'docs/frontend-tasks/H-ready';
  copyFixture('task-blocked-question', path.join(root, blocked));
  copyFixture('task-ready-to-cook', path.join(root, ready));
  const stale = (rel) => {
    const f = path.join(root, rel, 'tracking', 'workflow-status.md');
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(f, past, past);
  };
  const edit = (file, agent) => run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: path.join(root, file), new_string: 'x' }, agent_type: agent });
  const out = {};
  out['prompt cook blocked'] = run({ hook_event_name: 'UserPromptSubmit', prompt: `/fe:cook ${blocked}` });
  out['edit src developer blocked'] = edit('src/App.tsx', 'fe:frontend-developer');
  out['edit src reviewer'] = edit('src/App.tsx', 'fe:frontend-reviewer');
  out['edit artifact reviewer'] = edit(`${blocked}/output/review-report.md`, 'fe:frontend-reviewer');
  out['shell write reviewer'] = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo x > src/a.ts' }, agent_type: 'fe:frontend-reviewer' });
  out['override ask'] = run({
    hook_event_name: 'PreToolUse',
    tool_name: 'Edit',
    tool_input: { file_path: path.join(root, blocked, 'tracking', 'workflow-status.md'), old_string: 'human_override: false', new_string: 'human_override: true' },
  });
  out['stop refused route ok'] = (stale(blocked), run({ hook_event_name: 'Stop', stop_hook_active: false }));
  out['prompt plan ready'] = run({ hook_event_name: 'UserPromptSubmit', prompt: `FE plan ${ready}` });
  stale(ready);
  out['stop plan stale'] = run({ hook_event_name: 'Stop', stop_hook_active: false });
  out['stop plan stale released'] = run({ hook_event_name: 'Stop', stop_hook_active: true });
  out['prompt review ready'] = run({ hook_event_name: 'UserPromptSubmit', prompt: `/fe:review ${ready}` });
  out['delegate reviewer'] = run({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'fe:frontend-reviewer' } });
  out['subagent stop reviewer'] = run({ hook_event_name: 'SubagentStop', agent_type: 'fe:frontend-reviewer', stop_hook_active: false });
  const marker = JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions', 'golden.json'), 'utf8'));
  out['marker keys'] = Object.keys(marker).sort();
  out['marker'] = { ...marker, startedAt: '<TS>' };
  fs.rmSync(dataDir, { recursive: true, force: true });
  return out;
}

// --- MCP ------------------------------------------------------------------------------

function mcpCall(messages) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MCP], { env: { ...ENV, CLAUDE_PLUGIN_ROOT: path.join(ROOT, 'plugins', 'fe') } });
    let buf = '';
    const results = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('MCP server không trả lời'));
    }, 20000);
    const send = (msg) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.id === 0) {
          send({ method: 'notifications/initialized' });
          messages.forEach((m, i) => send({ id: i + 1, ...m }));
        } else if (msg.id > 0) {
          results[msg.id - 1] = msg.result ?? msg.error;
          if (results.filter((r) => r !== undefined).length === messages.length) {
            clearTimeout(timer);
            child.kill();
            resolve(results);
          }
        }
      }
    });
    child.on('error', reject);
    send({ id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'golden', version: '0' } } });
  });
}

async function captureMcp(root) {
  const ready = 'docs/frontend-tasks/M-ready';
  const blocked = 'docs/frontend-tasks/M-blocked';
  copyFixture('task-ready-to-cook', path.join(root, ready));
  copyFixture('task-blocked-question', path.join(root, blocked));
  const call = (name, args) => ({ method: 'tools/call', params: { name, arguments: { workspace_root: root, ...args } } });
  const calls = {
    'tools/list': { method: 'tools/list', params: {} },
    'begin plan ready': call('fe_begin_mode', { task_folder: ready, mode: 'plan' }),
    'begin cook blocked': call('fe_begin_mode', { task_folder: blocked, mode: 'cook' }),
    'begin pr ready': call('fe_begin_mode', { task_folder: ready, mode: 'pr' }),
    'begin unknown mode': call('fe_begin_mode', { task_folder: ready, mode: 'deploy' }),
    'begin missing task': call('fe_begin_mode', { task_folder: 'docs/frontend-tasks/none', mode: 'plan' }),
    'validate_task ready': call('fe_validate_task', { task_folder: ready }),
    'validate_workflow blocked': call('fe_validate_workflow', { task_folder: blocked }),
    'task_status ready': call('fe_task_status', { task_folder: ready }),
    'next_step blocked': call('fe_next_step', { task_folder: blocked }),
    'list_tasks': call('fe_list_tasks', {}),
    'new_task': call('fe_new_task', { task_name: 'M-new' }),
  };
  const results = await mcpCall(Object.values(calls));
  return Object.fromEntries(Object.keys(calls).map((k, i) => [k, results[i]]));
}

// --- CLI ------------------------------------------------------------------------------

function captureCli(root) {
  const run = (...args) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8', env: ENV });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const ready = 'docs/frontend-tasks/C-ready';
  const blocked = 'docs/frontend-tasks/C-blocked';
  copyFixture('task-ready-to-cook', path.join(root, ready));
  copyFixture('task-blocked-question', path.join(root, blocked));
  fs.cpSync(path.join(ROOT, 'rules'), path.join(root, '.frontend-delivery', 'rules'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'templates'), path.join(root, '.frontend-delivery', 'templates'), { recursive: true });
  const out = {};
  const help = run('help');
  out['help'] = { ...help, out: help.out.replace(/CLI v\S+/, 'CLI v<VERSION>') };
  for (const t of [ready, blocked]) {
    const n = path.basename(t);
    out[`status ${n}`] = run('status', t);
    out[`next ${n}`] = run('next', t);
    out[`validate-task ${n}`] = run('validate-task', t);
    out[`validate-workflow ${n}`] = run('validate-workflow', t);
    out[`validate-pr ${n}`] = run('validate-pr', t, '--no-scope');
    out[`mode begin cook ${n}`] = run('mode', 'begin', t, 'cook');
    out[`mode begin plan ${n}`] = run('mode', 'begin', t, 'plan');
    out[`mode end plan ${n}`] = run('mode', 'end', t, 'plan');
    out[`mode end cook ${n}`] = run('mode', 'end', t, 'cook');
    for (const check of ['check-srs-reference', 'check-questions-routing', 'check-plan-architecture', 'check-plan-checklist-sync', 'check-input-sync-report', 'check-figma-evidence', 'check-asset-gate']) {
      out[`${check} ${n}`] = run(check, t);
    }
  }
  out['new-task'] = run('new-task', 'C-new');
  out['new-task traversal'] = run('new-task', '../escape');
  out['mode bad usage'] = run('mode', 'start', ready, 'cook');
  out['report'] = run('report');
  out['report json'] = run('report', ready, '--json');
  out['validate-pr orphans no git'] = run('validate-pr', '--orphans');
  return out;
}

export async function captureAll() {
  const roots = ['validators', 'hook', 'mcp', 'cli'].map((n) => fs.mkdtempSync(path.join(os.tmpdir(), `fe-golden-${n}-`)));
  const normalize = makeNormalizer(roots);
  try {
    const result = {
      validators: await captureValidators(roots[0]),
      hook: captureHook(roots[1]),
      mcp: await captureMcp(roots[2]),
      cli: captureCli(roots[3]),
    };
    return normalize(JSON.parse(JSON.stringify(result)));
  } finally {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await captureAll();
  fs.writeFileSync(GOLDEN_FILE, JSON.stringify(result, null, 1) + '\n');
  const size = fs.statSync(GOLDEN_FILE).size;
  console.log(`Đã ghi ${path.relative(ROOT, GOLDEN_FILE)} (${Math.round(size / 1024)} KB): ` + Object.entries(result).map(([k, v]) => `${k} ${Object.keys(v).length}`).join(', '));
}
