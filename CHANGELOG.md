# Changelog

Mọi thay đổi đáng chú ý của Frontend Delivery Agent Kit được ghi tại đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/), version theo [SemVer](https://semver.org/lang/vi/).

Nhật ký phát triển nội bộ trước bản phát hành đầu tiên được lưu ở `CHANGELOG-dev-history.md`.

## [2.0.0] — 2026-10-05

Đưa kiến trúc orchestrator–worker và "gate được thực thi" mô tả trong `ARCHITECTURE.md` thành cơ chế chạy thật.

### Breaking

- **Plugin `fe` là kênh duy nhất cho Claude Code.** `fe-kit init --agents claude` không còn copy `.claude/commands/fe/`, `.claude/agents/`, `.claude/skills/` vào repo dự án; init chỉ ghi `CLAUDE.md`, `.claude/rules/` và bật `fe@frontend-delivery` trong `.claude/settings.json`. Repo đã init bằng v1.x cần xoá ba thư mục trên (`doctor` báo `TRÙNG` cho tới khi xoá).
- Payload init chuyển vào `core/adapters/<agent>/`; repo kit không còn `.claude/`, `.codex/`, `.cursor/`, `AGENTS.md` ở gốc. `.codex/prompts/` do `init` sinh trực tiếp từ `core/commands/`.
- `fe-kit init` chạy từ `standalone/fe-kit.mjs` (hoặc `bin/fe-kit.mjs` trong repo kit đã `npm install`). Bản `bin/fe-kit.mjs` trong repo dự án không chạy `init`.

### Thực thi gate

- **Delegation thật:** 9 command theo mode được chèn đoạn "Điều phối (Claude Code)" — main thread delegate cho đúng subagent `fe:frontend-*`, chuyển nguyên văn input trong chat, rồi gọi `fe_validate_workflow`. `quick` và `new-task` chạy inline.
- **Hook runtime** (`plugins/fe/hooks/`): ghi nhớ mode theo phiên; chặn agent không phải developer sửa source; chặn cook/bugfix/quick sửa source khi gate chưa mở; hỏi người dùng khi agent bật `human_override: true`; không cho mode kết thúc khi `workflow-status.md` chưa cập nhật, sai `current_mode`, thiếu artifact hoặc fail validator. Mức `FE_KIT_HOOKS=off|warn|enforce`, mặc định `warn`.
- **MCP tool mới:** `fe_begin_mode` (verdict gate + artifact bắt buộc + nguyên văn rule của mode, ưu tiên `.frontend-delivery/rules/` của repo rồi tới bản trong plugin), `fe_scope_diff`, `fe_new_task`.
- **Subagent** viết lại: prompt đầy đủ theo vai, giao thức chung `core/agents/_protocol.md`, preload skill, dùng `disallowedTools` thay whitelist `tools:` để thừa hưởng Skill, MCP của kit và Figma MCP.

### Validator tự tính sự thật

- Scope diff tính từ `git diff` so với bảng "File sẽ tạo / cập nhật" của plan (`validate-pr`, `fe_scope_diff`, hook khi kết thúc cook/bugfix/quick).
- Command evidence đọc từ bảng `Command evidence log` của `output/test-summary.md`.
- Bảng chuyển mode và `evaluateModeEntry`; `next_mode` lạ chỉ cảnh báo. Còn Critical/High mà route sang test/pr là lỗi.
- Một `evaluatePrGates` cho cả CLI và script; trước đây CLI từ chối `command_evidence_status: passed` mà script chấp nhận.
- CLI bỏ parser frontmatter regex (không đọc được CRLF), dùng gray-matter như validators.

### Tương thích ngược của schema

- Không xoá field nào. Field tự khai (`token_budget_status`, `required_files_read_status`, `scope_diff_status`, `command_evidence_status`, `test_command_log_status`, `playwright_screenshot_diff_status`, trạng thái artifact theo mode…) thành optional và không còn là điều kiện của `build_ready`.
- Thêm giá trị `partial`, `manual_review`, `waived`, `substituted` mà template và PR validator đã dùng từ v1.x.

### Phân phối

- CLI bundle standalone: chạy trong repo dự án không cần `node_modules`, version được nhúng lúc build.
- `init` không đè `docs/frontend-context/*`; `CLAUDE.md`/`AGENTS.md` chỉ thay khối `fe-kit:start…end`. `--agents github` không còn rò `kit-ci.yml` của kit.
- Một version duy nhất từ `package.json`, generator đồng bộ sang mọi manifest. `.gitattributes` ép LF; generator so sánh sau khi chuẩn hoá CRLF.
- `doctor` kiểm tra plugin đã bật và báo bản copy v1.x gây trùng.

### Test và eval

- Test mới cho bảng chuyển mode, scope diff, gate PR, resolver, hook (chạy bản bundle với payload JSON qua stdin) và CLI (bundle trong repo tạm không có `node_modules`).
- Eval hành vi `evals/` cho `claude plugin eval` (plan route input-sync, cook từ chối khi blocked, input-sync đóng gate, review tạo report); workflow `plugin-evals.yml` chạy tay.
- Kit CI chạy thêm `claude plugin validate` và `doctor --strict` trên repo tạm.

## [1.1.0] — 2026-09-02

### Breaking — plugin đổi tên, slash command ngắn lại

- Plugin đổi tên `frontend-delivery` → `fe`, file command bỏ prefix `fe-`. Slash command nay là `/fe:plan`, `/fe:cook`, `/fe:new-task`… thay cho `/frontend-delivery:fe-plan`. Namespace của plugin luôn là `<name trong plugin.json>:<tên file trong commands/>`, nên đặt `name: "fe"` + file phẳng `plan.md` cho ra `/fe:plan` — trùng cú pháp với bản cài project-level, khỏi nhớ 2 kiểu gõ.
- Lệnh cài đổi thành `/plugin install fe@frontend-delivery`. Tên marketplace giữ nguyên `frontend-delivery`.
- Thư mục `plugins/frontend-delivery/` đổi thành `plugins/fe/` để khớp `name` (convention của mọi marketplace chính thức: `name` = tên thư mục `source`).
- **Ai đã cài bản 1.0.0 phải gỡ rồi cài lại** — đổi tên nghĩa là Claude Code coi đây là plugin khác, `/plugin update` không tự chuyển. Xem `INSTALL.md`.
- Cảnh báo: nếu đã chạy `fe-kit init --agents claude` thì bản project-level cũng sinh `/fe:*` trùng tên với plugin. Nội dung sinh từ cùng `core/commands/` nên chạy vẫn đúng, chỉ hiện trùng trong danh sách command.

### Sửa lỗi

- `build/generate-adapters.mjs` bị lặp nguyên khối `COMMAND_CODEX_NAME` + `generateCommands` (lọt vào qua một lần merge), làm `npm run build` và `npm run build:check` chết ngay khi Node parse module với `SyntaxError: Identifier 'COMMAND_CODEX_NAME' has already been declared`.
- `fe-kit new-task` trên Windows ghi path dạng `docs\frontend-tasks\...` vào scalar YAML nháy kép trong `workflow-status.md`, khiến `\f` thành escape sequence không hợp lệ và `validate-workflow` không parse được frontmatter. Path ghi vào artifact nay luôn chuẩn hoá về dấu `/`.
- Subagent `frontend-figma-specialist` và `frontend-release-manager` có dấu `:` + khoảng trắng trong `description` chưa đóng nháy (`evidence: screenshot`, `readiness: pr-summary`), làm YAML frontmatter parse lỗi và agent load với metadata rỗng — mất cả khai báo `tools:`. Đã đóng nháy description.
- Command `quick.md` thiếu hẳn frontmatter nên không có `description`, đồng thời heading `# FE quick` bị lặp 2 lần trong bản sinh cho Codex. Đã thêm frontmatter và bỏ heading thừa.
- `claude plugin validate ./plugins/fe` nay pass sạch.

### Cải thiện

- `generate-adapters` tự xoá file `.md` thừa trong `commands/` của plugin, tránh để lại slash command mồ côi khi đổi tên hoặc bỏ lệnh; `--check` báo lỗi nếu còn file thừa.
- `INSTALL.md`, `README.md`, `QUICKSTART.md`, `PUBLISH.md`: bổ sung hướng dẫn chọn phạm vi cài — `--scope user` (mọi dự án, mặc định), `--scope project` (`<repo>/.claude/settings.json`, commit để cả team có), `--scope local` (`<repo>/.claude/settings.local.json`, không commit).
- `README.md` và `QUICKSTART.md` trước đây không hề nhắc tới đường cài bằng plugin, nay có đầy đủ.
- Sửa số lệnh ghi sai (10 → 11) và bổ sung `new-task` vào mô tả plugin/marketplace.

## [1.0.0] — 2026-09-02

Bản phát hành đầu tiên cho team.

### Quy trình

- 11 lệnh FE: `new-task`, `plan`, `quick`, `input-sync`, `figma`, `figma-review`, `cook`, `review`, `bugfix`, `test`, `pr`.
- Task folder chuẩn: `task.md`, `planning/implementation-plan.md`, `planning/build-checklist.md`, `planning/questions.md`, `tracking/workflow-status.md`, cùng các artifact conditional theo mode.
- `tracking/workflow-status.md` là state file duy nhất chứa `Prompt bước tiếp theo` — mọi lệnh đều in bước kế tiếp đọc trực tiếp từ đây.
- Blocking-question gate: còn câu hỏi blocking/open trong `questions.md` thì bắt buộc route sang `FE input-sync`, không cho sang `FE cook`.
- Các gate khác: SRS/API contract, Figma UI contract, evidence & scope diff, review bug severity, PR readiness.

### Kiểm soát bằng máy

- `packages/validators` — Zod schema 63 field cho `workflow-status.md`, parse bằng `gray-matter`, logic gate tập trung một nguồn (`gates.mjs`).
- CLI `fe-kit`: `init`, `doctor`, `new-task`, `next`, `validate-task`, `validate-workflow`, `validate-pr`.
- GitHub Actions `kit-ci.yml`: chạy test, kiểm tra drift codegen, và smoke test CLI.
- 12 test Vitest kèm fixtures cho các nhánh gate chính.

### Kiến trúc

- `core/` là nguồn duy nhất; toàn bộ adapter sinh ra bằng `npm run build`. `npm run build:check` chặn drift trong CI.
- 6 subagent theo mô hình orchestrator–worker, khai báo `tools:` least-privilege theo vai trò. Xem `ARCHITECTURE.md`.
- Rule loading theo mode (progressive disclosure) để tiết kiệm context.

### MCP server

- Plugin bundle sẵn MCP server (`.mcp.json` + file standalone, không cần node_modules), expose 5 tool cho agent: `fe_validate_task`, `fe_validate_workflow`, `fe_next_step`, `fe_task_status`, `fe_list_tasks`.
- Nhờ vậy cài plugin là chạy được gate ngay, không phải clone repo kit và `npm install` CLI riêng — mọi người dùng chung một logic gate.
- Tool chặn path traversal: task path bắt buộc nằm trong workspace.

### Phân phối

- Claude Code plugin qua marketplace: `/plugin marketplace add <owner>/<repo>` rồi `/plugin install fe@frontend-delivery`. Plugin tên `fe` nên slash command là `/fe:plan`, `/fe:cook`… trùng cú pháp với bản cài project-level. Hướng dẫn publish đầy đủ trong `PUBLISH.md`.
- CLI `fe-kit init --agents ...` cho Claude Code, Codex, Cursor, GitHub Copilot.
- ChatGPT Skill đóng gói qua `npm run pack:chatgpt`.
- Hướng dẫn đầy đủ trong `INSTALL.md`.

### Chuẩn nội dung

- Toàn bộ artifact và phản hồi viết bằng tiếng Việt có dấu (`rules/vietnamese-output.md`).
- Giữ nguyên không dấu cho code identifier, path, command, API field, DTO, error code, route, package và trích dẫn nguyên văn từ SRS.

### Giấy phép

- MIT.

### Cần thay trước khi phát hành nội bộ

- Placeholder `your-org`, `frontend-platform@example.com`, và dòng copyright trong `LICENSE` phải đổi sang thông tin thật của công ty.
