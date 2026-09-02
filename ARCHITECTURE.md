# Kiến trúc Agent / Multi-Agent

## Mô hình: Orchestrator–Worker qua state file

```
┌─────────────────────────────────────────────────────┐
│  MAIN THREAD (orchestrator)                         │
│  - Đọc tracking/workflow-status.md → next_prompt    │
│  - Delegate cho subagent theo mode                  │
│  - KHÔNG tự implement/review — chỉ điều phối        │
└──────────────┬──────────────────────────────────────┘
               │ delegate theo description (auto) hoặc slash command
   ┌───────────┼───────────┬───────────┬────────────┐
   ▼           ▼           ▼           ▼            ▼
 planner   developer   reviewer    tester    figma-specialist
 (plan)    (cook/      (review)    (test)    (figma/
           quick/                             figma-review)
           bugfix)                    ▼
                              release-manager (pr)
```

**Nguyên tắc thiết kế** (theo chuẩn subagent Claude Code):

1. **Main thread là orchestrator, không có "orchestrator agent" riêng.** Subagent trong Claude Code không spawn được subagent khác — mọi kit đặt 1 agent làm orchestrator đều là anti-pattern, vì agent đó không delegate tiếp được. Việc điều phối thuộc về main conversation, dựa trên `next_prompt`.

2. **State file là giao thức giao tiếp giữa các agent.** Subagent có context window riêng, không thấy hội thoại của nhau. Mọi thứ agent sau cần biết phải nằm trong task folder (`workflow-status.md`, `implementation-plan.md`, `questions.md`...) — không nằm trong chat. Đây là lý do gate `validate-workflow` bắt buộc agent ghi state ra file thay vì chỉ trả lời trong chat.

3. **Least-privilege theo role.** Mỗi agent chỉ khai báo `tools:` tối thiểu:

| Agent | tools | Vì sao |
|---|---|---|
| frontend-planner | Read, Grep, Glob, Write, Edit | Plan không được chạy lệnh sửa hệ thống — không Bash |
| frontend-figma-specialist | Read, Grep, Glob, Write, Edit | Chỉ trích xuất evidence — không Bash |
| frontend-developer | + Bash | Cần chạy build/test khi code |
| frontend-reviewer | + Bash | Cần chạy lint/test để verify claim |
| frontend-tester | + Bash | Chạy test là việc chính |
| frontend-release-manager | + Bash | Cần git log/diff cho scope check |

4. **Description là hợp đồng delegate.** Main thread chọn subagent dựa trên `description` — nên mỗi description ghi rõ *khi nào dùng* ("Dùng khi chạy FE cook...", "Không dùng khi plan chưa build_ready"). Đây là cơ chế auto-delegation, không cần user gọi đích danh.

5. **Handoff luôn qua `next_prompt`.** Agent kết thúc mode phải ghi `next_mode` + `next_prompt` vào `workflow-status.md`. Main thread (hoặc user) chỉ cần chạy `fe-kit next <task>` để biết bước kế — không agent nào tự ý nhảy mode.

## Luồng chuẩn một task

```
new-task ──► planner ──► [blocking question?] ──► input-sync ──► planner (re-check)
                │ build_ready=true
                ▼
        [figma_required?] ──► figma-specialist
                │
                ▼
            developer (cook) ──► reviewer ──► [bug?] ──► developer (bugfix) ──► reviewer
                                    │ passed
                                    ▼
                                 tester ──► [figma?] ──► figma-specialist (figma-review)
                                    │
                                    ▼
                            release-manager (pr) ──► validate-pr gate ──► PR
```

Mọi mũi tên đều được enforce bằng `packages/validators` — không phải chỉ bằng prompt. Agent không tuân routing sẽ fail `validate-workflow` trong CI.

## Vì sao không dùng mô hình "nhiều agent chạy song song"

Các bước của FE delivery phụ thuộc tuần tự (không plan xong thì không cook được; không cook xong thì không review được). Chạy song song chỉ hợp lệ ở mức **nhiều task khác nhau** (mỗi task 1 folder, state độc lập) — kit đã hỗ trợ sẵn vì mọi state đều scoped theo task folder, không có global state.
