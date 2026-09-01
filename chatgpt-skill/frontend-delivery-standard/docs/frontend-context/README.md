# Frontend Context

Folder này chỉ chứa context riêng của project. Rule mặc định nằm trong `.frontend-delivery/rules/`, không nằm trong `docs/frontend-context/`.

## Thứ tự đọc

1. `.frontend-delivery/rules/README.md` và rule liên quan tới mode
2. `project-source-context.md`
3. `feature-source-context.md` nếu có feature mẫu đáng tin
4. `design-context.md`

## Vai trò

| File | Vai trò |
|---|---|
| `project-source-context.md` | Stack, command, folder convention cấp project |
| `feature-source-context.md` | Feature mẫu và cách code của feature mẫu nếu source base có mẫu đáng tin |
| `design-context.md` | Design system, shared UI, token, Figma rule |

Rule priority: SRS/API → Figma → `.frontend-delivery/rules/*` → design context → project context → feature mẫu nếu đáng tin → source code → agent assumption.
