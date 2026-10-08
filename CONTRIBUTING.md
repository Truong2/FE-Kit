# Contributing

## Quy tắc quan trọng nhất: sửa ở nguồn, không sửa bản generate

Nguồn: `core/`, `packages/engine/`, `packages/pack-fe/` (gồm `pack.yaml`), `bin/fe-kit.mjs`, `evals/`, `tests/`. `packages/validators/` chỉ còn re-export `pack-fe` (cùng test gate FE và fixture).

Các thư mục sau là **output generate**, sửa tay sẽ bị `npm run build:check` chặn trong CI:

- `plugins/fe/` (toàn bộ plugin)
- `chatgpt-skill/frontend-delivery-standard/**`
- `standalone/fe-kit.mjs`
- `rules/`, `templates/`, `docs/` (top-level)
- `dist/**`
- `kit.yaml`, `packages/pack-*/src/manifest.gen.mjs` (sinh từ `pack.yaml`)

Sửa ở nguồn rồi chạy `npm run build`. Version chỉ sửa ở `package.json` gốc; generator đồng bộ sang `core/plugin.json`, `marketplace.json`, `kit.yaml`, `standard.yaml`, `VERSION.md`…

## Quy trình

```bash
npm install          # npm workspaces, esbuild, vitest
npm run build        # generate lại toàn bộ đích từ nguồn
npm run build:check  # xác nhận không lệch (CI chạy lệnh này)
npm test             # validators + hook + CLI bundle (cần build trước)
claude plugin validate ./plugins/fe --strict
```

Trước khi mở PR, các lệnh trên và CLI smoke test trong `.github/workflows/kit-ci.yml` phải xanh. Thay đổi prompt của command/agent/skill nên chạy thêm eval hành vi, từ rẻ đến đắt: `npm run eval:smoke` (mọi case 1 lần trên Haiku, trần 5 USD) trước, `npm run eval:gate` khi đổi gate hoặc hook. Chạy trên máy dùng tài khoản `claude` đang đăng nhập; trên CI dùng workflow `plugin-evals.yml` (chạy tay, chọn `profile`). Profile `gate`/`full` ghi baseline vào `evals/baselines/`, commit cùng PR.

## Thêm hoặc sửa case eval

- Mỗi case có `prompt.md`, `case.yaml`, `graders/`, `scaffold.mjs` và `scaffold.sh`. `scaffold.sh` chỉ gọi `node scaffold.mjs` (copy từ case có sẵn); hàm dựng workspace nằm ở `evals/scaffold-lib.mjs`.
- Case đo gate bị chặn thì thêm tên vào `ENTRY_BLOCKED` của `tests/evals.test.mjs`.
- Cấm sửa source thì cấm đủ `Edit`, `Write`, `MultiEdit` và thêm grader theo trạng thái file. `npm test` kiểm cả hai điều này.

## Thay đổi schema `workflow-status.md`

Schema nằm ở `packages/pack-fe/src/schema.mjs`. Phải tương thích ngược: không xoá field, không đổi field optional thành bắt buộc, không bỏ giá trị enum. Thêm giá trị enum hoặc field optional thì được. Thay đổi breaking phải bump major và ghi mục Breaking trong `CHANGELOG.md`.

## Thay đổi gate logic

Logic gate nằm ở hai chỗ, CLI, MCP server, hook và script chỉ import:

- `packages/engine/src/`: phần dùng chung cho mọi domain (state machine, gate kết thúc mode, scope diff, run-log, hook, MCP). Không nhắc khái niệm FE; `tests/engine-genericity.test.mjs` chạy engine trên pack mẫu và lint điều này.
- `packages/pack-fe/src/`: gate của FE (`gates.mjs`, `review-bugs.mjs`, `fe-checks.mjs`, luật vào mode trong `transitions.mjs`). Dữ liệu (mode, agent, artifact, rule, đường dẫn) nằm trong `packages/pack-fe/pack.yaml`.

Mỗi thay đổi gate phải kèm ít nhất 1 test pass + 1 test fail. Refactor không được đổi output: `tests/golden.test.mjs` so từng byte với `tests/golden/golden.json`; cố ý đổi output thì chạy lại `node tests/golden/capture.mjs` và giải thích trong CHANGELOG.

## Command, agent, adapter

- `core/commands/*.md`: nguồn của slash command plugin (generator chèn đoạn "Điều phối" theo bảng `AGENT_FOR_COMMAND`) và prompt Codex (`fe-kit init` sinh, bỏ frontmatter).
- `core/agents/*.md` + `core/agents/_protocol.md`: generator nối protocol vào cuối mỗi agent.
- `core/adapters/<agent>/`: payload `fe-kit init` copy vào repo dự án. `.cursor/rules/*.mdc` và `.github/instructions/*.md` vẫn viết tay (khác biệt theo tool).

## Commit convention

`feat|fix|chore|refactor|test|docs|perf(scope): message` — imperative mood, tiếng Anh cho commit message, tiếng Việt có dấu cho nội dung artifact/rule.
