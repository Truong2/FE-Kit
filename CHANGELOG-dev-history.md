> Lưu trữ nhật ký phát triển nội bộ trước khi phát hành bản 1.0.0 cho team.
> Các số hiệu 1.0.x–1.3.1 ở đây là bản build nội bộ, không phải bản phát hành công khai.

# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), version theo [SemVer](https://semver.org/).

## [1.3.1] — 2026-09-01

### Fixed

- **Dọn legacy payload trong `.claude/skills/frontend-delivery-standard/`:** các thư mục `agents/` (chứa `openai.yaml` cũ), `.cursor/`, `.github/`, `docs/frontend-tasks/` là tàn dư thiết kế v0.1.16 (skill zip tự chứa mọi adapter) — không được SKILL.md hay build script tham chiếu, đã stale so với bản chính, và bị `fe-kit init --agents claude` **copy nguyên vào mọi repo consumer** (init copy cả thư mục `.claude/`). Đã xoá.
- SKILL.md description bỏ version-pin ("Bản 1.0.x...") — đã stale 2 lần qua các đợt bump; mô tả hành vi không gắn số version nữa.

## [1.3.0] — 2026-09-01

### Fixed

- **Bug nặng — plugin cài về không thấy command nào:** cấu trúc `commands/fe/*.md` (thư mục con) không đúng spec plugin — trong plugin, `commands/` chỉ nhận file `.md` phẳng; thư mục con bị Claude Code hiểu là skill (phải chứa `SKILL.md`) và bị bỏ qua khi load. Hệ quả: cài plugin chỉ thấy mỗi `/frontend-delivery-standard` (tên skill), không có lệnh `fe` nào. Đã chuyển sang file phẳng prefix `fe-` → slash command dạng `/frontend-delivery:fe-plan`, `/frontend-delivery:fe-cook`... (Bản project-level `.claude/commands/fe/` không bị ảnh hưởng — subdirectory namespacing vẫn hợp lệ ở project level, giữ dạng `/fe:plan`.)

### Added

- **Lệnh tạo task trong plugin/adapter: `fe-new-task`** (`/frontend-delivery:fe-new-task FE-123-slug`, project-level `/fe:new-task`, Codex `# FE new-task`). Scaffold đủ bộ file chuẩn từ templates bundled trong skill; ưu tiên gọi CLI `fe-kit new-task` nếu repo đã cài; kết thúc bằng in `next_prompt` + gợi ý `FE quick` — trước đây tạo task bắt buộc phải cài CLI riêng.

### Changed

- `generate-adapters.mjs` sinh command cho 3 đích từ `core/commands/`: `.claude/commands/fe/` (nested, project), `.codex/prompts/` (heading), `plugins/.../commands/fe-*.md` (phẳng, plugin).

### Cách nhận bản sửa cho người đã cài plugin

```
/plugin marketplace update frontend-delivery
/plugin update frontend-delivery@frontend-delivery
/reload-plugins
```

## [1.2.0] — 2026-08-31

### Added

- **Chuẩn hoá multi-agent theo kiến trúc orchestrator–worker:**
  - Cả 6 subagent thêm `tools:` least-privilege theo role (planner/figma-specialist không có Bash; developer/reviewer/tester/release-manager có Bash vì cần chạy lệnh).
  - Description viết lại tiếng Việt, ghi rõ *khi nào dùng* để main thread auto-delegate được ("Dùng khi chạy FE cook...", "Không dùng khi plan chưa build_ready").
  - `ARCHITECTURE.md` mới: mô hình main-thread-là-orchestrator (không dùng anti-pattern "orchestrator agent" vì subagent Claude Code không spawn được subagent), state file là giao thức giao tiếp giữa agent, sơ đồ luồng chuẩn, lý do không chạy song song trong 1 task.
- **Đóng vòng codegen cho command files** (Known gap từ 1.0.2): `core/commands/` là nguồn duy nhất, generate ra `.claude/commands/fe/` (giữ frontmatter) và `.codex/prompts/` (heading `# FE <cmd>`, map tên cook→build, figma→figma-extract). `build:check` giờ bắt drift ở cả command files.

### Changed

- **Codex prompts chuyển sang tiếng Việt, cùng nội dung với Claude** — trước đây là bản tiếng Anh ngắn hơn viết tay riêng, lệch mandate tiếng Việt của toàn kit và không ai đồng bộ khi Claude commands đổi.

