# Checklist build (rút gọn — task rủi ro thấp)

> Checklist cho task `risk_level: low`. Mục không áp dụng thì đánh dấu `Không áp dụng` kèm lý do ngắn.

## 1. Gate trước khi code

| ID | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| GATE-01 | Không còn blocking question; nếu có thì next phải là `FE input-sync`, không được `FE cook` | Chưa làm |  |
| GATE-02 | Đã đọc yêu cầu/SRS/API liên quan và source của các file trong plan | Chưa làm |  |

## 2. SRS coverage

| ID | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| SRS-01 | Hành vi đổi đã trace sang FE behavior; không tự bịa field/API/status | Chưa làm / Không áp dụng |  |
| ERR-01 | Error/status đổi (nếu có) map đúng cách hiển thị đã có trong project | Chưa làm / Không áp dụng |  |

## 6. Scope / Evidence / Test

| ID | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| SCOPE-01 | File đã sửa nằm trong plan hoặc đã input-sync update | Chưa làm |  |
| CODE-01 | Không thêm global state/custom UI/hook ngoài plan; không dùng `any` né type | Chưa làm |  |
| TEST-01 | Typecheck/lint/test/build liên quan đã chạy thật, ghi trong Command evidence log | Chưa làm |  |
| REVIEW-01 | Review report đã tạo/cập nhật | Chưa làm |  |
| PR-01 | Không còn Critical/High issue | Chưa làm |  |
