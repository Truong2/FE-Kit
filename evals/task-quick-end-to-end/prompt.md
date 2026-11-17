---
description: 'Giao task bằng lời một lần → router phân loại low, tạo task, tự chạy quick qua developer rồi đi tiếp; kết thúc bằng báo xong hoặc khối "CẦN BẠN XỬ LÝ" (eval không có shell nên lệnh test không chạy được), không dừng hỏi giữa chừng.'
tags: [orchestration, router]
max_turns: 60
timeout_seconds: 1500
runs: 3
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

/fe:task Đổi nhãn nút "Huỷ đơn" thành "Huỷ đơn hàng" trong src/components/OrderCancelButton.tsx, không đổi hành vi.
