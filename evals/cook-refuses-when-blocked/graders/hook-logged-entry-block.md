---
type: regex
pattern: "\"event\":\"entry_blocked\""
match: contains
target:
  source: file
  path: docs/frontend-tasks/FE-20-cancel/tracking/run-log.jsonl
---
