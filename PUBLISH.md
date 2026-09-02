# Đưa kit lên Git cho team cài

## Bước 1 — Thay placeholder (bắt buộc, nếu không cài sẽ fail)

| Placeholder | Có trong | Thay bằng |
|---|---|---|
| `your-org/frontend-delivery-agent-kit` | `INSTALL.md`, `README.md`, `QUICKSTART.md`, `core/plugin.json`, `.claude-plugin/marketplace.json` | `<org>/<repo>` thật |
| `frontend-platform@example.com` | `.claude-plugin/marketplace.json` | email team thật |
| `@your-org/frontend-platform` | `CODEOWNERS` | team GitHub thật |
| `Frontend Platform Team` | `LICENSE` | pháp nhân công ty |

```bash
# đổi nhanh (kiểm tra lại sau khi chạy)
grep -rl "your-org" --include="*.json" --include="*.md" . | grep -v node_modules \
  | xargs sed -i 's|your-org/frontend-delivery-agent-kit|CONG-TY/frontend-delivery-agent-kit|g; s|@your-org/frontend-platform|@CONG-TY/frontend-platform|g'
```

Sau khi thay, chạy lại `npm run build` vì `core/plugin.json` là nguồn generate.

## Bước 2 — Push lên Git

```bash
npm install
npm test && npm run build:check   # cả hai phải xanh trước khi push

git init
git add .
git commit -m "feat: frontend delivery agent kit v1.0.0"
git remote add origin git@github.com:CONG-TY/frontend-delivery-agent-kit.git
git push -u origin main
git tag v1.0.0 && git push --tags
```

**Phải commit các thư mục generate** (`plugins/`, `.claude/`, `.codex/`, `.cursor/`, `.github/`, `rules/`, `templates/`, `standards/`, `docs/`): marketplace trỏ tới `./plugins/fe` bằng relative path, và người cài plugin không chạy `npm run build`. `.gitignore` hiện đã đúng — chỉ bỏ `node_modules`.

## Bước 3 — Team cài

Cài cho **tất cả dự án** trên máy mỗi người (scope `user`, mặc định):

```
/plugin marketplace add CONG-TY/frontend-delivery-agent-kit
/plugin install fe@frontend-delivery
/reload-plugins
```

Chỉ cài cho **một repo dự án** thì chạy tại gốc repo đó với `--scope project` (ghi vào `.claude/settings.json` của repo, commit được — xem bước 4) hoặc `--scope local` (ghi vào `.claude/settings.local.json`, không commit):

```bash
claude plugin marketplace add CONG-TY/frontend-delivery-agent-kit --scope project
claude plugin install fe@frontend-delivery --scope project
```

Cài xong mỗi người có ngay, không cần thêm bước nào:

- **11 slash command** — `/fe:new-task`, `/fe:plan`, `/fe:quick`, `/fe:input-sync`, `/fe:figma`, `/fe:figma-review`, `/fe:cook`, `/fe:review`, `/fe:bugfix`, `/fe:test`, `/fe:pr`
- **1 skill** — `frontend-delivery-standard` (rules, templates, standards)
- **6 subagent** — planner, developer, reviewer, tester, figma-specialist, release-manager
- **5 MCP tool** — `fe_validate_task`, `fe_validate_workflow`, `fe_next_step`, `fe_task_status`, `fe_list_tasks`

MCP server nằm sẵn trong plugin dưới dạng file bundle standalone, khai báo ở `.mcp.json`. Không cần cài node_modules, không cần clone repo kit.

## Bước 4 — Bật tự động cho cả team (khuyến nghị)

Commit file này vào **repo dự án** (không phải repo kit). Ai clone dự án và trust folder là tự có plugin, không phải gõ lệnh cài. Đây chính là file mà `--scope project` ở bước 3 sinh ra — bạn có thể chạy 2 lệnh đó rồi commit, hoặc viết tay:

```json
// .claude/settings.json
{
  "extraKnownMarketplaces": {
    "frontend-delivery": {
      "source": { "source": "github", "repo": "CONG-TY/frontend-delivery-agent-kit" }
    }
  },
  "enabledPlugins": { "fe@frontend-delivery": true }
}
```

Đây là cách đảm bảo **đồng nhất**: version plugin do repo kit quyết định, không ai dùng bản lệch.

## Bước 5 — Phát hành bản mới

```bash
# 1. sửa trong core/ (không sửa thư mục generate)
# 2. bump version ở 5 chỗ: kit.yaml, standard.yaml, package.json,
#    core/plugin.json, .claude-plugin/marketplace.json
# 3.
npm run build && npm test && npm run build:check
git commit -am "feat: <mô tả>" && git tag v1.0.1 && git push --follow-tags
```

⚠️ **Không bump `core/plugin.json` thì máy đã cài giữ nguyên bản cũ trong cache** và không có cảnh báo nào. Đây là lỗi âm thầm dễ mắc nhất.

Người dùng cập nhật:

```
/plugin marketplace update frontend-delivery
/plugin update fe@frontend-delivery
/reload-plugins
```

Người đã cài bản trước khi plugin đổi tên (`frontend-delivery@frontend-delivery`, command `/frontend-delivery:fe-*`) phải gỡ rồi cài lại — `update` không chuyển sang tên plugin mới:

```bash
/plugin uninstall frontend-delivery@frontend-delivery
/plugin install fe@frontend-delivery
```

## Repo private

Claude Code dùng git credential sẵn có. GitHub HTTPS: chạy `gh auth setup-git` một lần. SSH: cần key trong `ssh-agent`.

## CLI `fe-kit` — khi nào vẫn cần

Plugin đã đủ cho việc hằng ngày. CLI chỉ cần khi:

- **Khởi tạo repo dự án lần đầu**: `fe-kit init --agents claude` (tạo `.frontend-delivery/rules/`, `docs/frontend-context/`, CI workflow)
- **Chạy gate trong CI** (GitHub Actions không load plugin)
- **Dùng adapter khác**: Codex, Cursor, Copilot, ChatGPT

Xem `INSTALL.md` mục 2.
