# Kế hoạch triển khai và checklist build

`implementation-plan.md` là nơi quyết định architecture. Mỗi module/flow phải mô tả:

- Quyết định kiến trúc logic frontend
- File sẽ tạo/cập nhật
- Quyết định hook/store
- Quyết định vị trí state
- Quyết định global state
- Luồng người dùng
- Luồng API
- Quyết định lỗi API và hiển thị lỗi FE
- Luồng lỗi
- Kế hoạch test

`build-checklist.md` verify các quyết định đó. Mọi file/hook/store/state trong plan phải có item checklist tương ứng.


`build-checklist.md` phải verify từng error case đã plan: Error DTO/status/code mapping, error normalizer/mapper, field error, form alert, toast/snackbar core, page error, permission/session redirect và fallback. Không cho phép custom error UI nếu plan không quyết định rõ.


## Source pattern / clean code

Trước khi code, agent phải bám `Rule contract áp dụng cho implementation` trong plan. Code mới phải follow rule contract về page composition, component split, query/mutation/flow hook, API service, DTO/mapper, error normalizer, toast/form error/page error, permission/navigation và test.

Không được tạo custom UI, global store, abstraction, mapper hoặc hook mới nếu source đã có pattern phù hợp. Nếu implementation cần làm khác pattern, phải dừng để update plan/checklist hoặc route câu hỏi sang Dev.


## UI implementation clean code

Nếu task có Figma, implementation phải bám `UI Implementation Contract từ Figma` trong plan và `output/figma-extraction-summary.md`.

- Page/component vẫn phải clean theo feature source pattern.
- Visual/layout/state phải theo Figma evidence khi gate passed.
- Source component phải được map variant/props/token để match Figma.
- Không lấy UI base source làm chuẩn visual nếu Figma đã có evidence.
- Không tạo custom UI khi core component có thể match Figma bằng cấu hình hợp lệ.
