# Cài đặt

Có 4 đường cài, chọn theo công cụ team đang dùng.

---

## 1. Claude Code plugin (khuyến nghị cho team dùng Claude Code)

Cài 1 lần, tự động có: skill `frontend-delivery-standard`, 10 slash command, 6 subagent.

```bash
# trong phiên Claude Code
/plugin marketplace add your-org/frontend-delivery-agent-kit
/plugin install frontend-delivery@frontend-delivery
```

Hoặc từ terminal:

```bash
claude plugin marketplace add your-org/frontend-delivery-agent-kit
claude plugin install frontend-delivery@frontend-delivery
```

Sau khi cài, command được namespace theo tên plugin:

```
/frontend-delivery:fe:plan docs/frontend-tasks/FE-123-abc
/frontend-delivery:fe:cook docs/frontend-tasks/FE-123-abc
```

### Bắt cả team tự có marketplace (không cần ai gõ lệnh add)

Commit file này vào repo dự án — thành viên trust folder là tự có:

```json
// .claude/settings.json
{
  "extraKnownMarketplaces": {
    "frontend-delivery": {
      "source": {
        "source": "github",
        "repo": "your-org/frontend-delivery-agent-kit"
      }
    }
  },
  "enabledPlugins": {
    "frontend-delivery@frontend-delivery": true
  }
}
```

### Repo private

Claude Code dùng git credential helper sẵn có. Nếu dùng GitHub HTTPS, chạy `gh auth setup-git` một lần. Với SSH, cần key đã nạp vào `ssh-agent`.

### Cập nhật

```bash
/plugin marketplace update frontend-delivery
/plugin update frontend-delivery@frontend-delivery
```

⚠️ `version` trong `core/plugin.json` là tín hiệu cập nhật — **phải bump mỗi lần release**, nếu không user giữ bản cache cũ.

---

## 2. CLI `fe-kit` (cần cho `new-task`, `validate-*`, CI)

Plugin ở trên chỉ mang skill/command/agent. CLI dùng để tạo task folder và chạy gate trong CI:

```bash
git clone https://github.com/your-org/frontend-delivery-agent-kit
cd frontend-delivery-agent-kit
npm install

node bin/fe-kit.mjs init --target /path/to/your-project --agents all
node bin/fe-kit.mjs doctor --target /path/to/your-project --strict
```

Cài toàn cục cho tiện:

```bash
npm install -g /path/to/frontend-delivery-agent-kit
fe-kit new-task FE-123-ten-task
```

---

## 3. Adapter khác (Codex / Cursor / Copilot / ChatGPT)

`fe-kit init --agents <list>` copy adapter tương ứng vào repo dự án:

| Agent | Giá trị `--agents` | File được cài |
|---|---|---|
| Claude Code | `claude` | `.claude/`, `CLAUDE.md` |
| Codex | `codex` | `.codex/`, `AGENTS.md` |
| Cursor | `cursor` | `.cursor/rules/*.mdc` |
| GitHub Copilot | `github` | `.github/copilot-instructions.md`, `.github/instructions/` |

```bash
node bin/fe-kit.mjs init --target /path/to/project --agents cursor,github
```

**ChatGPT Skill:** chạy `npm run pack:chatgpt` rồi upload `dist/chatgpt-skill.zip` lên ChatGPT Skills UI.

---

## 4. Dùng trong CI

`.github/workflows/frontend-delivery-standard.yml` được `fe-kit init --agents github` copy sang repo dự án, tự validate task folder nào thay đổi trong PR.

---

## Nên cài cái nào?

| Nhu cầu | Cài |
|---|---|
| Chỉ cần slash command + skill trong Claude Code | Cách 1 |
| Cần tạo task folder, chạy gate, CI | Cách 1 + 2 |
| Team dùng Cursor/Copilot/Codex | Cách 2 + 3 |
| Toàn bộ, nhiều agent | Cách 2 rồi `init --agents all` |
