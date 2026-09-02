# Prompt Map

| Prompt | Mode | Mục đích |
|---|---|---|
| `FE plan <task>` | planning-mode | Lập kế hoạch từ SRS/source/Figma. |
| `FE quick <task>` | quick-mode | Task nhỏ, rủi ro thấp; làm nhanh nếu không cần re-plan/input-sync/Figma. |
| `FE input-sync <task> <answer-or-cr>` | input-sync-mode | Đồng bộ file trả lời, CR, clarification, SRS/Figma update. |
| `FE figma <task> <figma-link>` | figma-extraction-mode | Extract Figma evidence và asset decisions. |
| `FE cook <task>` | implementation-mode | Build theo implementation-plan và build-checklist. |
| `FE bugfix <task>` | bugfix-mode | Sửa lỗi trong phạm vi plan hiện tại. |
| `FE review <task>` | review-mode | Review theo SRS/plan/checklist/Figma. |
| `FE test <task>` | testing-mode | Chạy/ghi nhận test evidence. |
| `FE pr <task>` | pr-ready-mode | Chuẩn bị PR summary. |


## Ghi chú lỗi API và hiển thị FE

Khi task có API/error state, plan phải quyết định rõ Error DTO/status/error code map sang UI nào: inline field error, form alert, toast/snackbar core, page error, redirect hoặc fallback. Ưu tiên dùng core component/hook có sẵn trong source; custom UI chỉ dùng khi plan ghi rõ lý do và evidence.


## Review artifact bắt buộc

`FE review` luôn tạo/cập nhật `output/review-report.md` và `tracking/workflow-status.md`. Nếu có issue/bug, tạo/cập nhật `tracking/review-bugs.md` và route `Prompt bước tiếp theo` sang `FE bugfix`, `FE input-sync` hoặc `FE figma-review` tùy nguyên nhân.

## Gate câu hỏi blocking

Nếu `planning/questions.md` còn câu hỏi blocking `Open/Pending/Blocked`, prompt tiếp theo trong `workflow-status.md` phải là `FE input-sync <task> <answer-or-cr>`. Chỉ được sang `FE cook` sau khi input-sync cập nhật câu trả lời, plan/checklist và `questions_resolution_gate_status: passed`.
