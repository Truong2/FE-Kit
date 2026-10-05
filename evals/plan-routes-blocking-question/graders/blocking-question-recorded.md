---
type: llm
focus:
  source: file
  path: docs/frontend-tasks/FE-10-export/planning/questions.md
---

PASS nếu mục "Câu hỏi blocking" có ít nhất một câu hỏi ở trạng thái Open/Pending/Blocked về định dạng file, endpoint API hoặc giới hạn số dòng, và câu hỏi đó ghi bên trả lời (BA/PM hoặc BE/API).
FAIL nếu không có câu hỏi blocking đang mở nào, hoặc câu hỏi chỉ nằm ở mục non-blocking.
