---
name: frontend-delivery-standard
description: dùng cho task frontend cần FE plan, FE quick, FE input-sync, FE figma, FE figma-review, FE cook, FE review, FE bugfix, FE test, FE pr. Bắt buộc tiếng Việt có dấu, rules folder chung, output tối thiểu theo mode, SRS/Figma gates, token budget, scope diff, command evidence và blocking question input-sync gate. Chặn route sang cook khi còn câu hỏi blocking/open.
---

# Frontend Delivery Standard

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

## Luôn áp dụng

- Mọi câu trả lời và artifact `.md` phải viết bằng tiếng Việt có dấu đầy đủ.
- Không mode nào được kết thúc chỉ bằng chat response.
- Mọi mode phải tạo/cập nhật artifact bắt buộc và `tracking/workflow-status.md`.
- `tracking/workflow-status.md` là file duy nhất chứa `Prompt bước tiếp theo`.
- `FE plan` phải ghi đủ Input ledger trong `tracking/workflow-status.md` để các mode sau biết cần đọc input nào.
- Nếu `planning/questions.md` còn câu hỏi blocking/open, `workflow-status.md` phải route sang `FE input-sync`; không được route sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
- Không copy rule dài vào output; chỉ ghi rule ID/path và quyết định liên quan trực tiếp tới task.
- `docs/frontend-context/feature-source-context.md` chỉ mô tả feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin.

## Bắt đầu và kết thúc một mode

1. **Bắt đầu:** gọi MCP tool `fe_begin_mode` (`workspace_root`, `task_folder`, `mode`). Kết quả cho biết mode có được chạy không, prompt phải chạy thay thế nếu bị chặn, artifact bắt buộc và nguyên văn các rule áp dụng cho mode (không cần mở file rule riêng).
2. **Bị chặn:** không làm việc của mode và không sửa source; chỉ cập nhật `next_mode`/`next_prompt` trong `tracking/workflow-status.md` theo prompt được trả về.
3. **Kết thúc:** cập nhật `tracking/workflow-status.md`, gọi `fe_validate_workflow` và sửa tới khi `PASSED`.

Môi trường không có MCP tool của kit (ChatGPT, Codex, Cursor, Copilot): tự đọc `tracking/workflow-status.md` + `planning/questions.md`, áp dụng `rules/question-resolution-contract.md`, và dùng script trong `scripts/` nếu có (`node scripts/validate-workflow.mjs <task-folder>`).

## Vị trí rule

- Rule mặc định nằm trong `rules/` cạnh file skill này.
- Repo dự án có thể override bằng `.frontend-delivery/rules/` (tạo bởi `fe-kit init`); khi thư mục đó tồn tại thì nó được ưu tiên. `fe_begin_mode` tự chọn đúng nguồn và trả về nội dung rule.

## Rule loading theo mode

- Luôn: `rules/core.md`, `rules/mode-output-contract.md`, `rules/plan-input-ledger-contract.md`, `rules/question-resolution-contract.md`, `rules/vietnamese-output.md`, `rules/efficiency-budget-contract.md`
- SRS/API: `rules/srs-api-contract.md`
- UI/Figma: `rules/figma-ui-contract.md`
- Cook/review/quick/bugfix: `rules/clean-code-contract.md`
- Cook/review/test/figma-review/pr: `rules/evidence-scope-contract.md`
- Review/bugfix/PR: `rules/review-bug-contract.md`

## Project context chuẩn

```text
docs/frontend-context/
  README.md
  project-source-context.md
  feature-source-context.md
  design-context.md
```

Không tạo `frontend-rule-context.md` trong `docs/frontend-context/`.

## Mode output bắt buộc

| Mode | Artifact bắt buộc |
|---|---|
| `FE plan` | `task.md`, `planning/implementation-plan.md`, `planning/build-checklist.md`, `planning/questions.md`, `tracking/workflow-status.md` |
| `FE quick` | `tracking/workflow-status.md`, checklist nếu có task folder |
| `FE input-sync` | `tracking/input-sync-report.md`, `planning/questions.md`, `tracking/workflow-status.md` |
| `FE figma` | `output/figma-extraction-summary.md`, `tracking/workflow-status.md` |
| `FE cook` | code changes, `planning/build-checklist.md`, `tracking/workflow-status.md` |
| `FE review` | `output/review-report.md`, `tracking/workflow-status.md`; có bug thì thêm `tracking/review-bugs.md` |
| `FE bugfix` | `tracking/review-bugs.md`, `tracking/workflow-status.md` |
| `FE test` | `output/test-summary.md`, `tracking/workflow-status.md` |
| `FE figma-review` | `output/ui-figma-review-report.md`, `tracking/workflow-status.md` |
| `FE pr` | `output/pr-summary.md`, `tracking/workflow-status.md` |

## Ai được sửa source

Chỉ `FE cook`, `FE bugfix` và `FE quick` được sửa source code của dự án, và chỉ trong các file thuộc bảng `File sẽ tạo / cập nhật` của `planning/implementation-plan.md`. Các mode còn lại chỉ ghi artifact trong `docs/frontend-tasks/` và `docs/frontend-context/`.

## Evidence gates

- Trước PR phải có review/test evidence bắt buộc theo task.
- Nếu có Figma/UI, cần UI review evidence hoặc waiver rõ ràng.
- Không sửa file ngoài plan nếu chưa update plan/input-sync. Dùng MCP tool `fe_scope_diff` để đối chiếu `git diff` với plan thay vì tự khai `scope_diff_status`.
- Không claim command pass nếu chưa chạy thật. `output/test-summary.md` phải có dòng lệnh đã chạy thật trong bảng `Command evidence log`.
- `human_override: true` chỉ được bật khi người dùng xác nhận.

## Validation

| Việc | Claude Code (plugin `fe`) | Môi trường khác |
|---|---|---|
| Tạo task folder | `fe_new_task` | `node bin/fe-kit.mjs new-task <tên-task>` |
| Kiểm tra cấu trúc task | `fe_validate_task` | `node scripts/validate-task.mjs <task-folder>` |
| Kiểm tra gate workflow | `fe_validate_workflow` | `node scripts/validate-workflow.mjs <task-folder>` |
| Đối chiếu scope với plan | `fe_scope_diff` | `node bin/fe-kit.mjs validate-pr <task-folder>` |
| Bước tiếp theo | `fe_next_step` | mục `Prompt bước tiếp theo` trong `workflow-status.md` |
