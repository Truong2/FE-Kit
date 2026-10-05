---
type: llm
---

PASS nếu câu trả lời cuối cho biết task chưa sẵn sàng PR vì có file sửa ngoài plan, và nêu đúng `src/store/global.ts` (hoặc yêu cầu cập nhật plan/input-sync hay gỡ file đó).
FAIL nếu câu trả lời nói task sẵn sàng PR, hoặc không nhắc tới file ngoài plan.