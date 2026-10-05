# Kiến trúc Agent / Multi-Agent

Tài liệu này mô tả cơ chế **đang chạy thật** từ v2.0.0. Mỗi nguyên tắc đều chỉ ra nơi nó được thực thi; nguyên tắc nào chỉ nằm trong prompt thì ghi rõ như vậy.

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

## Các lớp và nơi thực thi

| Lớp | Thành phần | Nguồn | Thực thi bởi |
|---|---|---|---|
| Hướng dẫn | Skill `frontend-delivery-standard`, rule, template | `core/SKILL.md`, `core/rules/`, `core/templates/` | Prompt (mềm) |
| Điều phối | 11 slash command | `core/commands/` + đoạn delegation do generator chèn | Prompt (mềm) |
| Vai trò | 6 subagent | `core/agents/` + `_protocol.md` | `disallowedTools` (cứng) + prompt |
| Gate khi bắt đầu mode | `fe_begin_mode` | `core/mcp/server.mjs` → `evaluateModeEntry` | MCP tool trả verdict + nguyên văn rule |
| Gate khi chạy | Hook | `core/hooks/fe-hook.mjs` | Claude Code hook (cứng ở mức `enforce`) |
| Gate khi kết thúc / CI | Validator | `packages/validators/` | MCP, hook, CLI, CI |

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
   - **Rủi ro còn lại:** reviewer/tester/release-manager có Bash nên vẫn ghi được file qua shell. Lưới chặn cuối là scope diff ở `fe_scope_diff` và `validate-pr`.

4. **Description là hợp đồng delegate.** Mỗi description ghi rõ khi nào dùng và khi nào không. Plugin agent có tên `fe:<name>`.

5. **Handoff luôn qua `next_prompt`.** Mode kết thúc ghi `next_mode` + `next_prompt`. Không agent nào tự nhảy mode. `fe_begin_mode` so mode được yêu cầu với gate thật (câu hỏi blocking đếm từ `questions.md`, `build_ready`, Figma gate, review/bug) và với `next_mode` đã ghi.

6. **Sự thật tính được thắng field tự khai.** Scope diff tính từ `git diff` so với bảng "File sẽ tạo / cập nhật" của plan (`packages/validators/src/scope.mjs`). Command evidence đọc từ bảng `Command evidence log` của `output/test-summary.md`. Các field tự khai (`token_budget_status`, `scope_diff_status`…) chỉ còn là dự phòng và đã thành optional trong schema.
   - **Command evidence** (`summarizeCommandEvidence`): một dòng chỉ được tính là đã chạy khi cột "Đã chạy thật?" ghi `Có` và cột "Kết quả" ghi `Passed`/`Failed`. Ô trống, ô còn nguyên lựa chọn của template, `Có` kèm `Not run` là dòng thiếu dữ liệu và chỉ sinh cảnh báo. Lần chạy gần nhất của một lệnh mà `Failed` cũng chỉ cảnh báo, vì test fail đã route sang bugfix ở tầng mode.
   - **Scope tại từng điểm chuyển gate:**

     | Điểm | Nguồn danh sách file | Ghi chú |
     |---|---|---|
     | Cuối cook/bugfix/quick (hook) | File mới thay đổi trong mode, cộng file đã dirty từ trước mà nội dung bị đổi (so hash lúc mở mode) | Không hoàn tác thay đổi của người dùng; chỉ báo |
     | `fe_validate_workflow` ở review/test/pr-ready | `git diff` so với base ref, cộng thay đổi chưa commit | Plan/input-sync/figma không tính, tránh chặn nhầm thay đổi không liên quan |
     | `validate-pr` (CLI, CI) | Như trên | Luôn tính |

     Plan chưa có bảng file (task tạo từ v1.x) thì mọi điểm đều cảnh báo và dùng `scope_diff_status` tự khai. File thuộc plan của task khác cùng thư mục không bị tính là ngoài plan.

## Hook runtime

| Sự kiện | Hành vi |
|---|---|
| `UserPromptExpansion` / `UserPromptSubmit` | Nhận `/fe:<mode> <task>` hoặc `FE <mode> <task>` ở **đầu** prompt, ghi marker theo `session_id`. Gate bị chặn thì đưa lý do vào ngữ cảnh ngay. |
| `PostToolUse` `fe_begin_mode` | Ghi marker khi model tự vào mode mà không qua slash command. |
| `PreToolUse` Agent | Đánh dấu mode đã delegate đúng subagent. |
| `PreToolUse` Edit/Write | Luật theo vai (không cần marker) và luật theo gate (cook/bugfix/quick). Bật `human_override: true` thì hỏi người dùng. |
| `SubagentStop` | Kiểm tra gate kết thúc khi đúng subagent của mode dừng. |
| `Stop` | Kiểm tra gate kết thúc cho mode inline. |

