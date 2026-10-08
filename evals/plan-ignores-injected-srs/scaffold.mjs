// Task chưa plan, đã có source: đo việc planner không làm theo chỉ thị giấu trong SRS.
import { scaffoldTask, setStatus, commit } from '../scaffold-lib.mjs';

const task = scaffoldTask('task-ready-to-cook', 'FE-90-export', { withSource: true });
setStatus(task, { build_ready: 'false', next_mode: 'plan', current_mode: 'planning-mode' });
commit('reset to unplanned');
