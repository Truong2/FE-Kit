# Plan Input Ledger Contract

Áp dụng khi chạy `FE plan`, `FE input-sync`, `FE cook`, `FE review`, `FE test`, `FE pr`.

- `FE plan` phải ghi đầy đủ input đã đọc/cần đọc vào `tracking/workflow-status.md` mục `Input ledger bắt buộc cho FE plan`.
- Không chỉ ghi input trong chat hoặc trong `implementation-plan.md`; các mode sau có thể chỉ mở `workflow-status.md` trước.
- Input ledger tối thiểu phải cover: task/request, SRS/requirement, API/DTO/error, Figma/UI, project context, feature mẫu, design context, rules, source cần inspect, questions/input-sync nếu có.
- Nếu input không áp dụng, ghi `Không áp dụng` và lý do ngắn; không để trống làm agent sau phải đoán.
- Khi `FE input-sync` nhận CR/câu trả lời/SRS update/Figma update, phải cập nhật lại input ledger và `next_prompt` trong `workflow-status.md`.
- Nếu input ledger hoặc `questions.md` phát hiện câu hỏi blocking/open, plan phải set `next_mode: input-sync` và không được set `build_ready: true`.
