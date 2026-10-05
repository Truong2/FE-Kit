#!/usr/bin/env bash
# Ghi nội dung thật cho task "nút huỷ đơn" (fixture chỉ có placeholder):
# task.md, implementation-plan (có bảng "File sẽ tạo / cập nhật"), build-checklist.
# Dùng: cancel-order-task.sh <task-folder>. Chạy SAU scaffold-task.sh, trước commit.
set -euo pipefail
TASK="$1"

cat > "$TASK/task.md" <<'EOF'
# Nút huỷ đơn hàng

## Yêu cầu (SRS 3.2)

- Trang chi tiết đơn có nút "Huỷ đơn" khi đơn ở trạng thái `PENDING`.
- Bấm nút thì hiện hộp thoại xác nhận; chỉ khi người dùng xác nhận mới gọi `POST /orders/{id}/cancel`.
- API trả `409 ORDER_ALREADY_SHIPPED` thì hiện thông báo lỗi inline dưới nút: "Đơn đã giao cho đơn vị vận chuyển, không thể huỷ".
EOF

cat > "$TASK/planning/implementation-plan.md" <<'EOF'
# Kế hoạch triển khai

## 1. Tóm tắt phạm vi

Thêm nút huỷ đơn có hộp thoại xác nhận và xử lý lỗi `409 ORDER_ALREADY_SHIPPED` theo SRS 3.2.

## 3. Ma trận trace SRS → FE logic → UI → Test

| SRS | FE logic | UI | Test |
|---|---|---|---|
| 3.2 xác nhận trước khi huỷ | `onCancel` chỉ gọi API sau khi xác nhận | Hộp thoại xác nhận | Unit test component |
| 3.2 lỗi 409 | Map `ORDER_ALREADY_SHIPPED` sang thông báo inline | Text lỗi dưới nút | Unit test component |

## 7. File sẽ tạo / cập nhật

| File | Hành động | Lý do | Checklist ref |
|---|---|---|---|
| `src/components/OrderCancelButton.tsx` | Tạo / cập nhật | Nút huỷ, hộp thoại xác nhận, lỗi inline | IMP-01 |

## 8. Scope diff guard

| Quy tắc | Quyết định |
|---|---|
| File ngoài bảng trên có được sửa không? | Không, trừ khi update plan/input-sync trước |
EOF

cat > "$TASK/planning/build-checklist.md" <<'EOF'
# Build checklist

| ID | Nội dung | Trạng thái | Evidence |
|---|---|---|---|
| IMP-01 | `OrderCancelButton` hỏi xác nhận trước khi gọi API, hiện lỗi 409 inline | Chưa làm |  |
EOF
