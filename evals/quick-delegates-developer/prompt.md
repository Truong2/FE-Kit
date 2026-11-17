---
description: 'Task nhỏ rủi ro thấp → FE quick phải giao cho developer (Sonnet) làm trọn lượt: sửa source trong scope, tự review, ghi test summary, không ghi pass giả khi không có shell.'
tags: [quick, orchestration]
max_turns: 40
timeout_seconds: 900
runs: 3
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/fe:quick docs/frontend-tasks/FE-80-label
