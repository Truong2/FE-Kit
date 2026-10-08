import fs from 'node:fs';
import path from 'node:path';
import { readRunLog } from './runlog.mjs';
import { summarizeRunLog } from './report.mjs';

/**
 * Dữ liệu cho retro: gộp run-log và bảng issue của mọi task thành số liệu để
 * agent phân tích và đề xuất sửa rule/template. Tất định, không gọi model, không
 * sửa file nào ngoài file kết quả do caller chọn ghi.
 */

const bump = (obj, key, by = 1) => {
  obj[key] = (obj[key] || 0) + by;
};

const sortedEntries = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

function taskDirsIn(repoRoot, tasksRoot) {
  const root = path.join(repoRoot, tasksRoot);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(root, d.name))
    .sort();
}

/**
 * @param {object} p
 * @param {string} p.repoRoot
 * @param {string} p.tasksRoot thư mục chứa task folder (tương đối repo)
 * @param {string} p.runLogFile path run-log trong task folder
 * @param {(taskDir: string) => { rows: { id: string, severity: string, category: string, rootCause: string, status: string }[] }} p.listIssues
 *   issue của một task (do pack đọc từ artifact của mình)
 * @param {string} [p.since] chỉ tính task có sự kiện run-log từ ngày này (ISO hoặc YYYY-MM-DD)
 * @param {Date} [p.now]
 */
export function buildRetroData({ repoRoot, tasksRoot, runLogFile, listIssues, since, now = new Date() }) {
  const allRecords = [];
  const issues = {
    total: 0,
    open: 0,
    by_severity: {},
    by_category: {},
    by_root_cause: {},
    by_category_root_cause: {},
  };
  const perTask = [];
  let tasksTotal = 0;

  for (const dir of taskDirsIn(repoRoot, tasksRoot)) {
    tasksTotal += 1;
    const { records } = readRunLog(dir, { file: runLogFile });
    const inRange = since ? records.filter((r) => String(r.ts) >= since) : records;
    // Có `since` thì chỉ lấy task có hoạt động trong khoảng đó (issue không có ngày riêng).
    if (since && !inRange.length) continue;
    allRecords.push(...inRange);

    const rows = listIssues(dir).rows;
    let open = 0;
    for (const row of rows) {
      const category = row.category ? row.category.toLowerCase() : '(trống)';
      const rootCause = row.rootCause ? row.rootCause.toLowerCase() : '(trống)';
      issues.total += 1;
      if (row.status === 'open') {
        issues.open += 1;
        open += 1;
      }
      bump(issues.by_severity, row.severity);
      bump(issues.by_category, category);
      bump(issues.by_root_cause, rootCause);
      bump(issues.by_category_root_cause, `${category} / ${rootCause}`);
    }

    const summary = summarizeRunLog(inRange);
    const modes = Object.values(summary.modes);
    perTask.push({
      task: path.basename(dir),
      events: summary.events,
      completed: modes.reduce((a, m) => a + m.completed, 0),
      first_pass: modes.reduce((a, m) => a + m.firstPass, 0),
      loops: modes.reduce((a, m) => a + m.blocked + m.failed, 0),
      issues: rows.length,
      open_issues: open,
    });
  }

  const summary = summarizeRunLog(allRecords);
  const modes = Object.fromEntries(
    Object.entries(summary.modes).map(([mode, m]) => [
      mode,
      { starts: m.starts, completed: m.completed, first_pass: m.firstPass, blocked: m.blocked + m.failed, released: m.released },
    ])
  );
  return {
    schema: 1,
    generated_at: now.toISOString(),
    since: since || null,
    tasks_total: tasksTotal,
    tasks_included: perTask.length,
    runlog: {
      events: summary.events,
      modes,
      top_codes: sortedEntries(summary.codes).slice(0, 15),
      overrides: summary.overrides,
      abandoned: summary.abandoned,
      denials: summary.denials,
    },
    issues: {
      ...issues,
      by_severity: Object.fromEntries(sortedEntries(issues.by_severity)),
      by_category: Object.fromEntries(sortedEntries(issues.by_category)),
      by_root_cause: Object.fromEntries(sortedEntries(issues.by_root_cause)),
      by_category_root_cause: Object.fromEntries(sortedEntries(issues.by_category_root_cause).slice(0, 15)),
    },
    per_task: perTask,
  };
}

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

function table(header, rows) {
  if (!rows.length) return ['Không có.'];
  return [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
}

/** Tóm tắt Markdown tiếng Việt của dữ liệu retro (in ra cho người và agent đọc). */
export function renderRetroSummary(data, { title }) {
  const lines = [`# ${title}`, ''];
  lines.push(
    `Tạo lúc: ${data.generated_at}${data.since ? `. Tính từ: ${data.since}` : ''}. Task: ${data.tasks_included}/${data.tasks_total}. Sự kiện run-log: ${data.runlog.events}. Issue: ${data.issues.total} (đang mở ${data.issues.open}).`,
    ''
  );
  lines.push('## Mode', '', ...table(['Mode', 'Hoàn tất', 'Pass ngay lần đầu', 'Vòng bị chặn'], Object.entries(data.runlog.modes).map(([mode, m]) => [mode, m.completed, `${m.first_pass} (${pct(m.first_pass, m.completed)})`, m.blocked])), '');
  lines.push('## Lý do bị chặn nhiều nhất', '', ...table(['Code', 'Số lần'], data.runlog.top_codes.map(([c, n]) => [`\`${c}\``, n])), '');
  lines.push('## Issue theo nhóm và nguyên nhân gốc', '', ...table(['Nhóm / nguyên nhân gốc', 'Số issue'], Object.entries(data.issues.by_category_root_cause)), '');
  lines.push('## Task nhiều vòng bị chặn nhất', '', ...table(['Task', 'Vòng bị chặn', 'Issue (đang mở)'], [...data.per_task].sort((a, b) => b.loops - a.loops || b.issues - a.issues).slice(0, 10).map((t) => [t.task, t.loops, `${t.issues} (${t.open_issues})`])));
  return lines.join('\n') + '\n';
}
