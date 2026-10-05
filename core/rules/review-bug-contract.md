# Review/Bug Contract

- `FE review` luôn tạo/cập nhật `output/review-report.md`.
- Nếu có issue/bug, tạo/cập nhật `tracking/review-bugs.md`.
- Bug phải có severity, evidence, file liên quan, expected/actual, owner và next action.
- Critical/High issue block PR.
- Review đối chiếu các claim ở mục `Kiểm chứng claim` của plan với diff thật. Claim không còn đúng (symbol không tồn tại, luồng khác, owner của state khác, consumer bị ảnh hưởng mà plan không nêu) được ghi thành issue có evidence.
- Nếu bug cần đổi requirement/SRS/Figma, route next prompt sang `FE input-sync` hoặc `FE figma-review`.
- `FE pr` chỉ ready khi review/test/UI evidence đủ và không còn Critical/High.