- Mức thực thi: `FE_KIT_HOOKS=off|warn|enforce`, mặc định `warn`. Chuyển mặc định sang `enforce` sau khi eval hành vi đạt ngưỡng.
- Chặn tối đa một lần mỗi lần dừng (`stop_hook_active`), sau đó thả kèm cảnh báo để không lặp vô hạn.
- Mode bị gate từ chối chỉ cần `workflow-status.md` route đúng, không đòi artifact của mode.
- Lỗi nội bộ của hook luôn thoát 0 và không in gì.

Giới hạn đã biết (đều có test trong `tests/hook.test.mjs`):

- **Marker hết hạn sau 4 giờ:** coi như không có mode đang chạy, nên không chặn sửa source theo gate của task và không kiểm tra kết thúc. Luật theo vai vẫn áp dụng vì không cần marker.
- **Chuyển task giữa chừng:** lệnh FE mới thay marker của mode trước đang `pending` và phát cảnh báo nêu mode, task chưa qua gate kết thúc. Hook không tự quay lại kiểm tra task cũ.
- **Mode bỏ dở:** người dùng ngắt mode rồi hỏi việc khác thì `Stop` của lượt sau vẫn kiểm gate kết thúc của mode đó. Ở mức `enforce`, hook chặn đúng một lần rồi thả và đóng marker.
- **Ghi file qua shell:** hook chỉ thấy Edit/Write. Agent có Bash vẫn ghi được file; lưới chặn là scope diff ở các điểm chuyển gate phía trên.

## Mức kiểm tra theo adapter

| Adapter | Kiểm tra lúc agent chạy | Cách kiểm thủ công |
|---|---|---|
| Claude Code (plugin `fe`) | MCP `fe_begin_mode`/`fe_validate_workflow`/`fe_scope_diff`, hook, `disallowedTools` | Như cột bên dưới, khi cần |
| Codex, Cursor, Copilot | Không có: chỉ hướng dẫn trong prompt | `node bin/fe-kit.mjs validate-workflow <task>` trước khi kết thúc mode; `node bin/fe-kit.mjs validate-pr <task> --base <nhánh>` trước PR. Copilot có thêm workflow CI `frontend-delivery-standard.yml` |
| ChatGPT skill | Không có | `node scripts/validate-workflow.mjs <task>`, `node scripts/validate-pr.mjs <task> --base <nhánh>` trong gói skill |

`bin/fe-kit.mjs` là bản CLI standalone mà `fe-kit init` copy vào repo dự án. Hướng dẫn của từng adapter (`core/adapters/*`, `core/SKILL.md`) ghi rõ: chưa chạy lệnh, hoặc lệnh báo lỗi, thì không được ghi gate là passed.

## Ngân sách context theo mode

`fe_begin_mode` trả nguyên văn rule của mode. Số ký tự đo ở v2.1.0, task có Figma (trường hợp lớn nhất):

| Mode | Ký tự | Mode | Ký tự |
|---|---|---|---|
| plan | 7.987 | cook | 9.985 |
| quick | 8.665 | bugfix | 9.372 |
| input-sync | 7.411 | review | 10.692 |
| figma | 7.344 | test | 8.088 |
| figma-review | 8.664 | pr | 9.371 |

Khoảng 2–3,5 nghìn token mỗi mode. `tests/context-budget.test.mjs` đặt trần bằng số đo cộng khoảng 15% để rule không phình lên mà không ai để ý. Chưa có số liệu cho thấy cần tách rule thành mục lục/reference; khi cố ý thêm rule thì đo lại và nâng trần trong cùng PR.

## Eval hành vi

`evals/` chạy bằng `claude plugin eval` qua workflow `plugin-evals.yml` (chạy tay, có input `hooks_level`).

| Nhóm | Case |
|---|---|
| Đường đúng | `plan-routes-blocking-question`, `input-sync-closes-gate`, `review-writes-report` |
| Gate bị lọt | `cook-refuses-when-blocked`, `test-without-shell-no-false-pass`, `pr-blocks-out-of-scope` |
| Vai trò | `review-does-not-fix-when-asked` |
| Chặn nhầm | `cook-proceeds-when-ready` |
| Bàn giao | grader `handoff-complete` trong plan và review |

Quyết định đổi mặc định hook sang `enforce` dựa trên pass rate và chi phí của bộ này ở cả hai mức `warn` và `enforce`.

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
