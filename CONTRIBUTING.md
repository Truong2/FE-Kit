# Contributing

## Quy tắc quan trọng nhất: sửa ở nguồn, không sửa bản generate

Nguồn: `core/`, `packages/validators/`, `bin/fe-kit.mjs`, `evals/`, `tests/`.

Các thư mục sau là **output generate**, sửa tay sẽ bị `npm run build:check` chặn trong CI:

- `plugins/fe/` (toàn bộ plugin)
- `chatgpt-skill/frontend-delivery-standard/**`
- `standalone/fe-kit.mjs`
- `rules/`, `templates/`, `docs/` (top-level)
- `dist/**`

Sửa ở nguồn rồi chạy `npm run build`. Version chỉ sửa ở `package.json` gốc; generator đồng bộ sang `core/plugin.json`, `marketplace.json`, `kit.yaml`, `standard.yaml`, `VERSION.md`…

## Quy trình

```bash
npm install          # npm workspaces, esbuild, vitest
npm run build        # generate lại toàn bộ đích từ nguồn
npm run build:check  # xác nhận không lệch (CI chạy lệnh này)
npm test             # validators + hook + CLI bundle (cần build trước)
claude plugin validate ./plugins/fe --strict
```

Trước khi mở PR, các lệnh trên và CLI smoke test trong `.github/workflows/kit-ci.yml` phải xanh. Thay đổi prompt của command/agent/skill nên chạy thêm eval hành vi (`.github/workflows/plugin-evals.yml`, chạy tay vì tốn chi phí API), rồi commit baseline từ artifact `eval-baselines` vào `evals/baselines/`.

## Thêm hoặc sửa case eval

- Mỗi case có `prompt.md`, `case.yaml`, `graders/`, `scaffold.mjs` và `scaffold.sh`. `scaffold.sh` chỉ gọi `node scaffold.mjs` (copy từ case có sẵn); hàm dựng workspace nằm ở `evals/scaffold-lib.mjs`.
- Case đo gate bị chặn thì thêm tên vào `ENTRY_BLOCKED` của `tests/evals.test.mjs`.
- Cấm sửa source thì cấm đủ `Edit`, `Write`, `MultiEdit` và thêm grader theo trạng thái file. `npm test` kiểm cả hai điều này.

## Thay đổi schema `workflow-status.md`

Schema nằm ở `packages/validators/src/schema.mjs`. Phải tương thích ngược: không xoá field, không đổi field optional thành bắt buộc, không bỏ giá trị enum. Thêm giá trị enum hoặc field optional thì được. Thay đổi breaking phải bump major và ghi mục Breaking trong `CHANGELOG.md`.

## Thay đổi gate logic

Logic gate chỉ nằm trong `packages/validators/src/` (`gates.mjs`, `transitions.mjs`, `scope.mjs`, `modes.mjs`). CLI, MCP server, hook và script đều import từ đây — không copy logic sang chỗ khác. Mỗi thay đổi gate phải kèm ít nhất 1 test pass + 1 test fail.

## Command, agent, adapter

- `core/commands/*.md`: nguồn của slash command plugin (generator chèn đoạn "Điều phối" theo bảng `AGENT_FOR_COMMAND`) và prompt Codex (`fe-kit init` sinh, bỏ frontmatter).
- `core/agents/*.md` + `core/agents/_protocol.md`: generator nối protocol vào cuối mỗi agent.
- `core/adapters/<agent>/`: payload `fe-kit init` copy vào repo dự án. `.cursor/rules/*.mdc` và `.github/instructions/*.md` vẫn viết tay (khác biệt theo tool).

## Commit convention

`feat|fix|chore|refactor|test|docs|perf(scope): message` — imperative mood, tiếng Anh cho commit message, tiếng Việt có dấu cho nội dung artifact/rule.
