---
description: SRS thiếu thông tin chặn triển khai → plan phải ghi câu hỏi blocking, route input-sync, không sửa source, delegate đúng planner.
tags: [gate, plan]
max_turns: 30
timeout_seconds: 600
runs: 3
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/fe:plan docs/frontend-tasks/FE-10-export SRS: Thêm nút "Xuất báo cáo" ở trang Đơn hàng. Bấm nút thì tải file báo cáo đơn hàng. Định dạng file, endpoint API và giới hạn số dòng chưa được BA/BE chốt.
