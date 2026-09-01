
## Bắt buộc tiếng Việt có dấu — cache bust v1.0.0

- Mọi câu trả lời, heading, checklist, report, decision log và nội dung trong artifact `.md` phải viết bằng **tiếng Việt có dấu đầy đủ**.
- Không được viết tiếng Việt không dấu như `Ke hoach trien khai`, `Cau hoi can xac nhan`, `Trang thai workflow`, `Da hoan thanh`, `Khong co blocker`.
- Nếu phát hiện đã sinh nội dung tiếng Việt không dấu, agent phải sửa lại ngay trong cùng lượt trước khi kết thúc.
- Chỉ giữ nguyên không dấu khi đó là code identifier, command, path, route, package, API field, DTO, enum, error code, query key, branch name hoặc nội dung nguyên văn từ source/SRS.
- Cache marker: `vi-diacritics-rules-folder-v1.0.0`.

Use Frontend Delivery Standard for FE tasks.

Core rule: plan decides; build follows plan; checklist verifies; questions route external decisions; workflow-status owns the next prompt.


Use `FE quick <task>` only for small, low-risk localized changes with clear requirements, no unresolved questions, no Figma dependency, no new API/DTO ambiguity, and no new store/hook architecture decision. Otherwise use `FE plan` or `FE input-sync`.


## Ngôn ngữ artifact

Mọi file Markdown do agent tạo/cập nhật trong task phải viết bằng tiếng Việt có dấu. Chỉ giữ nguyên code/path/command/API field/DTO/error code/route/package/SRS section.


## Ghi chú lỗi API và hiển thị FE

Khi task có API/error state, plan phải quyết định rõ Error DTO/status/error code map sang UI nào: inline field error, form alert, toast/snackbar core, page error, redirect hoặc fallback. Ưu tiên dùng core component/hook có sẵn trong source; custom UI chỉ dùng khi plan ghi rõ lý do và evidence.

## Ghi chú feature source pattern

Trước khi plan/cook/quick/review, đọc `.frontend-delivery/rules/` như rules folder bắt buộc. `feature-source-context.md` chỉ dùng để tham chiếu feature mẫu/cách code feature mẫu nếu source base có mẫu đáng tin; không copy pattern xấu.

## UI/Figma strict mode v1.0.0

Bản này ép UI task có Figma phải đi qua `UI Implementation Contract`. Khi Figma gate passed, Figma là visual source of truth; source UI/core component chỉ là implementation base. Agent không được tự động làm theo UI base source nếu lệch Figma. Trước PR cho UI task, dùng `FE figma-review <task-folder>` hoặc review evidence tương đương để kiểm tra screenshot/UI đã build so với Figma.

## SRS/Figma strict contract v1.0.0

- SRS task phải có Ma trận trace SRS → FE logic → UI → Test trước build.
- UI/Figma task phải có UI Node Implementation Matrix và Figma → Source component binding cụ thể.
- Không fallback về UI base source nếu Figma gate passed và chưa có waiver.
- PR cho UI/Figma task cần UI match review/evidence; Critical/High mismatch block PR.
- Nếu còn câu hỏi blocking/open trong `planning/questions.md`, prompt tiếp theo phải là `FE input-sync`; không được sang `FE cook` cho tới khi input-sync cập nhật câu trả lời, plan/checklist và đóng gate.
