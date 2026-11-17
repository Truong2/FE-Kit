---
name: frontend-delivery-standard
description: dùng cho mọi yêu cầu frontend — yêu cầu mới bằng ngôn ngữ tự nhiên thì bắt đầu bằng FE task (router phân loại và chọn FE quick/FE plan); task đã có thì dùng FE plan, FE quick, FE input-sync, FE figma, FE figma-review, FE cook, FE review, FE bugfix, FE test, FE pr. Bắt buộc tiếng Việt có dấu, rules folder chung, output tối thiểu theo mode, SRS/Figma gates, token budget, scope diff, command evidence và blocking question input-sync gate. Chặn route sang cook khi còn câu hỏi blocking/open.
---

# Frontend Delivery Standard

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

Trong Claude Code: mở mode bằng `fe_begin_mode` (trả verdict gate, artifact bắt buộc và nguyên văn rule), đặt field trạng thái bằng `fe_update_status`, kết thúc bằng `fe_validate_workflow`.

## Luôn áp dụng

- Mọi câu trả lời và artifact `.md` phải viết bằng tiếng Việt có dấu đầy đủ.
- Không mode nào được kết thúc chỉ bằng chat response.
- Mọi mode phải tạo/cập nhật artifact bắt buộc và `tracking/workflow-status.md`.
- `tracking/workflow-status.md` là file duy nhất chứa `Prompt bước tiếp theo`.
- `FE plan` phải ghi đủ Input ledger trong `tracking/workflow-status.md` để các mode sau biết cần đọc input nào.
- Nếu `planning/questions.md` còn câu hỏi blocking/open, `workflow-status.md` phải route sang `FE input-sync`; không được route sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
- Không copy rule dài vào output; chỉ ghi rule ID/path và quyết định liên quan trực tiếp tới task.
- `docs/frontend-context/feature-source-context.md` chỉ mô tả feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin.

## Project context chuẩn

```text
docs/frontend-context/
  README.md
  project-source-context.md
  feature-source-context.md
  design-context.md
```

Không tạo `frontend-rule-context.md` trong `docs/frontend-context/`.

## Ai được sửa source

Chỉ `FE cook`, `FE bugfix` và `FE quick` được sửa source code của dự án, và chỉ trong các file thuộc bảng `File sẽ tạo / cập nhật` của `planning/implementation-plan.md`. Các mode còn lại chỉ ghi artifact trong `docs/frontend-tasks/` và `docs/frontend-context/`.
