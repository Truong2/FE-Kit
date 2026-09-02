---
description: Tạo task folder chuẩn (task.md, plan, checklist, questions, workflow-status) từ templates.
---

Tạo cấu trúc task chuẩn cho task frontend mới. Argument: tên task dạng `FE-<id>-<slug>` (ví dụ `FE-123-login-form`).

Các bước bắt buộc:

1. Xác định thư mục task: `docs/frontend-tasks/<tên-task>/`. Nếu đã tồn tại, dừng lại và báo — không ghi đè.
2. Tìm bộ templates theo thứ tự ưu tiên:
   - `.frontend-delivery/templates/` trong repo (nếu đã cài CLI fe-kit), hoặc
   - thư mục `templates/` của skill `frontend-delivery-standard` trong plugin này.
3. Tạo đủ các file sau từ template tương ứng (giữ nguyên frontmatter, thay placeholder tên task):
   - `task.md`
   - `planning/implementation-plan.md`
   - `planning/build-checklist.md`
   - `planning/questions.md`
   - `tracking/workflow-status.md`
   - `output/figma-reference-screenshots/.gitkeep`
4. Nếu repo đã cài CLI fe-kit, ưu tiên chạy `node bin/fe-kit.mjs new-task <tên-task>` (hoặc `fe-kit new-task`) thay vì tạo tay — CLI validate sẵn cấu trúc.
5. Kết thúc bằng cách in đúng `next_prompt` trong `tracking/workflow-status.md` vừa tạo (mặc định: `FE plan <task-folder>`), kèm gợi ý: task nhỏ/rủi ro thấp có thể dùng `FE quick <task-folder>`.

Không plan, không code trong lệnh này — chỉ scaffold.

## Ngôn ngữ output

Viết bằng tiếng Việt có dấu đầy đủ (theo `.frontend-delivery/rules/vietnamese-output.md`, luôn áp dụng cho toàn project). Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
