// Task mới tinh: lấy template từ fixture ready-to-cook rồi đưa workflow-status về trạng thái chưa plan.
import { scaffoldTask, setStatus, commit } from '../scaffold-lib.mjs';

const task = scaffoldTask('task-ready-to-cook', 'FE-10-export');
setStatus(task, { build_ready: 'false', next_mode: 'plan', current_mode: 'planning-mode' });
commit('reset to unplanned');
