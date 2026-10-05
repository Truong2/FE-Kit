---
description: Extract Figma evidence, screenshots, states, tokens, and asset decisions.
argument-hint: <task-folder> [Figma link]
---

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
