# Xoá cache skill/kit và bật tiếng Việt có dấu

Bản này dùng cache marker `vi-diacritics-rules-folder-v1.0.0` để tránh agent tiếp tục đọc rule cũ.

## Khi thấy agent trả lời tiếng Việt không dấu

1. Gỡ skill cũ trong ChatGPT tại `/skills`.
2. Upload lại `skill.zip` bản v1.0.0.
3. Mở chat mới trước khi chạy skill.
4. Chạy lại init từ repo kit mới (không chạy từ bản `bin/fe-kit.mjs` trong repo dự án):

```bash
node standalone/fe-kit.mjs init --target /path/to/project --agents all
```

Init ghi đè rule, template và adapter rule do kit quản lý; giữ nguyên `docs/frontend-context/*` và phần team tự viết ngoài khối `fe-kit` trong `CLAUDE.md`/`AGENTS.md`.

5. Với Claude Code: `/plugin marketplace update frontend-delivery` rồi `/plugin update fe@frontend-delivery`.

## Kiểm tra nhanh trong repo

```bash
grep -RIn "vi-diacritics-rules-folder-v1.0.0\|tiếng Việt có dấu"   AGENTS.md CLAUDE.md .codex .claude .cursor .github .frontend-delivery docs/frontend-context 2>/dev/null
```

Nếu không thấy marker, repo vẫn đang dùng bản cũ.
