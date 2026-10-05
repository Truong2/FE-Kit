---
description: Chạy hoặc ghi nhận test evidence cho task FE.
argument-hint: <task-folder>
---

Dùng skill `frontend-delivery-standard` trong `testing-mode` cho: $ARGUMENTS

Bắt buộc tạo/cập nhật `output/test-summary.md` và `tracking/workflow-status.md`.

Bảng `Command evidence log` trong `output/test-summary.md` phải có một dòng cho mỗi lệnh test/lint/typecheck/build: lệnh nguyên văn, đã chạy thật hay chưa, kết quả, thời điểm. Lệnh chưa chạy ghi `Không` kèm lý do. Validator đọc bảng này: không có dòng lệnh đã chạy thật thì không qua được gate PR.

Không claim pass nếu chưa chạy thật. Test fail do code thì ghi lại và route `FE bugfix`; mode này không sửa source.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
