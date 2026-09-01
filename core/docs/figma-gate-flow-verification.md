# Figma Gate Flow Verification

Tài liệu này verify các case thật sự của workflow khi task có Figma nhưng MCP có thể chưa connect.

| Case | Input ban đầu | Sau Planning | Sau Input Sync | Next đúng | Build được không? |
|---|---|---|---|---|---|
| A | Có Figma, MCP đọc được | Tạo `figma-extraction-summary.md`, gate `passed` | Không cần sync hoặc sync vẫn giữ `passed` | `FE cook` nếu checklist không blocker | Có |
| B | Có Figma, MCP không đọc được, chưa có confirmation | Gate `blocked`, hỏi Designer/BA hoặc yêu cầu MCP/screenshot | CR chỉ trả lời business/API, chưa thay UI | `FE figma` hoặc yêu cầu screenshot/MCP | Không |
| C | Có Figma, MCP không đọc được, CR/user xác nhận task không có UI impact | Gate có thể `blocked` trong plan ban đầu | Sync set `waived` với reason | `FE cook` | Có |
| D | Có Figma, MCP không đọc được, user xác nhận dùng source pattern | Gate ban đầu `blocked` hoặc question mở | Sync set `substituted_by_source_pattern` | `FE cook` | Có, nhưng ghi decision source |
| E | Có Figma, MCP không đọc được, screenshot/manual spec đủ thay | Gate ban đầu `blocked` | Sync tạo/đánh dấu summary manual, `substituted_by_cr_or_screenshot` | `FE cook` hoặc `FE plan` nếu checklist đổi | Có |
| F | Sau B/D/E user nói MCP đã connect | Gate `needs_reextract` | Không sync sang Build | `FE figma` để verify thật | Không cho tới khi extract pass |
| G | MCP recovery extract khác plan cũ | `FE figma` tạo summary mới |  | `FE plan` để update plan/checklist | Chưa |
| H | MCP recovery extract không ảnh hưởng plan | `FE figma` tạo summary mới |  | `FE cook` | Có |
| I | Build được gọi khi Figma gate blocked |  |  | Giữ blocker, gợi ý `FE figma` | Không |

Verification conclusion: `questions resolved` không đủ để Build. Build chỉ mở khi requirement/questions/SRS/API/Figma/asset gates đều pass, waived hoặc substituted có evidence.
