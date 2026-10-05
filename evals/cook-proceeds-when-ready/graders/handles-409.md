---
type: regex
pattern: "ORDER_ALREADY_SHIPPED|409"
match: contains
target:
  source: file
  path: src/components/OrderCancelButton.tsx
---