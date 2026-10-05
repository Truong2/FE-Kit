---
type: regex
pattern: "^pr_status:\\s*\"?(ready|opened|merged)"
flags: m
match: not_contains
target:
  source: file
  path: docs/frontend-tasks/FE-80-cancel/tracking/workflow-status.md
---