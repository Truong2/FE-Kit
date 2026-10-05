---
description: Đối chiếu UI đã build với Figma/reference screenshot, báo visual mismatch.
argument-hint: <task-folder>
---

## Điều phối (Claude Code)

Bạn là main thread điều phối. Không tự làm việc của mode này, không tự gọi `fe_begin_mode` và không delegate cho agent nào khác (subagent sẽ tự kiểm tra gate).

1. Delegate cho subagent `fe:frontend-figma-specialist` bằng Agent tool và chạy foreground (chờ kết quả). Brief phải gồm: mode `figma-review`; task folder lấy từ argument; đường dẫn tuyệt đối của workspace; nguyên văn mọi input người dùng chỉ đưa trong hội thoại (SRS dán vào, câu trả lời, CR, link Figma); và toàn bộ mục "Hướng dẫn mode" bên dưới.
2. Khi agent trả về, gọi MCP tool `fe_validate_workflow` cho task. Nếu `FAILED`, gửi danh sách lỗi cho chính agent đó để sửa; không tự sửa thay.
3. Trả lời người dùng ngắn gọn: artifact đã cập nhật, blocker nếu có, và dòng `Tiếp theo: <next_prompt>` lấy từ `tracking/workflow-status.md` (hoặc MCP tool `fe_next_step`).

Không tự chuyển sang mode kế tiếp.

## Hướng dẫn mode
Dùng skill `frontend-delivery-standard` trong `figma-review-mode` cho: $ARGUMENTS

Mục tiêu: đối chiếu UI đã build với Figma/reference screenshot và báo visual mismatch bằng tiếng Việt.

Output bắt buộc: `output/ui-figma-review-report.md` và `tracking/workflow-status.md`.

Luật:

- Đọc `output/figma-extraction-summary.md`, đặc biệt mục `UI Implementation Contract`.
- Đọc screenshot Figma trong `output/figma-reference-screenshots/`.
- Nếu có screenshot implementation/Playwright thì so sánh trực tiếp; nếu không có, review code + evidence hiện có và ghi limitation.
- Không được coi UI pass chỉ vì dùng core/source component.
- Nếu Figma gate passed, Figma là visual source of truth.
- Ghi mismatch theo severity: Critical / High / Medium / Low.
- Critical/High mismatch chưa fix/waive thì không PR-ready; route `FE bugfix`.
- Mode này không sửa source.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
