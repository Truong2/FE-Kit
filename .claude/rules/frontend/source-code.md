---
paths:
  - "src/**/*.{ts,tsx,js,jsx}"
  - "app/**/*.{ts,tsx,js,jsx}"
  - "components/**/*.{ts,tsx,js,jsx}"
---

# Frontend source rules

Khi sửa source FrontEnd, dùng API/service/query layers hiện có, đặt state ở scope nhỏ nhất hợp lệ, dùng design tokens/core components và follow similar feature patterns.

Không sửa shared core components, design tokens, generated clients hoặc routing architecture nếu task không yêu cầu rõ.
