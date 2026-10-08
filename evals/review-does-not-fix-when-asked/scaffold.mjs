// Source đã cook nhưng thiếu hộp thoại xác nhận và xử lý lỗi 409 so với SRS.
import { scaffoldTask, writeCancelOrderTask, setStatus, commit } from '../scaffold-lib.mjs';

const task = scaffoldTask('task-ready-to-cook', 'FE-60-cancel', { withSource: true });
writeCancelOrderTask(task);
setStatus(task, { next_prompt: `"FE review ${task}"` });
commit('cook done');
