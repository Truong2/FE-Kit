# Question Resolution Contract

Áp dụng khi chạy `FE plan`, `FE input-sync`, `FE cook`, `FE quick`, `FE review` và `FE pr`.

- Nếu `planning/questions.md` có bất kỳ câu hỏi blocking đang `Open`/`Pending`/`Blocked` thì `workflow-status.md` phải đặt `blocker: true`, `build_ready: false`, `questions_status: open` hoặc `blocked`, `input_sync_required: true`, `plan_recheck_required_after_input_sync: true`, `next_mode: input-sync` và `next_prompt: "FE input-sync <task-folder> <answer-or-cr>"`.
- Không được route sang `FE cook`, `FE quick`, `FE test`, `FE review` hoặc `FE pr` khi còn câu hỏi blocking/open.
- `FE input-sync` là bước bắt buộc để nhận câu trả lời/CR, cập nhật `tracking/input-sync-report.md`, cập nhật `planning/questions.md`, cập nhật `planning/implementation-plan.md` và `planning/build-checklist.md` nếu có impact.
- Chỉ được route sang `FE cook` khi `blocking_questions_open: 0`, `questions_resolution_gate_status: passed` hoặc `not_required`, `input_sync_required: false`, `plan_recheck_required_after_input_sync: false`, và plan/checklist đã đồng bộ với câu trả lời mới.
- Non-blocking question không chặn cook nếu plan đã ghi giả định mặc định và impact thấp.
