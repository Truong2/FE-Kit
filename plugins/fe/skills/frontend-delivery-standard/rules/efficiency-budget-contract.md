# Efficiency & Token Budget Contract

- Chỉ đọc file thật sự cần cho mode hiện tại; không đọc toàn bộ context/rules/source nếu không cần.
- Mỗi mode phải ghi trong plan/report các file/rule đã đọc ở mức ngắn gọn.
- Không copy nguyên SRS, Figma note hoặc rule dài vào artifact; chỉ ghi section, rule ID, node ID hoặc file path liên quan.
- `FE plan` chỉ ghi quyết định task-specific; target plan ngắn, đủ build.
- `FE cook` ưu tiên đọc: task, plan, checklist, workflow, file code liên quan, rule cần thiết; không đọc lại report dài không liên quan.
- `FE review` chỉ report issue có evidence; không mô tả lại toàn bộ plan.
- Nếu context quá lớn, dừng và đề xuất chia task hoặc chỉ xử lý module liên quan.
- `workflow-status.md` phải cập nhật `token_budget_status` và `required_files_read_status`.

- Dùng Input ledger trong `workflow-status.md` làm danh sách đọc chính trước khi mở thêm file khác.
