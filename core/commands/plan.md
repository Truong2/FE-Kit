---
description: Lập kế hoạch FE từ SRS/source/Figma, không code.
argument-hint: <task-folder> [SRS/Figma/ghi chú]
---

Dùng skill `frontend-delivery-standard` trong `planning-mode` cho: $ARGUMENTS

Input tối thiểu:

- Task folder
- SRS hoặc mô tả requirement
- Source context / project code
- Figma link nếu có UI dependency

Output phải cập nhật `task.md`, `planning/implementation-plan.md`, `planning/build-checklist.md`, `planning/questions.md`, và `tracking/workflow-status.md`.

## Input ledger bắt buộc

Sau khi chạy `FE plan`, phải cập nhật `tracking/workflow-status.md` mục `Input ledger bắt buộc cho FE plan` với đầy đủ input: task/request, SRS/API/Figma, context project/feature/design, rules và source cần inspect. Các mode sau có thể chỉ mở `workflow-status.md` trước nên không được để input chỉ nằm trong chat.

## Thiết kế trước prompt triển khai

Áp dụng ba nguyên tắc trước khi chốt plan và viết prompt triển khai:

1. **Thiết kế trước khi viết prompt:** xác định mục tiêu, ranh giới module, trách nhiệm và luồng dữ liệu/state/feedback; ghi lựa chọn cùng lý do vào plan. FE plan có thể hỗ trợ làm rõ thiết kế; chỉ chuyển sang triển khai khi phần cần quyết định đã rõ.
2. **Dùng spec làm khung:** ghi contract đầu vào/đầu ra, ràng buộc, hành vi thành công/lỗi và tiêu chí chấp nhận. Dùng ma trận trace/checklist hiện có để nối spec với code và kiểm tra; không tạo thêm spec riêng nếu input đã đủ. Input thay đổi phải được đồng bộ trước khi tiếp tục.
3. **Kiểm tra vai trò khi bỏ thành phần:** giả định bỏ thành phần để xác định hành vi, contract, khả năng quan sát hoặc cơ chế bảo vệ bị mất và cách kiểm chứng. Nếu chưa thấy ảnh hưởng, ghi ứng viên giản lược cùng bằng chứng còn thiếu, không tự động xóa hoặc coi thiếu import là đủ kết luận.

Ghi thiết kế/spec ngắn trong mục `Khung thiết kế trước triển khai` của plan; dùng ba câu hỏi bên dưới để kiểm tra quyết định cụ thể.

## Ba câu hỏi kiến trúc

Trước khi chốt kế hoạch, ghi ba câu trả lời vào `planning/implementation-plan.md`, mục `Ba câu hỏi kiến trúc` trong Code shape contract. Chỉ phân tích thành phần thuộc phạm vi task; dẫn file/symbol/cấu hình liên quan và phân biệt bằng chứng với giả định.

1. **State nằm ở đâu?** Nêu nguồn chính, owner, phạm vi và thời điểm cập nhật. State workflow nằm trong artifact theo task, có `workflow-status.md` giữ gate và bước tiếp theo. Với frontend, phân biệt UI/form/URL/server state; chọn phạm vi nhỏ nhất theo convention hiện có, tránh sao chép server state sang global store.
2. **Feedback nằm ở đâu?** Nêu artifact nhận câu trả lời/CR, lỗi review và kết quả kiểm tra; xác định vòng phát hiện → ghi bằng chứng → sửa → kiểm tra lại → đóng. Với UI, nêu nơi hiển thị loading, validation, lỗi và thành công khi áp dụng.
3. **Bỏ thành phần này thì cái gì bị ảnh hưởng?** Với thành phần định thêm/sửa/bỏ, nêu trách nhiệm, nơi phụ thuộc và hành vi/dữ liệu/public contract/gate bị ảnh hưởng. Kiểm tra cấu hình, route, script và cơ chế nạp động khi liên quan; thiếu import chưa đủ chứng minh an toàn. Không xóa thật để thử.

Ghi `Không áp dụng` kèm lý do nếu phù hợp. Phần chưa rõ chặn triển khai phải ghi vào `planning/questions.md` và áp dụng gate input-sync. Đưa quyết định cần triển khai/kiểm tra vào checklist; không thêm kiến trúc mới chỉ để trả lời ba câu hỏi.

## File sẽ tạo / cập nhật

Mục `File sẽ tạo / cập nhật` của `implementation-plan.md` phải liệt kê path thật hoặc glob cho mọi file dự kiến sửa. Validator so bảng này với `git diff` để tính scope diff ở cook/review/pr; file không có trong bảng sẽ bị báo là sửa ngoài plan.

## Gate câu hỏi blocking

Nếu tạo/cập nhật `planning/questions.md` với bất kỳ câu hỏi blocking đang `Open`/`Pending`/`Blocked`, phải cập nhật `tracking/workflow-status.md`: `blocker: true`, `build_ready: false`, `questions_status: open` hoặc `blocked`, `blocking_questions_open` đúng số lượng, `questions_resolution_gate_status: blocked`, `input_sync_required: true`, `plan_recheck_required_after_input_sync: true`, `next_mode: input-sync`, `next_prompt: "FE input-sync <task-folder> <answer-or-cr>"`. Không được gợi ý `FE cook` khi còn blocking question.

## Ghi chú lỗi API và hiển thị FE

Khi task có API/error state, plan phải quyết định rõ Error DTO/status/error code map sang UI nào: inline field error, form alert, toast/snackbar core, page error, redirect hoặc fallback. Ưu tiên dùng core component/hook có sẵn trong source; custom UI chỉ dùng khi plan ghi rõ lý do và evidence.

## Ghi chú feature source pattern

`feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin; không copy pattern xấu.

## Rule và ngôn ngữ output

Lấy danh sách rule của mode từ MCP tool `fe_begin_mode`. Nếu không có MCP, đọc `.frontend-delivery/rules/` của repo (nếu có) hoặc thư mục `rules/` của skill `frontend-delivery-standard`.

Viết bằng tiếng Việt có dấu đầy đủ. Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`
