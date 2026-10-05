# Quickstart

Version: 2.1.0

## Cài Claude Code plugin

Dùng cho **tất cả dự án** trên máy (mặc định):

```bash
# trong phiên Claude Code
/plugin marketplace add your-org/frontend-delivery-agent-kit
/plugin install fe@frontend-delivery
```

Terminal: `claude plugin marketplace add …` rồi `claude plugin install fe@frontend-delivery`.

Chỉ áp cho **1 dự án** thì chạy tại thư mục gốc repo với `--scope project` (ghi vào `<repo>/.claude/settings.json`, commit là cả team có) hoặc `--scope local` (ghi vào `.claude/settings.local.json`, không commit):

```bash
claude plugin marketplace add your-org/frontend-delivery-agent-kit --scope project
claude plugin install fe@frontend-delivery --scope project
```

Cài xong là có 11 command namespace `fe`:

```text
/fe:new-task FE-123-task-name
/fe:plan docs/frontend-tasks/FE-123-task-name
/fe:cook docs/frontend-tasks/FE-123-task-name
/fe:review docs/frontend-tasks/FE-123-task-name
/fe:pr docs/frontend-tasks/FE-123-task-name
```

Mỗi command được delegate cho subagent `fe:frontend-*` tương ứng; MCP tool `fe_begin_mode` kiểm tra gate trước khi làm. Hook mặc định ở mức `warn`; đặt `FE_KIT_HOOKS=enforce` để chặn thật.

Cập nhật: `/plugin marketplace update frontend-delivery` rồi `/plugin update fe@frontend-delivery`.

## Thêm rule, context và CLI cho repo dự án

```bash
git clone <kit-repo-url> && cd frontend-delivery-agent-kit
node standalone/fe-kit.mjs init --target /path/to/your-project --agents all
cd /path/to/your-project && node bin/fe-kit.mjs doctor --strict
```

Sau init, rule mặc định nằm trong `.frontend-delivery/rules/` (override bản trong plugin). Context riêng của project nằm trong `docs/frontend-context/`. Init lại không đè file context team đã sửa.

Đầy đủ các đường cài (plugin, init, adapter Codex/Cursor/Copilot/ChatGPT, CI) xem [INSTALL.md](INSTALL.md).

`feature-source-context.md` chỉ mô tả feature mẫu/cách code feature mẫu nếu có. Không đặt rule chung trong file này.

## Phát triển kit (maintainer)

```bash
npm install          # npm workspaces, esbuild, vitest
npm run build        # sinh lại mọi đích từ core/
npm run build:check  # kiểm tra core/ đã đồng bộ chưa (CI dùng lệnh này)
npm test             # validators + hook + CLI bundle
```

**Không sửa tay** output generate (`plugins/fe/`, `chatgpt-skill/`, `standalone/`, `rules/`, `templates/`, `docs/` top-level) — sửa trong `core/` rồi chạy `npm run build`.

## Token/evidence gates

- Agent phải đọc đúng file cần thiết theo mode, không đọc/copy toàn bộ context nếu không cần.
- Trước PR, scope diff được tính từ `git diff` so với plan, và `output/test-summary.md` phải có lệnh đã chạy thật.
- Với UI/Figma, Playwright screenshot diff là ưu tiên; nếu chưa có setup thì ghi manual/static evidence và lý do.

Câu hỏi blocking/open trong `planning/questions.md` chặn `FE cook`; `workflow-status.md` bắt buộc route sang `FE input-sync` cho tới khi câu trả lời được đồng bộ vào questions/plan/checklist và `questions_resolution_gate_status: passed`. Xem `CHANGELOG.md`.
