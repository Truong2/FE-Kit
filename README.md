# Frontend Delivery Agent Kit

Bộ chuẩn frontend delivery tiếng Việt cho ChatGPT Skill, Claude Code, Codex, Cursor và GitHub Copilot.

Version: 1.0.0

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

## Kiến trúc repo (dành cho người maintain kit)

```text
core/                     # NGUỒN DUY NHẤT — sửa ở đây
  rules/                  # rule mặc định dùng chung cho các agent
  templates/              # template task folder
  standards/              # tài liệu chuẩn chi tiết theo mode
  docs/                   # docs/frontend-context mặc định
  scripts/                # nguồn validator script (bundle bằng esbuild)
  skill-package.json      # package.json mẫu cho skill folder

packages/validators/       # Zod schema + gray-matter parser + gate logic dùng chung
  src/{schema,parse,gates,index}.mjs
  test/                    # Vitest, chạy `npm test`

bin/fe-kit.mjs             # CLI, import từ @frontend-delivery-kit/validators (npm workspace)

build/
  generate-adapters.mjs    # core/ -> rules/, templates/, docs/, .claude/skills/*, chatgpt-skill/*
  pack-chatgpt-skill.mjs   # đóng gói dist/chatgpt-skill.zip lúc release
```

**Quy tắc bắt buộc:** không sửa tay `rules/`, `templates/`, `docs/`, `standards/` ở top-level hay trong `.claude/skills/frontend-delivery-standard/`, `chatgpt-skill/frontend-delivery-standard/` — các thư mục này là output generate. Sửa trong `core/` rồi chạy:

```bash
npm install        # lần đầu, link npm workspace
npm run build       # sinh lại rules/templates/docs/scripts/package.json ở mọi đích
npm run build:check # CI dùng cái này để chặn PR nếu quên chạy build
npm test             # chạy Vitest cho packages/validators
```

## Cấu trúc rule/context (khi đã cài vào project của team)

```text
.frontend-delivery/
  rules/                 # rule mặc định dùng chung cho các agent
docs/frontend-context/
  README.md
  project-source-context.md
  feature-source-context.md
  design-context.md
```

`feature-source-context.md` chỉ dùng để mô tả feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin. Rule bắt buộc nằm trong `.frontend-delivery/rules/`.

## Cài vào project

```bash
npm install                                        # lần đầu (link workspace, cài zod/gray-matter)
node bin/fe-kit.mjs init --target /path/to/project --agents all
```

## Mode chính

- `FE plan <task-folder>`
- `FE input-sync <task-folder> <answer-or-cr>`
- `FE figma <task-folder> <figma-link>`
- `FE cook <task-folder>`
- `FE review <task-folder>`
- `FE bugfix <task-folder>`
- `FE test <task-folder>`
- `FE figma-review <task-folder>`
- `FE pr <task-folder>`
- `FE quick <task-folder>`

Mọi mode phải cập nhật artifact bắt buộc và `tracking/workflow-status.md`.

## Token/evidence gates

- Agent phải đọc đúng file cần thiết theo mode, không đọc/copy toàn bộ context nếu không cần.
- Trước PR phải có scope diff passed/not_required và command evidence completed/not_required.
- Với UI/Figma, Playwright screenshot diff là ưu tiên; nếu chưa có setup thì ghi manual/static evidence và lý do.


Ghi chú v1.0.0: Câu hỏi blocking/open trong `planning/questions.md` sẽ chặn `FE cook`; `workflow-status.md` bắt buộc route sang `FE input-sync` cho tới khi câu trả lời được đồng bộ vào questions/plan/checklist và `questions_resolution_gate_status: passed`. Xem `CHANGELOG.md` để biết chi tiết thay đổi so với bản 0.1.16.
