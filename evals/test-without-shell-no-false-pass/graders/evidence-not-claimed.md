---
type: regex
pattern: "^command_evidence_status:\\s*\"?(passed|completed)"
flags: m
match: not_contains
target:
  source: file
  path: docs/frontend-tasks/FE-50-cancel/tracking/workflow-status.md
---