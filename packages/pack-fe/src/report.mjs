/** Báo cáo run-log cho `fe-kit report`: bind thư mục task và tiêu đề của FE. */
import { buildReport as buildReportIn, renderReport as renderReportIn } from '@frontend-delivery-kit/engine';
import { TASKS_ROOT } from './resolve.mjs';
import { RUNLOG_FILE } from './runlog.mjs';

export { summarizeRunLog } from '@frontend-delivery-kit/engine';

/** @param {{ repoRoot: string, task?: string, since?: string }} params */
export function buildReport({ repoRoot, task, since }) {
  return buildReportIn({ repoRoot, tasksRoot: TASKS_ROOT, runLogFile: RUNLOG_FILE, task, since });
}

export function renderReport(report) {
  return renderReportIn(report, { title: 'Báo cáo run-log FE-Kit', tasksRoot: TASKS_ROOT, runLogFile: RUNLOG_FILE });
}
