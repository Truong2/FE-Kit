---
description: Extract Figma evidence, screenshots, states, tokens, and asset decisions.
argument-hint: <task-folder> [Figma link]
---

## Điều phối (Claude Code)

Bạn là main thread điều phối. Không tự làm việc của mode này, không tự gọi `fe_begin_mode` và không delegate cho agent nào khác (subagent sẽ tự kiểm tra gate).

1. Delegate cho subagent `fe:frontend-figma-specialist` bằng Agent tool và chạy foreground (chờ kết quả). Brief phải gồm: mode `figma`; task folder lấy từ argument; đường dẫn tuyệt đối của workspace; nguyên văn mọi input người dùng chỉ đưa trong hội thoại (SRS dán vào, câu trả lời, CR, link Figma); và toàn bộ mục "Hướng dẫn mode" bên dưới.
2. Khi agent trả về, gọi MCP tool `fe_validate_workflow` cho task. Nếu `FAILED`, gửi danh sách lỗi cho chính agent đó để sửa; không tự sửa thay.
3. Trả lời người dùng ngắn gọn: artifact đã cập nhật, blocker nếu có, và dòng `Tiếp theo: <next_prompt>` lấy từ `tracking/workflow-status.md` (hoặc MCP tool `fe_next_step`).

Không tự chuyển sang mode kế tiếp.

## Hướng dẫn mode
Dùng skill `frontend-delivery-standard` trong `figma-extraction-mode` cho: $ARGUMENTS

Output bắt buộc:

- `output/figma-extraction-summary.md` gồm `UI Implementation Contract` và `UI Node Implementation Matrix`
- `output/figma-reference-screenshots/*` nếu tool cho phép
- cập nhật Figma gate trong `tracking/workflow-status.md`

Dùng Figma MCP tool có trong phiên để đọc design. Không truy cập được Figma thì ghi blocker và mức evidence, đặt Figma gate `blocked`, route `FE input-sync`; không suy diễn design từ source.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
