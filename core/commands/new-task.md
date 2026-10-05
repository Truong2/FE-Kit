---
description: Tạo task folder chuẩn (task.md, plan, checklist, questions, workflow-status) từ templates.
argument-hint: FE-<id>-<slug>
---

Tạo cấu trúc task chuẩn cho task frontend mới: $ARGUMENTS

Argument là tên task dạng `FE-<id>-<slug>` (ví dụ `FE-123-login-form`). Lệnh này chạy inline, không delegate.

Các bước bắt buộc:

1. Gọi MCP tool `fe_new_task` với `workspace_root` và `task_name`. Tool tạo `docs/frontend-tasks/<tên-task>/` từ template (ưu tiên `.frontend-delivery/templates/` của repo, nếu không có thì dùng bản trong plugin), điền placeholder và không ghi đè file đã có.
2. Nếu không có MCP tool: chạy `node bin/fe-kit.mjs new-task <tên-task>` khi repo có CLI; nếu cũng không có thì tự tạo từ thư mục `templates/` của skill `frontend-delivery-standard`, đủ các file `task.md`, `planning/implementation-plan.md`, `planning/build-checklist.md`, `planning/questions.md`, `tracking/workflow-status.md`, `output/figma-reference-screenshots/.gitkeep` (thay `<TASK_ID>`, `<task-id>`, `<task-folder>`; path luôn dùng dấu `/`).
3. Gọi MCP tool `fe_validate_task` để xác nhận cấu trúc.
4. Kết thúc bằng cách in đúng `next_prompt` trong `tracking/workflow-status.md` vừa tạo (mặc định: `FE plan <task-folder>`), kèm gợi ý: task nhỏ/rủi ro thấp có thể dùng `FE quick <task-folder>`.

Không plan, không code trong lệnh này — chỉ scaffold.

## Ngôn ngữ output

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
