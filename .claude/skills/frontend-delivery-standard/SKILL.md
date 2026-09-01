---
name: frontend-delivery-standard
description: dùng cho task frontend cần FE plan, FE quick, FE input-sync, FE figma, FE figma-review, FE cook, FE review, FE bugfix, FE test, FE pr. Bắt buộc tiếng Việt có dấu, rules folder chung, output tối thiểu theo mode, SRS/Figma gates, token budget, scope diff, command evidence và blocking question input-sync gate. Bản 1.0.x chặn route sang cook khi còn câu hỏi blocking/open.
---

# Frontend Delivery Standard

Cache marker: `vi-diacritics-rules-folder-v1.0.0`

## Luôn áp dụng

- Mọi câu trả lời và artifact `.md` phải viết bằng tiếng Việt có dấu đầy đủ.
- Không mode nào được kết thúc chỉ bằng chat response.
- Mọi mode phải tạo/cập nhật artifact bắt buộc và `tracking/workflow-status.md`.
- `tracking/workflow-status.md` là file duy nhất chứa `Prompt bước tiếp theo`.
- `FE plan` phải ghi đủ Input ledger trong `tracking/workflow-status.md` để các mode sau biết cần đọc input nào.
- Nếu `planning/questions.md` còn câu hỏi blocking/open, `workflow-status.md` phải route sang `FE input-sync`; không được route sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
- Rule mặc định nằm trong `rules/` của skill và khi init repo sẽ được copy sang `.frontend-delivery/rules/`.
- Không copy rule dài vào output; chỉ ghi rule ID/path và quyết định liên quan trực tiếp tới task.
- `docs/frontend-context/feature-source-context.md` chỉ mô tả feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin.

## Rule loading theo mode

- Luôn: `rules/core.md`, `rules/mode-output-contract.md`, `rules/plan-input-ledger-contract.md`, `rules/question-resolution-contract.md`, `rules/vietnamese-output.md`, `rules/efficiency-budget-contract.md`
- SRS/API: `rules/srs-api-contract.md`
- UI/Figma: `rules/figma-ui-contract.md`
- Cook/review/quick/bugfix: `rules/clean-code-contract.md`
- Cook/review/test/figma-review/pr: `rules/evidence-scope-contract.md`
- Review/bugfix/PR: `rules/review-bug-contract.md`

## Project context chuẩn

```text
docs/frontend-context/
  README.md
  project-source-context.md
  feature-source-context.md
  design-context.md
```

Không tạo `frontend-rule-context.md` trong `docs/frontend-context/`.

## Mode output bắt buộc

| Mode | Artifact bắt buộc |
|---|---|
| `FE plan` | `task.md`, `planning/implementation-plan.md`, `planning/build-checklist.md`, `tracking/workflow-status.md` |
| `FE quick` | `tracking/workflow-status.md`, checklist nếu có task folder |
| `FE input-sync` | `tracking/input-sync-report.md`, `tracking/workflow-status.md` |
| `FE figma` | `output/figma-extraction-summary.md`, `tracking/workflow-status.md` |
| `FE cook` | code changes, `planning/build-checklist.md`, `tracking/workflow-status.md` |
| `FE review` | `output/review-report.md`, `tracking/workflow-status.md`; có bug thì thêm `tracking/review-bugs.md` |
| `FE bugfix` | `tracking/review-bugs.md`, `tracking/workflow-status.md` |
| `FE test` | `output/test-summary.md`, `tracking/workflow-status.md` |
| `FE figma-review` | `output/ui-figma-review-report.md`, `tracking/workflow-status.md` |
| `FE pr` | `output/pr-summary.md`, `tracking/workflow-status.md` |

## Evidence gates

- Trước PR phải có review/test evidence bắt buộc theo task.
- Nếu có Figma/UI, cần UI review evidence hoặc waiver rõ ràng.
- Không sửa file ngoài plan nếu chưa update plan/input-sync.
- Không claim command pass nếu chưa chạy thật.

## Validation

```bash
npm run validate:task -- <task-folder>
npm run validate:workflow -- <task-folder>
npm run validate:pr -- <task-folder>
```
