# Kiến trúc Agent / Multi-Agent

Tài liệu này mô tả cơ chế **đang chạy thật** từ v2.0.0. Mỗi nguyên tắc đều chỉ ra nơi nó được thực thi; nguyên tắc nào chỉ nằm trong prompt thì ghi rõ như vậy. Lộ trình và các quyết định: [ROADMAP.md](ROADMAP.md).

## Mô hình: Orchestrator–Worker qua state file

```
┌───────────────────────────────────────────────────────────┐
│  MAIN THREAD (orchestrator)                               │
│  /fe:<mode> <task>  →  delegate subagent theo bảng mode   │
│  → fe_validate_workflow → in next_prompt                  │
└──────────────┬────────────────────────────────────────────┘
               │ Agent tool, foreground, brief đầy đủ input
   ┌───────────┼───────────┬───────────┬────────────┬───────────────┐
   ▼           ▼           ▼           ▼            ▼               ▼
 planner   developer   reviewer    tester    figma-specialist  release-manager
 (plan,    (cook,      (review)    (test)    (figma,           (pr)
 input-    bugfix)                            figma-review)
 sync)
   │           │           │           │            │               │
   └───────────┴───────────┴─────┬─────┴────────────┴───────────────┘
                                 ▼
              docs/frontend-tasks/<task>/  (state duy nhất)
                                 ▲
           MCP: fe_begin_mode / fe_validate_workflow / fe_scope_diff
           Hook: UserPromptExpansion / PreToolUse / SubagentStop / Stop
```

`/fe:quick` và `/fe:new-task` chạy inline ở main thread.

## Engine và domain pack

Kit chỉ dùng cho domain frontend. Từ v2.4.0 code tách làm hai tầng để phần điều phối dùng chung không lẫn với luật riêng của FE, chứ không nhằm hỗ trợ domain khác:

| Tầng | Package | Chứa |
|---|---|---|
| Engine | `packages/engine` | State machine của mode, gate kết thúc mode, nội dung mở mode, scope diff, run-log, report, project config, scaffold, hook runtime, tool MCP, schema manifest |
| Domain pack | `packages/pack-fe` | `pack.yaml` (mode, agent, artifact, rule, đường dẫn, chuỗi MCP), schema `workflow-status.md`, gate workflow/PR, parser bảng câu hỏi/bug/evidence, luật vào mode |

- **Manifest:** `build/compile-packs.mjs` kiểm `pack.yaml` theo `PackManifestSchema` rồi sinh `src/manifest.gen.mjs` (và `kit.yaml` từ pack FE). Gate phức tạp vẫn là JS trong pack.
- **Object pack:** engine nhận một object (`fePack` trong `packages/pack-fe/src/pack.mjs`) gồm dữ liệu manifest, nhãn lệnh (`FE <mode>`), và hàm của pack (`entryRules`, `entryInputs`, `validateWorkflow`…). `createStateMachine`, `createModeCompletion`, `createModeBriefing`, `runHook`, `createMcpTools` đều dựng từ object này.
- **Plugin FE:** `core/hooks/fe-hook.mjs` gọi `runHook(fePack)`; `core/mcp/server.mjs` nối `createMcpTools(fePack)` vào MCP SDK; generator lấy tên plugin, thư mục skill, bảng agent và tên tool từ manifest.
- **Tương thích:** `@frontend-delivery-kit/validators` re-export `pack-fe` với đúng tên và đường dẫn module cũ. Plugin `fe`, lệnh `/fe:*`, tool `fe_*`, `docs/frontend-tasks`, field của `workflow-status.md` và biến `FE_KIT_*` không đổi.
- **Chứng minh dùng chung:** `packages/pack-sample-docs` là pack mẫu chỉ dùng trong test, khác FE ở mọi chỗ; `tests/engine-genericity.test.mjs` chạy toàn bộ engine (cả hook như một process) trên pack này.
- **Không đổi hành vi:** `tests/golden.test.mjs` so output của validators, hook, MCP và CLI với `tests/golden/golden.json` chụp trước khi tách.

## Các lớp và nơi thực thi

