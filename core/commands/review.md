---
description: Review code theo SRS, plan, checklist, questions và Figma evidence.
argument-hint: <task-folder>
---

Dùng skill `frontend-delivery-standard` trong `review-mode` cho: $ARGUMENTS

Bắt buộc tạo/cập nhật `output/review-report.md` và `tracking/workflow-status.md`. Nếu có issue/bug, tạo/cập nhật thêm `tracking/review-bugs.md`.

Review không sửa source: issue được ghi thành bug để xử lý ở `FE bugfix`.

Đối chiếu diff thật với plan/checklist/SRS; gọi MCP tool `fe_scope_diff` để lấy danh sách file sửa ngoài plan thay vì tự khai `scope_diff_status`.

Sau review phải cập nhật `workflow-status.md` với `review_status`, số issue theo severity, `bugfix_required`, `next_mode` và `next_prompt`.

Nếu còn Critical/High issue thì route sang `FE bugfix`, `FE input-sync` hoặc `FE figma-review`; không được route thẳng sang PR/test khi còn blocker. Nếu không có issue, next thường là `FE test <task-folder>`.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
