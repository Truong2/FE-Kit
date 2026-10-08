# FE-Kit — hướng dẫn cho người bảo trì kit

Repo này là **mã nguồn của kit**, không phải repo dự án dùng kit. Hướng dẫn cho repo dự án nằm ở `core/adapters/claude/CLAUDE.md` (được `fe-kit init` ghi vào repo dự án).

## Nguồn duy nhất

- Sửa trong `core/` (nội dung prompt của FE), `packages/engine/` (engine dùng chung) và `packages/pack-fe/` (`pack.yaml` + gate của FE), rồi chạy `npm run build`. Không sửa tay output generate: `plugins/fe/`, `chatgpt-skill/`, `standalone/`, `rules/`, `templates/`, `docs/` ở top-level, `kit.yaml`, `packages/pack-*/src/manifest.gen.mjs`.
- `packages/validators/` chỉ còn re-export `pack-fe` để giữ tên package và đường dẫn module cũ; test của gate FE và fixture dùng chung vẫn nằm ở đó.
- `npm run build:check` chặn PR khi quên build hoặc sửa tay output.
- Version chỉ đổi ở `package.json` gốc; generator đồng bộ sang các manifest.

## Kiểm tra trước khi xong việc

```bash
npm run build && npm run build:check
npm test                                   # mọi workspace + hook, MCP, CLI bundle, golden
claude plugin validate ./plugins/fe --strict
```

Test hook và CLI chạy trên bản bundle, nên phải `npm run build` trước `npm test`.

## Quy ước

- Gate logic: phần dùng chung cho mọi domain nằm trong `packages/engine/src/`, gate riêng của domain nằm trong `packages/pack-<id>/src/`. Không đặt gate trong CLI, hook hay MCP script. Mỗi gate mới cần ít nhất một test pass và một test fail.
- Engine không được nhắc khái niệm của FE (test `engine-genericity` chặn); dữ liệu của domain đi qua `pack.yaml` hoặc object pack.
- Refactor không được đổi output: `tests/golden.test.mjs` so với `tests/golden/golden.json`. Cố ý đổi output thì chạy lại `node tests/golden/capture.mjs` và giải thích trong CHANGELOG.
- Schema `workflow-status.md` phải tương thích ngược: không xoá field, không bắt buộc field mới.
- Artifact và tài liệu viết tiếng Việt có dấu đầy đủ; commit message tiếng Anh.
- Kiến trúc và nơi thực thi từng gate: `ARCHITECTURE.md`. Lộ trình: `ROADMAP.md`.
