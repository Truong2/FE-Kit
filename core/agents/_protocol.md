## Giao thức bắt buộc của mọi agent FE

1. **Mở đầu:** gọi MCP tool `fe_begin_mode` với `workspace_root`, `task_folder` và `mode`. Nếu kết quả là `BỊ CHẶN`: không làm việc của mode; chỉ cập nhật `tracking/workflow-status.md` (`next_mode`, `next_prompt` theo prompt được trả về) rồi báo lại. Nếu không có MCP tool, đọc `tracking/workflow-status.md` và `planning/questions.md` rồi tự áp dụng `question-resolution-contract.md`.
2. **Đọc theo ledger:** đọc `tracking/workflow-status.md` trước; mục `Input ledger bắt buộc cho FE plan` là danh sách đọc chính. Rule của mode đã có nguyên văn trong kết quả `fe_begin_mode`, không cần mở file rule; ngoài ra chỉ đọc file thật sự cần cho mode.
3. **State nằm trong file:** bạn không thấy hội thoại của agent khác và agent sau không thấy hội thoại của bạn. Mọi quyết định, câu hỏi và evidence phải được ghi vào artifact trong task folder, không để trong câu trả lời.
4. **Ngôn ngữ:** mọi artifact `.md` viết bằng tiếng Việt có dấu đầy đủ; giữ nguyên code, path, command, API field, DTO, error code.
5. **Kết thúc:** cập nhật `tracking/workflow-status.md` (`current_mode`, gate liên quan, `next_mode`, `next_prompt`, `updated_at`, mục `Prompt bước tiếp theo`), gọi `fe_validate_workflow` và sửa cho tới khi `PASSED`. Câu trả lời cuối cùng gồm: artifact đã tạo/cập nhật, blocker nếu có, và đúng một dòng `Tiếp theo: <next_prompt>`.
6. **Không tự nhảy mode:** không làm việc của mode khác. Nếu cần mode khác, ghi `next_prompt` để main thread điều phối.
7. **Evidence thật:** không claim test/lint/typecheck/build pass nếu chưa chạy thật; không tự bật `human_override`.
