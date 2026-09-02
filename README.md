# Frontend Delivery Agent Kit

Bộ chuẩn frontend delivery tiếng Việt cho ChatGPT Skill, Claude Code, Codex, Cursor và GitHub Copilot.

Version: 1.1.0

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

## Cài đặt nhanh

Chi tiết đầy đủ (4 đường cài, repo private, CI) xem [INSTALL.md](INSTALL.md).

### Cách 1 — Claude Code plugin (khuyến nghị cho team dùng Claude Code)

Cài 1 lần là có luôn skill `frontend-delivery-standard`, 11 slash command và 6 subagent.

**Dùng cho tất cả dự án** (mặc định — scope `user`):

```bash
# trong phiên Claude Code
/plugin marketplace add your-org/frontend-delivery-agent-kit
/plugin install fe@frontend-delivery
```

Hoặc từ terminal:

```bash
claude plugin marketplace add your-org/frontend-delivery-agent-kit
claude plugin install fe@frontend-delivery
```

**Chỉ 1 dự án, cả team dùng chung** — chạy tại thư mục gốc repo, thêm `--scope project`:

```bash
claude plugin marketplace add your-org/frontend-delivery-agent-kit --scope project
claude plugin install fe@frontend-delivery --scope project
```

Hai lệnh này ghi `extraKnownMarketplaces` + `enabledPlugins` vào `<repo>/.claude/settings.json`. Commit file đó là ai clone repo cũng có `/fe:*`, không phải cài gì thêm. Muốn chỉ mình bạn dùng trong repo đó thì đổi thành `--scope local` (ghi vào `.claude/settings.local.json`, không commit).

Chi tiết cả 3 scope: [INSTALL.md](INSTALL.md).

Cài xong gõ command với namespace `fe`:

```text
/fe:new-task FE-123-abc
/fe:plan docs/frontend-tasks/FE-123-abc
/fe:cook docs/frontend-tasks/FE-123-abc
```

Đúng cú pháp với bản cài project-level qua CLI, không phải nhớ 2 kiểu gõ.

Cập nhật (nhớ `--scope` đúng với lúc cài, mặc định là `user`):

```bash
/plugin marketplace update frontend-delivery
/plugin update fe@frontend-delivery
```

### Cách 2 — CLI `fe-kit` (cần cho `new-task`, `validate-*`, CI)

Plugin chỉ mang skill/command/agent; CLI mới tạo được task folder và chạy gate trong CI.

```bash
git clone https://github.com/your-org/frontend-delivery-agent-kit
cd frontend-delivery-agent-kit
npm install                                        # link workspace, cài zod/gray-matter
node bin/fe-kit.mjs init --target /path/to/project --agents all
node bin/fe-kit.mjs doctor --target /path/to/project --strict
```

Bản cài qua CLI cũng dùng `/fe:plan`, `/fe:cook`… Nếu đã cài plugin ở cách 1 thì bỏ `claude` khỏi `--agents` để khỏi sinh bộ command trùng tên — xem [INSTALL.md](INSTALL.md).

### Cách 3 — adapter khác

`--agents codex,cursor,github` copy adapter Codex/Cursor/Copilot vào repo dự án. ChatGPT Skill: `npm run pack:chatgpt` rồi upload `dist/chatgpt-skill.zip`.

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

## Mode chính

- `FE new-task <task-id>`
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
