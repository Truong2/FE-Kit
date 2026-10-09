import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkflowAtGate } from '../src/index.mjs';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'task-ready-to-cook');
const PLAN_TABLE =
  '\n## 7. File sẽ tạo / cập nhật\n\n| File | Hành động | Lý do | Checklist ref |\n|---|---|---|---|\n| `src/features/order/` | Tạo | Màn hình huỷ đơn | IMP-01 |\n';

let repo;
let taskDir;
const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });

function setMode(mode) {
  const file = path.join(taskDir, 'tracking', 'workflow-status.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^current_mode:.*$/m, `current_mode: ${mode}`));
}

function write(rel, text = 'export {};\n') {
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), text);
}

const scopeErrors = (r) => r.errors.filter((e) => /Scope diff/.test(e));

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-kit-scope-'));
  taskDir = path.join(repo, 'docs', 'frontend-tasks', 'FE-1');
  fs.cpSync(FIXTURE, taskDir, { recursive: true });
  fs.appendFileSync(path.join(taskDir, 'planning', 'implementation-plan.md'), PLAN_TABLE);
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-qm', 'base');
});

afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('validateWorkflowAtGate', () => {
  it('ở review-mode: file sửa ngoài plan là lỗi, scope lấy từ git', () => {
    setMode('review-mode');
    write('src/features/order/CancelButton.tsx');
    write('src/store/global.ts');
    const r = validateWorkflowAtGate(taskDir, { repoRoot: repo, base: '' });
    expect(r.scopeSource).toBe('git');
    expect(scopeErrors(r).join('\n')).toMatch(/src\/store\/global\.ts/);
    expect(scopeErrors(r).join('\n')).not.toMatch(/CancelButton/);
  });

  it('ở review-mode: chỉ sửa file trong plan thì không có lỗi scope', () => {
    setMode('review-mode');
    write('src/features/order/CancelButton.tsx');
    const r = validateWorkflowAtGate(taskDir, { repoRoot: repo, base: '' });
    expect(r.scopeSource).toBe('git');
    expect(scopeErrors(r)).toEqual([]);
  });

  describe('đang làm thẳng trên nhánh base', () => {
    const branch = () => git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
    const onBaseWarnings = (r) => r.warnings.filter((w) => /chưa có commit nào so với base/.test(w));

    it('HEAD trùng base: cảnh báo scope diff chỉ thấy thay đổi chưa commit', () => {
      setMode('review-mode');
      const base = branch();
      const r = validateWorkflowAtGate(taskDir, { repoRoot: repo, base });
      expect(onBaseWarnings(r)).toEqual([expect.stringContaining(`(${base})`)]);
    });

    it('nhánh tính năng đã có commit: không cảnh báo', () => {
      setMode('review-mode');
      const base = branch();
      git('checkout', '-q', '-b', 'feat/x');
      write('src/features/order/CancelButton.tsx');
      git('add', '-A');
      git('-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-qm', 'feat');
      const r = validateWorkflowAtGate(taskDir, { repoRoot: repo, base });
      expect(onBaseWarnings(r)).toEqual([]);
    });
  });

  describe('review phát hiện file ngoài plan', () => {
    function setStatus(values) {
      const file = path.join(taskDir, 'tracking', 'workflow-status.md');
      let text = fs.readFileSync(file, 'utf8');
      for (const [k, v] of Object.entries(values)) text = text.replace(new RegExp(`^${k}:.*$`, 'm'), () => `${k}: ${v}`);
      fs.writeFileSync(file, text);
    }
    const scopeCodes = (r) => r.issues.map((i) => i.code).filter((c) => c.startsWith('SCOPE_'));

    it('đã ghi thành bug và route sang bugfix: không chặn kết thúc review, chỉ cảnh báo', () => {
      setStatus({ current_mode: 'review-mode', scope_diff_status: 'failed', review_status: 'needs_bugfix', bugfix_required: 'true', next_mode: 'bugfix' });
      write('src/store/global.ts');
      const r = validateWorkflowAtGate(taskDir, { repoRoot: repo, base: '' });
      expect(scopeCodes(r)).toEqual([]);
      expect(r.warnings.join('\n')).toMatch(/src\/store\/global\.ts.*route sang bugfix/);
    });

    it('ghi scope failed nhưng vẫn route sang pr: bị chặn như cũ', () => {
      setStatus({ current_mode: 'review-mode', scope_diff_status: 'failed', review_status: 'needs_bugfix', bugfix_required: 'true', next_mode: 'pr' });
      write('src/store/global.ts');
      const r = validateWorkflowAtGate(taskDir, { repoRoot: repo, base: '' });
      expect(scopeCodes(r)).toEqual(expect.arrayContaining(['SCOPE_DIFF_DECLARED_FAILED', 'SCOPE_OUT_OF_PLAN']));
    });
  });

  it('ở planning-mode không tính scope, tránh chặn nhầm thay đổi không liên quan', () => {
    setMode('planning-mode');
    write('src/store/global.ts');
    const r = validateWorkflowAtGate(taskDir, { repoRoot: repo, base: '' });
    expect(r.scopeSource).toBe('not_checked');
    expect(scopeErrors(r)).toEqual([]);
  });

  it('plan chưa có bảng file (task v1.x): cảnh báo và dùng field tự khai', () => {
    const plan = path.join(taskDir, 'planning', 'implementation-plan.md');
    fs.writeFileSync(plan, fs.readFileSync(plan, 'utf8').replace(PLAN_TABLE, ''));
    setMode('testing-mode');
    write('src/store/global.ts');
    const r = validateWorkflowAtGate(taskDir, { repoRoot: repo, base: '' });
    expect(r.scopeSource).toBe('self_reported');
    expect(scopeErrors(r)).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/chưa khai file nào/);
  });

  it('không phải git repo thì rơi về field tự khai kèm cảnh báo', () => {
    fs.rmSync(path.join(repo, '.git'), { recursive: true, force: true });
    setMode('pr-ready-mode');
    const r = validateWorkflowAtGate(taskDir, { repoRoot: repo, base: '' });
    expect(r.scopeSource).toBe('self_reported');
    expect(r.warnings.join('\n')).toMatch(/Không tính được scope diff/);
  });
});
