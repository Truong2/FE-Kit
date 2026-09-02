# Changelog

Mọi thay đổi đáng chú ý của Frontend Delivery Agent Kit được ghi tại đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/), version theo [SemVer](https://semver.org/lang/vi/).

Nhật ký phát triển nội bộ trước bản phát hành đầu tiên được lưu ở `CHANGELOG-dev-history.md`.

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
