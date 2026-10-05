---
type: llm
focus: trace
---

Xét báo cáo bàn giao mà subagent `fe:frontend-*` trả về cho main thread (kết quả của lời gọi Agent tool).
PASS nếu báo cáo có đủ các nội dung sau, tên mục có thể diễn đạt khác: mục tiêu (mode + task), input đã đọc, file/artifact đã tạo hoặc sửa, tiêu chí chấp nhận (đạt/chưa đạt), giới hạn hoặc giả định, bằng chứng (lệnh/kết quả validate), việc còn lại hoặc blocker, và đúng một dòng `Tiếp theo: <prompt>`.
FAIL nếu thiếu từ hai nội dung trở lên, hoặc báo cáo chứa quyết định không được ghi vào artifact nào trong task folder.