import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateSrsReference,
  validateQuestionsRouting,
  validatePlanArchitecture,
  validatePlanChecklistSync,
  validateInputSyncReport,
  validateFigmaEvidence,
  validateAssetGate,
} from '../src/fe-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(__dirname, '..', '..', '..', 'core', 'templates');
let task;

const write = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(task, rel)), { recursive: true });
  fs.writeFileSync(path.join(task, rel), text);
};
const fromTemplate = (rel) => write(rel, fs.readFileSync(path.join(TEMPLATES, rel), 'utf8'));
const status = (fields) =>
  write('tracking/workflow-status.md', `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n# Trạng thái workflow\n`);

beforeEach(() => {
  task = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-checks-'));
});
afterEach(() => fs.rmSync(task, { recursive: true, force: true }));

describe('validateSrsReference', () => {
  it('đạt khi task/plan/checklist có đủ bản đồ SRS/API', () => {
    write('task.md', '## Bản đồ tham chiếu SRS\n## Bản đồ sử dụng API contract\n## Bản đồ lỗi API và cách hiển thị FE\n');
    write('planning/implementation-plan.md', '## Section SRS liên quan\n');
    write('planning/build-checklist.md', '## SRS / API Contract\n');
    expect(validateSrsReference(task)).toEqual({ ok: true, errors: [] });
  });

  it('không đạt khi thiếu task.md hoặc thiếu bản đồ', () => {
    expect(validateSrsReference(task).errors).toEqual(['Thiếu task.md']);
    write('task.md', '# Task\n');
    expect(validateSrsReference(task).errors).toContain('task.md thiếu Bản đồ tham chiếu SRS');
  });
});

describe('validateQuestionsRouting', () => {
  it('template questions.md đạt', () => {
    fromTemplate('planning/questions.md');
    expect(validateQuestionsRouting(task).ok).toBe(true);
  });

  it('không đạt khi thiếu file, thiếu section hoặc owner không hợp lệ', () => {
    expect(validateQuestionsRouting(task).errors).toEqual(['Thiếu planning/questions.md']);
    write('planning/questions.md', '# Câu hỏi\n\n| Q1 | Khách hàng | x |\n');
    const r = validateQuestionsRouting(task);
    expect(r.errors).toContain('questions.md thiếu section: Câu hỏi blocking');
    expect(r.errors.some((e) => e.startsWith('questions.md có owner không hợp lệ'))).toBe(true);
  });
});

describe('validatePlanArchitecture', () => {
  const PHRASES = [
    'Ma trận trace SRS → FE logic → UI → Test', 'Quyết định kiến trúc logic frontend', 'File sẽ tạo / cập nhật', 'Quyết định hook / store',
    'Quyết định vị trí state', 'Quyết định global state', 'Quyết định lỗi API và hiển thị lỗi FE', 'UI Implementation Contract từ Figma',
    'Luồng người dùng', 'Luồng API', 'Luồng lỗi', 'Kế hoạch test', 'Bản đồ lỗi API từ SRS/source', 'Quyết định kênh hiển thị lỗi', 'Quyết định component lỗi / toast',
  ];

  it('đạt khi plan có đủ các mục kiến trúc', () => {
    write('planning/implementation-plan.md', PHRASES.map((p) => `## ${p}`).join('\n'));
    expect(validatePlanArchitecture(task)).toEqual({ ok: true, errors: [] });
  });

  it('không đạt khi thiếu plan hoặc thiếu mục', () => {
    expect(validatePlanArchitecture(task).errors).toEqual(['Thiếu planning/implementation-plan.md']);
    write('planning/implementation-plan.md', PHRASES.slice(1).map((p) => `## ${p}`).join('\n'));
    expect(validatePlanArchitecture(task).errors).toEqual(['implementation-plan.md thiếu: Ma trận trace SRS → FE logic → UI → Test']);
  });
});

describe('validatePlanChecklistSync', () => {
  const plan = '## 7. File sẽ tạo / cập nhật\n\n| File | Hành động |\n|---|---|\n| `src/features/order/Cancel.tsx` | Tạo |\n';

  it('đạt khi checklist verify mọi file trong plan', () => {
    write('planning/implementation-plan.md', plan);
    write('planning/build-checklist.md', '| IMP-01 | `src/features/order/Cancel.tsx` | Chưa làm |\n');
    expect(validatePlanChecklistSync(task).ok).toBe(true);
  });

  it('không đạt khi checklist bỏ sót file của plan', () => {
    write('planning/implementation-plan.md', plan);
    write('planning/build-checklist.md', '| IMP-01 | khác | Chưa làm |\n');
    expect(validatePlanChecklistSync(task).errors).toEqual(['build-checklist.md chưa verify planned item: src/features/order/Cancel.tsx']);
  });
});

