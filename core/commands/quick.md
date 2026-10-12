---
description: Chạy nhanh task FE nhỏ, rõ scope, rủi ro thấp — plan, code, tự review và test evidence trong một lượt, đi thẳng tới PR.
argument-hint: <task-folder> <việc cần làm>
---

Dùng skill `frontend-delivery-standard` trong `quick-mode` cho: $ARGUMENTS

Dùng khi task frontend nhỏ, rõ scope, rủi ro thấp. Mode này chạy inline, không delegate. Đánh đổi: review là tự review của chính lượt này, không phải review độc lập; task có rủi ro thì dùng luồng đầy đủ.

Điều kiện bắt buộc trước khi sửa code:

- Scope nhỏ, localized.
- Không còn blocking question.
- Không có API/SRS DTO/error ambiguity mới.
- Không cần Figma extraction hoặc visual gate.
- Không thêm global store/Zustand/context/query/form library/hook architecture mới.
- Không ảnh hưởng cross-module.

Nếu bất kỳ điều kiện nào fail, dừng và chuyển sang `FE plan` hoặc `FE input-sync`.

Các bước, trong cùng một lượt:

1. Gọi MCP tool `fe_begin_mode` với mode `quick` trước khi sửa. Đọc `task.md`, `tracking/workflow-status.md`, source liên quan.
2. Điền ngắn bảng `File sẽ tạo / cập nhật` trong `planning/implementation-plan.md` (chỉ các file sẽ sửa) để `fe_scope_diff` tính được.
3. Sửa tối thiểu trong scope, kèm test cho hành vi đổi.
4. Tự review theo checklist (SRS/yêu cầu, clean code, scope) rồi ghi `output/review-report.md` theo template, chọn `Loại review: Quick — tự review`. Có bug thì ghi vào `tracking/review-bugs.md`.
5. Chạy thật typecheck/test/build của dự án rồi ghi `output/test-summary.md` theo template, bảng Command evidence log có kết quả và thời điểm. Chạy từng lệnh một tại thư mục gốc dự án (vd `npm test`), không ghép `cd …;` hay `&&`, để khớp quyền đã cấp. Sửa nhiều chỗ trong một file thì viết lại file một lần.
6. Gọi `fe_scope_diff`.
7. Cập nhật `tracking/workflow-status.md`: `current_mode: quick-mode`, `review_status`, `review_bug_status`, `scope_diff_status`, `command_evidence_status`, `test_command_log_status`. Chỉ để `Prompt bước tiếp theo` trong file này.
   - Tự review đạt, không có bug Critical/High, scope và test đều passed: next là `FE pr <task-folder>`.
   - Có bug Critical/High, rủi ro vượt dự kiến, hoặc người dùng muốn review độc lập: next là `FE review <task-folder>`.
8. Gọi `fe_validate_workflow` và sửa cho tới khi `PASSED`.

## Ghi chú feature source pattern

`feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin; không copy pattern xấu.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
