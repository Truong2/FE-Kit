# Vietnamese Output Cheatsheet

File này dành cho dev/agent khi tạo output Markdown từ workflow frontend delivery.

## Quy tắc nhanh

- Tên file, path, command, mode giữ nguyên tiếng Anh.
- Tiêu đề chính có thể giữ tiếng Anh.
- Nội dung mô tả, bảng trạng thái, checklist, decision, bug, risk và prompt tiếp theo viết tiếng Việt.
- Mỗi file output/tracking phải cho biết: đang ở bước nào, trạng thái ra sao, bước tiếp theo là gì, copy prompt nào để chạy tiếp.

## Mapping trạng thái

| Technical status | Tiếng Việt nên dùng |
|---|---|
| Ready for implementation | Sẵn sàng triển khai |
| Ready with assumptions | Sẵn sàng triển khai với giả định |
| Blocked | Bị chặn |
| In progress | Đang thực hiện |
| Completed | Hoàn tất |
| Changes requested | Cần sửa |
| Pass | Đạt |
| Failed | Thất bại |
| Ready for PR | Sẵn sàng tạo PR |

## Khung trạng thái nên dùng

```md
## Current Step

| Trường | Giá trị | Ghi chú |
|---|---|---|
| Bước hiện tại | Planning - Lập kế hoạch | Đang lập kế hoạch triển khai |
| Trạng thái bước | Sẵn sàng triển khai | Không còn blocker High/Critical |
| Bước trước | Input - Chuẩn bị đầu vào | Đã có SRS và API contract |
| Bước tiếp theo | Implementation - Triển khai | Chạy Start Build Check trước khi code |
| Cập nhật lúc |  | Ghi thời điểm nếu có |
```
