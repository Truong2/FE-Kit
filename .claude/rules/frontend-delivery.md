# Frontend Delivery Rules for Claude

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

Claude phải áp dụng rule chung trong `.frontend-delivery/rules/`:

- `.frontend-delivery/rules/core.md`
- `.frontend-delivery/rules/mode-output-contract.md`
- `.frontend-delivery/rules/plan-input-ledger-contract.md`
- `.frontend-delivery/rules/efficiency-budget-contract.md`
- `.frontend-delivery/rules/srs-api-contract.md`
- `.frontend-delivery/rules/figma-ui-contract.md` khi task có UI/Figma
- `.frontend-delivery/rules/clean-code-contract.md`
- `.frontend-delivery/rules/evidence-scope-contract.md`
- `.frontend-delivery/rules/review-bug-contract.md` khi review/bugfix/PR
- `.frontend-delivery/rules/vietnamese-output.md`

Không được hoàn thành mode chỉ bằng chat response. Mọi mode phải cập nhật artifact bắt buộc và `tracking/workflow-status.md`.
- Nếu còn câu hỏi blocking/open trong `planning/questions.md`, prompt tiếp theo phải là `FE input-sync`; không được sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
