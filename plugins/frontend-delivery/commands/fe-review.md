---
description: Review code theo SRS, plan, checklist, questions và Figma evidence.
---

Dùng skill `frontend-delivery-standard` trong `review-mode`.

Bắt buộc tạo/cập nhật `output/review-report.md` và `tracking/workflow-status.md`. Nếu có issue/bug, tạo/cập nhật thêm `tracking/review-bugs.md`.

Sau review phải cập nhật `workflow-status.md` với `review_status`, `review_report_status`, `review_bug_status`, số issue theo severity, `bugfix_required`, `next_mode` và `next_prompt`.

Nếu còn Critical/High issue thì route sang `FE bugfix`, `FE input-sync` hoặc `FE figma-review`; không được route thẳng sang PR/test khi còn blocker. Nếu không có issue, next thường là `FE test <task-folder>`.

## Ngôn ngữ output

Viết bằng tiếng Việt có dấu đầy đủ (theo `.frontend-delivery/rules/vietnamese-output.md`, luôn áp dụng cho toàn project). Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
