import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateModeCompletion } from '../src/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let task;

function useFixture(name) {
  task = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-completion-'));
  fs.cpSync(path.join(__dirname, 'fixtures', name), task, { recursive: true });
}

function setStatus(values) {
  const file = path.join(task, 'tracking', 'workflow-status.md');
  let text = fs.readFileSync(file, 'utf8');
  for (const [k, v] of Object.entries(values)) text = text.replace(new RegExp(`^${k}:.*$`, 'm'), () => `${k}: ${v}`);
  fs.writeFileSync(file, text);
}

const codes = (r) => r.issues.map((i) => i.code);

afterEach(() => fs.rmSync(task, { recursive: true, force: true }));

describe('evaluateModeCompletion', () => {
  describe('mode được chạy', () => {
    beforeEach(() => useFixture('task-ready-to-cook'));

    it('đạt khi current_mode đúng, đủ artifact và qua validator', () => {
      setStatus({ current_mode: 'planning-mode' });
      const r = evaluateModeCompletion({ taskDir: task, taskRef: 'FE-1', command: 'plan', startedAt: Date.now() - 60_000 });
      expect(r).toMatchObject({ ok: true, refused: false, issues: [] });
    });

    it('thiếu artifact và sai current_mode thì không đạt', () => {
      const r = reviewWithoutReport();
      expect(codes(r)).toEqual(expect.arrayContaining(['END_CURRENT_MODE_MISMATCH', 'END_ARTIFACT_MISSING']));
      expect(r.errors).toEqual(r.issues.map((i) => i.message));
    });

    it('workflow-status.md không được sửa sau startedAt thì không đạt; không truyền startedAt thì không kiểm', () => {
      setStatus({ current_mode: 'planning-mode' });
      const future = Date.now() + 60_000;
      expect(codes(evaluateModeCompletion({ taskDir: task, taskRef: 'FE-1', command: 'plan', startedAt: future }))).toEqual(['END_STATUS_NOT_UPDATED']);
      expect(evaluateModeCompletion({ taskDir: task, taskRef: 'FE-1', command: 'plan' }).ok).toBe(true);
    });

    it('lỗi riêng của caller xếp trước lỗi validator', () => {
      setStatus({ current_mode: 'planning-mode', next_mode: 'test', critical_issues_open: 1 });
      const r = evaluateModeCompletion({
        taskDir: task,
        taskRef: 'FE-1',
        command: 'plan',
        extraIssues: [{ code: 'END_PREDIRTY_OUT_OF_PLAN', message: 'x' }],
      });
      expect(codes(r)[0]).toBe('END_PREDIRTY_OUT_OF_PLAN');
      expect(codes(r)).toContain('NEXT_MODE_WITH_CRITICAL_HIGH');
    });

    function reviewWithoutReport() {
      return evaluateModeCompletion({ taskDir: task, taskRef: 'FE-1', command: 'review' });
    }
  });

  describe('mode bị gate từ chối lúc vào', () => {
    beforeEach(() => useFixture('task-blocked-question'));

    it('status đã route đúng thì đạt mà không đòi artifact', () => {
      const r = evaluateModeCompletion({ taskDir: task, taskRef: 'FE-1', command: 'cook', startedAt: Date.now() + 60_000 });
      expect(r).toMatchObject({ ok: true, refused: true });
    });

    it('status route sai thì không đạt và nêu prompt đúng', () => {
      setStatus({ next_mode: 'cook' });
      const r = evaluateModeCompletion({ taskDir: task, taskRef: 'FE-1', command: 'cook' });
      expect(r.refused).toBe(true);
      expect(codes(r)[0]).toBe('END_REFUSED_ROUTE_INVALID');
      expect(r.errors[0]).toMatch(/FE input-sync FE-1/);
    });
  });

  it('thiếu hoặc hỏng workflow-status.md', () => {
    useFixture('task-ready-to-cook');
    const file = path.join(task, 'tracking', 'workflow-status.md');
    fs.writeFileSync(file, '---\nfoo: [\n---\n');
    expect(codes(evaluateModeCompletion({ taskDir: task, taskRef: 'FE-1', command: 'plan' }))).toEqual(['END_STATUS_UNPARSEABLE']);
    fs.rmSync(file);
    expect(codes(evaluateModeCompletion({ taskDir: task, taskRef: 'FE-1', command: 'plan' }))).toEqual(['END_STATUS_MISSING']);
  });
});
