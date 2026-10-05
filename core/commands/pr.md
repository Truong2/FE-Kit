---
description: Chuẩn bị PR summary và readiness evidence.
argument-hint: <task-folder>
---

Dùng skill `frontend-delivery-standard` trong `pr-ready-mode` cho: $ARGUMENTS

Output bắt buộc: `output/pr-summary.md` và cập nhật `tracking/workflow-status.md`.

Chỉ đặt `pr_status: ready` khi: review passed, không còn bug Critical/High, `output/test-summary.md` có lệnh đã chạy thật, MCP tool `fe_scope_diff` không báo file sửa ngoài plan, và task UI/Figma đã có UI match review hoặc waiver. Thiếu điều kiện nào thì đặt `pr_status: blocked` và route sang mode xử lý tương ứng.

Mode này không sửa source và không tự mở/push PR trừ khi người dùng yêu cầu rõ.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
