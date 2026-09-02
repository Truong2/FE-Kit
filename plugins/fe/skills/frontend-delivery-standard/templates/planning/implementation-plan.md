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

| Concern | Quyết định | File/hook/component | Rule áp dụng | Ghi chú |
|---|---|---|---|---|
| Component tree |  |  |  |  |
| Hook flow |  |  |  |  |
| API flow |  |  |  |  |
| DTO/mapper |  |  |  |  |
| Error flow |  |  |  |  |
| State ownership |  |  |  |  |
| Test/review |  |  |  |  |

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
