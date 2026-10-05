/**
 * Test MCP server bằng bản bundle thật (plugins/fe/mcp/fe-kit-mcp.mjs), nói
 * JSON-RPC qua stdio như Claude Code. Chạy `npm run build` trước nếu vừa sửa
 * core/mcp hoặc packages/validators.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'plugins', 'fe', 'mcp', 'fe-kit-mcp.mjs');
const FIXTURE = path.join(ROOT, 'packages', 'validators', 'test', 'fixtures', 'task-ready-to-cook');

/** Gọi một tool rồi đóng server; trả về `result` của lời gọi tool. */
function callTool(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], { env: { ...process.env, CLAUDE_PLUGIN_ROOT: path.join(ROOT, 'plugins', 'fe') } });
    let buf = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('MCP server không trả lời'));
    }, 15000);
    const send = (msg) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.id === 1) {
          send({ method: 'notifications/initialized' });
          send({ id: 2, method: 'tools/call', params: { name, arguments: args } });
        } else if (msg.id === 2) {
          clearTimeout(timer);
          child.kill();
          resolve(msg.result);
        }
      }
    });
    child.on('error', reject);
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fe-kit-test', version: '0' } } });
  });
}

let repo;

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-kit-mcp-'));
  const taskDir = path.join(repo, 'docs', 'frontend-tasks', 'FE-1');
  fs.cpSync(FIXTURE, taskDir, { recursive: true });
  fs.appendFileSync(
    path.join(taskDir, 'planning', 'implementation-plan.md'),
    '\n## 7. File sẽ tạo / cập nhật\n\n| File | Hành động | Lý do | Checklist ref |\n|---|---|---|---|\n| `src/features/order/` | Tạo | Màn hình huỷ đơn | IMP-01 |\n'
  );
  const status = path.join(taskDir, 'tracking', 'workflow-status.md');
  fs.writeFileSync(status, fs.readFileSync(status, 'utf8').replace(/^current_mode:.*$/m, 'current_mode: review-mode'));
  const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-qm', 'base');
});

afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('fe_validate_workflow', () => {
  it('task ở review-mode có file sửa ngoài plan thì FAILED và nêu tên file', async () => {
    fs.mkdirSync(path.join(repo, 'src', 'store'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'store', 'global.ts'), 'export {};\n');

    const result = await callTool('fe_validate_workflow', { workspace_root: repo, task_folder: 'FE-1' });
    const text = result.content[0].text;
    expect(result.isError).toBe(true);
    expect(text).toMatch(/validate-workflow: FAILED/);
    expect(text).toMatch(/Scope: tính từ git/);
    expect(text).toMatch(/src\/store\/global\.ts/);
  });

  it('không có file ngoài plan thì không còn lỗi scope', async () => {
    fs.mkdirSync(path.join(repo, 'src', 'features', 'order'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'features', 'order', 'CancelButton.tsx'), 'export {};\n');

    const text = (await callTool('fe_validate_workflow', { workspace_root: repo, task_folder: 'FE-1' })).content[0].text;
    expect(text).toMatch(/Scope: tính từ git/);
    expect(text).not.toMatch(/Scope diff:/);
  });
});
