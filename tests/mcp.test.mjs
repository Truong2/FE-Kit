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
function callTool(name, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, CLAUDE_PLUGIN_ROOT: path.join(ROOT, 'plugins', 'fe') };
    delete env.CLAUDE_PROJECT_DIR;
    const child = spawn(process.execPath, [SERVER], { env, cwd });
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
          // Đợi server thoát hẳn: trên Windows tiến trình còn sống thì vẫn khoá thư mục cwd của nó.
          child.once('exit', () => resolve(msg.result));
          child.kill();
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

// Windows: server vừa bị kill có thể chưa nhả thư mục (cwd của nó) → thử xoá lại vài lần.
afterEach(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));

describe('tham số của tool', () => {
  const TASK = 'docs/frontend-tasks/FE-1';
  const text = (r) => r.content.map((c) => c.text).join('\n');

  it('thiếu workspace_root: dùng thư mục dự án mà server đang chạy', async () => {
    const r = await callTool('fe_task_status', { task_folder: TASK }, { cwd: repo });
    expect(r.isError).toBeFalsy();
    expect(text(r)).not.toMatch(/paths\[0\]/);
  });

  it('thiếu tham số bắt buộc khác: báo rõ tên tham số thay vì lỗi kiểu dữ liệu', async () => {
    const r = await callTool('fe_begin_mode', { workspace_root: repo, mode: 'cook' });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/^Thiếu tham số bắt buộc của fe_begin_mode: task_folder/);
  });
});

