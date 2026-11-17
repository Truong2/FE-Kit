---
type: regex
pattern: '\|\s*(Có|Co|Yes)\s*\|\s*(Passed|Pass|Đạt)'
flags: i
match: not_contains
target:
  source: file
  path: docs/frontend-tasks/FE-80-label/output/test-summary.md
---
