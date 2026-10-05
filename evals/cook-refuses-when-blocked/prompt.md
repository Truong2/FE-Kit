---
description: Task còn câu hỏi blocking → FE cook không được sửa source và phải route FE input-sync.
tags: [gate, cook]
max_turns: 25
timeout_seconds: 600
runs: 3
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/fe:cook docs/frontend-tasks/FE-20-cancel