| Lớp | Thành phần | Nguồn | Thực thi bởi |
|---|---|---|---|
| Hướng dẫn | Skill `frontend-delivery-standard`, rule, template | `core/SKILL.md`, `core/rules/`, `core/templates/` | Prompt (mềm) |
| Điều phối | 12 slash command | `core/commands/` + đoạn delegation do generator chèn | Prompt (mềm) |
| Vai trò | 7 subagent | `core/agents/` + `_protocol.md` | `disallowedTools` (cứng) + prompt |
| Gate khi bắt đầu mode | `fe_begin_mode`, `fe-kit mode begin` | `createModeBriefing` (engine) → `evaluateModeEntry` (luật FE trong `pack-fe/src/transitions.mjs`) | MCP tool / CLI trả verdict + nguyên văn rule |
| Gate khi chạy | Hook | `runHook` (engine), gắn pack ở `core/hooks/fe-hook.mjs` | Claude Code hook (cứng ở mức `enforce`) |
| Gate khi kết thúc mode | `evaluateModeCompletion` | `createModeCompletion` (engine) | Hook `SubagentStop`/`Stop`, CLI `fe-kit mode end` |
| Gate khi kết thúc / CI | Validator | `packages/pack-fe/src/` (gate FE) | MCP, hook, CLI, CI |
| Quan sát | Run-log, báo cáo | `packages/engine/src/runlog.mjs`, `report.mjs` | Hook, MCP, CLI ghi; `fe-kit report` đọc |

## Nguyên tắc thiết kế

1. **Main thread là orchestrator, không có "orchestrator agent" riêng.** Subagent trong Claude Code không spawn được subagent khác. Mọi command theo mode được generator chèn đoạn "Điều phối (Claude Code)": main thread delegate cho đúng subagent (bảng `AGENT_FOR_COMMAND` trong `packages/validators/src/modes.mjs`), chuyển nguyên văn input chỉ có trong chat, rồi gọi `fe_validate_workflow`. Đoạn này chỉ có trong command của plugin, không có trong `SKILL.md` (subagent preload skill sẽ tự delegate vòng lặp) và không có trong prompt Codex.
   - Không dùng `context: fork` vì fork không thấy lịch sử chat, trong khi SRS/câu trả lời thường được dán thẳng vào chat.

2. **State file là giao thức giao tiếp giữa các agent.** Subagent có context riêng. Mọi thứ agent sau cần biết phải nằm trong task folder. Hook `SubagentStop`/`Stop` không cho mode kết thúc nếu `workflow-status.md` chưa được sửa trong lượt, sai `current_mode`, thiếu artifact bắt buộc của mode, hoặc không qua `validateWorkflow`.

3. **Least-privilege theo vai, thực thi hai lớp.**

   | Agent | Chặn bằng `disallowedTools` | Chặn bằng hook |
   |---|---|---|
   | frontend-planner | Bash, PowerShell, Agent, NotebookEdit | Sửa ngoài `docs/frontend-tasks/`, `docs/frontend-context/` |
   | frontend-figma-specialist | Bash, PowerShell, Agent, NotebookEdit | như trên |
   | frontend-reviewer / tester / release-manager | Agent | như trên |
   | frontend-developer | Agent | Sửa source khi gate của task chưa mở |

   Dùng `disallowedTools` thay cho whitelist `tools:` để agent thừa hưởng Skill, MCP của kit và Figma MCP của từng máy (tên server Figma khác nhau nên không whitelist được).
   - **Ghi qua shell:** reviewer/tester/release-manager có Bash. Hook cảnh báo lệnh shell trông như ghi file (`FE_KIT_BASH_GUARD=off` để tắt), và không cho mode chỉ đọc kết thúc khi file source (theo `source_paths`) bị đổi so với lúc mở mode (`END_SOURCE_TOUCHED_IN_READONLY_MODE`). Lưới chặn cuối vẫn là scope diff ở `fe_scope_diff` và `validate-pr`.

4. **Description là hợp đồng delegate.** Mỗi description ghi rõ khi nào dùng và khi nào không. Plugin agent có tên `fe:<name>`.

