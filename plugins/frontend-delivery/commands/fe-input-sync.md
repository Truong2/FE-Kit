---
description: Đồng bộ CR, file trả lời câu hỏi, clarification, SRS/Figma/source update vào task.
---

Dùng skill `frontend-delivery-standard` trong `input-sync-mode`.

Input tối thiểu:
- Task folder
- Nội dung hoặc file CR/câu trả lời/clarification/update

Output phải cập nhật `tracking/input-sync-report.md`, questions/plan/checklist/task/status khi có impact. `tracking/workflow-status.md` là nơi duy nhất chứa `Prompt bước tiếp theo`.

## Đồng bộ câu hỏi blocking

Nếu input là câu trả lời cho `planning/questions.md`, phải cập nhật `tracking/input-sync-report.md`, đổi trạng thái câu hỏi, cập nhật plan/checklist/task nếu câu trả lời làm đổi scope/logic/UI/API. Chỉ route sang `FE cook` khi không còn câu hỏi blocking open, `questions_resolution_gate_status: passed`, `input_sync_required: false`, `plan_recheck_required_after_input_sync: false` và plan/checklist đã đồng bộ. Nếu chưa đồng bộ xong, next phải là `FE plan` hoặc tiếp tục `FE input-sync`, không phải `FE cook`.

## Ngôn ngữ output

Viết bằng tiếng Việt có dấu đầy đủ (theo `.frontend-delivery/rules/vietnamese-output.md`, luôn áp dụng cho toàn project). Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

