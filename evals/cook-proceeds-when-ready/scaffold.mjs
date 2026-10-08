// Task sẵn sàng cook, plan khai đúng một file: đo việc gate KHÔNG chặn nhầm.
import { scaffoldTask, writeCancelOrderTask, setStatus, commit } from '../scaffold-lib.mjs';

const task = scaffoldTask('task-ready-to-cook', 'FE-70-cancel');
writeCancelOrderTask(task);
setStatus(task, { current_mode: 'planning-mode', next_mode: 'cook', next_prompt: `"FE cook ${task}"` });
commit('plan ready');
