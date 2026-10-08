# Lộ trình: FE-Kit thành AI Engineering OS

Tài liệu này thay cho `output/fe-kit-architecture-evolution.md`. `CHANGELOG.md` 2.1.0 từng nhắc tới file đó, nhưng nó chưa bao giờ được commit.

## Đích đến

FE-Kit chỉ phục vụ domain frontend. Bên trong kit, phần dùng chung được tách thành **engine**: state machine của mode, gate runner, hook, MCP, run-log, báo cáo và vòng tự học. Mọi thứ riêng của FE nằm trong **pack FE**: mode, artifact, rule, template và gate. Việc tách này để giữ code gọn và dễ test, không nhằm làm thêm domain khác. Pack FE phải giữ nguyên hành vi và tương thích ngược với repo dự án đang dùng (`docs/frontend-tasks`, field của `workflow-status.md`, plugin `fe`, tool `fe_*`).

Mức đánh giá của bản 2.1.0, trước lộ trình này:

- **Mạnh:** guardrail tất định (gate, hook, MCP, agent theo vai).
- **Chưa có:**
  - eval đã chạy thật;
  - đo lường;
  - vòng tự học;
  - kiểm chéo cho field tự khai về bug;
  - rule cho input không tin cậy;
  - engine tách khỏi FE.

## Quyết định đã chốt

1. Tách engine khỏi pack FE (Phase 3). Ban đầu chọn "đa domain"; ngày 2026-10-08 chốt lại là **kit chỉ dùng cho FE**, nên không làm pack thật thứ hai (Phase 5).
2. Có ngân sách API để chạy eval thật.
3. Run-log ghi file JSONL trong task folder và commit cùng code.

Mặc định đổi được khi review từng phase:

- `enforce` chỉ thành mặc định khi đạt luật eval bên dưới.
- Bước tách engine là minor vì không đổi hành vi.
- Manifest của pack viết bằng YAML rồi compile sang JS.
- Gate đếm issue chỉ báo lỗi khi nhận diện được header bảng; không nhận diện được thì cảnh báo.

## Các phase

| Phase | Version | Nội dung | Trạng thái |
|---|---|---|---|
| 0 | 2.1.1 | Eval chạy được, có baseline; khôi phục lộ trình; gom danh sách file/rule về một nguồn | Code xong; chờ chạy eval thật để có baseline |
| 1 | 2.2.0 | Run-log `tracking/run-log.jsonl`, reason code, `fe-kit report`, `fe-kit mode begin/end` cho adapter không có hook, quyết định `enforce` | Code xong; `enforce` chưa bật vì chưa có baseline (xem bên dưới) |
| 2 | 2.3.0 | Đếm issue từ `review-bugs.md`, taxonomy bug (nhóm + nguyên nhân gốc), deprecate field không gate nào đọc, chuyển gate `check-*` ra khỏi CLI, rule input không tin cậy, kiểm ghi qua shell | Code xong; eval `plan-ignores-injected-srs` chờ chạy thật |
| 3 | 2.4.0 | Tách `packages/engine` + `packages/pack-fe` theo kiểu strangler, có golden test; pack mẫu thứ hai chỉ dùng trong test | Xong (xem bên dưới) |
| 4 | 2.5.0 | `retro`: tổng hợp run-log + bug thành đề xuất sửa rule, có người duyệt | Code xong; eval `retro-proposes-not-applies` chờ chạy thật; cần vài tuần run-log thật để retro có ý nghĩa |
| 5 | — | Pack thật thứ hai (BE hoặc QA), mỗi pack một plugin | Không làm: kit chỉ dùng cho FE |

### Luật bật `enforce` mặc định

Áp dụng ở Phase 1, tính bằng `enforceDecision` trong `evals/summarize.mjs`. Bật khi đủ cả bốn điều kiện, so cùng version và model:

1. Mọi case tag `gate` đạt ≥ 0,8 ở `enforce`.
2. `cook-proceeds-when-ready` (đo chặn nhầm) đạt 1 ở `enforce`.
3. Ở case gate, `enforce` không kém `warn` quá 0,05.
4. Không có run lỗi hoặc aborted, và không baseline nào chạy dở.

