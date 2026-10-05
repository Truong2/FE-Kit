---
description: Chạy hoặc ghi nhận test evidence cho task FE.
argument-hint: <task-folder>
---

## Điều phối (Claude Code)

Bạn là main thread điều phối. Không tự làm việc của mode này, không tự gọi `fe_begin_mode` và không delegate cho agent nào khác (subagent sẽ tự kiểm tra gate).

1. Delegate cho subagent `fe:frontend-tester` bằng Agent tool và chạy foreground (chờ kết quả). Brief phải gồm: mode `test`; task folder lấy từ argument; đường dẫn tuyệt đối của workspace; nguyên văn mọi input người dùng chỉ đưa trong hội thoại (SRS dán vào, câu trả lời, CR, link Figma); và toàn bộ mục "Hướng dẫn mode" bên dưới.
2. Khi agent trả về, gọi MCP tool `fe_validate_workflow` cho task. Nếu `FAILED`, gửi danh sách lỗi cho chính agent đó để sửa; không tự sửa thay.
3. Trả lời người dùng ngắn gọn: artifact đã cập nhật, blocker nếu có, và dòng `Tiếp theo: <next_prompt>` lấy từ `tracking/workflow-status.md` (hoặc MCP tool `fe_next_step`).

Không tự chuyển sang mode kế tiếp.

## Hướng dẫn mode
Dùng skill `frontend-delivery-standard` trong `testing-mode` cho: $ARGUMENTS

Bắt buộc tạo/cập nhật `output/test-summary.md` và `tracking/workflow-status.md`.

Bảng `Command evidence log` trong `output/test-summary.md` phải có một dòng cho mỗi lệnh test/lint/typecheck/build: lệnh nguyên văn, đã chạy thật hay chưa, kết quả, thời điểm. Lệnh chưa chạy ghi `Không` kèm lý do. Validator đọc bảng này: không có dòng lệnh đã chạy thật thì không qua được gate PR.

Không claim pass nếu chưa chạy thật. Test fail do code thì ghi lại và route `FE bugfix`; mode này không sửa source.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
