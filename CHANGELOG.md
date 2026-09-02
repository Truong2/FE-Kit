# Changelog

Mọi thay đổi đáng chú ý của Frontend Delivery Agent Kit được ghi tại đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/), version theo [SemVer](https://semver.org/lang/vi/).

Nhật ký phát triển nội bộ trước bản phát hành đầu tiên được lưu ở `CHANGELOG-dev-history.md`.

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

- Claude Code plugin qua marketplace: `/plugin marketplace add <owner>/<repo>` rồi `/plugin install frontend-delivery@frontend-delivery`. Hướng dẫn publish đầy đủ trong `PUBLISH.md`.
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
