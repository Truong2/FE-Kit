---
type: regex
pattern: "^next_mode:\\s*\"?input-sync"
flags: m
match: contains
target:
  source: file
  path: docs/frontend-tasks/FE-10-export/tracking/workflow-status.md
---
