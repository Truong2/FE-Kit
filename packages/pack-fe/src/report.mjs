/** Báo cáo run-log cho `fe-kit report`: bind thư mục task và tiêu đề của FE. */
import { buildReport as buildReportIn, renderReport as renderReportIn } from '@frontend-delivery-kit/engine';
import { TASKS_ROOT } from './resolve.mjs';
import { RUNLOG_FILE } from './runlog.mjs';

export { summarizeRunLog } from '@frontend-delivery-kit/engine';

/** @param {{ repoRoot: string, task?: string, since?: string }} params */
export function buildReport({ repoRoot, task, since }) {
  return buildReportIn({ repoRoot, tasksRoot: TASKS_ROOT, runLogFile: RUNLOG_FILE, task, since });
}

/** @param {{ currentVersion?: string }} [opts] version kit đang chạy, để cảnh báo phiên chạy bằng plugin cũ */
export function renderReport(report, { currentVersion } = {}) {
  return renderReportIn(report, {
    title: 'Báo cáo run-log FE-Kit',
    tasksRoot: TASKS_ROOT,
    runLogFile: RUNLOG_FILE,
    currentVersion,
    updateHint: 'Cập nhật plugin: `claude plugin marketplace update frontend-delivery` rồi `claude plugin update fe@frontend-delivery`, mở phiên mới.',
  });
}