### Còn lại (roadmap "best-in-market", chưa làm ở bản này)

- npx installer (publish npm) — cài 1 lệnh như spec-kit/BMAD.
- Release automation (changesets + tag + auto bump plugin.json version).
- Eval suite cho hành vi agent (đo tỉ lệ pass gate/đúng routing trên task mẫu).
- Tách `workflow-status` sang JSON state + render `.md` (đang chờ chốt hướng).
- Unify `.cursor/rules` + `.github/instructions` vào codegen.

## [1.1.0] — 2026-08-31

### Added

- **Phân phối dạng Claude Code plugin.** Thêm `.claude-plugin/marketplace.json` (catalog) và `plugins/frontend-delivery/` (plugin tự chứa: skill + 10 command + 6 subagent). Team cài bằng 2 lệnh:
  `/plugin marketplace add your-org/frontend-delivery-agent-kit` rồi `/plugin install frontend-delivery@frontend-delivery`.
  Plugin được generate từ `core/` qua `npm run build`, **không sửa tay** thư mục `plugins/`.
- `LICENSE` (MIT) + trường `license` trong `package.json`, `plugin.json`, marketplace entry.
- `INSTALL.md` — 4 đường cài (plugin marketplace, CLI, adapter Codex/Cursor/Copilot/ChatGPT, CI), kèm cách bắt cả team tự có marketplace qua `extraKnownMarketplaces` trong `.claude/settings.json`.
- `SKILL.md` và `plugin.json` đưa vào `core/` làm nguồn duy nhất (trước đây `SKILL.md` phải sửa tay ở 2 nơi).

### Fixed

- `SKILL.md` description còn ghi "Bản 0.1.16 chặn route sang cook..." — cập nhật thành "Bản 1.0.x".

### Lưu ý khi release

- `version` trong `core/plugin.json` là **tín hiệu cập nhật** của Claude Code: không bump thì user giữ bản cache cũ dù đã push code mới.
- Thư mục `plugins/` là generated nhưng **phải commit** vào git, vì `marketplace.json` trỏ tới nó bằng relative path `./plugins/frontend-delivery`.

## [1.0.3] — 2026-08-31

### Fixed

- **Bug nghiêm trọng — rule Cursor gần như không hoạt động:** cả 3 file `.cursor/rules/*.mdc` có YAML frontmatter (`description:`, `alwaysApply:`) **nằm giữa file** thay vì dòng 1, do khối "Bắt buộc tiếng Việt" được chèn lên trước. Cursor yêu cầu frontmatter ở đầu file, nên `alwaysApply: true` của rule core nhiều khả năng không được parse → rule không tự áp dụng. Đã đưa frontmatter về đúng dòng 1.
- **Rule Cursor không tự attach:** `frontend-delivery-code.mdc` và `frontend-delivery-task.mdc` đặt `alwaysApply: false` nhưng **không có `globs:`** → không bao giờ tự gắn vào file nào. Đã thêm globs khớp với bản Claude tương ứng (`docs/frontend-tasks/**/*.md` và `src|app|components/**/*.{ts,tsx,js,jsx}`).
- **Copilot instructions thiếu `applyTo:`:** cả 2 file `.github/instructions/*.instructions.md` không có frontmatter nào → không được scope đúng. Đã thêm `applyTo`.
- Leftover `v0.1.16` trong file `.mdc` (lần cập nhật version trước chỉ quét `.md/.yaml/.mjs/.json`, bỏ sót đuôi `.mdc`).
- Rút gọn boilerplate tiếng Việt trong 3 file `.mdc` + 2 file Copilot instructions (tiếp nối đợt 1.0.2 vốn chỉ xử lý Claude/Codex): **6.5KB → 4.6KB**.

### Added

- `CONTRIBUTING.md` — quy tắc "sửa ở `core/`, không sửa bản generate", quy trình build/test, chính sách breaking change cho schema, yêu cầu test kèm mỗi thay đổi gate.
- `CODEOWNERS` — bảo vệ vùng nhạy cảm (`schema.mjs`, `gates.mjs`, `core/`, `standard.yaml`).

### Known gap (chưa fix)

