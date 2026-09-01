# FE cook

Use `frontend-delivery-standard` in `implementation-mode`. Build only according to `planning/implementation-plan.md` and verify with `planning/build-checklist.md`.

## Chặn cook khi còn câu hỏi blocking

Trước khi code, nếu `planning/questions.md` còn câu hỏi blocking open hoặc `workflow-status.md` có `blocking_questions_open > 0`, `input_sync_required: true`, `plan_recheck_required_after_input_sync: true`, hoặc `questions_resolution_gate_status` chưa `passed/not_required`, phải dừng và cập nhật `Prompt bước tiếp theo` thành `FE input-sync <task-folder> <answer-or-cr>`. Không được code.

## Ghi chú lỗi API và hiển thị FE

`implementation-plan.md` phải đã quyết định rõ Error DTO/status/error code map sang UI nào (inline field error, form alert, toast/snackbar core, page error, redirect hoặc fallback). Build triển khai đúng quyết định đó — không tự ý đổi cách hiển thị lỗi khi đang code. Nếu plan chưa quyết định rõ, dừng lại và quay về `FE plan` để bổ sung, không tự quyết định trong lúc build. Ưu tiên dùng core component/hook có sẵn trong source; custom UI chỉ dùng khi plan đã ghi rõ lý do và evidence.

## Ghi chú feature source pattern

Trước khi plan/cook/quick/review, đọc `.frontend-delivery/rules/` như rules folder bắt buộc. `feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin; không copy pattern xấu.

## Ngôn ngữ output

Viết bằng tiếng Việt có dấu đầy đủ (theo `.frontend-delivery/rules/vietnamese-output.md`, luôn áp dụng cho toàn project). Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

