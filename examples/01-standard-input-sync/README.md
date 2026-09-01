# Example: Standard task + Input Sync

Ví dụ duy nhất minh họa flow chuẩn v0.1.0:

```bash
node bin/fe-kit.mjs new-task FE-123-login
```

Sau planning, nếu nhận file trả lời hoặc CR mới:

```txt
FE input-sync docs/frontend-tasks/FE-123-login docs/srs/auth/CR/CR-002-answers.md
```

Output chính:

- `task.md`: overview, SRS/API map, decision log.
- `planning/implementation-plan.md`: Plan Version + frontend architecture decisions.
- `planning/build-checklist.md`: verify plan decisions.
- `planning/questions.md`: câu hỏi handoff.
- `tracking/input-sync-report.md`: chỉ tạo khi chạy `FE input-sync`.
- `tracking/workflow-status.md`: file duy nhất chứa `Prompt bước tiếp theo`.
