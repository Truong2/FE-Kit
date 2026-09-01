# Claude Frontend Delivery Kit

## Bắt buộc

- Mọi artifact `.md` phải viết bằng tiếng Việt có dấu đầy đủ.
- Không mode nào được kết thúc chỉ bằng chat response.
- Mọi mode phải cập nhật `tracking/workflow-status.md`.
- `FE plan` phải cập nhật Input ledger trong `tracking/workflow-status.md` với đầy đủ input để các mode sau biết cần đọc gì.
- Rule mặc định nằm trong `.frontend-delivery/rules/`.
- `docs/frontend-context/feature-source-context.md` chỉ dùng cho feature mẫu/cách code feature mẫu nếu có.
- Cache marker: `vi-diacritics-rules-folder-v1.0.0`.

Claude adapter: đọc thêm `.claude/rules/frontend-delivery.md` và command trong `.claude/commands/fe/`.

## Token/evidence gates

- Áp dụng `.frontend-delivery/rules/efficiency-budget-contract.md` để chỉ đọc file cần thiết theo mode.
- Áp dụng `.frontend-delivery/rules/evidence-scope-contract.md` khi cook/review/test/figma-review/pr.
- Không claim test/lint/typecheck/build pass nếu chưa chạy thật.
- Không sửa file ngoài plan nếu chưa update plan/input-sync.
- Nếu còn câu hỏi blocking/open trong `planning/questions.md`, prompt tiếp theo phải là `FE input-sync`; không được sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
