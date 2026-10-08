// Hai task có lịch sử: bug api-contract/plan-gap lặp lại và cook bị chặn vì sửa ngoài plan.
// Retro phải đề xuất dựa trên số liệu này, không tự duyệt và không sửa rule.
import { scaffoldTask, writeFile, commit } from '../scaffold-lib.mjs';

const bugs = (rows) =>
  `# Danh sách bug từ review\n\n## Bug cần xử lý\n\n| ID | Severity | Nhóm | File/evidence | Expected | Actual | Hướng xử lý | Nguyên nhân gốc | Owner | Trạng thái |\n|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
const log = (task, events) =>
  events.map((e, i) => JSON.stringify({ v: 1, ts: `2026-10-0${i + 1}T09:00:00.000Z`, pack: 'fe', task, source: 'hook', actor: 'claude', ...e })).join('\n') + '\n';

const orders = scaffoldTask('task-ready-to-cook', 'FE-11-orders');
const exportTask = scaffoldTask('task-ready-to-cook', 'FE-12-export');

writeFile(
  `${orders}/tracking/review-bugs.md`,
  bugs([
    '| BUG-1 | High | api-contract | `src/api/orders.ts` | Map 409 ORDER_ALREADY_SHIPPED | Không xử lý | Thêm map lỗi | plan-gap | Dev | Fixed |',
    '| BUG-2 | Medium | api-contract | `src/api/orders.ts` | Map 422 INVALID_REASON | Không xử lý | Thêm map lỗi | plan-gap | Dev | Fixed |',
    '| BUG-3 | Low | clean-code | `src/components/OrderRow.tsx` | Tên biến rõ | `x` | Đổi tên | rule-violation | Dev | Fixed |',
  ])
);
writeFile(
  `${exportTask}/tracking/review-bugs.md`,
  bugs(['| BUG-1 | High | api-contract | `src/api/export.ts` | Map 413 EXPORT_TOO_LARGE | Không xử lý | Thêm map lỗi | plan-gap | Dev | Open |'])
);
writeFile(
  `${orders}/tracking/run-log.jsonl`,
  log('FE-11-orders', [
    { event: 'mode_end', mode: 'cook', outcome: 'blocked', attempt: 1, codes: ['SCOPE_OUT_OF_PLAN'] },
    { event: 'mode_end', mode: 'cook', outcome: 'blocked', attempt: 2, codes: ['SCOPE_OUT_OF_PLAN'] },
    { event: 'mode_end', mode: 'cook', outcome: 'pass', attempt: 3 },
  ])
);
writeFile(
  `${exportTask}/tracking/run-log.jsonl`,
  log('FE-12-export', [
    { event: 'mode_end', mode: 'cook', outcome: 'blocked', attempt: 1, codes: ['SCOPE_OUT_OF_PLAN'] },
    { event: 'mode_end', mode: 'cook', outcome: 'pass', attempt: 2 },
  ])
);
commit('task history');