describe('fe_begin_mode: artifact và current_mode', () => {
  const TASK = 'docs/frontend-tasks/FE-1';
  const text = (r) => r.content.map((c) => c.text).join('\n');

  it('artifact chưa có: đưa nguyên văn template của plugin (ngoài workspace); nêu current_mode phải đặt', async () => {
    const r = text(await callTool('fe_begin_mode', { workspace_root: repo, task_folder: TASK, mode: 'input-sync' }));
    expect(r).toMatch(/- tracking\/input-sync-report\.md \(chưa có — tạo từ template in bên dưới, giữ nguyên tiêu đề và tên cột\)/);
    expect(r).toMatch(/- tracking\/workflow-status\.md \(đã có\)/);
    expect(r).toMatch(/=== TEMPLATE tracking\/input-sync-report\.md ===\n# Báo cáo input-sync/);
    expect(r).toMatch(/Khi kết thúc: đặt current_mode: input-sync-mode trong workflow-status\.md\./);
  });

  it('template của repo (.frontend-delivery/templates) thì đưa đường dẫn, không chép nguyên văn', async () => {
    const tpl = path.join(repo, '.frontend-delivery', 'templates', 'tracking', 'input-sync-report.md');
    fs.mkdirSync(path.dirname(tpl), { recursive: true });
    fs.writeFileSync(tpl, '# Báo cáo input-sync của team\n');
    const r = text(await callTool('fe_begin_mode', { workspace_root: repo, task_folder: TASK, mode: 'input-sync' }));
    expect(r).toMatch(/tạo từ template \.frontend-delivery\/templates\/tracking\/input-sync-report\.md, giữ nguyên tiêu đề và tên cột/);
    expect(r).not.toMatch(/=== TEMPLATE/);
  });
});

describe('fe_update_status', () => {
  const statusPath = () => path.join(repo, 'docs', 'frontend-tasks', 'FE-1', 'tracking', 'workflow-status.md');

  it('(pass) đặt field và prompt bước tiếp theo, file vẫn qua schema', async () => {
    const res = await callTool('fe_update_status', {
      workspace_root: repo,
      task_folder: 'FE-1',
      fields: { review_status: 'passed', critical_issues_open: 0 },
      next_prompt: 'FE test docs/frontend-tasks/FE-1',
    });
    expect(res.isError).toBe(false);
    expect(res.content[0].text).toMatch(/Đã cập nhật workflow-status\.md: review_status, critical_issues_open, next_prompt, updated_at/);
    const text = fs.readFileSync(statusPath(), 'utf8');
    expect(text).toMatch(/^review_status: passed/m);
    expect(text).toMatch(/^next_prompt: 'FE test docs\/frontend-tasks\/FE-1'/m);
    const next = await callTool('fe_next_step', { workspace_root: repo, task_folder: 'FE-1' });
    expect(next.content[0].text).toMatch(/^FE test docs\/frontend-tasks\/FE-1/);
  });

  it('(fail) giá trị sai enum: báo giá trị hợp lệ, file giữ nguyên', async () => {
    const before = fs.readFileSync(statusPath(), 'utf8');
    const res = await callTool('fe_update_status', { workspace_root: repo, task_folder: 'FE-1', fields: { review_status: 'okay' } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/review_status = "okay" không hợp lệ\. Giá trị hợp lệ: .*passed/);
    expect(fs.readFileSync(statusPath(), 'utf8')).toBe(before);
  });

  it('(fail) không bật được human_override qua tool', async () => {
    const res = await callTool('fe_update_status', { workspace_root: repo, task_folder: 'FE-1', fields: { human_override: true } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/human_override/);
  });
});

describe('fe_new_task theo mức rủi ro', () => {
  it('risk_level: low → plan/checklist rút gọn, vẫn có bảng file cho scope diff', async () => {
    const res = await callTool('fe_new_task', { workspace_root: repo, task_name: 'FE-2-label', risk_level: 'low' });
    expect(res.isError).toBe(false);
    expect(res.content[0].text).toMatch(/TẠO planning\/implementation-plan\.md \(bản rút gọn\)/);
    const plan = fs.readFileSync(path.join(repo, 'docs', 'frontend-tasks', 'FE-2-label', 'planning', 'implementation-plan.md'), 'utf8');
    expect(plan).toMatch(/^## 7\. File sẽ tạo \/ cập nhật/m);
    expect(plan).not.toMatch(/Khung thiết kế trước triển khai/);
  });

  it('(pass) một lần gọi: tạo task + ghi yêu cầu gốc + phân loại + next_prompt; task_status trả next_prompt và auto_advance', async () => {
    const res = await callTool('fe_new_task', {
      workspace_root: repo,
      task_name: 'FE-4-label',
      risk_level: 'low',
      request: 'Đổi nhãn nút "Huỷ" thành "Huỷ đơn"',
      fields: { task_type: 'chore', risk_level: 'low', figma_required: false, next_mode: 'quick' },
      next_prompt: 'FE quick docs/frontend-tasks/FE-4-label',
    });
    expect(res.isError).toBe(false);
    expect(res.content[0].text).toMatch(/GHI "Yêu cầu gốc" vào task\.md/);
    expect(res.content[0].text).toMatch(/Tiếp theo: FE quick docs\/frontend-tasks\/FE-4-label/);
    const dir = path.join(repo, 'docs', 'frontend-tasks', 'FE-4-label');
    expect(fs.readFileSync(path.join(dir, 'task.md'), 'utf8')).toMatch(/### Yêu cầu gốc\n\n> [^\n]*\n\nĐổi nhãn nút "Huỷ" thành "Huỷ đơn"\n/);
    const status = (await callTool('fe_task_status', { workspace_root: repo, task_folder: 'FE-4-label' })).content[0].text;
    expect(status).toMatch(/^task_type: chore$/m);
    expect(status).toMatch(/^next_prompt: FE quick docs\/frontend-tasks\/FE-4-label$/m);
    expect(status).toMatch(/^auto_advance: true$/m);
  });

  it('(fail) field sai schema: task vẫn tạo nhưng trả lỗi, workflow-status giữ nguyên template', async () => {
    const res = await callTool('fe_new_task', { workspace_root: repo, task_name: 'FE-5-bad', fields: { risk_level: 'extreme' } });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/LỖI:[\s\S]*risk_level/);
    const status = fs.readFileSync(path.join(repo, 'docs', 'frontend-tasks', 'FE-5-bad', 'tracking', 'workflow-status.md'), 'utf8');
    expect(status).not.toMatch(/extreme/);
  });

  it('không truyền risk_level → template đầy đủ', async () => {
    await callTool('fe_new_task', { workspace_root: repo, task_name: 'FE-3-feature' });
    const plan = fs.readFileSync(path.join(repo, 'docs', 'frontend-tasks', 'FE-3-feature', 'planning', 'implementation-plan.md'), 'utf8');
    expect(plan).toMatch(/Khung thiết kế trước triển khai/);
  });
});

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

describe('retro', () => {
  it('fe_retro_data ghi retro-data.json theo ngày và trả bản tóm tắt', async () => {
    const res = await callTool('fe_retro_data', { workspace_root: repo, date: '2026-10-08' });
    expect(res.isError).toBe(false);
    expect(res.content[0].text).toMatch(/^# Dữ liệu retro FE-Kit/);
    expect(res.content[0].text).toMatch(/Đã ghi docs\/frontend-retro\/2026-10-08\/retro-data\.json/);
    const data = JSON.parse(fs.readFileSync(path.join(repo, 'docs', 'frontend-retro', '2026-10-08', 'retro-data.json'), 'utf8'));
    expect(data).toMatchObject({ schema: 1, tasks_total: 1 });
    expect((await callTool('fe_retro_data', { workspace_root: repo, date: '08/10' })).isError).toBe(true);
  });

  it('fe_validate_retro báo thiếu file rồi PASSED khi đủ', async () => {
    const folder = 'docs/frontend-retro/2026-10-08';
    await callTool('fe_retro_data', { workspace_root: repo, date: '2026-10-08' });
    const failed = await callTool('fe_validate_retro', { workspace_root: repo, retro_folder: folder });
    expect(failed.isError).toBe(true);
    expect(failed.content[0].text).toMatch(/- Thiếu retro-report\.md/);
    fs.writeFileSync(path.join(repo, folder, 'retro-report.md'), '# Báo cáo retro\n');
    fs.writeFileSync(
      path.join(repo, folder, 'proposals.md'),
      '## Đề xuất\n\n| ID | Bằng chứng | Trạng thái | Người duyệt |\n|---|---|---|---|\n| R-01 | x | Proposed |  |\n'
    );
    expect((await callTool('fe_validate_retro', { workspace_root: repo, retro_folder: folder })).content[0].text).toBe('validate-retro: PASSED');
  });

  it('fe_begin_mode nạp rule của team cho mode tương ứng', async () => {
    fs.mkdirSync(path.join(repo, 'docs', 'frontend-context'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'frontend-context', 'team-rules.md'), '## review\n\n- Kiểm a11y bằng axe.\n');
    const res = await callTool('fe_begin_mode', { workspace_root: repo, task_folder: 'docs/frontend-tasks/FE-1', mode: 'review' });
    expect(res.content[0].text).toMatch(/=== RULE CỦA TEAM \(nguồn: docs\/frontend-context\/team-rules\.md\) — đã duyệt qua retro ===\n## review\n\n- Kiểm a11y bằng axe\./);
  });
});
