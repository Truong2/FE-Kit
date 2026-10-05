---
description: Implement FE task theo implementation-plan và build-checklist.
argument-hint: <task-folder>
---

## Điều phối (Claude Code)

Bạn là main thread điều phối. Không tự làm việc của mode này, không tự gọi `fe_begin_mode` và không delegate cho agent nào khác (subagent sẽ tự kiểm tra gate).

1. Delegate cho subagent `fe:frontend-developer` bằng Agent tool và chạy foreground (chờ kết quả). Brief phải gồm: mode `cook`; task folder lấy từ argument; đường dẫn tuyệt đối của workspace; nguyên văn mọi input người dùng chỉ đưa trong hội thoại (SRS dán vào, câu trả lời, CR, link Figma); và toàn bộ mục "Hướng dẫn mode" bên dưới.
2. Khi agent trả về, gọi MCP tool `fe_validate_workflow` cho task. Nếu `FAILED`, gửi danh sách lỗi cho chính agent đó để sửa; không tự sửa thay.
3. Trả lời người dùng ngắn gọn: artifact đã cập nhật, blocker nếu có, và dòng `Tiếp theo: <next_prompt>` lấy từ `tracking/workflow-status.md` (hoặc MCP tool `fe_next_step`).

Không tự chuyển sang mode kế tiếp.

## Hướng dẫn mode
Dùng skill `frontend-delivery-standard` trong `implementation-mode` cho: $ARGUMENTS

Trước khi code, đọc `task.md`, `workflow-status.md`, `questions.md`, `implementation-plan.md`, `build-checklist.md`, và Figma summary nếu có. Không build nếu còn blocker hoặc gate chưa pass.

Output bắt buộc: code changes, `planning/build-checklist.md`, `tracking/workflow-status.md`.

## Chặn cook khi còn câu hỏi blocking

Trước khi code, nếu `fe_begin_mode` báo `BỊ CHẶN`, hoặc `planning/questions.md` còn câu hỏi blocking open, hoặc `workflow-status.md` có `blocking_questions_open > 0`, `input_sync_required: true`, `plan_recheck_required_after_input_sync: true`, hay `questions_resolution_gate_status` chưa `passed/not_required`: phải dừng và cập nhật `Prompt bước tiếp theo` thành `FE input-sync <task-folder> <answer-or-cr>`. Không được code.

## Scope

Chỉ sửa file nằm trong bảng `File sẽ tạo / cập nhật` của `implementation-plan.md`. Cần sửa file khác thì dừng, cập nhật plan qua `FE input-sync`/`FE plan` trước. Trước khi kết thúc, gọi MCP tool `fe_scope_diff` và xử lý mọi file bị báo ngoài plan.

## Ghi chú lỗi API và hiển thị FE

`implementation-plan.md` phải đã quyết định rõ Error DTO/status/error code map sang UI nào (inline field error, form alert, toast/snackbar core, page error, redirect hoặc fallback). Cook triển khai đúng quyết định đó — không tự ý đổi cách hiển thị lỗi khi đang code. Nếu plan chưa quyết định rõ, dừng lại và quay về `FE plan` để bổ sung, không tự quyết định trong lúc cook. Ưu tiên dùng core component/hook có sẵn trong source; custom UI chỉ dùng khi plan đã ghi rõ lý do và evidence.

## Ghi chú feature source pattern

`feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin; không copy pattern xấu.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
