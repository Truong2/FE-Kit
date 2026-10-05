---
description: Đối chiếu UI đã build với Figma/reference screenshot, báo visual mismatch.
argument-hint: <task-folder>
---

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