5. **Handoff luôn qua `next_prompt`.** Mode kết thúc ghi `next_mode` + `next_prompt`. Không agent nào tự nhảy mode. `fe_begin_mode` so mode được yêu cầu với gate thật (câu hỏi blocking đếm từ `questions.md`, `build_ready`, Figma gate, review/bug) và với `next_mode` đã ghi.

6. **Sự thật tính được thắng field tự khai.** Scope diff tính từ `git diff` so với bảng "File sẽ tạo / cập nhật" của plan (`packages/validators/src/scope.mjs`). Command evidence đọc từ bảng `Command evidence log` của `output/test-summary.md`. Các field tự khai (`token_budget_status`, `scope_diff_status`…) chỉ còn là dự phòng và đã thành optional trong schema.
   - **Issue đang mở** (`countOpenIssuesBySeverity`, từ v2.3.0): đếm từ bảng của `tracking/review-bugs.md` và mục "Issue phát hiện" của `output/review-report.md`, cột tìm theo tên header. Gate dùng `max(tự khai, đếm được)` cho Critical/High như với câu hỏi blocking; field ghi thấp hơn bảng là lỗi `ISSUES_COUNT_MISMATCH`. Bảng không nhận diện được cột ID/Severity/Trạng thái thì chỉ cảnh báo. Cột `Nhóm` và `Nguyên nhân gốc` có danh sách giá trị trong `review-bug-contract.md` để retro đếm được.
   - **Command evidence** (`summarizeCommandEvidence`): một dòng chỉ được tính là đã chạy khi cột "Đã chạy thật?" ghi `Có` và cột "Kết quả" ghi `Passed`/`Failed`. Ô trống, ô còn nguyên lựa chọn của template, `Có` kèm `Not run` là dòng thiếu dữ liệu và chỉ sinh cảnh báo. Lần chạy gần nhất của một lệnh mà `Failed` cũng chỉ cảnh báo, vì test fail đã route sang bugfix ở tầng mode.
   - **Scope tại từng điểm chuyển gate:**

     | Điểm | Nguồn danh sách file | Ghi chú |
     |---|---|---|
     | Cuối cook/bugfix/quick (hook) | File mới thay đổi trong mode, cộng file đã dirty từ trước mà nội dung bị đổi (so hash lúc mở mode) | Không hoàn tác thay đổi của người dùng; chỉ báo |
     | `fe_validate_workflow` ở review/test/pr-ready | `git diff` so với base ref, cộng thay đổi chưa commit | Plan/input-sync/figma không tính, tránh chặn nhầm thay đổi không liên quan |
     | `validate-pr` (CLI, CI) | Như trên | Luôn tính |

     Plan chưa có bảng file (task tạo từ v1.x) thì mọi điểm đều cảnh báo và dùng `scope_diff_status` tự khai. File thuộc plan của task khác cùng thư mục không bị tính là ngoài plan.

## Vòng tự học (retro)

`/fe:retro` là lệnh cấp repo, không phải mode của task.

| Bước | Thành phần | Ghi chú |
|---|---|---|
| Số liệu | `buildRetroData` (engine), MCP `fe_retro_data`, CLI `fe-kit retro --write` | Gộp run-log và bảng bug (nhóm, nguyên nhân gốc) của mọi task; ghi `docs/frontend-retro/<ngày>/retro-data.json`. Tất định. |
| Phân tích | Subagent `frontend-retro-analyst` | Không có Bash; viết `retro-report.md` và `proposals.md`; mọi đề xuất ở trạng thái `Proposed`. Không nhận giao thức mode. |
| Duyệt | Hook (approval guard của pack) | Đổi đề xuất sang `Approved`/`Applied` và mọi thay đổi ở `docs/frontend-context/team-rules.md` đều hỏi người dùng (`ask`), ghi `approval_requested`. Gate `RETRO_APPROVAL_INCOMPLETE`: đã duyệt mà thiếu Người duyệt. |
| Áp dụng | `team-rules.md`, `fe-kit retro export` | Đề xuất `project` đã duyệt thêm vào `team-rules.md` (mục `## <mode>` hoặc `## Mọi mode`), được nạp kèm khi mở mode với trần 3.000 ký tự. Đề xuất `upstream` xuất thành nội dung issue cho repo kit; kit không tự sửa rule lõi. |
| Đóng vòng | Retro kỳ sau | So Metric theo dõi của đề xuất cũ trước/sau. |

