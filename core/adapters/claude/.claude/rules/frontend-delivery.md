# Frontend Delivery Rules for Claude

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

Claude phải áp dụng rule chung của kit. Khi chạy một mode, gọi MCP tool `fe_begin_mode`: kết quả có nguyên văn các rule áp dụng cho mode đó, lấy từ `.frontend-delivery/rules/` của repo (nếu có) hoặc từ plugin.

Danh sách rule:

- `core.md`
- `mode-output-contract.md`
- `plan-input-ledger-contract.md`
- `question-resolution-contract.md`
- `efficiency-budget-contract.md`
- `srs-api-contract.md`
- `figma-ui-contract.md` khi task có UI/Figma
- `clean-code-contract.md`
- `evidence-scope-contract.md`
- `review-bug-contract.md` khi review/bugfix/PR
- `vietnamese-output.md`

Không được hoàn thành mode chỉ bằng chat response. Mọi mode phải cập nhật artifact bắt buộc và `tracking/workflow-status.md`.

Nếu còn câu hỏi blocking/open trong `planning/questions.md`, prompt tiếp theo phải là `FE input-sync`; không được sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
