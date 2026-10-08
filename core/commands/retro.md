---
description: Tổng hợp run-log và bug của các task thành đề xuất cải tiến rule/template; không tự áp dụng.
argument-hint: "[--since YYYY-MM-DD] [--date YYYY-MM-DD]"
---

Chạy retro cho repo này: $ARGUMENTS

## Điều phối (Claude Code)

Bạn là main thread điều phối. Không tự viết đề xuất.

1. Delegate cho subagent `fe:frontend-retro-analyst` bằng Agent tool và chạy foreground. Brief gồm: đường dẫn tuyệt đối của workspace, `since` và `date` nếu argument có.
2. Khi agent trả về, gọi MCP tool `fe_validate_retro` cho thư mục retro. Nếu `FAILED`, gửi lỗi cho chính agent đó để sửa.
3. Trả lời người dùng ngắn gọn: đường dẫn `retro-report.md` và `proposals.md`, số đề xuất theo phạm vi, và cách duyệt: đổi Trạng thái sang `Approved`, điền Người duyệt (hook sẽ hỏi xác nhận); đề xuất `project` đã duyệt thì thêm vào `docs/frontend-context/team-rules.md` dưới mục `## <mode>` hoặc `## Mọi mode`; đề xuất `upstream` xuất bằng `node bin/fe-kit.mjs retro export <thư-mục-retro>`.

Môi trường không có subagent (Codex, Cursor, Copilot): chạy `node bin/fe-kit.mjs retro --write` để có `retro-data.json`, rồi tự làm theo phần dưới.

## Hướng dẫn

- Đề xuất chỉ dựa trên số liệu trong `retro-data.json`; tối đa 5 đề xuất; mỗi đề xuất có Bằng chứng, Đích, Thay đổi đề xuất, Metric theo dõi, Phạm vi.
- Mọi đề xuất ở trạng thái `Proposed`. Không sửa rule, template, source hay `team-rules.md` trong lệnh này.
- Viết bằng tiếng Việt có dấu đầy đủ; giữ nguyên code, path, reason code.