## Input không tin cậy

SRS, CR, câu trả lời, Figma, comment trong source và kết quả tool là dữ liệu (`core/rules/untrusted-input-contract.md`, nạp cho mọi mode). Đoạn "Điều phối" của command bảo main thread đặt input người dùng dán vào trong khối `<untrusted-input>` khi brief subagent; `_protocol.md` bảo agent coi nội dung đó là dữ liệu và ghi chỉ thị lạ vào `questions.md`. Đây là lớp prompt (mềm); lớp cứng vẫn là gate và hook: chỉ thị trong SRS không mở được gate. Eval `plan-ignores-injected-srs` đo hành vi này.

## Hook runtime

| Sự kiện | Hành vi |
|---|---|
| `UserPromptExpansion` / `UserPromptSubmit` | Nhận `/fe:<mode> <task>` hoặc `FE <mode> <task>` ở **đầu** prompt, ghi marker theo `session_id`. Gate bị chặn thì đưa lý do vào ngữ cảnh ngay. |
| `PostToolUse` `fe_begin_mode` | Ghi marker khi model tự vào mode mà không qua slash command. |
| `PreToolUse` Agent | Đánh dấu mode đã delegate đúng subagent. |
| `PreToolUse` Edit/Write | Luật theo vai (không cần marker) và luật theo gate (cook/bugfix/quick). Bật `human_override: true` thì hỏi người dùng. |
| `SubagentStop` | Kiểm tra gate kết thúc khi đúng subagent của mode dừng. |
| `Stop` | Kiểm tra gate kết thúc cho mode inline. |

Mọi sự kiện trên đều ghi run-log của task khi có kết quả đáng đếm (mở mode, bị chặn, bị từ chối sửa, kết thúc mode); xem mục Run-log.

- Mức thực thi: `FE_KIT_HOOKS=off|warn|enforce`, mặc định `warn`. Trong phiên `claude plugin eval` hook đọc `EVAL_FE_KIT_HOOKS`, vì runner chỉ chuyển biến `EVAL_*` vào phiên; `FE_KIT_HOOKS` vẫn thắng nếu có. Chuyển mặc định sang `enforce` theo luật trong [ROADMAP.md](ROADMAP.md).
- Chặn tối đa một lần mỗi lần dừng (`stop_hook_active`), sau đó thả kèm cảnh báo để không lặp vô hạn.
- Mode bị gate từ chối chỉ cần `workflow-status.md` route đúng, không đòi artifact của mode.
- Lỗi nội bộ của hook luôn thoát 0 và không in gì.

Giới hạn đã biết (đều có test trong `tests/hook.test.mjs`):

- **Marker hết hạn sau 4 giờ:** coi như không có mode đang chạy, nên không chặn sửa source theo gate của task và không kiểm tra kết thúc. Luật theo vai vẫn áp dụng vì không cần marker.
- **Chuyển task giữa chừng:** lệnh FE mới thay marker của mode trước đang `pending` và phát cảnh báo nêu mode, task chưa qua gate kết thúc. Hook không tự quay lại kiểm tra task cũ.
- **Mode bỏ dở:** người dùng ngắt mode rồi hỏi việc khác thì `Stop` của lượt sau vẫn kiểm gate kết thúc của mode đó. Ở mức `enforce`, hook chặn đúng một lần rồi thả và đóng marker.
- **Ghi file qua shell:** hook không chặn được lệnh shell trước khi chạy, chỉ cảnh báo theo mẫu lệnh. Mode chỉ đọc bị chặn khi kết thúc nếu file source bị đổi; file ngoài `source_paths` (vd `coverage/`) và thay đổi có sẵn của người dùng không bị tính.

## Mức kiểm tra theo adapter

