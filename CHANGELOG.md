# Changelog

Mọi thay đổi đáng chú ý của Frontend Delivery Agent Kit được ghi tại đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/), version theo [SemVer](https://semver.org/lang/vi/).

Nhật ký phát triển nội bộ trước bản phát hành đầu tiên được lưu ở `CHANGELOG-dev-history.md`.

## [2.2.0] — 2026-10-08

Phase 1 của [ROADMAP.md](ROADMAP.md): đo được kit đang chạy thế nào. Không đổi gate, schema `workflow-status.md` hay prompt của command/agent; hook vẫn mặc định `warn`.

### Có thể ảnh hưởng repo dự án

- **Task folder có thêm `tracking/run-log.jsonl`.** Hook, MCP và CLI tự ghi sự kiện của mode vào đây. Commit file này cùng task. Không muốn ghi thì đặt `FE_KIT_RUNLOG=off`. CLI không ghi khi `CI=true` hoặc có `--no-log`.
- `fe-kit init` thêm một dòng `merge=union` cho run-log vào `.gitattributes`.

### Run-log và báo cáo

- `packages/validators/src/runlog.mjs`: `appendRunLog` (không bao giờ throw, không tạo thư mục, ngừng ghi khi file quá 5 MB), `readRunLog` (bỏ qua dòng hỏng), schema bản ghi v1. Không ghi prompt hay nội dung file; session id được hash.
- Hook ghi `mode_start`, `entry_blocked`, `edit_denied`/`edit_warned`, `override_requested`, `mode_abandoned` và `mode_end` (`pass`/`blocked`/`released`, kèm `attempt` và `duration_ms`). MCP `fe_validate_workflow` và CLI `validate-*` ghi `validate`.
- `fe-kit report [<task>] [--since] [--json]`: tỉ lệ pass ngay lần đầu theo mode, số vòng bị chặn, lý do bị chặn nhiều nhất, thời gian mỗi mode, phân bổ theo actor.

### Reason code

- `evaluateWorkflowGates`, `evaluatePrGates`, `validateWorkflow`, `validateWorkflowAtGate`, `validatePr` trả thêm `issues: [{ code, message }]`; `errors` giữ nguyên. `evaluateModeEntry` trả thêm `reasonCodes`.

### Codex, Cursor, Copilot có gate mở/kết thúc mode

- `fe-kit mode begin <task> <mode>`: verdict gate, artifact bắt buộc và nguyên văn rule của mode, như MCP `fe_begin_mode`; exit 1 khi bị chặn.
- `fe-kit mode end <task> <mode>`: cùng gate kết thúc mode với hook của Claude Code.
- Hướng dẫn của ba adapter đổi sang dùng hai lệnh này (`--actor codex|cursor|copilot`).

### Nguồn duy nhất

- `modeBriefing` (nội dung của `fe_begin_mode`) và `evaluateModeCompletion` (gate kết thúc mode) chuyển vào validators; MCP, hook và CLI dùng chung. Output của `fe_begin_mode` giữ nguyên từng byte (đã so 21 trường hợp trước/sau).

### Eval

- `cook-refuses-when-blocked` thêm grader `hook-logged-entry-block`: run-log có `entry_blocked`, chứng minh hook thật sự chạy trong phiên eval.

### Chưa làm

- Chưa bật `enforce` mặc định: chưa có baseline eval để áp luật trong ROADMAP.

## [2.1.1] — 2026-10-08

Phase 0 của [ROADMAP.md](ROADMAP.md): bộ eval chạy được và đo đúng mức hook, danh sách file/rule về một nguồn. Không đổi gate, schema hay prompt.

### Có thể ảnh hưởng repo dự án

- `fe-kit doctor` kiểm đủ 11 file rule trong `.frontend-delivery/rules/`. Trước đây danh sách viết tay thiếu `figma-ui-contract.md` và `review-bug-contract.md`. Repo init từ bản cũ thiếu hai file này cần chạy lại `fe-kit init`.

### Eval

- **Sửa: mức hook trong eval chưa bao giờ được áp dụng.** `claude plugin eval` chỉ chuyển biến `EVAL_*` vào phiên được đánh giá, nên `FE_KIT_HOOKS` đặt trong workflow không tới được hook; mọi lượt eval trước đây đều chạy ở `warn`. Hook nay đọc thêm `EVAL_FE_KIT_HOOKS`; `FE_KIT_HOOKS` vẫn thắng.
- **Sửa: scaffold của `review-writes-report` luôn lỗi.** Fixture đã đúng trạng thái nên bước commit thứ hai không có gì để commit, và `set -e` làm script dừng.
- Scaffold viết lại bằng Node (`evals/scaffold-lib.mjs` + `scaffold.mjs` của từng case; `scaffold.sh` chỉ gọi node). Bỏ phụ thuộc GNU `sed -i`, chạy được trên Windows và macOS. Xoá `evals/scaffold-task.sh`, `evals/cancel-order-task.sh`.
- Grader cấm sửa source bổ sung `Write`, `MultiEdit` (trước chỉ bắt `Edit`); `cook-refuses-when-blocked` và `review-writes-report` thêm grader `source-unchanged` để bắt cả thay đổi qua shell.
- `tests/evals.test.mjs` tự kiểm bộ eval mà không gọi API.
- `evals/summarize.mjs` ghi baseline vào `evals/baselines/` và áp luật bật `enforce` mặc định. Workflow `plugin-evals.yml` chạy matrix `warn`/`enforce` (`hooks_level: both`), mặc định 5 run mỗi case, xuất artifact `eval-baselines`.
- Bộ eval vẫn chưa chạy thật cho bản này; baseline sẽ được commit sau lượt chạy đầu tiên.

### Nguồn duy nhất

- `REQUIRED_TASK_FILES`, `REQUIRED_TASK_DOCS`, `CONDITIONAL_TASK_FILES`, `allRuleFiles()` export từ `packages/validators/src/modes.mjs`. Gate, MCP `fe_validate_task`, CLI `validate-task`/`doctor`, `scaffoldTask` và script của gói ChatGPT skill dùng chung thay cho bốn bản sao viết tay. `tests/single-source.test.mjs` giữ `kit.yaml`, `standard.yaml` và `core/rules/` khớp với các hằng này.
- Xoá code chết trong `bin/fe-kit.mjs`: `validatePromptOnlyInWorkflow`, `validateNoPdfExport`, `hasOpenHighBug`, `hasFeCookPrompt`.

### Tài liệu

- Thêm [ROADMAP.md](ROADMAP.md): đích đến engine + domain pack, các phase, luật bật `enforce`.

## [2.1.0] — 2026-10-05

Củng cố bằng chứng và gate của bản 2.0 (bước 1–2 của lộ trình; file lộ trình gốc `output/fe-kit-architecture-evolution.md` chưa từng được commit, nay thay bằng [ROADMAP.md](ROADMAP.md)). Không thêm agent, hook event hay field schema.

### Có thể ảnh hưởng task đang chạy

- **Command evidence chặt hơn.** Một dòng trong `Command evidence log` chỉ được tính là đã chạy khi ghi `Có` và kết quả `Passed`/`Failed`. Trước đây dòng có tên lệnh nhưng ô "Đã chạy thật?" và "Kết quả" để trống vẫn được tính. Task mà mọi dòng đều trống sẽ không qua `validate-pr` cho tới khi ghi đủ.
- **`fe_validate_workflow` và `fe-kit validate-workflow` tự đối chiếu scope** khi task ở review/test/pr-ready: file sửa ngoài plan (theo git) là lỗi, như `validate-pr`. Plan/input-sync/figma không bị ảnh hưởng. Tắt ở CLI bằng `--no-scope`.

### Gate và hook

- `summarizeCommandEvidence` phân loại từng dòng: đã chạy, chưa chạy, thiếu dữ liệu, thiếu thời điểm, lần gần nhất `Failed`. Ba loại sau chỉ cảnh báo.
- Hook chụp hash nội dung các file đang dirty lúc mở cook/bugfix/quick. Cuối mode, file vốn đã có thay đổi của người dùng mà bị sửa thêm ngoài plan sẽ bị báo, kèm lời nhắc không hoàn tác thay đổi gốc. Marker cũ (chỉ có danh sách path) vẫn chạy như trước.
- Bắt đầu lệnh FE mới khi mode trước còn chưa qua gate kết thúc thì hook cảnh báo thay vì ghi đè marker im lặng.
- `core/scripts/validate-workflow.mjs` (gói ChatGPT skill) dùng cùng hàm với MCP và nhận `--base`.

### Chất lượng thiết kế và bàn giao

- Template plan có mục `Kiểm chứng claim` theo bốn góc: tồn tại, luồng xử lý, lifetime, contract. Chỉ điền theo rủi ro; claim chưa xác minh mà ảnh hưởng triển khai thành câu hỏi blocking.
- Template review có mục `Đối chiếu claim của plan`; các mục sau đánh số lại (issue là mục 4).
- Giao thức agent: báo cáo cuối theo khung bàn giao (mục tiêu, input, file đã sửa, tiêu chí chấp nhận, giới hạn, bằng chứng, việc còn lại, `Tiếp theo:`).
- Hướng dẫn Codex, Cursor, Copilot và skill ghi rõ mức kiểm tra: không có MCP/hook, gate chỉ được kiểm khi chạy CLI.

### Kiểm chứng

- Test mới cho evidence, scope tại điểm chuyển gate (repo git thật), hook (file dirty từ trước, marker hết hạn, chuyển task, mode bỏ dở), MCP server qua stdio, và trần context rule theo mode (`tests/context-budget.test.mjs`).
- Bốn case eval mới: `cook-proceeds-when-ready` (chặn nhầm), `review-does-not-fix-when-asked`, `test-without-shell-no-false-pass`, `pr-blocks-out-of-scope`; grader `handoff-complete`. Workflow eval có input `hooks_level`. Bộ eval chưa được chạy cho bản này.

## [2.0.1] — 2026-10-05

### Sửa lỗi

- `validate-pr` chặn nhầm task tạo từ v1.x: plan không có bảng "File sẽ tạo / cập nhật" khiến mọi file đã sửa bị coi là "ngoài plan". Nay trường hợp này chỉ cảnh báo và dùng `scope_diff_status` tự khai, giống v1.1.
- PR gộp nhiều task: file nằm trong plan của task khác không còn bị tính là "ngoài plan" của task đang kiểm tra.

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
