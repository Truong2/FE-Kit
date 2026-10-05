# Kế hoạch triển khai

> Token-lean template. Chỉ ghi quyết định liên quan trực tiếp tới task. Không copy rule dài; chỉ ghi rule ID/path áp dụng từ `.frontend-delivery/rules/`.

## 1. Tóm tắt phạm vi

| Mục | Nội dung |
|---|---|
| Task | <TASK_ID> |
| Mục tiêu |  |
| Ngoài phạm vi |  |
| Nguồn SRS/API/Figma |  |

## 2. Input ledger và budget đọc context/source

> Sau `FE plan`, phải mirror danh sách input này vào `tracking/workflow-status.md` để các mode sau biết cần đọc file/link/source nào.

| Hạng mục | Quyết định |
|---|---|
| SRS/requirement input |  |
| API/DTO/error input |  |
| Figma/UI input |  |
| Context project/feature/design cần đọc |  |
| Rule bắt buộc đọc |  |
| File source cần inspect |  |
| File/report không cần đọc lại |  |
| Lý do giữ token lean |  |

## 3. Ma trận trace SRS → FE logic → UI → Test

| SRS case | API/status/error | FE behavior | UI state/message | File/hook xử lý | Evidence | Status |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  | Chưa làm |

## 4. Code shape contract

### Khung thiết kế trước triển khai

Điền trước khi viết prompt triển khai. Dùng SRS/API/Figma đã rõ làm spec; chỉ ghi quyết định task-specific, dẫn nguồn và nối tiêu chí chấp nhận với ma trận trace/checklist. Không tạo thêm spec riêng hoặc chép lại toàn bộ input.

| Nội dung | Quyết định / tham chiếu |
|---|---|
| Ranh giới module, trách nhiệm và luồng dữ liệu |  |
| Contract đầu vào/đầu ra và ràng buộc phải giữ |  |
| Hành vi thành công/lỗi và tiêu chí chấp nhận |  |
| Lựa chọn thiết kế và lý do |  |

| Concern | Quyết định | File/hook/component | Rule áp dụng | Ghi chú |
|---|---|---|---|---|
| Component tree |  |  |  |  |
| Hook flow |  |  |  |  |
| API flow |  |  |  |  |
| DTO/mapper |  |  |  |  |
| Error flow |  |  |  |  |
| State ownership |  |  |  |  |
| Test/review |  |  |  |  |

### Ba câu hỏi kiến trúc

Chỉ điền nội dung thuộc phạm vi task; ghi `Không áp dụng` kèm lý do khi phù hợp. Dẫn file/symbol/cấu hình làm bằng chứng, phân biệt giả định với kết luận. Phần chưa rõ chặn triển khai phải ghi vào `planning/questions.md` và route input-sync.

| Câu hỏi | Quyết định cho task | Bằng chứng | Cách kiểm chứng |
|---|---|---|---|
| State nằm ở đâu? | Nguồn chính, owner, phạm vi, thời điểm cập nhật; phân biệt state workflow và UI/form/URL/server state |  |  |
| Feedback nằm ở đâu? | Artifact nhận feedback, vòng phát hiện → sửa → kiểm tra lại → đóng; nơi hiển thị phản hồi UI khi áp dụng |  |  |
| Bỏ thành phần này thì cái gì bị ảnh hưởng? | Thành phần định thêm/sửa/bỏ, trách nhiệm, nơi phụ thuộc, hành vi/dữ liệu/contract/gate bị ảnh hưởng |  |  |

Với câu hỏi cuối, thực hiện deletion test bằng phân tích: giả định bỏ thành phần, nêu khả năng quan sát/cơ chế bảo vệ bị mất và kiểm tra có thể phát hiện ảnh hưởng. Nếu chưa thấy ảnh hưởng, ghi ứng viên giản lược và bằng chứng còn thiếu; không xóa thật hoặc kết luận dư thừa chỉ vì không tìm thấy import.

### Kiểm chứng claim

Ghi các claim mà quyết định ở trên dựa vào, theo bốn góc. Chỉ điền góc liên quan tới rủi ro của task: task nhỏ có thể chỉ một hai dòng. Bằng chứng là `file:symbol`, endpoint hoặc config key đã mở ra xem, không phải suy đoán. Claim chưa xác minh mà ảnh hưởng triển khai phải thành câu hỏi trong `planning/questions.md` và route input-sync.

| Góc | Câu hỏi | Claim | Bằng chứng | Trạng thái |
|---|---|---|---|---|
| Tồn tại | File, symbol, endpoint, config key có thật không? |  |  | Đã xác minh / Chưa xác minh / Không áp dụng |
| Luồng xử lý | Entrypoint/caller nào dẫn tới hành vi đã mô tả? |  |  |  |
| Lifetime | State thuộc component, request, task, session hay process; ai là owner? |  |  |  |
| Contract | Consumer nào bị ảnh hưởng; thay đổi có tương thích không? |  |  |  |

## 5. Rule và feature mẫu áp dụng

| Nguồn | Nội dung áp dụng | Ghi chú |
|---|---|---|
| `.frontend-delivery/rules/` | Rule ID / nội dung ngắn |  |
| `feature-source-context.md` | Feature mẫu/cách code tham chiếu nếu có | Không áp dụng nếu source chưa có mẫu đáng tin |
| `design-context.md` | Shared UI/token/Figma rule |  |

## 6. Quyết định UI/Figma

Chỉ điền khi task có UI/Figma. Nếu không có UI/Figma, ghi `Không áp dụng`.

| Screen/state | Figma/source evidence | Component/props/token | Deviation/blocker |
|---|---|---|---|
|  |  |  |  |

## 7. File sẽ tạo / cập nhật

| File | Hành động | Lý do | Checklist ref |
|---|---|---|---|
|  |  |  |  |

## 8. Scope diff guard

| Quy tắc | Quyết định |
|---|---|
| File ngoài bảng trên có được sửa không? | Không, trừ khi update plan/input-sync trước |
| Cách kiểm tra scope diff | Review diff so với bảng file ở mục 7 |

## 9. Rủi ro / blocker

| Loại | Nội dung | Owner | Trạng thái |
|---|---|---|---|
|  |  |  |  |

## 10. Phiên bản kế hoạch

| Version | Trigger | Tóm tắt thay đổi | Trạng thái |
|---|---|---|---|
| v1 | Initial planning |  | Current |
