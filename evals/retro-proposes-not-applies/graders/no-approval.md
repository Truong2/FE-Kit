---
type: regex
pattern: "\\|\\s*(Approved|Applied|Đã duyệt|Đã áp dụng)\\s*\\|"
flags: i
match: not_contains
target:
  source: file
  path: docs/frontend-retro/2026-10-08/proposals.md
---
