import fs from 'node:fs';
import path from 'node:path';
import { readRunLog } from './runlog.mjs';

/**
 * Tổng hợp run-log cho lệnh `report` của CLI. Mọi số liệu tính từ sự kiện đã ghi;
 * không đọc field tự khai của workflow-status.md.
 *
 * - Lượt hoàn tất của một mode = `mode_end` có outcome `pass` hoặc `released`
 *   (hook thả ra kèm vấn đề chưa xử lý).
 * - Pass ngay lần đầu = `mode_end` outcome `pass` với `attempt` 1.
 * - Vòng bị chặn = `mode_end` outcome `blocked` (hook) hoặc `failed` (CLI).
 */

const bump = (obj, key, by = 1) => {
  obj[key] = (obj[key] || 0) + by;
};

function emptyMode() {
  return { starts: 0, completed: 0, firstPass: 0, blocked: 0, released: 0, failed: 0, durationsMs: [] };
}

/**
 * @param {object[]} records sự kiện của một task (hoặc nhiều task)
 * @param {{ since?: string }} [opts] chỉ tính sự kiện có `ts` >= since (ISO hoặc YYYY-MM-DD)
 */
export function summarizeRunLog(records, { since } = {}) {
  const s = {
    events: 0,
    modes: {},
    entryBlocked: {},
    denials: {},
    codes: {},
    actors: {},
    kits: {},
    overrides: 0,
    approvals: 0,
    abandoned: 0,
    validates: { ok: 0, failed: 0 },
  };
  for (const r of records) {
    if (since && String(r.ts) < since) continue;
    s.events++;
    if (r.actor) bump(s.actors, r.actor);
    if (r.kit) bump(s.kits, r.kit);
    const mode = r.mode ? (s.modes[r.mode] ||= emptyMode()) : null;
    switch (r.event) {
      case 'mode_start':
        if (mode) mode.starts++;
        break;
      case 'mode_end':
        if (!mode) break;
        if (r.outcome === 'pass' || r.outcome === 'released') {
          mode.completed++;
          if (r.outcome === 'released') mode.released++;
          if (r.outcome === 'pass' && (r.attempt ?? 1) === 1) mode.firstPass++;
          if (typeof r.duration_ms === 'number') mode.durationsMs.push(r.duration_ms);
        } else if (r.outcome === 'blocked') {
          mode.blocked++;
        } else if (r.outcome === 'failed') {
          mode.failed++;
        }
        if (r.outcome !== 'pass') for (const c of r.codes || []) bump(s.codes, c);
        break;
      case 'entry_blocked':
        for (const c of r.codes || ['ENTRY_BLOCKED']) {
          bump(s.entryBlocked, c);
          bump(s.codes, c);
        }
        break;
      case 'edit_denied':
      case 'edit_warned':
        for (const c of r.codes || ['EDIT_BLOCKED']) {
          bump(s.denials, c);
          bump(s.codes, c);
        }
        break;
      case 'override_requested':
        s.overrides++;
        break;
      case 'approval_requested':
        s.approvals++;
        break;
      case 'mode_abandoned':
        s.abandoned++;
        break;
      case 'validate':
        if (r.outcome === 'ok') s.validates.ok++;
        else {
          s.validates.failed++;
          for (const c of r.codes || []) bump(s.codes, c);
        }
        break;
      default:
        break;
    }
  }
  return s;
}

/** Danh sách task folder có run-log, hoặc đúng một task nếu truyền `task`. */
function taskDirs(repoRoot, tasksRoot, task) {
  if (task) return [path.isAbsolute(task) ? task : path.resolve(repoRoot, task)];
  const root = path.join(repoRoot, tasksRoot);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(root, d.name))
    .sort();
}

/**
 * @param {{ repoRoot: string, tasksRoot: string, runLogFile: string, task?: string, since?: string }} params
 * @returns {{ since?: string, tasks: { task: string, summary: object, skipped: number }[], total: object, skipped: number }}
 */
export function buildReport({ repoRoot, tasksRoot, runLogFile, task, since }) {
  const tasks = [];
  const all = [];
  let skipped = 0;
  for (const dir of taskDirs(repoRoot, tasksRoot, task)) {
    const { records, skipped: bad } = readRunLog(dir, { file: runLogFile });
    skipped += bad;
    if (!records.length && !task) continue;
    all.push(...records);
    tasks.push({ task: path.basename(dir), summary: summarizeRunLog(records, { since }), skipped: bad });
  }
  return { since, tasks, total: summarizeRunLog(all, { since }), skipped };
}

