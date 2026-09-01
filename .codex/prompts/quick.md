# FE quick

Use `FE quick <task-folder>` only for small, low-risk localized frontend changes.

Quick gate must be true before editing code:

- Scope is small and clear.
- No blocking question is open.
- No new SRS/API request/response/error DTO ambiguity.
- No Figma extraction or visual gate is required.
- No new global store, Zustand state, context, query layer, form library, or architecture decision is needed.
- No cross-module impact.

If any gate fails, stop and route to `FE plan` or `FE input-sync`.

Read `task.md`, `tracking/workflow-status.md`, and relevant source files. Make the minimal scoped change, update `workflow-status.md`, and keep `Prompt bước tiếp theo` only there.

## Ghi chú feature source pattern

Trước khi plan/cook/quick/review, đọc `.frontend-delivery/rules/` như rules folder bắt buộc. `feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin; không copy pattern xấu.

## Ngôn ngữ output

Viết bằng tiếng Việt có dấu đầy đủ (theo `.frontend-delivery/rules/vietnamese-output.md`, luôn áp dụng cho toàn project). Giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

