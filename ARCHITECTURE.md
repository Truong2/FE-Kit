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
