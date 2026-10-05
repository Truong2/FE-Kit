---
description: Review code theo SRS, plan, checklist, questions và Figma evidence.
argument-hint: <task-folder>
---

## Điều phối (Claude Code)

Bạn là main thread điều phối. Không tự làm việc của mode này, không tự gọi `fe_begin_mode` và không delegate cho agent nào khác (subagent sẽ tự kiểm tra gate).

1. Delegate cho subagent `fe:frontend-reviewer` bằng Agent tool và chạy foreground (chờ kết quả). Brief phải gồm: mode `review`; task folder lấy từ argument; đường dẫn tuyệt đối của workspace; nguyên văn mọi input người dùng chỉ đưa trong hội thoại (SRS dán vào, câu trả lời, CR, link Figma); và toàn bộ mục "Hướng dẫn mode" bên dưới.
2. Khi agent trả về, gọi MCP tool `fe_validate_workflow` cho task. Nếu `FAILED`, gửi danh sách lỗi cho chính agent đó để sửa; không tự sửa thay.
3. Trả lời người dùng ngắn gọn: artifact đã cập nhật, blocker nếu có, và dòng `Tiếp theo: <next_prompt>` lấy từ `tracking/workflow-status.md` (hoặc MCP tool `fe_next_step`).

Không tự chuyển sang mode kế tiếp.

## Hướng dẫn mode
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