Không đạt thì giữ `warn` và ghi lý do vào bảng phase ở trên.

Trạng thái ở 2.2.0: **giữ `warn`**. Bộ eval chưa chạy thật nên chưa có baseline để áp luật. Chạy profile `gate` (`npm run eval:gate` hoặc `plugin-evals.yml`), commit baseline, rồi đổi `DEFAULT_LEVEL` trong `core/hooks/fe-hook.mjs` trong một bản riêng nếu đạt.

## Phase 0 — việc còn lại

- Chạy theo bậc: `pilot` (đo chi phí một lượt) → `smoke` (mọi case một lần, trần 5 USD) → `gate` (baseline để áp luật `enforce`). Chạy trên máy với tài khoản `claude` đang đăng nhập, hoặc qua `plugin-evals.yml`. Commit baseline trong `evals/baselines/`.
- Sau `pilot`: xem số turn thật của từng case để hạ `max_turns` (đang 25–40) nếu dư nhiều.
- Model `claude-opus-5-5` và `claude-sonnet-5-5` cần Claude Code ≥ 2.1.280 (`claude update`). `pilot` ngày 2026-10-08 trên 2.1.270 bị lỗi 400 trước khi model chạy.
- Đã xong (`pilot` 2026-10-08, Windows): scaffold Node chạy được ngoài Linux; plugin eval nạp đủ 10 case sau khi sửa `--eval-dir` và `case.yaml`.

## Phase 3 — đã làm và còn lại

Đã làm: engine (`packages/engine`), pack FE với `pack.yaml` (`packages/pack-fe`), golden test, pack mẫu `docs` và test chạy toàn bộ engine trên nó, generator đọc identity từ manifest, `kit.yaml` sinh từ manifest.

Pack mẫu bắt được hai giả định FE trong engine và đã sửa: tiền tố lệnh (`/fe:` trùng `FE `) và đường dẫn run-log gắn cứng `tracking/`.

Không làm, vì chỉ có ý nghĩa khi có pack thật thứ hai:

- `generatePack(pack)`: generator sinh plugin cho pack bất kỳ. Generator vẫn chỉ sinh plugin `fe` từ `core/`.
- CLI chọn pack theo registry. `bin/fe-kit.mjs` vẫn là CLI của FE.

Pack mẫu `docs` và test `engine-genericity` vẫn giữ để engine không bị dính khái niệm FE trở lại.

Có thể làm riêng nếu thấy cần: sinh `standard.yaml` từ manifest. File này vẫn viết tay, có test giữ khớp danh sách file.

## Lệch đã biết, đã chấp nhận

- **Không có eval cho ghi qua shell.** `plugin eval` chỉ cấp Write, Edit và MCP của kit, không cấp Bash, nên case `review-no-shell-write` trong plan không chạy được. Cơ chế được test tất định trong `tests/hook.test.mjs`.
- **Chưa làm `wrapUntrusted`.** Không tool nào của kit trả lại nội dung SRS/CR cho agent, nên helper này chưa có chỗ dùng.

## Rủi ro đang theo dõi

- ~~Hook chưa chắc thấy được mức đã đặt.~~ Đã xác minh ở `pilot` 2026-10-08: `run-log.jsonl` của workspace eval ghi `"level":"enforce"`, nên hook nhận được `EVAL_FE_KIT_HOOKS`.
- **Chưa rõ `tool_used` có thấy tool call bên trong subagent không.** Tài liệu không nói. Vì vậy grader cấm sửa source luôn đi kèm grader theo trạng thái file (`source-unchanged`, `file_exists`).
- **Eval dao động giữa các lần chạy.** Baseline cần ≥ 3 run mỗi case gate. Chi phí chặn bằng profile (`evals/profiles.mjs`): `pilot` 1 USD, `smoke` 5 USD, `gate` 2 × 10 USD, `full` 2 × 30 USD là trần, chưa phải chi phí đo được.
