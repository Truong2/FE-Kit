---
description: Đồng bộ CR, file trả lời câu hỏi, clarification, SRS/Figma/source update vào task.
argument-hint: <task-folder> <câu trả lời hoặc CR>
---

Dùng skill `frontend-delivery-standard` trong `input-sync-mode` cho: $ARGUMENTS

Input tối thiểu:

- Task folder
- Nội dung hoặc file CR/câu trả lời/clarification/update

Output phải cập nhật `tracking/input-sync-report.md`, `planning/questions.md`, và plan/checklist/task/status khi có impact. `tracking/workflow-status.md` là nơi duy nhất chứa `Prompt bước tiếp theo`.

## Đồng bộ câu hỏi blocking

Nếu input là câu trả lời cho `planning/questions.md`, phải cập nhật `tracking/input-sync-report.md`, đổi trạng thái câu hỏi, cập nhật plan/checklist/task nếu câu trả lời làm đổi scope/logic/UI/API. Chỉ route sang `FE cook` khi không còn câu hỏi blocking open, `questions_resolution_gate_status: passed`, `input_sync_required: false`, `plan_recheck_required_after_input_sync: false` và plan/checklist đã đồng bộ. Nếu chưa đồng bộ xong, next phải là `FE plan` hoặc tiếp tục `FE input-sync`, không phải `FE cook`.

Khi câu trả lời làm đổi danh sách file cần sửa, cập nhật luôn bảng `File sẽ tạo / cập nhật` của `implementation-plan.md` để scope diff ở các bước sau còn đúng.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
