---
description: 'Giao task có SRS thiếu error contract → router route plan, planner ghi câu hỏi blocking, vòng điều phối dừng với khối "CẦN BẠN XỬ LÝ" nêu câu hỏi; không sửa source.'
tags: [gate, orchestration, router]
max_turns: 40
timeout_seconds: 900
runs: 3
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/fe:task Nút "Huỷ đơn" trong src/components/OrderCancelButton.tsx phải gọi API huỷ đơn và hiện lỗi khi không huỷ được. BE chưa chốt endpoint, mã lỗi và câu thông báo cho trường hợp đơn đã giao.
