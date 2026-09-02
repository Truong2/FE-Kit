# Câu hỏi cần xác nhận

## Mục đích

File này chỉ chứa câu hỏi cần external confirmation để gửi đúng bên trả lời. Không hỏi lại thông tin đã rõ trong SRS. Nếu SRS đã mô tả rõ API req/res/DTO/error/context thì reference SRS trong plan/checklist thay vì hỏi.

## Quy tắc route câu hỏi

- Source code conflict với SRS → hỏi Dev.
- SRS mơ hồ về business behavior, permission, acceptance criteria hoặc user journey → hỏi BA/PM.
- API request/response/error DTO/status code/pagination/enum thiếu, mâu thuẫn hoặc chưa rõ kỹ thuật → hỏi BE/API.
- Error message wording, user-facing copy, khi nào toast/khi nào inline/form/page error chưa rõ về nghiệp vụ → hỏi BA/PM.
- Error DTO/status/code/payload, fieldErrors format hoặc backend message contract chưa rõ → hỏi BE/API.
- Source đã có core toast/form alert/page error component nhưng conflict với SRS/Figma/requirement → hỏi Dev hoặc Design/Dev.
- Cần tạo custom UI error thay vì dùng core component có sẵn → hỏi Design/Dev hoặc Dev nếu là technical constraint.
- Figma conflict với behavior trong SRS → hỏi BA/PM.
- Figma conflict với source design system/component implementation → hỏi Design/Dev.
- Thiếu visual state trong Figma → hỏi Design; nếu state ảnh hưởng behavior thì hỏi BA/PM.
- Nếu SRS/source đã rõ, không hỏi; reference section SRS/source path trong `task.md`, `implementation-plan.md` và `build-checklist.md`.

## Gate sang bước tiếp theo

- Nếu có bất kỳ câu hỏi blocking ở trạng thái `Open`, `Pending` hoặc `Blocked`, `tracking/workflow-status.md` phải set `blocker: true`, `build_ready: false`, `questions_status: open/blocked`, `blocking_questions_open` đúng số lượng, `input_sync_required: true`, `plan_recheck_required_after_input_sync: true`, `next_mode: input-sync`, `next_prompt: "FE input-sync <task-folder> <answer-or-cr>"`.
- Không được gợi ý `FE cook` cho tới khi `FE input-sync` cập nhật câu trả lời, đóng câu hỏi blocking, cập nhật plan/checklist nếu có impact và set `questions_resolution_gate_status: passed`.
- Câu hỏi non-blocking không chặn cook nếu plan ghi rõ giả định mặc định và impact thấp.

## Câu hỏi blocking

| ID | Bên trả lời | Hạng mục | Ưu tiên | Bằng chứng nguồn | Conflict / thiếu thông tin | Câu hỏi | Quyết định cần có | Ảnh hưởng nếu chưa rõ | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
|  | Dev / BA/PM / BE/API / Design / Design/Dev / PM |  | Cao |  |  |  |  |  | Open |

## Câu hỏi non-blocking

| ID | Bên trả lời | Hạng mục | Ưu tiên | Bằng chứng nguồn | Thiếu thông tin | Câu hỏi | Giả định mặc định | Trạng thái |
|---|---|---|---|---|---|---|---|---|
|  | Dev / BA/PM / BE/API / Design / Design/Dev / PM |  | Trung bình |  |  |  |  | Open |

## Quyết định đã xác nhận

| ID | Bên trả lời | Quyết định | Ngày | Áp dụng cho | Hành động tiếp theo |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
