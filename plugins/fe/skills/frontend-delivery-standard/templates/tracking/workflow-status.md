---
task_id: <TASK_ID>
status: created
layout: standard
current_mode: planning-mode
step_status: not_started
blocker: false
next_mode: plan
next_prompt: "FE plan <task-folder>"
updated_by: agent
updated_at: ""
human_override: false
vietnamese_diacritics_cache_marker: vi-diacritics-rules-folder-v1.0.0

# Plan input ledger gates
input_inventory_status: not_started
plan_input_ledger_status: not_started
required_input_count: 0
missing_input_count: 0
srs_input_refs: ""
api_input_refs: ""
figma_input_refs: ""
project_context_refs: ""
feature_context_refs: ""
design_context_refs: ""
source_inspection_refs: ""
rule_refs: ""

# Core gates
srs_required: unknown
srs_trace_matrix_status: not_started
srs_logic_coverage_status: not_started
api_contract_mapping_status: not_started
api_error_mapping_status: not_started
fe_error_display_status: not_started
rule_contract_application_status: not_started
clean_code_gate_status: not_started
questions_status: none
blocking_questions_open: 0
questions_resolution_gate_status: not_started
input_sync_required: false
plan_recheck_required_after_input_sync: false

# Efficiency / evidence gates
token_budget_status: not_started
required_files_read_status: not_started
scope_diff_status: not_started
command_evidence_status: not_started
test_command_log_status: not_started
playwright_screenshot_diff_status: not_required

# Figma/UI gates
figma_required: unknown
figma_gate_status: unknown
ui_implementation_contract_status: not_started
figma_node_matrix_status: not_started
figma_component_binding_status: not_started
ui_match_review_status: not_started
ui_match_severity_status: unknown

# Mode output status
input_sync_report_status: not_started
figma_summary_status: not_started
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
ui_figma_review_report_status: not_started
pr_summary_status: not_started
pr_status: not_started
build_ready: false
---

# Trạng thái workflow

## Snapshot

| Mục | Giá trị |
|---|---|
| Mode hiện tại | planning-mode |
| Trạng thái | created |
| Blocker | false |
| Blocking questions open | 0 |
| Input-sync required | false |
| Next mode | plan |

## Input ledger bắt buộc cho FE plan

> `FE plan` phải điền bảng này đầy đủ. Các mode sau đọc bảng này để biết input nào phải mở; không được chỉ để input trong chat hoặc chỉ để trong `implementation-plan.md`.

| Nhóm input | File/link/source phải đọc | Đã đọc? | Evidence/section | Ghi chú |
|---|---|---|---|---|
| Task/request | `task.md` / nội dung user cung cấp | Chưa |  |  |
| SRS/Requirement |  | Chưa / Không áp dụng |  |  |
| API contract/DTO/error |  | Chưa / Không áp dụng |  |  |
| Figma/UI |  | Chưa / Không áp dụng |  |  |
| Project context | `docs/frontend-context/project-source-context.md` | Chưa |  |  |
| Feature mẫu | `docs/frontend-context/feature-source-context.md` | Chưa / Không áp dụng |  |  |
| Design context | `docs/frontend-context/design-context.md` | Chưa / Không áp dụng |  |  |
| Rules | `.frontend-delivery/rules/*` liên quan | Chưa |  |  |
| Source cần inspect |  | Chưa |  |  |
| Câu hỏi/CR/input-sync liên quan | `planning/questions.md` / `tracking/input-sync-report.md` | Chưa / Không áp dụng |  |  |

## Gate câu hỏi blocking

> Nếu bảng `planning/questions.md` còn câu hỏi blocking `Open`/`Pending`/`Blocked`, không được gợi ý `FE cook`. Prompt tiếp theo bắt buộc là `FE input-sync <task-folder> <answer-or-cr>`. Sau input-sync, agent phải cập nhật lại câu hỏi, plan/checklist và chỉ set `build_ready: true` khi không còn blocking question.

| Gate | Giá trị hiện tại | Quy tắc |
|---|---|---|
| questions_status | none | `open/blocked` thì không được cook |
| blocking_questions_open | 0 | `> 0` thì next phải là `input-sync` |
| questions_resolution_gate_status | not_started | `passed/not_required` mới được cook |
| input_sync_required | false | `true` thì next phải là `FE input-sync` |
| plan_recheck_required_after_input_sync | false | `true` thì input-sync phải cập nhật plan/checklist trước cook |

## Output bắt buộc theo mode

| Mode | Artifact bắt buộc | Trạng thái |
|---|---|---|
| FE plan | `planning/implementation-plan.md`, `planning/build-checklist.md`, `planning/questions.md`, `tracking/workflow-status.md` | not_started |
| FE input-sync | `tracking/input-sync-report.md`, `tracking/workflow-status.md` | not_started |
| FE figma | `output/figma-extraction-summary.md`, `tracking/workflow-status.md` | not_started |
| FE cook | `planning/build-checklist.md`, `tracking/workflow-status.md` | not_started |
| FE review | `output/review-report.md`, `tracking/workflow-status.md` | not_started |
| FE test | `output/test-summary.md`, `tracking/workflow-status.md` | not_started |
| FE pr | `output/pr-summary.md`, `tracking/workflow-status.md` | not_started |

## Prompt bước tiếp theo

FE plan <task-folder>

> Nếu còn blocking question: dùng `FE input-sync <task-folder> <answer-or-cr>`, không dùng `FE cook`.
