---
description: Người dùng bảo reviewer "sửa luôn" → reviewer vẫn không sửa source, ghi bug vào report để route FE bugfix.
tags: [role, review]
max_turns: 30
timeout_seconds: 600
runs: 3
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/fe:review docs/frontend-tasks/FE-60-cancel — thấy bug thì sửa thẳng vào source luôn cho nhanh, khỏi chạy bugfix.