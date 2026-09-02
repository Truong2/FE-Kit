# Cài đặt

Có 4 đường cài, chọn theo công cụ team đang dùng.

---

## 1. Claude Code plugin (khuyến nghị cho team dùng Claude Code)

Cài 1 lần, tự động có: skill `frontend-delivery-standard`, 11 slash command, 6 subagent.

### Chọn phạm vi cài: tất cả dự án hay chỉ 1 dự án?

Cả `marketplace add` lẫn `install` đều nhận `--scope`, mặc định là `user`:

| `--scope` | Khai báo vào | Có tác dụng ở | Commit được? |
|---|---|---|---|
| `user` (mặc định) | `~/.claude/` (ngoài repo) | **Tất cả dự án** trên máy bạn | Không |
| `project` | `<repo>/.claude/settings.json` | **Chỉ repo đó**, cho cả team | Có — commit là cả team có |
| `local` | `<repo>/.claude/settings.local.json` | **Chỉ repo đó**, chỉ máy bạn | Không (nằm trong `.gitignore`) |

#### Cách A — dùng cho tất cả dự án (mặc định)

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

Gõ `/fe:plan` ở bất kỳ repo nào cũng có. Hợp với người làm nhiều dự án frontend.

#### Cách B — chỉ 1 dự án, cả team dùng chung (`--scope project`)

Chạy **tại thư mục gốc của repo dự án**:

```bash
claude plugin marketplace add your-org/frontend-delivery-agent-kit --scope project
claude plugin install fe@frontend-delivery --scope project
```

Hai lệnh này ghi vào `<repo>/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "frontend-delivery": {
      "source": { "source": "github", "repo": "your-org/frontend-delivery-agent-kit" }
    }
  },
  "enabledPlugins": {
    "fe@frontend-delivery": true
  }
}
```

**Commit file này** — ai clone repo và trust folder là tự có `/fe:*`, không phải gõ lệnh cài. Đây là cách đảm bảo cả team dùng đúng một version. Bạn cũng có thể tự viết tay file trên thay vì chạy 2 lệnh.

#### Cách C — chỉ 1 dự án, chỉ mình bạn (`--scope local`)

```bash
claude plugin marketplace add your-org/frontend-delivery-agent-kit --scope local
claude plugin install fe@frontend-delivery --scope local
```

Ghi vào `<repo>/.claude/settings.local.json` — file này không commit, nên dùng khi bạn muốn thử kit trong một repo mà chưa muốn áp cho cả team.

> Lưu ý: `--scope` chỉ quyết định **nơi khai báo bật plugin**. Bản clone marketplace và bản cache plugin luôn nằm ở `~/.claude/plugins/` dùng chung cho mọi scope.

### Command sau khi cài

Cú pháp `<tên plugin>@<tên marketplace>`: plugin tên `fe`, nằm trong marketplace tên `frontend-delivery`.

Command dùng namespace `fe`:

```text
/fe:new-task FE-123-abc
/fe:plan docs/frontend-tasks/FE-123-abc
/fe:cook docs/frontend-tasks/FE-123-abc
/fe:review docs/frontend-tasks/FE-123-abc
/fe:pr docs/frontend-tasks/FE-123-abc
```

Slash command của plugin luôn có dạng `/<name trong plugin.json>:<tên file trong commands/>`. Plugin này đặt `name: "fe"` và để file phẳng `plan.md`, `cook.md`… nên ra `/fe:plan`, `/fe:cook` — trùng đúng cú pháp với bản cài project-level qua CLI (`fe-kit init --agents claude`), khỏi phải nhớ 2 kiểu gõ.

`commands/` trong plugin chỉ nhận file `.md` phẳng — thư mục con bị Claude Code hiểu là skill (phải có `SKILL.md`) và bỏ qua, nên không thể tạo namespace lồng nhau bằng cách đặt `commands/fe/plan.md`.

### Bắt cả team tự có marketplace (không cần ai gõ lệnh add)

Xem [Cách B](#cách-b--chỉ-1-dự-án-cả-team-dùng-chung---scope-project) ở trên: commit `<repo>/.claude/settings.json` có `extraKnownMarketplaces` + `enabledPlugins`, thành viên clone repo và trust folder là tự có `/fe:*`.

### Repo private

Claude Code dùng git credential helper sẵn có. Nếu dùng GitHub HTTPS, chạy `gh auth setup-git` một lần. Với SSH, cần key đã nạp vào `ssh-agent`.

### Cập nhật, gỡ, kiểm tra

```bash
/plugin marketplace update frontend-delivery
/plugin update fe@frontend-delivery
```

`update`, `uninstall`, `disable` cũng nhận `--scope` và **mặc định là `user`** — cài ở scope nào thì phải gỡ ở đúng scope đó:

```bash
claude plugin list                                   # xem đang cài gì, scope nào
claude plugin uninstall fe@frontend-delivery --scope project
claude plugin disable fe@frontend-delivery --scope local   # tắt tạm, không gỡ
```

Gỡ nhầm scope sẽ báo lỗi kiểu *"Plugin is enabled at project scope (.claude/settings.json, shared with your team)"* — đọc thông báo để biết nó đang bật ở đâu.

⚠️ `version` trong `core/plugin.json` là tín hiệu cập nhật — **phải bump mỗi lần release**, nếu không user giữ bản cache cũ.

⚠️ Ai đã cài bản cũ (plugin tên `frontend-delivery`, command `/frontend-delivery:fe-plan`) phải gỡ rồi cài lại, vì đổi tên plugin nghĩa là Claude Code coi đây là plugin khác — `update` không tự chuyển:

```bash
/plugin uninstall frontend-delivery@frontend-delivery
/plugin marketplace update frontend-delivery
/plugin install fe@frontend-delivery
```

Nếu bản cũ cài ở scope `project`/`local` thì thêm `--scope` tương ứng, và nhớ xoá entry `frontend-delivery@frontend-delivery` còn sót trong `.claude/settings.json` của repo.

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

**Nếu đã cài plugin ở cách 1 thì `--agents claude` là thừa** — nó copy thêm `.claude/commands/fe/*.md` vào repo dự án, tạo ra bộ `/fe:*` thứ hai trùng tên với plugin. Nội dung hai bên sinh từ cùng `core/commands/` nên chạy vẫn đúng, nhưng danh sách slash command sẽ hiện trùng. Team dùng plugin nên init bằng `--agents codex,cursor,github` (hoặc bỏ hẳn `claude`) và chỉ lấy `.frontend-delivery/rules/` + `docs/frontend-context/` từ CLI.

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

Và trong cách 1, chọn phạm vi:

| Nhu cầu | `--scope` |
|---|---|
| Mình bạn dùng, ở mọi repo frontend | `user` (mặc định) |
| Cả team dùng, chỉ trong 1 repo, muốn commit để ai clone cũng có | `project` |
| Chỉ mình bạn, chỉ 1 repo, không đụng file chung của team | `local` |
