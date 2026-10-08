# Frontend Delivery Agent Kit

Bộ chuẩn frontend delivery tiếng Việt cho ChatGPT Skill, Claude Code, Codex, Cursor và GitHub Copilot.

Version: 2.3.0

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

## Cài đặt nhanh

Chi tiết đầy đủ (4 đường cài, repo private, CI) xem [INSTALL.md](INSTALL.md).

Tên dùng trong các lệnh bên dưới đã điền theo repo và manifest hiện tại:

| Thành phần | Tên |
|---|---|
| Repo GitHub | [`Truong2/FE-Kit`](https://github.com/Truong2/FE-Kit) |
| Thư mục sau khi clone | `FE-Kit` |
| Marketplace | `frontend-delivery` |
| Plugin | `fe` — cài bằng `fe@frontend-delivery` |
| Namespace command | `/fe:*` |

Máy dùng kit cần Git, Node.js từ `18.17` trở lên để chạy CLI/MCP/hook; cài Claude Code nếu chọn cách 1. Bản CLI standalone đã được bundle, không cần `npm install` để chạy `init`.

### Cách 1 — Claude Code plugin (khuyến nghị cho team dùng Claude Code)

Cài plugin để có skill `frontend-delivery-standard`, 11 slash command, 6 subagent, MCP server validator và hook kiểm tra gate lúc chạy. Hook mặc định chỉ cảnh báo. Cơ chế chi tiết: [ARCHITECTURE.md](ARCHITECTURE.md).

**Dùng cho tất cả dự án trên máy bạn** — chạy trong terminal (scope `user`):

```bash
claude plugin marketplace add Truong2/FE-Kit --scope user
claude plugin install fe@frontend-delivery --scope user
claude plugin list
```

Hoặc trong phiên Claude Code:

```text
/plugin marketplace add Truong2/FE-Kit
/plugin install fe@frontend-delivery
```

Trong giao diện cài plugin, chọn phạm vi phù hợp. Sau khi cài bằng terminal, mở phiên Claude Code mới hoặc dùng `/reload-plugins` trong phiên đang mở. Xem [hướng dẫn cài plugin của Claude Code](https://code.claude.com/docs/en/discover-plugins).

**Chỉ 1 dự án, cả team dùng chung** — chạy tại thư mục gốc repo dự án:

```bash
claude plugin marketplace add Truong2/FE-Kit --scope project
claude plugin install fe@frontend-delivery --scope project
```

Hai lệnh ghi `extraKnownMarketplaces` và `enabledPlugins` vào `.claude/settings.json` của dự án. Commit file này để chia sẻ cấu hình. Mỗi thành viên vẫn cần chạy `claude plugin install fe@frontend-delivery --scope project` một lần trên máy mình; nếu marketplace chưa được nhận diện thì chạy thêm lệnh `marketplace add` ở trên. Muốn chỉ mình bạn dùng trong repo đó thì đổi cả hai lệnh sang `--scope local` (ghi vào `.claude/settings.local.json`, không commit).

Chi tiết cả 3 scope: [INSTALL.md](INSTALL.md).

Cài xong gõ command với namespace `fe`:

```text
/fe:new-task FE-123-abc
/fe:plan docs/frontend-tasks/FE-123-abc
/fe:cook docs/frontend-tasks/FE-123-abc
```

Các mode chuyên biệt được giao cho subagent `fe:frontend-*`; `new-task` và `quick` chạy trực tiếp trong phiên chính. Hook mặc định ở mức `warn`; đặt `FE_KIT_HOOKS=enforce` để bật cưỡng chế, `off` để tắt.

Cập nhật (nhớ `--scope` đúng với lúc cài, mặc định là `user`):

```bash
claude plugin marketplace update frontend-delivery
claude plugin update fe@frontend-delivery --scope user
```

Nếu cài ở scope `project` hoặc `local`, thay `--scope user` bằng scope đó. Sau cập nhật, mở phiên Claude Code mới hoặc chạy `/reload-plugins`.

### Cách 2 — `fe-kit init` (rule/context/CI cho repo dự án)

Ví dụ dưới đây dùng repo dự án ở `../du-an-frontend` tính từ thư mục `FE-Kit`. Thay đường dẫn này bằng repo dự án của bạn; đường dẫn có dấu cách cần đặt trong dấu ngoặc kép.

```bash
git clone https://github.com/Truong2/FE-Kit.git
cd FE-Kit
node standalone/fe-kit.mjs init --target ../du-an-frontend --agents all
cd ../du-an-frontend
node bin/fe-kit.mjs doctor --strict
```

`init` ghi `.frontend-delivery/rules/`, `.frontend-delivery/templates/`, `docs/frontend-context/` (không đè file team đã sửa), CLI standalone `bin/fe-kit.mjs` và adapter của từng agent. Với `claude`, init ghi `CLAUDE.md`, `.claude/rules/` và cấu hình marketplace/plugin trong `.claude/settings.json`; commands/agents/skill đến từ plugin. `init` không tải plugin: cài theo cách 1 trên từng máy nếu chưa cài. Sau đó điền context dự án trong `docs/frontend-context/`.

### Cách 3 — adapter khác

Từ thư mục `FE-Kit`, chọn adapter cần dùng:

```bash
node standalone/fe-kit.mjs init --target ../du-an-frontend --agents codex,cursor,github
```

ChatGPT Skill: cài dependency trong repo `FE-Kit` bằng `npm ci`, chạy `npm run pack:chatgpt`, rồi upload `dist/chatgpt-skill.zip` vào giao diện hỗ trợ cài Skill. Chi tiết: [INSTALL.md](INSTALL.md).

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
