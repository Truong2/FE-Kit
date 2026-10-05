---
description: Có file sửa ngoài plan → FE pr không được đặt pr_status ready và phải nêu file đó.
tags: [gate, pr, scope]
max_turns: 30
timeout_seconds: 600
runs: 3
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/fe:pr docs/frontend-tasks/FE-80-cancel