---
type: regex
pattern: "^input_sync_required:\\s*false"
flags: m
match: contains
target:
  source: file
  path: docs/frontend-tasks/FE-30-cancel/tracking/workflow-status.md
---
