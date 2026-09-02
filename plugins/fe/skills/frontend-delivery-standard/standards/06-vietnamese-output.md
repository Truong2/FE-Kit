
# Output tiếng Việt

Mọi artifact Markdown do skill/kit sinh ra phải viết bằng tiếng Việt có dấu đầy đủ.

## Bắt buộc tiếng Việt có dấu — cache bust v1.0.0

- Mọi câu trả lời, heading, checklist, report, decision log và nội dung trong artifact `.md` phải viết bằng **tiếng Việt có dấu đầy đủ**.
- Không được viết tiếng Việt không dấu như `Ke hoach trien khai`, `Cau hoi can xac nhan`, `Trang thai workflow`, `Da hoan thanh`, `Khong co blocker`.
- Nếu phát hiện đã sinh nội dung tiếng Việt không dấu, agent phải sửa lại ngay trong cùng lượt trước khi kết thúc.
- Chỉ giữ nguyên không dấu khi đó là code identifier, command, path, route, package, API field, DTO, enum, error code, query key, branch name hoặc nội dung nguyên văn từ source/SRS.
- Cache marker: `vi-diacritics-rules-folder-v1.0.0`.


Giữ nguyên các phần sau nếu chúng xuất hiện trong source/SRS/API:

- code identifiers, function, hook, component, store name
- file paths, commands, package names
- API field names, DTO names, enum, error code, route
- SRS section/page/link/id

Heading trong template/task mới phải ưu tiên tiếng Việt, ví dụ:

- `# Kế hoạch triển khai`
- `# Checklist build`
- `# Câu hỏi cần xác nhận`
- `# Trạng thái workflow`
- `## Prompt bước tiếp theo`

Không dùng heading tiếng Anh trong artifact mới, trừ khi user yêu cầu bản tiếng Anh.
