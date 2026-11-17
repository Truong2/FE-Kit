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

Dùng plugin `fe` (bật trong `.claude/settings.json`). **Quy trình kit chỉ chạy khi người dùng gọi `/fe:*`** (hoặc prompt `FE <mode>`); yêu cầu thường không có lệnh đó thì làm như bình thường, không tự áp quy trình, không tự tạo task folder hay delegate cho agent `fe:frontend-*`. Giao yêu cầu frontend qua kit: `/fe:task <yêu cầu>` — router phân loại, tạo task folder rồi **tự điều phối qua các agent tới khi task sẵn sàng PR**; chỉ dừng với khối `⛔ CẦN BẠN XỬ LÝ` khi có blocker cần người xác nhận (câu hỏi blocking, input thiếu, file ngoài plan, bug Critical/High sau 2 vòng, gate lỗi, cần quyền chạy lệnh). Trả lời ngay trong chat hoặc `/fe:next [task]` để chạy tiếp. `auto_advance: false` trong `.frontend-delivery/standard.yaml` để duyệt từng bước. Các lệnh theo mode vẫn gọi được trực tiếp: `/fe:new-task`, `/fe:plan`, `/fe:input-sync`, `/fe:figma`, `/fe:cook`, `/fe:review`, `/fe:bugfix`, `/fe:test`, `/fe:figma-review`, `/fe:pr`, `/fe:quick`, và `/fe:retro` (định kỳ, đề xuất cải tiến rule; đề xuất đã duyệt nằm trong `docs/frontend-context/team-rules.md`).

- Main thread chỉ điều phối: mỗi mode được delegate cho subagent `fe:frontend-*` tương ứng; `/fe:task`, `/fe:next` và `/fe:new-task` chạy ở main thread. Mở phiên bằng `claude --agent fe:frontend-orchestrator` để main thread chạy bằng agent điều phối (Opus).
- Team và model: planner (kiến trúc), reviewer, retro-analyst dùng Opus; developer (cook, bugfix, quick), figma-specialist dùng Sonnet; input-sync chạy Sonnet; researcher, tester, release-manager dùng Haiku. `fe:frontend-researcher` không phải mode: router gọi nó trước `FE plan` khi cần dò codebase rộng, nó chỉ ghi `planning/research-brief.md`.
- Field của `tracking/workflow-status.md` đặt bằng MCP tool `fe_update_status` (không viết lại cả file).
- Chỉ `fe:frontend-developer` trong cook/bugfix/quick được sửa source. Hook của plugin chặn agent khác sửa ngoài `docs/frontend-tasks/` và `docs/frontend-context/`.
- Mức thực thi hook đặt bằng biến môi trường `FE_KIT_HOOKS=off|warn|enforce`.
- `human_override: true` trong `workflow-status.md` chỉ được bật khi người dùng xác nhận.

## Tư duy thiết kế trước prompt triển khai

- **Thiết kế trước khi viết prompt (design before you prompt):** xác định mục tiêu, ranh giới module, trách nhiệm, luồng dữ liệu, state và feedback trước khi viết prompt triển khai hoặc chuyển sang cook. Có thể dùng FE plan để làm rõ thiết kế; prompt triển khai phải dẫn tới quyết định đã ghi, thay vì để agent tự đoán kiến trúc.
- **Dùng spec làm khung (spec as scaffolding):** ghi contract đầu vào/đầu ra, ràng buộc, hành vi thành công/lỗi và tiêu chí chấp nhận vào plan/ma trận trace hiện có. Checklist và kiểm tra phải bám spec; khi input đổi, đồng bộ qua input-sync trước khi tiếp tục. Không cần tạo spec riêng hoặc sao chép dài nếu input đã đủ rõ.
- **Kiểm tra vai trò khi bỏ thành phần (deletion tests):** giả định bỏ một thành phần và nêu hành vi, contract, khả năng quan sát hoặc cơ chế bảo vệ bị mất cùng cách kiểm chứng. Nếu chưa tìm được ảnh hưởng, ghi ứng viên giản lược và phần cần xác minh; không kết luận dư thừa chỉ vì thiếu import. Đây là phân tích thiết kế, không phải yêu cầu xóa thật trong repo.

## Ba câu hỏi kiến trúc bắt buộc

- Trong `FE plan`, ghi ba câu trả lời vào `planning/implementation-plan.md`, mục `Ba câu hỏi kiến trúc`; dùng file/symbol hoặc cấu hình liên quan làm bằng chứng, phân biệt kết luận với giả định.
- **State nằm ở đâu?** Nêu nguồn chính, owner, phạm vi và thời điểm cập nhật. State workflow nằm trong artifact theo task; state frontend phải phân biệt UI/form/URL/server state và chọn phạm vi nhỏ nhất theo convention hiện có.
- **Feedback nằm ở đâu?** Nêu nơi ghi câu trả lời/CR, lỗi review và kết quả kiểm tra; xác định vòng phát hiện → sửa → kiểm tra lại → đóng. Với UI, nêu nơi hiển thị loading, validation, lỗi và thành công khi áp dụng.
- **Bỏ thành phần này thì cái gì bị ảnh hưởng?** Với thành phần định thêm/sửa/bỏ, nêu trách nhiệm, nơi phụ thuộc và hành vi/dữ liệu/contract/gate bị ảnh hưởng. Kiểm tra cả cấu hình, route, script hoặc nạp động khi liên quan; không xóa thật để thử.
- Cook/bugfix phải bám quyết định trong plan; review đối chiếu quyết định với diff và evidence. Với `FE quick`, ghi ngắn ba câu trả lời trong workflow hoặc checklist; nếu phát sinh kiến trúc state/hook mới hay ảnh hưởng liên module thì chuyển `FE plan`.
- Ghi `Không áp dụng` kèm lý do khi phù hợp. Nếu phần chưa rõ chặn triển khai, ghi vào `planning/questions.md` và route `FE input-sync` theo gate hiện có.

## Token/evidence gates

- Áp dụng `efficiency-budget-contract.md` để chỉ đọc file cần thiết theo mode.
- Áp dụng `evidence-scope-contract.md` khi cook/review/test/figma-review/pr. Dùng MCP tool `fe_scope_diff` để đối chiếu `git diff` với plan.
- Không claim test/lint/typecheck/build pass nếu chưa chạy thật.
- Không sửa file ngoài plan nếu chưa update plan/input-sync.
- Nếu còn câu hỏi blocking/open trong `planning/questions.md`, prompt tiếp theo phải là `FE input-sync`; không được sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
