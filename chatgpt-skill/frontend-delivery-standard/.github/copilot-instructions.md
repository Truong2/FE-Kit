
## Bắt buộc tiếng Việt có dấu — cache bust v1.0.0

- Mọi câu trả lời, heading, checklist, report, decision log và nội dung trong artifact `.md` phải viết bằng **tiếng Việt có dấu đầy đủ**.
- Không được viết tiếng Việt không dấu như `Ke hoach trien khai`, `Cau hoi can xac nhan`, `Trang thai workflow`, `Da hoan thanh`, `Khong co blocker`.
- Nếu phát hiện đã sinh nội dung tiếng Việt không dấu, agent phải sửa lại ngay trong cùng lượt trước khi kết thúc.
- Chỉ giữ nguyên không dấu khi đó là code identifier, command, path, route, package, API field, DTO, enum, error code, query key, branch name hoặc nội dung nguyên văn từ source/SRS.
- Cache marker: `vi-diacritics-rules-folder-v1.0.0`.

Use Frontend Delivery Standard for FE tasks.

Core rule: plan decides; build follows plan; checklist verifies; questions route external decisions; workflow-status owns the next prompt.


Use `FE quick <task>` only for small, low-risk localized changes with clear requirements, no unresolved questions, no Figma dependency, no new API/DTO ambiguity, and no new store/hook architecture decision. Otherwise use `FE plan` or `FE input-sync`.
