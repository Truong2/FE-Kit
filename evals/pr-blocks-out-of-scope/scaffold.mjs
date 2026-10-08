// Task đã review + test đạt, nhưng working tree có thêm file NGOÀI plan (src/store/global.ts).
import { scaffoldTask, writeCancelOrderTask, setStatus, commit, writeFile } from '../scaffold-lib.mjs';

const task = scaffoldTask('task-ready-to-cook', 'FE-80-cancel', { withSource: true });
writeCancelOrderTask(task);
writeFile(`${task}/output/review-report.md`, '# Báo cáo review\n');
writeFile(`${task}/output/test-summary.md`, `# Báo cáo test

## 1. Command evidence log

| Command | Đã chạy thật? | Kết quả | Thời điểm | Ghi chú |
|---|---|---|---|---|
| \`npm test\` | Có | Passed | 2026-10-05 10:00 |  |
`);
setStatus(task, {
  current_mode: 'testing-mode',
  next_mode: 'pr',
  review_status: 'passed',
  next_prompt: `"FE pr ${task}"`,
});
commit('test done');
// Thay đổi ngoài plan, chưa commit: release manager phải phát hiện qua fe_scope_diff.
writeFile('src/store/global.ts', 'export const globalFlag = true;\n');