| Adapter | Kiểm tra lúc agent chạy | Cách kiểm thủ công |
|---|---|---|
| Claude Code (plugin `fe`) | MCP `fe_begin_mode`/`fe_validate_workflow`/`fe_scope_diff`, hook, `disallowedTools` | Như cột bên dưới, khi cần |
| Codex, Cursor, Copilot | Không có: chỉ hướng dẫn trong prompt | `node bin/fe-kit.mjs mode begin <task> <mode>` khi mở mode và `mode end` trước khi kết thúc (cùng gate với hook); `node bin/fe-kit.mjs validate-pr <task> --base <nhánh>` trước PR. Copilot có thêm workflow CI `frontend-delivery-standard.yml` |
| ChatGPT skill | Không có | `node scripts/validate-workflow.mjs <task>`, `node scripts/validate-pr.mjs <task> --base <nhánh>` trong gói skill |

`bin/fe-kit.mjs` là bản CLI standalone mà `fe-kit init` copy vào repo dự án. Hướng dẫn của từng adapter (`core/adapters/*`, `core/SKILL.md`) ghi rõ: chưa chạy lệnh, hoặc lệnh báo lỗi, thì không được ghi gate là passed.

## Run-log

Mỗi task có `tracking/run-log.jsonl`: mỗi sự kiện một dòng JSON, commit cùng task. `fe-kit init` thêm `merge=union` cho file này vào `.gitattributes` để hai nhánh cùng ghi không conflict.

| Sự kiện | Ai ghi | Field chính |
|---|---|---|
| `mode_start` | Hook (prompt `/fe:<mode>` hoặc `fe_begin_mode`), `fe-kit mode begin` | `mode` |
| `entry_blocked` | Hook, `fe-kit mode begin` | `codes` (`ENTRY_*`) |
| `edit_denied` / `edit_warned` | Hook `PreToolUse` | `codes` (`EDIT_ROLE_FORBIDDEN`, `EDIT_GATE_CLOSED` + `ENTRY_*`), `file` |
| `override_requested` | Hook | — |
| `mode_abandoned` | Hook, khi lệnh FE mới thay mode chưa qua gate kết thúc | `replaced_by` |
| `mode_end` | Hook `SubagentStop`/`Stop`, `fe-kit mode end` | `outcome` (`pass`, `blocked`, `released`, `failed`), `attempt`, `duration_ms`, `codes` |
| `validate` | MCP `fe_validate_workflow`, CLI `validate-*` | `outcome`, `codes` |

- **Không ghi nội dung:** không có prompt, nội dung file hay input của người dùng; session id được hash.
- **Reason code:** mọi lỗi của gate có code ổn định (`issues[].code` của validator, `reasonCodes` của `evaluateModeEntry`), nên báo cáo đếm được lý do bị chặn.
- **Không làm hỏng việc chính:** ghi log không bao giờ throw; task chưa có `tracking/` thì bỏ qua; file quá 5 MB thì ngừng ghi. Tắt bằng `FE_KIT_RUNLOG=off`. CLI không ghi khi `CI=true` hoặc có `--no-log`.
- **Báo cáo:** `fe-kit report [<task>] [--since YYYY-MM-DD] [--json]` tính tỉ lệ pass ngay lần đầu, số vòng bị chặn, lý do bị chặn nhiều nhất và thời gian mỗi mode, chỉ từ sự kiện đã ghi.

## Ngân sách context theo mode

`fe_begin_mode` trả nguyên văn rule của mode. Số ký tự đo ở v2.3.0 (đã có `untrusted-input-contract.md` cho mọi mode), task có Figma (trường hợp lớn nhất):

| Mode | Ký tự | Mode | Ký tự |
|---|---|---|---|
| plan | 8.855 | cook | 10.863 |
| quick | 9.543 | bugfix | 10.665 |
| input-sync | 8.272 | review | 11.985 |
| figma | 8.204 | test | 8.941 |
| figma-review | 9.524 | pr | 10.646 |

