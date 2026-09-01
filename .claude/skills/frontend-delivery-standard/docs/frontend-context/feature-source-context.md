---
doc_name: feature-source-context
doc_version: 1.0.0
status: active
purpose: ghi feature mẫu và cách code của feature mẫu nếu source base có mẫu đáng tin
---

# Feature Source Context

File này dùng để xác định **feature mẫu** và **cách code của feature mẫu** trong source hiện có.

File này không phải rule contract. Rule bắt buộc nằm trong `.frontend-delivery/rules/`.

Nếu source base chưa có feature mẫu chuẩn, ghi rõ `Chưa có feature mẫu chuẩn` và không tự chọn bừa một module làm chuẩn.

## 1. Tình trạng feature mẫu

| Mục | Giá trị |
|---|---|
| Có feature mẫu chuẩn không? | Có / Không / Chưa xác định |
| Feature mẫu |  |
| Path feature mẫu |  |
| Lý do chọn |  |
| Mức độ tin cậy | Cao / Trung bình / Thấp |
| Không nên copy phần nào |  |

## 2. File/pattern mẫu nếu có

| Concern | File mẫu | Pattern có thể tham chiếu | Ghi chú |
|---|---|---|---|
| Page |  |  |  |
| Container/component |  |  |  |
| Query hook |  |  |  |
| Mutation hook |  |  |  |
| API service |  |  |  |
| DTO/mapper |  |  |  |
| Error display |  |  |  |
| State |  |  |  |
| UI component |  |  |  |
| Test |  |  |  |

## 3. Cách dùng trong task

- Chỉ tham chiếu feature mẫu nếu pattern trong đó sạch và phù hợp task.
- Không copy anti-pattern từ source cũ.
- Nếu feature mẫu conflict với SRS/Figma/`.frontend-delivery/rules/`, phải ưu tiên SRS/Figma/rule.
- Nếu không có feature mẫu, agent vẫn phải bám `.frontend-delivery/rules/` và inspect shared layer.
