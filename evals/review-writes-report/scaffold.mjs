// Task đã cook xong: có source thật, workflow-status route sang review.
import { scaffoldTask, setStatus, commit } from '../scaffold-lib.mjs';

const task = scaffoldTask('task-ready-to-cook', 'FE-40-cancel', { withSource: true });
setStatus(task, {
  current_mode: 'implementation-mode',
  next_mode: 'review',
  next_prompt: `"FE review ${task}"`,
});
commit('cook done');