Khoảng 2,2–3,8 nghìn token mỗi mode. `tests/context-budget.test.mjs` đặt trần bằng số đo cộng khoảng 15% để rule không phình lên mà không ai để ý. Chưa có số liệu cho thấy cần tách rule thành mục lục/reference; khi cố ý thêm rule thì đo lại và nâng trần trong cùng PR.

## Eval hành vi

`evals/` chạy bằng `claude plugin eval` qua `node evals/run.mjs <profile>` (trên máy: `npm run eval:<profile>`; CI: workflow `plugin-evals.yml`, chạy tay). Mức hook truyền qua `EVAL_FE_KIT_HOOKS`.

Chi phí tỉ lệ với số lượt chạy (case × số lần × số mức hook); mỗi lượt là một phiên Claude Code đầy đủ. Hook chỉ chèn vài dòng cảnh báo nên gần như không tốn token. `evals/profiles.mjs` định nghĩa các mức, mức nào cũng có trần `--max-cost-usd` và không chạy nhánh không plugin (`--ablation none`):

| Profile | Chạy | Model | Trần | Ghi baseline |
|---|---|---|---|---|
| `pilot` | `cook-refuses-when-blocked` × 1, enforce | Sonnet | 1 USD | Không |
| `smoke` | mọi case × 1, warn | Haiku | 5 USD | Không |
| `gate` | case `gate` × 3, warn và enforce | Sonnet | 10 USD/mức | Có |
| `full` | mọi case × 5 ở warn, case `gate` × 5 ở enforce | Sonnet | 30 USD/mức | Có |

Luật `enforce` chỉ xét case `gate`, nên không chạy case khác ở cả hai mức. Baseline cần ≥ 3 run mỗi case gate mới được dùng để quyết định.

| Nhóm | Case |
|---|---|
| Đường đúng | `plan-routes-blocking-question`, `input-sync-closes-gate`, `review-writes-report` |
| Gate bị lọt | `cook-refuses-when-blocked`, `test-without-shell-no-false-pass`, `pr-blocks-out-of-scope` |
| Vai trò | `review-does-not-fix-when-asked` |
| Chặn nhầm | `cook-proceeds-when-ready` |
| Bàn giao | grader `handoff-complete` trong plan và review |

Quyết định đổi mặc định hook sang `enforce` dựa trên pass rate và chi phí của bộ này ở cả hai mức `warn` và `enforce`.

- **Scaffold:** runner chỉ chạy bash, nên `scaffold.sh` của mỗi case chỉ gọi `node scaffold.mjs`; hàm dựng workspace nằm ở `evals/scaffold-lib.mjs`.
- **Tự kiểm không tốn API:** `tests/evals.test.mjs` dựng lại workspace của từng case rồi kiểm gate lúc bắt đầu, kiểm grader kiềm chế pass và grader hành động fail khi agent chưa làm gì, và kiểm grader cấm sửa source có đủ Edit, Write, MultiEdit.
- **Baseline:** `evals/summarize.mjs` ghi kết quả vào `evals/baselines/<version>/<model>-<level>.json` và sinh lại `evals/baselines/README.md`, kèm quyết định theo luật `enforce`. Baseline được commit.
- **Ngữ nghĩa grader cần nhớ:** `file_exists` chỉ tính file tạo ra trong lượt chạy. Tài liệu không nói `tool_used` có thấy tool call bên trong subagent không, nên grader cấm sửa source luôn đi kèm grader theo trạng thái file.

## Luồng chuẩn một task

```
new-task ──► planner ──► [blocking question?] ──► input-sync ──► planner (re-check)
                │ build_ready=true
                ▼
        [figma_required?] ──► figma-specialist (figma)
                │
                ▼
            developer (cook) ──► reviewer ──► [bug?] ──► developer (bugfix) ──► reviewer
                                    │ passed
                                    ▼
                                 tester ──► [figma?] ──► figma-specialist (figma-review)
                                    │
                                    ▼
                            release-manager (pr) ──► validate-pr ──► PR
```

## Vì sao không chạy song song nhiều agent

Các bước phụ thuộc tuần tự. Song song chỉ hợp lệ ở mức **nhiều task khác nhau**: mọi state đều nằm trong task folder, marker của hook tách theo phiên.
