# Clean Code Contract

- Page chỉ compose layout/hook, không chứa API mapping hoặc business flow dài.
- Presentational component không gọi API, không normalize error.
- Query hook chỉ xử lý read/cache/loading/error; mutation hook xử lý mutate/success/error/invalidate đúng scope.
- Chọn state scope nhỏ nhất: local → parent → module → global.
- Không duplicate server state từ React Query/SWR vào global store.
- Không dùng `any` để né DTO/contract.
- Không custom toast/modal/component nếu project đã có core pattern phù hợp.
- Không hardcode display string nếu project có i18n.
- Nếu cần architecture mới, cập nhật plan/checklist trước khi code.
