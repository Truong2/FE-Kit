import { describe, it, expect } from 'vitest';
import { normalizeCommand, evaluateModeEntry, checkRecordedNextMode } from '../src/transitions.mjs';

describe('normalizeCommand', () => {
  it('nhận mọi cách viết tên lệnh', () => {
    expect(normalizeCommand('cook')).toBe('cook');
    expect(normalizeCommand('FE cook docs/frontend-tasks/FE-1')).toBe('cook');
    expect(normalizeCommand('/fe:input-sync')).toBe('input-sync');
    expect(normalizeCommand('fe:figma-review')).toBe('figma-review');
    expect(normalizeCommand('implementation-mode')).toBe('cook');
    expect(normalizeCommand('build')).toBe('cook');
  });

  it('trả rỗng cho giá trị lạ', () => {
    expect(normalizeCommand('none')).toBe('');
    expect(normalizeCommand('')).toBe('');
    expect(normalizeCommand('deploy')).toBe('');
  });
});

describe('evaluateModeEntry', () => {
  const ready = { build_ready: true, next_mode: 'cook', questions_status: 'none', questions_resolution_gate_status: 'passed' };

  it('cho cook khi plan sẵn sàng', () => {
    const r = evaluateModeEntry({ requested: 'cook', data: ready, taskRef: 'docs/frontend-tasks/FE-1' });
    expect(r.allowed).toBe(true);
    expect(r.mode).toBe('implementation-mode');
  });

  it('chặn cook khi questions.md còn câu hỏi blocking dù frontmatter khai 0', () => {
    const r = evaluateModeEntry({ requested: 'cook', data: ready, openBlockingQuestions: 2, taskRef: 'docs/frontend-tasks/FE-1' });
    expect(r.allowed).toBe(false);
    expect(r.redirect).toBe('FE input-sync docs/frontend-tasks/FE-1 <answer-or-cr>');
  });

  it('plan và input-sync luôn chạy được khi đang bị chặn', () => {
    const blocked = { build_ready: false, input_sync_required: true, blocking_questions_open: 1 };
    expect(evaluateModeEntry({ requested: 'input-sync', data: blocked }).allowed).toBe(true);
    expect(evaluateModeEntry({ requested: 'plan', data: blocked }).allowed).toBe(true);
    expect(evaluateModeEntry({ requested: 'review', data: blocked }).allowed).toBe(false);
  });

  it('chặn cook khi build_ready=false và gợi ý FE plan', () => {
    const r = evaluateModeEntry({ requested: 'cook', data: { build_ready: false }, taskRef: 'T' });
    expect(r.allowed).toBe(false);
    expect(r.redirect).toBe('FE plan T');
  });

  it('chặn cook khi task cần Figma nhưng gate chưa pass', () => {
    const r = evaluateModeEntry({ requested: 'cook', data: { ...ready, figma_required: true, figma_gate_status: 'not_started' }, taskRef: 'T' });
    expect(r.allowed).toBe(false);
    expect(r.redirect).toBe('FE figma T');
  });

  it('chặn pr khi còn bug High hoặc review chưa passed', () => {
    expect(evaluateModeEntry({ requested: 'pr', data: { review_status: 'passed', high_issues_open: 1 } }).allowed).toBe(false);
    expect(evaluateModeEntry({ requested: 'pr', data: { review_status: 'not_started' } }).allowed).toBe(false);
    expect(evaluateModeEntry({ requested: 'pr', data: { review_status: 'passed' } }).allowed).toBe(true);
  });

  it('human_override hạ lỗi chặn xuống cảnh báo', () => {
    const r = evaluateModeEntry({ requested: 'cook', data: { build_ready: false, human_override: true } });
    expect(r.allowed).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/human_override/);
  });

  it('chỉ cảnh báo khi mode chạy khác next_mode đã ghi', () => {
    const r = evaluateModeEntry({ requested: 'test', data: { next_mode: 'review' } });
    expect(r.allowed).toBe(true);
    expect(r.warnings).toHaveLength(1);
  });

  it('từ chối mode không tồn tại', () => {
    expect(evaluateModeEntry({ requested: 'deploy', data: {} }).allowed).toBe(false);
  });
});

describe('checkRecordedNextMode', () => {
  it('không cảnh báo cho chuyển bước hợp lý và giá trị kết thúc', () => {
    expect(checkRecordedNextMode({ currentMode: 'planning-mode', nextMode: 'cook' }).warnings).toEqual([]);
    expect(checkRecordedNextMode({ currentMode: 'pr-ready-mode', nextMode: 'none' }).warnings).toEqual([]);
  });

  it('cảnh báo (không lỗi) cho next_mode lạ hoặc bất thường', () => {
    expect(checkRecordedNextMode({ currentMode: 'planning-mode', nextMode: 'ship-it' }).warnings).toHaveLength(1);
    expect(checkRecordedNextMode({ currentMode: 'planning-mode', nextMode: 'pr' }).warnings).toHaveLength(1);
  });
});