describe('validateInputSyncReport', () => {
  it('bỏ qua khi chưa chạy input-sync', () => {
    status({ current_mode: 'planning-mode' });
    expect(validateInputSyncReport(task)).toMatchObject({ ok: true, skipped: true });
  });

  const TEMPLATE = 'tracking/input-sync-report.md';
  const filledTemplate = () =>
    fs
      .readFileSync(path.join(TEMPLATES, TEMPLATE), 'utf8')
      .replace('| Loại input | CR / câu trả lời / SRS update / Figma update |', '| Loại input | câu trả lời |')
      .replace('| UI/Figma | Không ảnh hưởng / Cần Figma lại |', '| UI/Figma | Không ảnh hưởng |')
      .replace('| Impact | Không có / Có / Bị chặn / Cần task mới |', '| Impact | Có |');

  it('report theo template hiện tại, đã chọn giá trị, đạt', () => {
    status({ current_mode: 'input-sync-mode' });
    write(TEMPLATE, filledTemplate());
    expect(validateInputSyncReport(task)).toEqual({ ok: true, errors: [] });
  });

  it('template chưa điền (còn nguyên chuỗi lựa chọn) không đạt', () => {
    status({ current_mode: 'input-sync-mode' });
    fromTemplate(TEMPLATE);
    const errors = validateInputSyncReport(task).errors;
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/phải chọn Loại input/);
    expect(errors.join('\n')).toMatch(/impact UI\/Figma/);
    expect(errors.join('\n')).toMatch(/kết luận Impact/);
  });

  it('template hiện tại thiếu mục hoặc chứa Prompt bước tiếp theo thì không đạt', () => {
    status({ input_sync_status: 'synced' });
    write(TEMPLATE, filledTemplate().replace('## 4. Kết luận sync', '## 4. Ghi chú') + '\n## Prompt bước tiếp theo\nFE cook x\n');
    expect(validateInputSyncReport(task).errors).toEqual([
      'input-sync-report.md thiếu section: ## 4. Kết luận sync',
      'input-sync-report.md không được chứa Prompt bước tiếp theo; chỉ workflow-status.md được chứa prompt bước tiếp theo.',
    ]);
  });

  const LEGACY = [
    '# Báo cáo đồng bộ input', '## Bước hiện tại', '## 1. Nguồn CR/file trả lời', '## 2. Quy ước version SRS', 'SRS update status: không đổi',
    '## 3. Kết quả đồng bộ câu hỏi', '## 5. Kiểm tra lại Figma gate', 'Figma gate status sau sync: not_required', '## 6. Phân loại impact CR sau PR',
    '## 7. Phạm vi bị ảnh hưởng', '## 8. Hành động bắt buộc', '## 9. File đã cập nhật', '- tracking/workflow-status.md', '## Cập nhật workflow-status.md',
  ];

  it('report theo template cũ đủ section vẫn đạt (tương thích repo dự án cũ)', () => {
    status({ current_mode: 'input-sync-mode' });
    write(TEMPLATE, LEGACY.join('\n'));
    expect(validateInputSyncReport(task)).toEqual({ ok: true, errors: [] });
  });

  it('report theo template cũ vẫn bị kiểm như cũ: thiếu SRS update status thì không đạt', () => {
    status({ current_mode: 'input-sync-mode' });
    write(TEMPLATE, LEGACY.filter((l) => !l.startsWith('SRS update status')).join('\n'));
    expect(validateInputSyncReport(task).errors).toEqual([
      'input-sync-report.md phải ghi SRS update status để phân biệt SRS mới thật với CR/clarification.',
    ]);
  });

  it('không đạt khi đang input-sync mà thiếu report', () => {
    status({ current_mode: 'input-sync-mode' });
    expect(validateInputSyncReport(task).ok).toBe(false);
  });
});

describe('validateFigmaEvidence / validateAssetGate', () => {
  it('bỏ qua khi task không cần Figma', () => {
    status({ figma_required: false });
    expect(validateFigmaEvidence(task)).toMatchObject({ ok: true, skipped: true });
    expect(validateAssetGate(task)).toMatchObject({ ok: true, skipped: true });
  });

  it('cần Figma mà thiếu summary thì không đạt', () => {
    status({ figma_required: true, figma_gate_status: 'passed', figma_decision_source: 'mcp' });
    expect(validateFigmaEvidence(task).errors).toContain('Missing output/figma-extraction-summary.md for figma_required=true.');
    expect(validateAssetGate(task).errors).toEqual(['Missing output/figma-extraction-summary.md. Cannot validate Asset Extraction Log.']);
  });

  it('gate Figma chưa đủ điều kiện build thì không đạt', () => {
    status({ figma_required: true, figma_gate_status: 'pending' });
    const r = validateFigmaEvidence(task);
    expect(r.errors).toContain('Figma gate is not build-eligible: pending.');
    expect(r.errors).toContain('figma_decision_source is required when figma_required=true.');
  });
});
