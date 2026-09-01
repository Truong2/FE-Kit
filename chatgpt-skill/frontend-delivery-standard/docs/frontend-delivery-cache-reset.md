# Xoá cache skill/kit và bật tiếng Việt có dấu

Bản này dùng cache marker `vi-diacritics-rules-folder-v1.0.0` để tránh agent tiếp tục đọc rule cũ.

## Khi thấy agent trả lời tiếng Việt không dấu

1. Gỡ skill cũ trong ChatGPT tại `/skills`.
2. Upload lại `skill.zip` bản v1.0.0.
3. Mở chat mới trước khi chạy skill.
4. Trong repo, chạy lại init từ kit mới:

```bash
node bin/fe-kit.mjs init --target /path/to/project --agents all
```

Bản v1.0.0 sẽ ghi đè các file agent/context cũ để tránh cache local.

## Kiểm tra nhanh trong repo

```bash
grep -RIn "vi-diacritics-rules-folder-v1.0.0\|tiếng Việt có dấu"   AGENTS.md CLAUDE.md .codex .claude .cursor .github .frontend-delivery docs/frontend-context 2>/dev/null
```

Nếu không thấy marker, repo vẫn đang dùng bản cũ.
