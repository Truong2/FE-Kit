# Frontend Tasks

Create a task with:

```bash
node bin/fe-kit.mjs new-task FE-123-login
```

Each task uses one standard structure:

```text
task.md
planning/implementation-plan.md
planning/build-checklist.md
planning/questions.md
tracking/workflow-status.md
output/figma-reference-screenshots/.gitkeep
```

Conditional files:

```text
tracking/input-sync-report.md          # after FE input-sync
tracking/cr-impact-report.md           # complex post-PR CR triage
output/figma-extraction-summary.md     # after FE figma
output/review-report.md                # after FE review if needed
output/test-summary.md                 # after FE test if needed
output/pr-summary.md                   # after FE pr
```

Use SRS references directly in `task.md`, `implementation-plan.md`, and `build-checklist.md`.


Use `FE quick <task>` only for small, low-risk localized changes with clear scope. It does not create additional task files by default and must escalate to `FE plan` or `FE input-sync` when requirements, Figma, API/DTO, state/store/hook architecture, or cross-module behavior is affected.
