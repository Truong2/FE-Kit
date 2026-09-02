# Core Rules

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

- Không mode nào được kết thúc chỉ bằng chat response.
- Mọi mode phải tạo/cập nhật artifact bắt buộc theo `mode-output-contract.md`.
- Mọi mode phải cập nhật `tracking/workflow-status.md`.
- `tracking/workflow-status.md` là file duy nhất chứa `Prompt bước tiếp theo`.
- Mọi artifact Markdown phải viết bằng tiếng Việt có dấu đầy đủ.
- SRS/API là source of truth cho business, DTO, validation, permission và error nếu đã rõ.
- Figma là visual source of truth khi Figma gate passed.
- Source hiện có chỉ là reference; không copy pattern xấu hoặc UI source default nếu lệch SRS/Figma/rule.
- `docs/frontend-context/feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu có mẫu đáng tin.
- Artifact task phải token-lean: ghi quyết định task-specific, không copy toàn bộ rule dài.

- `FE plan` phải ghi đầy đủ Input ledger trong `tracking/workflow-status.md` để các mode sau biết cần đọc input nào.
