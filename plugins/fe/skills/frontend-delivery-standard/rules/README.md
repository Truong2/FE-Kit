# Frontend Delivery Rules

Folder này là rule mặc định dùng chung cho ChatGPT, Claude, Codex, Cursor và GitHub Copilot.

## Thứ tự đọc theo nhu cầu

1. `core.md` — luôn áp dụng.
2. `mode-output-contract.md` — luôn áp dụng theo mode.
3. `plan-input-ledger-contract.md`, `question-resolution-contract.md` — `FE plan` phải ghi đủ input vào `workflow-status.md` cho các mode sau.
4. `efficiency-budget-contract.md` — luôn áp dụng để tiết kiệm token/context.
5. `srs-api-contract.md` — khi task có SRS/API/logic.
6. `figma-ui-contract.md` — khi task có UI/Figma.
7. `clean-code-contract.md` — khi cook/review/quick/bugfix.
8. `evidence-scope-contract.md` — khi cook/review/test/figma-review/pr.
9. `review-bug-contract.md` — khi review/bugfix/PR.
10. `vietnamese-output.md` — luôn áp dụng.

Rule priority: SRS/API → Figma → `.frontend-delivery/rules/*` → `docs/frontend-context/design-context.md` → `docs/frontend-context/project-source-context.md` → `docs/frontend-context/feature-source-context.md` nếu có feature mẫu đáng tin → source code hiện có → agent assumption.
9. `question-resolution-contract.md` — khi plan/questions/input-sync quyết định có được sang cook không.
