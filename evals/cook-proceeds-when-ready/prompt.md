---
description: Task đã build_ready, không còn câu hỏi blocking → FE cook phải được sửa đúng file trong plan, không bị gate chặn nhầm.
tags: [gate, cook, false-block]
max_turns: 40
timeout_seconds: 900
runs: 3
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/fe:cook docs/frontend-tasks/FE-70-cancel