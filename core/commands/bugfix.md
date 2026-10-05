---
description: Sửa bug trong phạm vi plan hiện tại.
argument-hint: <task-folder> [bug ID]
---

Dùng skill `frontend-delivery-standard` trong `bugfix-mode` cho: $ARGUMENTS

Sửa các bug đang mở trong `tracking/review-bugs.md`, trong phạm vi file của plan hiện tại.

Output bắt buộc: `tracking/review-bugs.md` (trạng thái từng bug, file đã sửa, cách kiểm tra lại) và `tracking/workflow-status.md`.

Nếu bug làm thay đổi requirement, API, state/store/hook, flow hoặc Figma assumption, chạy `FE input-sync` trước.

Sau bugfix, next thường là `FE review <task-folder>` để kiểm tra lại.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
