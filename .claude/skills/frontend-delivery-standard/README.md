# Frontend Delivery Agent Kit

Bộ chuẩn frontend delivery tiếng Việt cho ChatGPT Skill, Claude Code, Codex, Cursor và GitHub Copilot.

Version: 0.1.16

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

## Cấu trúc rule/context

```text
.frontend-delivery/
  rules/                 # rule mặc định dùng chung cho các agent
docs/frontend-context/
  README.md
  project-source-context.md
  feature-source-context.md
  design-context.md
```

`feature-source-context.md` chỉ dùng để mô tả feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin. Rule bắt buộc nằm trong `.frontend-delivery/rules/`.

## Cài vào project

```bash
node bin/fe-kit.mjs init --target /path/to/project --agents all
```

## Mode chính

- `FE plan <task-folder>`
- `FE input-sync <task-folder> <answer-or-cr>`
- `FE figma <task-folder> <figma-link>`
- `FE cook <task-folder>`
- `FE review <task-folder>`
- `FE bugfix <task-folder>`
- `FE test <task-folder>`
- `FE figma-review <task-folder>`
- `FE pr <task-folder>`
- `FE quick <task-folder>`

Mọi mode phải cập nhật artifact bắt buộc và `tracking/workflow-status.md`.

## Token/evidence gates

- Agent phải đọc đúng file cần thiết theo mode, không đọc/copy toàn bộ context nếu không cần.
- Trước PR phải có scope diff passed/not_required và command evidence completed/not_required.
- Với UI/Figma, Playwright screenshot diff là ưu tiên; nếu chưa có setup thì ghi manual/static evidence và lý do.


Ghi chú v1.0.0: `FE plan` phải cập nhật Input ledger trong `tracking/workflow-status.md`; checklist được khôi phục lean gates để không bỏ sót SRS/API/error/state/UI/test.
