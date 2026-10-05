---
paths:
  - "docs/frontend-tasks/**/*.md"
---

# Frontend task folder rules

Cấu trúc task chuẩn (theo `standard.yaml` → `standard_task_structure`):

```text
docs/frontend-tasks/<task-folder>/
  task.md
  planning/
    implementation-plan.md
    build-checklist.md
    questions.md
  tracking/
    workflow-status.md
    input-sync-report.md      # conditional, chỉ tạo khi có CR/clarification
    review-bugs.md            # conditional
    cr-impact-report.md       # conditional
  output/
    figma-reference-screenshots/
    figma-extraction-summary.md    # conditional
    review-report.md               # conditional
    test-summary.md                # conditional
    pr-summary.md                  # conditional
    ui-figma-review-report.md      # conditional
```

Không tạo folder `input/` riêng cho `srs.md`/`api-contract.md`. SRS và API contract là input tham chiếu, được ghi lại (link/section/ID) trong `task.md` và `tracking/workflow-status.md` (Input ledger), không lưu bản copy trong task folder.

Shared source/design context nằm ở `docs/frontend-context/`. Rule mặc định nằm ở `.frontend-delivery/rules/` sau khi `fe-kit init`.

Tạo hoặc cập nhật `planning/implementation-plan.md` trước implementation. Không implement production code khi plan bị chặn (`build_ready: false` hoặc còn blocking question).
