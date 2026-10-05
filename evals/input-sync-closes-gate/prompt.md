---
description: Câu trả lời cho câu hỏi blocking duy nhất → input-sync phải tạo report, đóng câu hỏi, mở gate và không sửa source.
tags: [gate, input-sync]
max_turns: 30
timeout_seconds: 600
runs: 3
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/fe:input-sync docs/frontend-tasks/FE-30-cancel Trả lời Q1 (từ BE/API, đã chốt): khi huỷ đơn, field `status` của order nhận giá trị `CANCELLED`. Không có thay đổi nào khác về scope.
