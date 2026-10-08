# Cài đặt

Có 4 đường cài, chọn theo công cụ team đang dùng.

Repo chính thức: [`Truong2/FE-Kit`](https://github.com/Truong2/FE-Kit). Marketplace tên `frontend-delivery`, plugin tên `fe`; định danh cài đặt là `fe@frontend-delivery`. Máy dùng kit cần Git và Node.js từ `18.17` trở lên; cách 1 cần Claude Code.

---

## 1. Claude Code plugin (khuyến nghị cho team dùng Claude Code)

Cài 1 lần, tự động có: skill `frontend-delivery-standard`, 11 slash command, 6 subagent.

### Chọn phạm vi cài: tất cả dự án hay chỉ 1 dự án?

Cả `marketplace add` lẫn `install` đều nhận `--scope`, mặc định là `user`:

| `--scope` | Khai báo vào | Có tác dụng ở | Commit được? |
|---|---|---|---|
| `user` (mặc định) | `~/.claude/` (ngoài repo) | **Tất cả dự án** trên máy bạn | Không |
| `project` | `<repo>/.claude/settings.json` | **Chỉ repo đó**, chia sẻ cấu hình cho team | Có — mỗi máy vẫn cần cài plugin |
| `local` | `<repo>/.claude/settings.local.json` | **Chỉ repo đó**, chỉ máy bạn | Không (nằm trong `.gitignore`) |

#### Cách A — dùng cho tất cả dự án (mặc định)

```text
# trong phiên Claude Code
/plugin marketplace add Truong2/FE-Kit
/plugin install fe@frontend-delivery
```

Hoặc từ terminal:

```bash
claude plugin marketplace add Truong2/FE-Kit --scope user
claude plugin install fe@frontend-delivery --scope user
```

Gõ `/fe:plan` ở bất kỳ repo nào cũng có. Hợp với người làm nhiều dự án frontend.

Trong phiên tương tác, `/plugin install` mở giao diện để chọn phạm vi và xác nhận cài. Sau khi cài bằng terminal, mở phiên mới hoặc chạy `/reload-plugins`. Xem [hướng dẫn chính thức của Claude Code](https://code.claude.com/docs/en/discover-plugins).

#### Cách B — chỉ 1 dự án, cả team dùng chung (`--scope project`)

Chạy **tại thư mục gốc của repo dự án**:

```bash
claude plugin marketplace add Truong2/FE-Kit --scope project
claude plugin install fe@frontend-delivery --scope project
```

Hai lệnh này ghi vào `<repo>/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "frontend-delivery": {
      "source": { "source": "github", "repo": "Truong2/FE-Kit" }
    }
  },
  "enabledPlugins": {
    "fe@frontend-delivery": true
  }
}
```

**Commit file này** để chia sẻ nguồn marketplace và cấu hình bật plugin. Cấu hình không tải plugin về máy từng thành viên: mỗi người chạy `claude plugin install fe@frontend-delivery --scope project` một lần tại repo dự án; nếu marketplace chưa được nhận diện thì chạy thêm lệnh `marketplace add` ở trên. Bạn cũng có thể tự tạo cấu hình JSON này thay vì dùng lệnh, rồi cài plugin trên từng máy. Cấu hình trên không ghim version của plugin.

#### Cách C — chỉ 1 dự án, chỉ mình bạn (`--scope local`)

```bash
claude plugin marketplace add Truong2/FE-Kit --scope local
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

### Chia sẻ cấu hình marketplace cho team

Làm theo Cách B: commit `.claude/settings.json` có `extraKnownMarketplaces` và `enabledPlugins`. Thành viên clone repo vẫn cần cài plugin trên máy mình bằng lệnh cài ở scope `project`.

### Repo private

Claude Code dùng git credential helper sẵn có. Nếu dùng GitHub HTTPS, chạy `gh auth setup-git` một lần. Với SSH, cần key đã nạp vào `ssh-agent`.

### Cập nhật, gỡ, kiểm tra

```bash
claude plugin marketplace update frontend-delivery
claude plugin update fe@frontend-delivery --scope user
```

Với `update` và `uninstall`, scope mặc định là `user`. Chỉ định đúng scope đã cài; ví dụ cài cho team thì cập nhật bằng `claude plugin update fe@frontend-delivery --scope project`. Sau cập nhật, mở phiên mới hoặc dùng `/reload-plugins`. Kiểm tra và quản lý plugin bằng:

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

### Hook và mức thực thi

Plugin kèm hook chặn gate lúc chạy (sửa source sai vai, cook khi còn câu hỏi blocking, kết thúc mode khi chưa cập nhật `workflow-status.md`). Mức thực thi đặt bằng biến môi trường:

| `FE_KIT_HOOKS` | Hành vi |
|---|---|
| `warn` (mặc định) | Chỉ cảnh báo |
| `enforce` | Từ chối tool call và chặn kết thúc mode (tối đa một lần mỗi lần dừng) |
| `off` | Tắt hook |

Đặt cho cả team trong `.claude/settings.json` của repo: `"env": { "FE_KIT_HOOKS": "enforce" }`.

---

## 2. `fe-kit init` (rule, context, CLI cho CI)

Ví dụ dùng repo dự án ở `../du-an-frontend` tính từ thư mục `FE-Kit`; thay bằng đường dẫn dự án thật của bạn. Đặt đường dẫn có dấu cách trong dấu ngoặc kép.

```bash
git clone https://github.com/Truong2/FE-Kit.git
cd FE-Kit
node standalone/fe-kit.mjs init --target ../du-an-frontend --agents all

cd ../du-an-frontend
node bin/fe-kit.mjs doctor --strict
node bin/fe-kit.mjs new-task FE-123-ten-task
```

`standalone/fe-kit.mjs` là bản bundle, không cần `npm install`. `init` copy bản này vào `bin/fe-kit.mjs` của repo dự án; bản copy chạy `new-task`, `status`, `next`, `validate-*`, `mode begin|end`, `report`, `doctor` nhưng không chạy `init` (init luôn chạy từ repo kit). `mode begin|end` là gate mở/kết thúc mode cho Codex, Cursor, Copilot; `report` tổng hợp `tracking/run-log.jsonl` của các task.

Với adapter Claude, `init` chỉ ghi cấu hình marketplace/plugin vào `.claude/settings.json`, không tải plugin. Trên mỗi máy chưa cài, thực hiện cách 1. Sau init, điền thông tin thật vào `docs/frontend-context/*.md` trước khi lập plan.

| Loại file | Hành vi khi init lại |
|---|---|
| `.frontend-delivery/rules/`, `templates/`, `bin/fe-kit.mjs`, adapter rules | Ghi đè (kit quản lý) |
| `docs/frontend-context/*`, `.frontend-delivery/standard.yaml` | Chỉ tạo khi chưa có |
| `CLAUDE.md`, `AGENTS.md` | Chỉ thay khối giữa `<!-- fe-kit:start -->` và `<!-- fe-kit:end -->`, giữ phần team tự viết |

---

## 3. Adapter theo agent

| Agent | Giá trị `--agents` | File được cài |
|---|---|---|
| Claude Code | `claude` | `CLAUDE.md`, `.claude/rules/`, bật `fe@frontend-delivery` trong `.claude/settings.json` |
| Codex | `codex` | `AGENTS.md`, `.codex/rules/`, `.codex/prompts/` (sinh từ `core/commands`) |
| Cursor | `cursor` | `.cursor/rules/*.mdc` |
| GitHub Copilot | `github` | `.github/copilot-instructions.md`, `.github/instructions/`, PR template, workflow validate task |

Từ v2.0.0 `--agents claude` **không** copy commands/agents/skill nữa — chúng đến từ plugin. Repo đã init bằng v1.x còn `.claude/commands/fe/`, `.claude/agents/frontend-*.md`, `.claude/skills/frontend-delivery-standard/` thì xoá đi; `doctor` báo `TRÙNG` cho đến khi xoá xong.

**ChatGPT Skill:** tại thư mục `FE-Kit`, chạy `npm ci`, rồi `npm run pack:chatgpt` và upload `dist/chatgpt-skill.zip` vào giao diện hỗ trợ cài Skill.

---

## 4. Dùng trong CI

`.github/workflows/frontend-delivery-standard.yml` (cài bởi `--agents github`) chạy `doctor --strict` và validate mọi task folder thay đổi trong PR. `validate-pr` so `git diff` với nhánh đích của PR (tự đọc `GITHUB_BASE_REF`) để phát hiện file sửa ngoài plan.

---

## Nên cài cái nào?

| Nhu cầu | Cài |
|---|---|
| Chỉ cần slash command + skill trong Claude Code | Cách 1 |
| Cần tạo task folder, chạy gate, CI | Cách 1 + 2 |
| Team dùng Cursor/Copilot/Codex | Cách 2 + 3 |
| Toàn bộ, nhiều agent | Cách 2 với `--agents all`; thêm cách 1 trên mỗi máy dùng Claude |

Và trong cách 1, chọn phạm vi:

| Nhu cầu | `--scope` |
|---|---|
| Mình bạn dùng, ở mọi repo frontend | `user` (mặc định) |
| Cả team dùng trong 1 repo, commit cấu hình và cài plugin trên từng máy | `project` |
| Chỉ mình bạn, chỉ 1 repo, không đụng file chung của team | `local` |
