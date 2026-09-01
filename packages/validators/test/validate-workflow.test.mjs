import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkflow } from '../src/index.mjs';
import { countOpenBlockingQuestions, realQuestionCell, evaluateWorkflowGates } from '../src/gates.mjs';
import { parseWorkflowStatus } from '../src/parse.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(__dirname, 'fixtures', name);

describe('validateWorkflow — gate integration (chạy trên filesystem fixture thật)', () => {
  it('chặn khi còn blocking question mở: build_ready phải false, next_mode phải input-sync', () => {
    const result = validateWorkflow(fixture('task-blocked-question'));
    expect(result.ok).toBe(true); // fixture này ĐÃ khai báo đúng gate (next_mode=input-sync, build_ready=false) nên tự nó hợp lệ
  });

  it('phát hiện vi phạm khi build_ready=true nhưng vẫn còn blocking question', () => {
    // dựng lại data từ fixture nhưng cố tình phá gate để chứng minh validator bắt được lỗi thật
    const raw = `---
task_id: FE-999-broken
status: created
layout: standard
current_mode: planning-mode
step_status: not_started
blocker: false
next_mode: cook
next_prompt: "FE cook docs/frontend-tasks/FE-999-broken"
updated_by: agent
updated_at: "2026-08-31T00:00:00Z"
human_override: false
vietnamese_diacritics_cache_marker: vi-diacritics-rules-folder-v1.0.0
input_inventory_status: passed
plan_input_ledger_status: passed
required_input_count: 1
missing_input_count: 0
srs_input_refs: ""
api_input_refs: ""
figma_input_refs: ""
project_context_refs: ""
feature_context_refs: ""
design_context_refs: ""
source_inspection_refs: ""
rule_refs: ""
srs_required: false
srs_trace_matrix_status: not_required
srs_logic_coverage_status: not_required
api_contract_mapping_status: not_required
api_error_mapping_status: not_required
fe_error_display_status: not_required
rule_contract_application_status: not_required
clean_code_gate_status: not_required
questions_status: open
blocking_questions_open: 2
questions_resolution_gate_status: blocked
input_sync_required: true
plan_recheck_required_after_input_sync: true
token_budget_status: passed
required_files_read_status: passed
scope_diff_status: passed
command_evidence_status: passed
test_command_log_status: passed
playwright_screenshot_diff_status: not_required
figma_required: false
figma_gate_status: not_required
ui_implementation_contract_status: not_required
figma_node_matrix_status: not_required
figma_component_binding_status: not_required
ui_match_review_status: not_required
ui_match_severity_status: unknown
input_sync_report_status: not_required
figma_summary_status: not_required
cook_status: not_started
review_status: not_started
review_report_status: not_started
review_bug_status: none
critical_issues_open: 0
high_issues_open: 0
medium_issues_open: 0
low_issues_open: 0
bugfix_required: false
test_summary_status: not_started
ui_figma_review_report_status: not_required
pr_summary_status: not_started
pr_status: not_started
build_ready: true
---

## Input ledger bắt buộc cho FE plan

## Prompt bước tiếp theo

FE cook docs/frontend-tasks/FE-999-broken
`;

    const parsed = parseWorkflowStatus(raw);
    expect(parsed.ok).toBe(true); // schema-valid (đúng kiểu dữ liệu), nhưng vi phạm business gate bên dưới

    // giả lập file hệ thống: 5 file bắt buộc coi như đã tồn tại
    const exists = () => true;
    const read = (rel) =>
      rel === 'planning/questions.md'
        ? `## Câu hỏi blocking\n\n| ID | Câu hỏi | Ngữ cảnh | X | X | X | Chi tiết | Impact | Trạng thái |\n|---|---|---|---|---|---|---|---|---|\n| Q1 | ? | ctx | | | | co-noi-dung | cao | Open |\n| Q2 | ? | ctx | | | | co-noi-dung | cao | Pending |\n`
        : '';

    const result = evaluateWorkflowGates({ data: parsed.data, body: parsed.body, exists, read });

    expect(result.ok).toBe(false);
    // build_ready=true nhưng next_mode=cook trong khi còn 2 blocking question → phải bị bắt lỗi
    expect(result.errors).toContain(
      'Không được build_ready=true khi còn câu hỏi blocking/open hoặc input-sync required.'
    );
    expect(result.errors).toContain('build_ready=true nhưng còn blocking question.');
  });

  it('fixture task-ready-to-cook pass toàn bộ gate', () => {
    const result = validateWorkflow(fixture('task-ready-to-cook'));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('báo lỗi rõ ràng khi thiếu file bắt buộc', () => {
    const result = validateWorkflow(fixture('task-does-not-exist'));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Thiếu/);
  });
});

describe('countOpenBlockingQuestions', () => {
  it('đếm đúng số câu hỏi Open, bỏ qua câu đã Resolved', () => {
    const md = `## Câu hỏi blocking

| ID | Câu hỏi | Ngữ cảnh | A | B | C | D | E | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| Q1 | Xử lý huỷ đơn thế nào? | checkout | x | x | x | co-noi-dung | cao | Open |
| Q2 | Field nào bắt buộc? | form | x | x | x | co-noi-dung | trung binh | Resolved |

## Câu hỏi non-blocking
`;
    expect(countOpenBlockingQuestions(md)).toBe(1);
  });

  it('KHÔNG lọc được hàng placeholder nếu cột Trạng thái vẫn ghi "Open" (finding, không phải bug port)', () => {
    // hasContent kiểm tra 5 cột: [ID, D, E, ...,Trạng thái]. Cột "Trạng thái"
    // luôn nằm trong danh sách kiểm tra hasContent, và khi isOpen=true thì
    // giá trị cột này ("Open"/"Pending"/...) gần như không bao giờ khớp
    // pattern placeholder — nên hasContent hầu như luôn true bất cứ khi nào
    // isOpen true, kể cả khi ID và toàn bộ nội dung khác đều trống/N-A.
    // => Đây là hạn chế có sẵn từ bản gốc (giữ nguyên khi port sang gates.mjs
    // để không đổi behavior ngoài kế hoạch), KHÔNG phải lỗi mới. Khuyến nghị:
    // team nên xem lại có nên loại cột Trạng thái ra khỏi hasContent hay không.
    const md = `## Câu hỏi blocking

| ID | Câu hỏi | Ngữ cảnh | A | B | C | D | E | Trạng thái |
|---|---|---|---|---|---|---|---|---|
|  | N/A | | | | | N/A | N/A | Open |

## Câu hỏi non-blocking
`;
    expect(countOpenBlockingQuestions(md)).toBe(1);
  });

  it('trả về 0 khi không có mục Câu hỏi blocking', () => {
    expect(countOpenBlockingQuestions('# Không có gì ở đây')).toBe(0);
  });

  it('trả về 0 khi input rỗng/undefined', () => {
    expect(countOpenBlockingQuestions('')).toBe(0);
    expect(countOpenBlockingQuestions(undefined)).toBe(0);
  });
});

describe('realQuestionCell', () => {
  it('coi placeholder là không có nội dung', () => {
    expect(realQuestionCell('')).toBe(false);
    expect(realQuestionCell('N/A')).toBe(false);
    expect(realQuestionCell('Không áp dụng')).toBe(false);
    expect(realQuestionCell('<frame-id>')).toBe(false);
    expect(realQuestionCell('-')).toBe(false);
  });

  it('coi nội dung thật là có nội dung', () => {
    expect(realQuestionCell('Cần xác nhận trạng thái đơn hàng')).toBe(true);
  });
});

describe('parseWorkflowStatus — schema validation', () => {
  it('báo lỗi rõ field nào sai khi current_mode không nằm trong enum hợp lệ', () => {
    const raw = `---
task_id: FE-1
current_mode: not-a-real-mode
---
body`;
    const result = parseWorkflowStatus(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('current_mode'))).toBe(true);
  });

  it('báo lỗi khi thiếu field bắt buộc (vd. task_id)', () => {
    const raw = `---
status: created
---
body`;
    const result = parseWorkflowStatus(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('task_id'))).toBe(true);
  });
});
