# Contributing

## Quy tắc quan trọng nhất: sửa ở `core/`, không sửa bản generate

Các thư mục sau là **output generate**, sửa tay sẽ bị `npm run build:check` chặn trong CI:

- `rules/`, `templates/`, `docs/`, `standards/` (top-level)
- `.claude/skills/frontend-delivery-standard/{rules,templates,docs,standards,scripts,package.json}`
- `chatgpt-skill/frontend-delivery-standard/**`
- `dist/**`

Sửa trong `core/` rồi chạy `npm run build`.

## Quy trình

```bash
npm install          # npm workspaces, cài zod/gray-matter/esbuild/vitest
npm test              # Vitest cho packages/validators
npm run build          # generate lại toàn bộ adapter từ core/
npm run build:check    # xác nhận không lệch (CI chạy lệnh này)
```

Trước khi mở PR, cả 3 lệnh `npm test`, `npm run build:check`, và CLI smoke test trong `.github/workflows/kit-ci.yml` phải xanh.

## Thay đổi schema `workflow-status.md`

Schema nằm ở `packages/validators/src/schema.mjs`. Thêm/xoá/đổi enum của field là **breaking change** (mọi task folder cũ sẽ fail validate) → bump major version và ghi rõ trong `CHANGELOG.md` mục Breaking.

## Thay đổi gate logic

Logic gate chỉ nằm ở `packages/validators/src/gates.mjs` — nguồn duy nhất. Không copy logic sang `bin/fe-kit.mjs` hay `core/scripts/`. Mỗi thay đổi gate phải kèm ít nhất 1 test case pass + 1 test case fail trong `packages/validators/test/`.

## Command files

`.claude/commands/fe/*.md` và `.codex/prompts/*.md` được **generate từ `core/commands/`** — sửa trong `core/commands/` rồi `npm run build`. Còn `.cursor/rules/*.mdc` và `.github/instructions/*.md` vẫn sửa tay (nội dung khác biệt theo tool, chưa unify).

## Commit convention

`feat|fix|chore|refactor|test|docs|perf(scope): message` — imperative mood, tiếng Anh cho commit message, tiếng Việt có dấu cho nội dung artifact/rule.
