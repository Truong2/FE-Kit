---
type: llm
focus:
  source: file
  path: docs/frontend-tasks/FE-30-cancel/planning/questions.md
---

PASS nếu câu hỏi Q1 không còn ở trạng thái Open/Pending/Blocked, và câu trả lời `CANCELLED` được ghi lại (trong dòng Q1 hoặc mục "Quyết định đã xác nhận").
FAIL nếu Q1 vẫn Open/Pending/Blocked, hoặc câu trả lời không được ghi ở đâu trong file.
