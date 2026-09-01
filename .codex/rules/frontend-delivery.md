# Frontend Delivery Rules for Codex

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

Codex phải áp dụng rule chung trong `.frontend-delivery/rules/`. Khi dùng prompt trong `.codex/prompts/`, không chỉ trả lời trong chat; phải tạo/cập nhật artifact bắt buộc theo mode và `tracking/workflow-status.md`.

Đọc tối thiểu:

- `.frontend-delivery/rules/core.md`
- `.frontend-delivery/rules/mode-output-contract.md`
- `.frontend-delivery/rules/plan-input-ledger-contract.md`
- `.frontend-delivery/rules/efficiency-budget-contract.md`
- `.frontend-delivery/rules/srs-api-contract.md`
- `.frontend-delivery/rules/clean-code-contract.md`
- `.frontend-delivery/rules/evidence-scope-contract.md`
- `.frontend-delivery/rules/vietnamese-output.md`
- Nếu còn câu hỏi blocking/open trong `planning/questions.md`, prompt tiếp theo phải là `FE input-sync`; không được sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
