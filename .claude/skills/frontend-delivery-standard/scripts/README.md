# Scripts

Các script validator (`validate-task.mjs`, `validate-workflow.mjs`, `validate-pr.mjs`) là bản **đã bundle sẵn** (esbuild) từ nguồn `core/scripts/*.mjs` trong repo kit gốc. Chạy trực tiếp bằng `node`, **không cần** `ts-node`, **không cần** cài thêm package nào — toàn bộ dependency (`zod`, `gray-matter`) đã được đóng gói vào file trong thư mục `chunks/`.

```bash
node scripts/validate-task.mjs docs/frontend-tasks/<task>
node scripts/validate-workflow.mjs docs/frontend-tasks/<task>
node scripts/validate-pr.mjs docs/frontend-tasks/<task>
```

Hoặc qua npm script (xem `package.json` cùng cấp):

```bash
npm run validate:task -- docs/frontend-tasks/<task>
npm run validate:workflow -- docs/frontend-tasks/<task>
npm run validate:pr -- docs/frontend-tasks/<task>
```

⚠️ **Không sửa tay** các file trong thư mục này. Đây là output generate — sửa nguồn ở `core/scripts/*.mjs` trong repo kit gốc rồi chạy `npm run build` để bundle lại và đồng bộ ra cả 2 nơi (Claude skill + ChatGPT skill).

`validate-workflow.mjs` kiểm tra mapping lỗi API và quyết định hiển thị lỗi FE/toast/core component trong plan/checklist/workflow-status, cùng toàn bộ gate: plan input ledger, blocking question, token budget, scope diff, command evidence, Figma/UI evidence.
