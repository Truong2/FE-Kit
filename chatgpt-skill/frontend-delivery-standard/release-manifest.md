# Release Manifest

Version: 0.1.16

## Changes

- Thêm `rules/question-resolution-contract.md` để chặn route sang `FE cook` khi còn câu hỏi blocking/open.
- `workflow-status.md` có gate `questions_resolution_gate_status`, `input_sync_required`, `plan_recheck_required_after_input_sync`.
- `validate-workflow` kiểm tra cả `planning/questions.md` và YAML status để bắt buộc next prompt là `FE input-sync` khi còn blocker.

- Thêm `rules/efficiency-budget-contract.md` để bắt agent đọc đúng file cần thiết theo mode, không copy rule/SRS/Figma dài vào artifact.
- Thêm `rules/evidence-scope-contract.md` để kiểm soát scope diff, command evidence và screenshot evidence.
- Thêm các gate mới trong `workflow-status.md`: `token_budget_status`, `required_files_read_status`, `scope_diff_status`, `command_evidence_status`, `test_command_log_status`, `playwright_screenshot_diff_status`.
- Cập nhật `implementation-plan.md` với budget đọc context/source và scope diff guard.
- Cập nhật `build-checklist.md` với token/scope/evidence gates.
- Cập nhật `test-summary.md`, `review-report.md`, `ui-figma-review-report.md`, `pr-summary.md` để ghi command evidence, scope diff và Playwright/manual screenshot evidence.
- Siết `validate-workflow` và `validate-pr` để chặn PR khi thiếu scope diff hoặc command evidence.
- Giữ rules folder/adapters cho Claude/Codex/Cursor/GitHub, tiếng Việt có dấu và mandatory mode outputs.


Ghi chú v1.0.0: Câu hỏi blocking/open trong `planning/questions.md` sẽ chặn `FE cook`; `workflow-status.md` bắt buộc route sang `FE input-sync` cho tới khi câu trả lời được đồng bộ vào questions/plan/checklist và `questions_resolution_gate_status: passed`.
