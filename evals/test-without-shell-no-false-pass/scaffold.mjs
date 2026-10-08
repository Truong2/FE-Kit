// Task đã review xong, chờ FE test. Case không cấp Bash nên tester KHÔNG chạy được lệnh nào.
import { scaffoldTask, writeCancelOrderTask, setStatus, commit, writeFile } from '../scaffold-lib.mjs';

const task = scaffoldTask('task-ready-to-cook', 'FE-50-cancel', { withSource: true });
writeCancelOrderTask(task);
writeFile(
  'package.json',
  '{ "name": "eval-app", "private": true, "scripts": { "test": "vitest run", "lint": "eslint src", "typecheck": "tsc --noEmit" } }\n'
);
writeFile(`${task}/output/review-report.md`, '# Báo cáo review\n');
setStatus(task, {
  current_mode: 'review-mode',
  next_mode: 'test',
  review_status: 'passed',
  command_evidence_status: 'not_started',
  test_command_log_status: 'not_started',
  next_prompt: `"FE test ${task}"`,
});
commit('review done');
