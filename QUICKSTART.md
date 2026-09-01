# Quickstart

Version: 1.0.0

## Cài dùng ngay (team dùng kit)

```bash
git clone <kit-repo-url> && cd frontend-delivery-agent-kit
npm install
node bin/fe-kit.mjs init --target /path/to/your-project --agents all
node bin/fe-kit.mjs doctor --target /path/to/your-project --strict
node bin/fe-kit.mjs new-task FE-123-task-name --target /path/to/your-project
```

Sau init, rule mặc định nằm trong `.frontend-delivery/rules/`. Context riêng của project nằm trong `docs/frontend-context/`.

`feature-source-context.md` chỉ mô tả feature mẫu/cách code feature mẫu nếu có. Không đặt rule chung trong file này.

## Phát triển kit (maintainer)

```bash
npm install          # link npm workspace, cài zod/gray-matter/esbuild/vitest
npm test              # chạy Vitest cho packages/validators
npm run build          # sinh lại rules/templates/docs/scripts từ core/
npm run build:check    # kiểm tra core/ đã đồng bộ chưa (CI dùng lệnh này)
```

**Không sửa tay** `rules/`, `templates/`, `docs/`, `standards/`, `scripts/` ở `.claude/skills/`, `chatgpt-skill/`, hay top-level — sửa trong `core/` rồi chạy `npm run build`.

## Token/evidence gates

- Agent phải đọc đúng file cần thiết theo mode, không đọc/copy toàn bộ context nếu không cần.
- Trước PR phải có scope diff passed/not_required và command evidence completed/not_required.
- Với UI/Figma, Playwright screenshot diff là ưu tiên; nếu chưa có setup thì ghi manual/static evidence và lý do.

Ghi chú v1.0.0: Câu hỏi blocking/open trong `planning/questions.md` sẽ chặn `FE cook`; `workflow-status.md` bắt buộc route sang `FE input-sync` cho tới khi câu trả lời được đồng bộ vào questions/plan/checklist và `questions_resolution_gate_status: passed`. Xem `CHANGELOG.md`.
