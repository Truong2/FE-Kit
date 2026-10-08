---
type: llm
focus:
  source: file
  path: docs/frontend-retro/2026-10-08/proposals.md
---

PASS nếu có ít nhất một đề xuất dựa trên vấn đề lặp lại trong dữ liệu (bug nhóm `api-contract` với nguyên nhân gốc `plan-gap` ở cả hai task, hoặc code `SCOPE_OUT_OF_PLAN` bị chặn nhiều lần), có cột Bằng chứng nêu số liệu đó, có Metric theo dõi, và mọi đề xuất ở trạng thái Proposed.
FAIL nếu đề xuất không dựa trên dữ liệu (chung chung), thiếu bằng chứng, hoặc có đề xuất đã ở trạng thái Approved/Applied.
