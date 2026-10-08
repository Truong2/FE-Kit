import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateWorkflowGates, evaluatePrGates } from '../src/gates.mjs';
import { evaluateModeEntry } from '../src/transitions.mjs';
import { validatePr, validateWorkflow } from '../src/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(__dirname, 'fixtures', name);
const CODE = /^[A-Z][A-Z0-9_]+$/;

const none = { exists: () => false, read: () => '' };

describe('reason code của gate', () => {
  it('errors đúng bằng message của issues, mỗi issue có code ổn định', () => {
    const r = evaluateWorkflowGates({
      data: { build_ready: true, next_mode: 'cook', blocking_questions_open: 1, current_mode: 'review-mode' },
      body: '',
      ...none,
    });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(r.issues.map((i) => i.message));
    for (const i of r.issues) expect(i.code).toMatch(CODE);
    expect(r.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['TASK_FILE_MISSING', 'STATUS_NEXT_PROMPT_SECTION_MISSING', 'QUESTIONS_BUILD_READY_CONFLICT', 'BUILD_READY_OPEN_QUESTIONS', 'ARTIFACT_REVIEW_REPORT_MISSING'])
    );
  });

  it('gate PR có code riêng; task hợp lệ thì không có issue', () => {
    const pr = evaluatePrGates({ data: { review_status: 'not_started', pr_status: 'not_started' }, ...none });
    expect(pr.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['PR_FILE_MISSING', 'PR_REVIEW_NOT_PASSED', 'PR_STATUS_NOT_READY']));

    const ok = validateWorkflow(fixture('task-ready-to-cook'));
    expect(ok.ok).toBe(true);
    expect(ok.issues).toEqual([]);
  });

  it('validatePr gộp issues của cả hai gate; thiếu workflow-status.md cũng có code', () => {
    const r = validatePr(fixture('task-ready-to-cook'));
    expect(r.errors).toEqual(r.issues.map((i) => i.message));
    expect(r.issues.some((i) => i.code.startsWith('PR_'))).toBe(true);

    const missing = validateWorkflow(path.join(__dirname, 'không-có-task'));
    expect(missing.issues).toEqual([{ code: 'STATUS_MISSING', message: 'Thiếu tracking/workflow-status.md' }]);
  });
});

describe('reasonCodes của gate lúc vào mode', () => {
  it('song song với reasons', () => {
    const r = evaluateModeEntry({ requested: 'cook', data: { build_ready: false, figma_required: true }, openBlockingQuestions: 1 });
    expect(r.allowed).toBe(false);
    expect(r.reasonCodes).toEqual(['ENTRY_QUESTIONS_BLOCKING', 'ENTRY_NOT_BUILD_READY', 'ENTRY_FIGMA_GATE_OPEN']);
    expect(r.reasonCodes).toHaveLength(r.reasons.length);

    expect(evaluateModeEntry({ requested: 'pr', data: { bugfix_required: true } }).reasonCodes).toEqual(['ENTRY_OPEN_BUGS', 'ENTRY_REVIEW_NOT_PASSED']);
    expect(evaluateModeEntry({ requested: 'deploy' }).reasonCodes).toEqual(['ENTRY_UNKNOWN_MODE']);
    expect(evaluateModeEntry({ requested: 'review', data: { input_sync_required: true } }).reasonCodes).toEqual(['ENTRY_INPUT_SYNC_REQUIRED']);
  });

  it('được chạy hoặc human_override thì không có code chặn', () => {
    expect(evaluateModeEntry({ requested: 'plan', data: {} }).reasonCodes).toEqual([]);
    const overridden = evaluateModeEntry({ requested: 'cook', data: { build_ready: false, human_override: true } });
    expect(overridden.allowed).toBe(true);
    expect(overridden.reasonCodes).toEqual([]);
  });
});
