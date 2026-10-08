# Lộ trình: FE-Kit thành AI Engineering OS

Tài liệu này thay cho `output/fe-kit-architecture-evolution.md`. `CHANGELOG.md` 2.1.0 từng nhắc tới file đó, nhưng nó chưa bao giờ được commit.

## Đích đến

Một **engine dùng chung**, không gắn với domain nào. Engine gồm state machine của mode, gate runner, hook, MCP, run-log, báo cáo và vòng tự học. Các **domain pack** khai báo mode, artifact, rule, template và gate riêng của mình. FE là pack đầu tiên và phải giữ nguyên hành vi, tương thích ngược với repo dự án đang dùng (`docs/frontend-tasks`, field của `workflow-status.md`, plugin `fe`, tool `fe_*`).

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

1. Đa domain: tách engine khỏi FE domain pack.
2. Có ngân sách API để chạy eval thật.
3. Run-log ghi file JSONL trong task folder và commit cùng code.

Mặc định đổi được khi review từng phase:

- `enforce` chỉ thành mặc định khi đạt luật eval bên dưới.
- Bước tách engine là minor vì không đổi hành vi. Chỉ lên major khi có pack thật thứ hai.
- Manifest của pack viết bằng YAML rồi compile sang JS. Mỗi pack một plugin.
- Gate đếm issue chỉ báo lỗi khi nhận diện được header bảng; không nhận diện được thì cảnh báo.

## Các phase

| Phase | Version | Nội dung | Trạng thái |
|---|---|---|---|
| 0 | 2.1.1 | Eval chạy được, có baseline; khôi phục lộ trình; gom danh sách file/rule về một nguồn | Code xong; chờ chạy eval thật để có baseline |
| 1 | 2.2.0 | Run-log `tracking/run-log.jsonl`, reason code, `fe-kit report`, `fe-kit mode begin/end` cho adapter không có hook, quyết định `enforce` | Code xong; `enforce` chưa bật vì chưa có baseline (xem bên dưới) |
| 2 | 2.3.0 | Đếm issue từ `review-bugs.md`, taxonomy bug (nhóm + nguyên nhân gốc), deprecate field không gate nào đọc, chuyển gate `check-*` ra khỏi CLI, rule input không tin cậy, kiểm ghi qua shell | Chưa làm |
| 3 | 2.4.0 | Tách `packages/engine` + `packages/pack-fe` theo kiểu strangler, có golden test; pack mẫu thứ hai chỉ dùng trong test | Chưa làm |
| 4 | 2.5.0 | `retro`: tổng hợp run-log + bug thành đề xuất sửa rule, có người duyệt | Chưa làm |
| 5 | 3.0.0 | Pack thật thứ hai (BE hoặc QA), mỗi pack một plugin | Chưa làm |

### Luật bật `enforce` mặc định

Áp dụng ở Phase 1, tính bằng `enforceDecision` trong `evals/summarize.mjs`. Bật khi đủ cả bốn điều kiện, so cùng version và model:

1. Mọi case tag `gate` đạt ≥ 0,8 ở `enforce`.
2. `cook-proceeds-when-ready` (đo chặn nhầm) đạt 1 ở `enforce`.
3. Ở case gate, `enforce` không kém `warn` quá 0,05.
4. Không có run lỗi hoặc aborted, và không baseline nào chạy dở.

Không đạt thì giữ `warn` và ghi lý do vào bảng phase ở trên.

Trạng thái ở 2.2.0: **giữ `warn`**. Bộ eval chưa chạy thật nên chưa có baseline để áp luật. Chạy `plugin-evals.yml` (`hooks_level: both`), commit baseline, rồi đổi `DEFAULT_LEVEL` trong `core/hooks/fe-hook.mjs` trong một bản riêng nếu đạt.

## Phase 0 — việc còn lại

- Chạy workflow `plugin-evals.yml` với `hooks_level: both`, `runs: 5`. Tải artifact `eval-baselines` về `evals/baselines/` rồi commit.
- Chạy một case trên Windows để chắc scaffold Node chạy được ngoài Linux:

  ```bash
  claude plugin eval ./plugins/fe --eval-dir evals --case cook-refuses-when-blocked --scaffold --runs 1 ...
  ```

## Rủi ro đang theo dõi

- **Hook chưa chắc thấy được mức đã đặt.** `plugin eval` chỉ chuyển `EVAL_*` vào phiên, nên hook đọc `EVAL_FE_KIT_HOOKS`. Chưa xác minh hook thật sự nhận được biến này trong phiên eval. Từ 2.2.0, grader `hook-logged-entry-block` chứng minh hook có chạy, và field `level` trong `run-log.jsonl` của workspace eval (`--keep-temp`) cho biết hook chạy ở mức nào.
- **Chưa rõ `tool_used` có thấy tool call bên trong subagent không.** Tài liệu không nói. Vì vậy grader cấm sửa source luôn đi kèm grader theo trạng thái file (`source-unchanged`, `file_exists`).
- **Eval dao động giữa các lần chạy.** Dùng 5 run mỗi case. Mỗi lượt baseline tốn tối đa khoảng 2 × 30 USD.