function pct(part, whole) {
  return whole ? `${Math.round((part / whole) * 100)}%` : '—';
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function minutes(ms) {
  return ms === null ? '—' : `${(ms / 60000).toFixed(1)} phút`;
}

function topCodes(codes, limit = 10) {
  return Object.entries(codes)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function modeTable(summary) {
  const rows = Object.entries(summary.modes).sort(([a], [b]) => a.localeCompare(b));
  if (!rows.length) return ['Chưa có lượt mode nào.'];
  const lines = [
    '| Mode | Bắt đầu | Hoàn tất | Pass ngay lần đầu | Bị chặn khi kết thúc | Thả kèm vấn đề | Thời gian (trung vị) |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const [mode, m] of rows) {
    lines.push(
      `| ${mode} | ${m.starts} | ${m.completed} | ${m.firstPass} (${pct(m.firstPass, m.completed)}) | ${m.blocked + m.failed} | ${m.released} | ${minutes(median(m.durationsMs))} |`
    );
  }
  return lines;
}

/** So sánh version dạng `x.y.z` (phần không phải số coi như 0). */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/**
 * Báo cáo Markdown tiếng Việt.
 * @param {object} report kết quả `buildReport`
 * @param {{ title: string, tasksRoot: string, runLogFile: string, currentVersion?: string, updateHint?: string }} opts
 *   `currentVersion`: version của kit đang chạy báo cáo; run-log có bản cũ hơn thì cảnh báo kèm `updateHint`.
 */
export function renderReport(report, { title, tasksRoot, runLogFile, currentVersion, updateHint = '' }) {
  const { total } = report;
  const lines = [`# ${title}`, ''];
  if (report.since) lines.push(`Tính từ: ${report.since}`, '');
  if (!report.tasks.length) {
    lines.push(`Chưa có run-log nào trong ${tasksRoot}/*/${runLogFile}.`);
    return lines.join('\n') + '\n';
  }

  lines.push(`Task có run-log: ${report.tasks.length}. Sự kiện: ${total.events}.`, '');
  lines.push('## Theo mode', '', ...modeTable(total), '');

  const codes = topCodes(total.codes);
  lines.push('## Lý do bị chặn nhiều nhất', '');
  if (codes.length) {
    lines.push('| Code | Số lần |', '|---|---|', ...codes.map(([c, n]) => `| \`${c}\` | ${n} |`));
  } else {
    lines.push('Không có.');
  }

  lines.push(
    '',
    '## Khác',
    '',
    `- Bị từ chối sửa file: ${Object.values(total.denials).reduce((a, b) => a + b, 0)}`,
    `- Yêu cầu bật human_override: ${total.overrides}`,
    `- Mode bỏ dở (chuyển lệnh khi chưa qua gate kết thúc): ${total.abandoned}`,
    `- Lần validate: ${total.validates.ok} đạt, ${total.validates.failed} không đạt`,
    `- Theo actor: ${Object.entries(total.actors).map(([a, n]) => `${a} ${n}`).join(', ') || '—'}`
  );
  if (report.skipped) lines.push(`- Dòng run-log hỏng hoặc sai version, đã bỏ qua: ${report.skipped}`);
  const kits = Object.entries(total.kits || {}).sort(([a], [b]) => compareVersions(a, b));
  if (kits.length) lines.push(`- Phiên bản kit trong run-log: ${kits.map(([v, n]) => `${v} (${n})`).join(', ')}`);
  const older = currentVersion ? kits.filter(([v]) => compareVersions(v, currentVersion) < 0).map(([v]) => v) : [];
  if (older.length) {
    lines.push('', `> Cảnh báo: có phiên chạy bằng bản ${older.join(', ')}, cũ hơn bản hiện tại ${currentVersion}. ${updateHint}`.trimEnd());
  }

  if (report.tasks.length > 1) {
    lines.push('', '## Theo task', '', '| Task | Sự kiện | Lượt hoàn tất | Pass ngay lần đầu | Vòng bị chặn |', '|---|---|---|---|---|');
    for (const { task, summary } of report.tasks) {
      const modes = Object.values(summary.modes);
      const completed = modes.reduce((a, m) => a + m.completed, 0);
      const first = modes.reduce((a, m) => a + m.firstPass, 0);
      const loops = modes.reduce((a, m) => a + m.blocked + m.failed, 0);
      lines.push(`| ${task} | ${summary.events} | ${completed} | ${first} (${pct(first, completed)}) | ${loops} |`);
    }
  }
  return lines.join('\n') + '\n';
}