- Chưa có `LICENSE` — cần team quyết định license trước khi phát hành ra ngoài tổ chức.
- Hai file `.cursor/rules/frontend-delivery-{code,task}.mdc` có nội dung viết bằng **tiếng Anh**, khác với toàn bộ phần còn lại của kit (tiếng Việt) — không phải bug kỹ thuật nhưng thiếu nhất quán, để team quyết định có dịch hay không.
- Command/prompt/rule của 4 adapter (Claude, Codex, Cursor, Copilot) vẫn phải sửa tay song song — chưa generate từ `core/`. Đây là nguồn drift lớn nhất còn lại, và chính là nguyên nhân của các bug frontmatter phát hiện ở bản này.

## [1.0.2] — 2026-08-31

### Fixed

- **Bug ngữ nghĩa thật:** `fe:cook`/`fe:build` (implementation-mode) chứa nguyên văn câu *"plan phải quyết định rõ Error DTO..."* copy nhầm từ `plan.md` — sai actor/sai thì, khiến agent tưởng được tự quyết định lại cách hiển thị lỗi trong lúc code thay vì phải tuân theo quyết định đã có trong plan. Đã sửa lại đúng ngữ cảnh cho cả `.claude/commands/fe/cook.md` và `.codex/prompts/build.md`.
- **Không tiết kiệm token:** 16/20 file command (`.claude/commands/fe/*.md` + `.codex/prompts/*.md`) chứa nguyên khối "Bắt buộc tiếng Việt có dấu" ~690 byte lặp lại y hệt nhau — trong khi nội dung này đã là rule bắt buộc auto-load toàn project (`.frontend-delivery/rules/vietnamese-output.md`, liệt kê trong `.claude/rules/frontend-delivery.md` không có `paths:` scoping → luôn active). Đã rút gọn thành pointer 4 dòng trỏ về rule gốc thay vì lặp lại toàn bộ nội dung. **Tổng tiết kiệm: 11KB / 38.8%** trên 16 file, không mất thông tin (rule gốc vẫn always-on).
- `figma-review.md` (cả Claude lẫn Codex) thiếu frontmatter `description:` và không theo cấu trúc heading chuẩn như 9 file command còn lại — đã chuẩn hoá.
- `review.md` (bản duy nhất vốn đã ngắn gọn từ đầu) — chuẩn hoá lại format heading cho khớp với các file khác sau khi rút gọn.

### Known gap (chưa fix, ghi nhận)

- `.claude/commands/fe/*.md` và `.codex/prompts/*.md` **chưa được đưa vào `core/`** để generate tự động như `rules/`/`templates/`/`docs/`/`scripts/` — hiện vẫn phải sửa tay đồng thời ở cả 2 nơi (đã làm thủ công đúng ở bản vá này, nhưng rủi ro lệch sẽ quay lại nếu có thay đổi tiếp theo mà quên đồng bộ Cursor `.mdc`/Copilot instructions). Khuyến nghị: mở rộng `build/generate-adapters.mjs` để compose command files từ `core/commands/` + fragment dùng chung trong đợt refactor tiếp theo.

## [1.0.1] — 2026-08-31

### Fixed

- **Next-step guidance thiếu ở nhiều lệnh:** `validate-task`, `validate-workflow`, `validate-pr` trước đây khi PASS chỉ in `"... passed."`, không gợi ý bước kế tiếp — người dùng/agent phải tự nhớ chạy thêm `fe-kit next <task>`. Giờ cả 3 lệnh tự in `next_prompt` thật (đọc trực tiếp từ `tracking/workflow-status.md`, không hardcode).
- `doctor` khi pass không có hint bước kế — đã thêm gợi ý chạy `new-task`.
- `new-task` trước đây in hint **hardcoded** ("chạy FE plan...") thay vì đọc từ chính `next_prompt` vừa ghi vào file — rủi ro lệch nếu default template đổi. Đã sửa đọc từ file thật.
- `new-task` không hề nhắc tới lựa chọn `FE quick <task-folder>` (dành cho task nhỏ/rủi ro thấp, không cần re-plan/input-sync/Figma) dù `help()`/`templates/prompts.md` đã document đây là con đường chính thức — đã thêm dòng gợi ý.
- Leftover version string `v0.1.16` còn sót ở `help()` text, `init()` note, và ~30 file command/prompt/doc khác (không khớp pattern cache-marker nên lần cập nhật version trước đó bỏ sót) — đã cập nhật đồng bộ `v1.0.0` toàn repo.

