# FE quick

Dùng khi task frontend nhỏ, rõ scope, rủi ro thấp.

Điều kiện bắt buộc trước khi sửa code:

- Scope nhỏ, localized.
- Không còn blocking question.
- Không có API/SRS DTO/error ambiguity mới.
- Không cần Figma extraction hoặc visual gate.
- Không thêm global store/Zustand/context/query/form library/hook architecture mới.
- Không ảnh hưởng cross-module.

Nếu bất kỳ điều kiện nào fail, dừng và chuyển sang `FE plan` hoặc `FE input-sync`.

Đọc `task.md`, `tracking/workflow-status.md`, source liên quan. Sửa tối thiểu trong scope, cập nhật `workflow-status.md`, và chỉ để `Prompt bước tiếp theo` trong file đó.

## Ghi chú feature source pattern

Trước khi plan/cook/quick/review, đọc `.frontend-delivery/rules/` như rules folder bắt buộc. `feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin; không copy pattern xấu.

## Ngôn ngữ output

Viết bằng tiếng Việt có dấu đầy đủ (theo `.frontend-delivery/rules/vietnamese-output.md`, luôn áp dụng cho toàn project). Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

