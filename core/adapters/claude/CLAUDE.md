# Claude Frontend Delivery Kit

## Bắt buộc

- Mọi artifact `.md` phải viết bằng tiếng Việt có dấu đầy đủ.
- Không mode nào được kết thúc chỉ bằng chat response.
- Mọi mode phải cập nhật `tracking/workflow-status.md`.
- `FE plan` phải cập nhật Input ledger trong `tracking/workflow-status.md` với đầy đủ input để các mode sau biết cần đọc gì.
- Rule mặc định nằm trong `.frontend-delivery/rules/` (repo này) hoặc trong skill `frontend-delivery-standard` của plugin; MCP tool `fe_begin_mode` trả về đúng rule cho từng mode.
- `docs/frontend-context/feature-source-context.md` chỉ dùng cho feature mẫu/cách code feature mẫu nếu có.
- Cache marker: `vi-diacritics-rules-folder-v1.0.0`.

## Cách chạy

Dùng plugin `fe` (bật trong `.claude/settings.json`): `/fe:new-task`, `/fe:plan`, `/fe:input-sync`, `/fe:figma`, `/fe:cook`, `/fe:review`, `/fe:bugfix`, `/fe:test`, `/fe:figma-review`, `/fe:pr`, `/fe:quick`.

- Main thread chỉ điều phối: mỗi mode được delegate cho subagent `fe:frontend-*` tương ứng; `/fe:quick` và `/fe:new-task` chạy inline.
- Chỉ `fe:frontend-developer` trong cook/bugfix (và main thread trong quick) được sửa source. Hook của plugin chặn agent khác sửa ngoài `docs/frontend-tasks/` và `docs/frontend-context/`.
- Mức thực thi hook đặt bằng biến môi trường `FE_KIT_HOOKS=off|warn|enforce`.
- `human_override: true` trong `workflow-status.md` chỉ được bật khi người dùng xác nhận.

## Token/evidence gates

- Áp dụng `efficiency-budget-contract.md` để chỉ đọc file cần thiết theo mode.
- Áp dụng `evidence-scope-contract.md` khi cook/review/test/figma-review/pr. Dùng MCP tool `fe_scope_diff` để đối chiếu `git diff` với plan.
- Không claim test/lint/typecheck/build pass nếu chưa chạy thật.
- Không sửa file ngoài plan nếu chưa update plan/input-sync.
- Nếu còn câu hỏi blocking/open trong `planning/questions.md`, prompt tiếp theo phải là `FE input-sync`; không được sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