## [1.0.0] — 2026-08-31

### Breaking

- Chuyển repo sang npm workspaces (`packages/*`). `bin/fe-kit.mjs` giờ phụ thuộc `@frontend-delivery-kit/validators` — cần chạy `npm install` ở root trước khi dùng CLI (trước đây CLI zero-dependency, chạy được ngay sau khi copy file).
- `rules/`, `templates/`, `docs/`, `standards/` không còn là nguồn để sửa trực tiếp ở `.claude/skills/...`, `chatgpt-skill/...`, hay top-level nữa — nguồn duy nhất là `core/`. Sửa ở các thư mục cũ sẽ bị `npm run build:check` phát hiện và báo lỗi trong CI.
- `dist/chatgpt-skill.zip` không còn commit vào git. Chạy `npm run pack:chatgpt` để sinh lại khi cần release.

### Added

- Package `@frontend-delivery-kit/validators`: Zod schema cho toàn bộ frontmatter `workflow-status.md`, parser dùng `gray-matter` (YAML parser thật, thay regex tay), và `evaluateWorkflowGates` — nguồn logic gate DUY NHẤT.
- Vitest test suite thật cho gate logic (12 test case, chạy `npm test`), thay cho `tests/01-standard-input-sync/expected-structure.md` (chỉ mô tả suông, không executable).
- `build/generate-adapters.mjs` — sinh `rules/`, `templates/`, `docs/`, `standards/`, `scripts/` (bundle bằng esbuild), `package.json` skill từ `core/`. Có `--check` mode dùng trong CI để chặn drift.
- `build/pack-chatgpt-skill.mjs` — đóng gói `chatgpt-skill.zip` lúc release.
- `CHANGELOG.md` (file này).

### Fixed

- **Blocker:** `npm run validate:task`/`validate:workflow`/`validate:pr` trong skill package trước đây gọi `ts-node/register` nhưng `ts-node` chưa từng được khai báo dependency ở đâu — lệnh sẽ crash ngay trên máy sạch. Đã thay bằng script `.mjs` bundle sẵn, chạy thẳng bằng `node`, không phụ thuộc gì thêm.
- Xoá ~250 dòng dead code trong `bin/fe-kit.mjs` (`validateWorkflow()`, `validateTask()`, `validatePr()`, `validateWorkflowStatusStrict()`, `validateReviewArtifacts()`) — không được CLI dispatch table gọi tới bao giờ, kiểm tra một schema field cũ (`figma_access_status`, `plan_version`, `srs_reference_status`...) không khớp template hiện tại.
- Gộp 3 bản logic gate gần như trùng lặp (`scripts/validate-workflow.ts`, `leanModeOutputErrors` trong `bin/fe-kit.mjs`, và bản dead code) thành một nguồn duy nhất trong `packages/validators`.
- `.claude/rules/frontend/task-folders.md` mô tả cấu trúc task cũ (`input/srs.md`, `input/api-contract.md`) không khớp `standard.yaml` hiện tại — đã sửa khớp đúng cấu trúc `task.md` / `planning/` / `tracking/` / `output/`.
- Trong lúc port logic gate sang `packages/validators`, phát hiện và sửa 1 sai lệch: giá trị `completed` bị rơi khỏi điều kiện `input_inventory_status`/`plan_input_ledger_status`/`srs_trace_matrix_status` so với bản gốc.
- `fe-kit status` hiển thị field YAML cũ đã chết (`srs_reference_status`, `asset_gate_status`, `plan_version`...) không khớp template — cập nhật theo field thật, thêm dòng đếm blocking question trực tiếp từ `questions.md`.

### Known findings (chưa fix, cần team quyết định)

- `countOpenBlockingQuestions`: cột "Trạng thái" trong bảng câu hỏi luôn được tính là "có nội dung" (vì giá trị như "Open"/"Pending" gần như không bao giờ khớp pattern placeholder) — khiến điều kiện lọc placeholder-row gần như luôn true bất cứ khi nào status là Open. Xem ghi chú trong `packages/validators/test/validate-workflow.test.mjs`.

## [0.1.16] và các bản trước

Xem lịch sử trong `VERSION.md` (không còn được cập nhật từ bản 1.0.0 trở đi — dùng file này thay thế).
