# Review, bugfix, test và PR

## FE review là bước tạo artifact bắt buộc

Khi chạy `FE review <task-folder>`, agent không được chỉ trả lời trong chat. Agent phải luôn tạo hoặc cập nhật:

- `output/review-report.md`
- `tracking/workflow-status.md`

Nếu phát hiện issue/bug, agent phải tạo hoặc cập nhật thêm:

- `tracking/review-bugs.md`

## Review report

`output/review-report.md` phải ghi rõ:

- kết quả review: Đạt / Cần bugfix / Bị chặn / Không đủ evidence
- SRS/API/Figma/rule contract đã kiểm tra
- issue phát hiện nếu có
- evidence file/code/screenshot/test liên quan
- kết luận có được chuyển sang `FE test` hay không

## Review bugs

`tracking/review-bugs.md` chỉ tạo khi có issue. File này theo dõi bug lifecycle từ review sang bugfix. Mỗi bug phải có:

- ID `BUG-xxx`
- severity: Critical / High / Medium / Low
- nhóm: SRS / API / UI / Figma / State / Clean code / Test
- expected / actual
- file/evidence
- owner
- trạng thái: Open / Fixed / Waived / Blocked
- prompt xử lý tiếp theo

Critical/High còn open thì block PR.

## Workflow status sau review

Sau mỗi review, `tracking/workflow-status.md` phải update:

- `current_mode: review-mode`
- `review_status: passed | needs_bugfix | blocked | insufficient_evidence`
- `review_report_status: created | updated`
- `review_bug_status: none | open | fixed | waived | blocked`
- `critical_issues_open`
- `high_issues_open`
- `medium_issues_open`
- `low_issues_open`
- `bugfix_required`
- `next_mode`
- `next_prompt`

Nếu không có bug: next thường là `FE test <task-folder>`.
Nếu có Critical/High: next phải là `FE bugfix <task-folder>`, `FE input-sync <task-folder>` hoặc `FE figma-review <task-folder>` tùy nguyên nhân.

## Test và PR

`FE test` phải ghi evidence test thật hoặc lý do chưa chạy. `FE pr` chỉ pass khi không còn blocker, Critical/High issue, bug mở, thiếu review report hoặc thiếu test/Figma evidence bắt buộc.
