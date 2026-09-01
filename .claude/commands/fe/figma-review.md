---
description: Đối chiếu UI đã build với Figma/reference screenshot, báo visual mismatch.
---

Bạn đang chạy `figma-review-mode`.

Mục tiêu: đối chiếu UI đã build với Figma/reference screenshot và báo visual mismatch bằng tiếng Việt.

Luật:

- Đọc `output/figma-extraction-summary.md`, đặc biệt mục `UI Implementation Contract`.
- Đọc screenshot Figma trong `output/figma-reference-screenshots/`.
- Nếu có screenshot implementation/Playwright thì so sánh trực tiếp; nếu không có, review code + evidence hiện có và ghi limitation.
- Không được coi UI pass chỉ vì dùng core/source component.
- Nếu Figma gate passed, Figma là visual source of truth.
- Ghi mismatch theo severity: Critical / High / Medium / Low.
- Critical/High mismatch chưa fix/waive thì không PR-ready.

Output nếu cần evidence riêng: `output/ui-figma-review-report.md`.

## Ngôn ngữ output

Viết bằng tiếng Việt có dấu đầy đủ (theo `.frontend-delivery/rules/vietnamese-output.md`, luôn áp dụng cho toàn project). Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
