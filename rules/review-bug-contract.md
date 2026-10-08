# Review/Bug Contract

- `FE review` luôn tạo/cập nhật `output/review-report.md`.
- Nếu có issue/bug, tạo/cập nhật `tracking/review-bugs.md`.
- Bug phải có severity, evidence, file liên quan, expected/actual, owner và next action.
- `Nhóm`: `srs-logic`, `api-contract`, `error-handling`, `ui-figma`, `state-data`, `a11y`, `performance`, `clean-code`, `test`, `scope`, `other`.
- `Nguyên nhân gốc`: `requirement-unclear`, `plan-gap`, `implementation-error`, `missing-test`, `figma-mismatch`, `rule-violation`, `environment`, `other`.
- `critical_issues_open`/`high_issues_open` phải khớp số issue đang mở trong bảng; validator tự đếm và báo lệch.
- Critical/High issue block PR.
- Review đối chiếu các claim ở mục `Kiểm chứng claim` của plan với diff thật. Claim không còn đúng (symbol không tồn tại, luồng khác, owner của state khác, consumer bị ảnh hưởng mà plan không nêu) được ghi thành issue có evidence.
- Nếu bug cần đổi requirement/SRS/Figma, route next prompt sang `FE input-sync` hoặc `FE figma-review`.
- `FE pr` chỉ ready khi review/test/UI evidence đủ và không còn Critical/High.
