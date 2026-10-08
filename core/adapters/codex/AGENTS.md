# Frontend Delivery Agent Kit

## Bắt buộc

- Mọi artifact `.md` phải viết bằng tiếng Việt có dấu đầy đủ.
- Không mode nào được kết thúc chỉ bằng chat response.
- Mọi mode phải cập nhật `tracking/workflow-status.md`.
- `FE plan` phải cập nhật Input ledger trong `tracking/workflow-status.md` với đầy đủ input để các mode sau biết cần đọc gì.
- Rule mặc định nằm trong `.frontend-delivery/rules/`.
- `docs/frontend-context/feature-source-context.md` chỉ dùng cho feature mẫu/cách code feature mẫu nếu có.
- Cache marker: `vi-diacritics-rules-folder-v1.0.0`.

## Prompts

Dùng `FE plan`, `FE input-sync`, `FE figma`, `FE cook`, `FE review`, `FE bugfix`, `FE test`, `FE figma-review`, `FE pr`, `FE quick`.

## Token/evidence gates

- Áp dụng `.frontend-delivery/rules/efficiency-budget-contract.md` để chỉ đọc file cần thiết theo mode.
- Áp dụng `.frontend-delivery/rules/evidence-scope-contract.md` khi cook/review/test/figma-review/pr.
- Không claim test/lint/typecheck/build pass nếu chưa chạy thật.
- Không sửa file ngoài plan nếu chưa update plan/input-sync.
- Nếu còn câu hỏi blocking/open trong `planning/questions.md`, prompt tiếp theo phải là `FE input-sync`; không được sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.

## Mức kiểm tra

Codex không có MCP hay hook của kit: không có gì tự chặn sai gate lúc agent chạy. Gate chỉ được kiểm khi chạy CLI của kit (`bin/fe-kit.mjs`, do `fe-kit init` copy vào repo):

- Khi bắt đầu mỗi mode: `node bin/fe-kit.mjs mode begin <task-folder> <mode> --actor codex`. Lệnh in verdict của gate, artifact bắt buộc và nguyên văn rule của mode. Exit 1 là mode bị chặn: chỉ cập nhật `workflow-status.md` theo prompt được in ra rồi dừng, không sửa source.
- Trước khi kết thúc mỗi mode: `node bin/fe-kit.mjs mode end <task-folder> <mode> --actor codex`. Cùng gate kết thúc mode với hook của Claude Code: `workflow-status.md` đã cập nhật, `current_mode` đúng, đủ artifact, qua validator; task ở review/test/pr thì đối chiếu file đã sửa (git) với plan.
- Hai lệnh trên và `validate-*` ghi sự kiện vào `tracking/run-log.jsonl` của task; commit file này cùng task. `node bin/fe-kit.mjs report` tổng hợp lại.
- Trước khi mở PR: `node bin/fe-kit.mjs validate-pr <task-folder> --base <nhánh-đích>`.
- Chưa chạy, hoặc lệnh báo lỗi, thì không ghi gate là passed trong `workflow-status.md`; ghi lại lệnh đã chạy và kết quả.
