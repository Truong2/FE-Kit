# Mode Output Contract

| Mode | Artifact bắt buộc | Ghi chú |
|---|---|---|
| `FE plan` | `task.md`, `planning/implementation-plan.md`, `planning/build-checklist.md`, `planning/questions.md`, `tracking/workflow-status.md` | Không code; phải điền Input ledger. Nếu có blocking question thì next phải là `FE input-sync`, không được `FE cook`. |
| `FE quick` | `tracking/workflow-status.md`, checklist nếu có task folder | Chỉ task nhỏ/rủi ro thấp. |
| `FE input-sync` | `tracking/input-sync-report.md`, `planning/questions.md`, `tracking/workflow-status.md` | Luôn tạo report; nếu nhận câu trả lời blocking thì cập nhật questions/plan/checklist trước khi cho cook. |
| `FE figma` | `output/figma-extraction-summary.md`, `tracking/workflow-status.md` | UI/Figma contract. |
| `FE cook` | code changes, `planning/build-checklist.md`, `tracking/workflow-status.md` | Không chạy nếu còn blocking question/open hoặc input-sync required. |
| `FE review` | `output/review-report.md`, `tracking/workflow-status.md` | Nếu có issue, thêm `tracking/review-bugs.md`. |
| `FE bugfix` | `tracking/review-bugs.md`, `tracking/workflow-status.md` | Update trạng thái bug và next prompt. |
| `FE test` | `output/test-summary.md`, `tracking/workflow-status.md` | Ghi command đã chạy hoặc lý do chưa chạy. |
| `FE figma-review` | `output/ui-figma-review-report.md`, `tracking/workflow-status.md` | Bắt buộc cho UI/Figma trước PR nếu required. |
| `FE pr` | `output/pr-summary.md`, `tracking/workflow-status.md` | Chỉ pass khi không còn Critical/High. |

Gate câu hỏi: mọi mode sau plan phải dừng nếu `questions_status` còn `open/blocked` hoặc `blocking_questions_open > 0`; prompt tiếp theo bắt buộc là `FE input-sync`.
