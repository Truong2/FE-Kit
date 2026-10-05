# FE-Kit — hướng dẫn cho người bảo trì kit

Repo này là **mã nguồn của kit**, không phải repo dự án dùng kit. Hướng dẫn cho repo dự án nằm ở `core/adapters/claude/CLAUDE.md` (được `fe-kit init` ghi vào repo dự án).

## Nguồn duy nhất

- Sửa trong `core/` và `packages/validators/`, rồi chạy `npm run build`. Không sửa tay output generate: `plugins/fe/`, `chatgpt-skill/`, `standalone/`, `rules/`, `templates/`, `docs/` ở top-level.
- `npm run build:check` chặn PR khi quên build hoặc sửa tay output.
- Version chỉ đổi ở `package.json` gốc; generator đồng bộ sang các manifest.

## Kiểm tra trước khi xong việc

```bash
npm run build && npm run build:check
npm test                                   # validators + hook + CLI bundle
claude plugin validate ./plugins/fe --strict
```

Test hook và CLI chạy trên bản bundle, nên phải `npm run build` trước `npm test`.

## Quy ước

- Gate logic chỉ nằm trong `packages/validators/src/`. Mỗi gate mới cần ít nhất một test pass và một test fail.
- Schema `workflow-status.md` phải tương thích ngược: không xoá field, không bắt buộc field mới.
- Artifact và tài liệu viết tiếng Việt có dấu đầy đủ; commit message tiếng Anh.
- Kiến trúc và nơi thực thi từng gate: `ARCHITECTURE.md`.
