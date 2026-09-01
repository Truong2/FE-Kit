# Planning và SRS

Trong `FE plan`, không sửa source code. Agent phải đọc SRS/source/Figma, map section SRS vào `task.md`, và tạo plan/checklist/questions/status bằng tiếng Việt.

`task.md` phải có:

- Bản đồ tham chiếu SRS
- Bản đồ sử dụng API contract
- Ghi chú tương thích Source / SRS
- Tóm tắt câu hỏi
- Ghi chú triển khai / nhật ký quyết định

Nếu SRS đã rõ req/res/DTO/error/context thì không hỏi lại và không tạo file API/SRS summary riêng.


## Lỗi API và hiển thị FE

Trong planning, nếu module có API call hoặc error state, agent phải map rõ Error DTO/status/error code từ SRS/API sang cách hiển thị FE. Phải quyết định dùng inline field error, form alert, toast/snackbar core, page error, redirect hay fallback. Nếu message wording/business behavior chưa rõ thì hỏi BA/PM; nếu DTO/status/payload chưa rõ thì hỏi BE/API; nếu source core component conflict hoặc cần custom UI thì hỏi Dev hoặc Design/Dev.


## Frontend Rules Folder

Trong `FE plan`, agent phải đọc `rules/` nếu tồn tại. File này là Frontend Rules Folder: route/auth/query/mutation/API/DTO/error/state/i18n/UI/clean-code rules phải follow. Agent không được tự chọn một module bất kỳ làm chuẩn nếu source base chưa có chuẩn; phải inspect shared layer/source convention và ghi vào `implementation-plan.md` mục `Rule contract áp dụng cho implementation`. Không được tự tạo architecture mới khi chưa có pattern hoặc xác nhận từ Dev.


## SRS Scenario Trace Matrix

Nếu task có SRS/acceptance criteria, `FE plan` phải tạo `Ma trận trace SRS → FE logic → UI → Test` trong `implementation-plan.md`. Matrix phải cover happy path, validation error, business error, permission/session, loading, empty, success và network/server fallback hoặc ghi rõ `Không áp dụng`. Không được set `build_ready=true` nếu case quan trọng còn thiếu FE behavior, UI state/message, file/hook/component xử lý hoặc evidence test/review.
