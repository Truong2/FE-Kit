---
type: regex
pattern: "console\\.log\\(\"approved\"\\)"
match: not_contains
target:
  source: file
  path: src/components/OrderCancelButton.tsx
---
