---
description: Chạy nhanh task FE nhỏ, rõ scope, rủi ro thấp — gộp plan/cook/review vào một lượt.
argument-hint: <task-folder> <việc cần làm>
---

Dùng skill `frontend-delivery-standard` trong `quick-mode` cho: $ARGUMENTS

Dùng khi task frontend nhỏ, rõ scope, rủi ro thấp. Mode này chạy inline, không delegate.

Điều kiện bắt buộc trước khi sửa code:

- Scope nhỏ, localized.
- Không còn blocking question.
- Không có API/SRS DTO/error ambiguity mới.
- Không cần Figma extraction hoặc visual gate.
- Không thêm global store/Zustand/context/query/form library/hook architecture mới.
- Không ảnh hưởng cross-module.

Nếu bất kỳ điều kiện nào fail, dừng và chuyển sang `FE plan` hoặc `FE input-sync`.

Gọi MCP tool `fe_begin_mode` với mode `quick` trước khi sửa. Đọc `task.md`, `tracking/workflow-status.md`, source liên quan. Sửa tối thiểu trong scope, cập nhật `workflow-status.md` (`current_mode: quick-mode`), chỉ để `Prompt bước tiếp theo` trong file đó, rồi gọi `fe_validate_workflow`.

## Ghi chú feature source pattern

`feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin; không copy pattern xấu.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
