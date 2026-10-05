---
description: Lập kế hoạch FE từ SRS/source/Figma, không code.
argument-hint: <task-folder> [SRS/Figma/ghi chú]
---

Dùng skill `frontend-delivery-standard` trong `planning-mode` cho: $ARGUMENTS

Input tối thiểu:

- Task folder
- SRS hoặc mô tả requirement
- Source context / project code
- Figma link nếu có UI dependency

Output phải cập nhật `task.md`, `planning/implementation-plan.md`, `planning/build-checklist.md`, `planning/questions.md`, và `tracking/workflow-status.md`.

## Input ledger bắt buộc

Sau khi chạy `FE plan`, phải cập nhật `tracking/workflow-status.md` mục `Input ledger bắt buộc cho FE plan` với đầy đủ input: task/request, SRS/API/Figma, context project/feature/design, rules và source cần inspect. Các mode sau có thể chỉ mở `workflow-status.md` trước nên không được để input chỉ nằm trong chat.

## File sẽ tạo / cập nhật

Mục `File sẽ tạo / cập nhật` của `implementation-plan.md` phải liệt kê path thật hoặc glob cho mọi file dự kiến sửa. Validator so bảng này với `git diff` để tính scope diff ở cook/review/pr; file không có trong bảng sẽ bị báo là sửa ngoài plan.

## Gate câu hỏi blocking

Nếu tạo/cập nhật `planning/questions.md` với bất kỳ câu hỏi blocking đang `Open`/`Pending`/`Blocked`, phải cập nhật `tracking/workflow-status.md`: `blocker: true`, `build_ready: false`, `questions_status: open` hoặc `blocked`, `blocking_questions_open` đúng số lượng, `questions_resolution_gate_status: blocked`, `input_sync_required: true`, `plan_recheck_required_after_input_sync: true`, `next_mode: input-sync`, `next_prompt: "FE input-sync <task-folder> <answer-or-cr>"`. Không được gợi ý `FE cook` khi còn blocking question.

## Ghi chú lỗi API và hiển thị FE

Khi task có API/error state, plan phải quyết định rõ Error DTO/status/error code map sang UI nào: inline field error, form alert, toast/snackbar core, page error, redirect hoặc fallback. Ưu tiên dùng core component/hook có sẵn trong source; custom UI chỉ dùng khi plan ghi rõ lý do và evidence.

## Ghi chú feature source pattern

`feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin; không copy pattern xấu.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
