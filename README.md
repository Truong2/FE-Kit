# Frontend Delivery Agent Kit

Bộ chuẩn frontend delivery tiếng Việt cho ChatGPT Skill, Claude Code, Codex, Cursor và GitHub Copilot.

Version: 2.0.1

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

## Cài đặt nhanh

Chi tiết đầy đủ (4 đường cài, repo private, CI) xem [INSTALL.md](INSTALL.md).

### Cách 1 — Claude Code plugin (khuyến nghị cho team dùng Claude Code)

Cài 1 lần là có luôn skill `frontend-delivery-standard`, 11 slash command, 6 subagent, MCP server validator và hook chặn gate lúc chạy. Cơ chế chi tiết: [ARCHITECTURE.md](ARCHITECTURE.md).

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

Mỗi command được delegate cho subagent `fe:frontend-*` tương ứng. Hook mặc định ở mức `warn`; đặt `FE_KIT_HOOKS=enforce` để chặn thật, `off` để tắt.

Cập nhật (nhớ `--scope` đúng với lúc cài, mặc định là `user`):

```bash
/plugin marketplace update frontend-delivery
/plugin update fe@frontend-delivery
```

### Cách 2 — `fe-kit init` (rule/context/CI cho repo dự án)

```bash
git clone https://github.com/your-org/frontend-delivery-agent-kit
cd frontend-delivery-agent-kit
node standalone/fe-kit.mjs init --target /path/to/project --agents all
cd /path/to/project && node bin/fe-kit.mjs doctor --strict
```

`init` ghi `.frontend-delivery/rules|templates`, `docs/frontend-context/` (không đè file team đã sửa), CLI standalone `bin/fe-kit.mjs` (chạy không cần `node_modules`) và adapter của từng agent. Với `claude`, init chỉ ghi `CLAUDE.md`, `.claude/rules/` và bật plugin `fe` trong `.claude/settings.json` — commands/agents/skill đến từ plugin, không còn copy vào repo.

### Cách 3 — adapter khác

`--agents codex,cursor,github` cài adapter Codex/Cursor/Copilot. ChatGPT Skill: `npm run pack:chatgpt` rồi upload `dist/chatgpt-skill.zip`.

## Kiến trúc repo (dành cho người maintain kit)

```text
core/                     # NGUỒN DUY NHẤT — sửa ở đây
  SKILL.md                # skill frontend-delivery-standard
  commands/               # 11 slash command (generator chèn đoạn delegation cho plugin)
  agents/                 # 6 subagent + _protocol.md dùng chung
  hooks/                  # hook runtime (bundle) + hooks.json
  mcp/server.mjs          # MCP server: fe_begin_mode, fe_validate_*, fe_scope_diff, fe_new_task...
  rules/ templates/ standards/ docs/ scripts/
  adapters/<agent>/       # payload `fe-kit init` cho claude/codex/cursor/github

packages/validators/       # schema, parser, gate, bảng mode, scope diff, scaffold — dùng chung
bin/fe-kit.mjs             # nguồn CLI; bản bundle standalone/fe-kit.mjs được copy vào repo dự án
evals/                     # eval hành vi plugin (claude plugin eval --eval-dir evals)
tests/                     # test hook và CLI trên bản bundle

build/generate-adapters.mjs  # core/ -> plugins/fe, chatgpt-skill, standalone, rules/templates/docs top-level
```

**Quy tắc bắt buộc:** không sửa tay output generate (`plugins/fe/`, `chatgpt-skill/`, `standalone/`, `rules/`, `templates/`, `docs/` top-level). Sửa trong `core/` hoặc `packages/validators/` rồi chạy:

```bash
npm install          # lần đầu
npm run build        # sinh lại mọi đích, đồng bộ version từ package.json
npm run build:check  # CI chặn PR nếu quên build
npm test             # validators + hook + CLI bundle
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
- Trước PR, scope diff được tính từ `git diff` so với bảng "File sẽ tạo / cập nhật" của plan, và `output/test-summary.md` phải có lệnh đã chạy thật.
- Với UI/Figma, Playwright screenshot diff là ưu tiên; nếu chưa có setup thì ghi manual/static evidence và lý do.


Ghi chú v1.0.0: Câu hỏi blocking/open trong `planning/questions.md` sẽ chặn `FE cook`; `workflow-status.md` bắt buộc route sang `FE input-sync` cho tới khi câu trả lời được đồng bộ vào questions/plan/checklist và `questions_resolution_gate_status: passed`. Từ v2.0.0 gate này còn được thực thi bằng `fe_begin_mode` và hook. Xem `CHANGELOG.md`.
