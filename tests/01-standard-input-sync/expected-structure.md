# 01 Standard Input Sync Scenario

This is the single canonical full-kit scenario for v0.1.2.

Expected `new-task` output:

```txt
task.md
planning/implementation-plan.md
planning/build-checklist.md
planning/questions.md
tracking/workflow-status.md
output/figma-reference-screenshots/.gitkeep
```

Expected `FE input-sync` output only when CR/answers/clarification appears:

```txt
tracking/input-sync-report.md
```

Packaged ChatGPT/Claude skill scripts must contain only:

```txt
scripts/README.md
scripts/validate-task.ts
scripts/validate-workflow.ts
scripts/validate-pr.ts
```


Quick mode expectation:

```txt
FE quick <task> is supported only for small, low-risk localized changes and must escalate to FE plan/input-sync if any quick gate fails.
```
