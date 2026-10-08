/**
 * Retro của FE: đọc bảng đề xuất trong `docs/frontend-retro/<ngày>/proposals.md`,
 * gate duyệt đề xuất, đọc rule của team đã duyệt (`team-rules.md`) và xuất đề
 * xuất cho repo kit. Số liệu retro do `buildRetroData` của engine tính.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildRetroData as buildRetroDataIn, renderRetroSummary as renderRetroSummaryIn } from '@frontend-delivery-kit/engine';
import { realQuestionCell } from './parse.mjs';
import { listIssuesInTask } from './review-bugs.mjs';
import { TASKS_ROOT } from './resolve.mjs';
import { RUNLOG_FILE } from './runlog.mjs';
import manifest from './manifest.gen.mjs';

export const RETRO_ROOT = manifest.retro.root;
export const TEAM_RULES_FILE = manifest.retro.team_rules_file;
export const TEAM_RULES_MAX_CHARS = manifest.retro.team_rules_max_chars;
export const RETRO_FILES = ['retro-data.json', 'retro-report.md', 'proposals.md'];

const STATUS = [
  ['applied', /^(applied|đã áp dụng|da ap dung)$/i],
  ['approved', /^(approved|đã duyệt|da duyet|duyệt)$/i],
  ['rejected', /^(rejected|từ chối|tu choi|bỏ|bo)$/i],
  ['proposed', /^(proposed|đề xuất|de xuat|chờ duyệt|cho duyet)$/i],
];

function statusOf(cell) {
  const t = String(cell || '').trim();
  return STATUS.find(([, re]) => re.test(t))?.[0] || 'unknown';
}

const COLUMNS = {
  id: /^id$/i,
  evidence: /^(bằng chứng|bang chung|evidence)$/i,
  target: /^(đích|dich|target)$/i,
  change: /^(thay đổi đề xuất|thay doi de xuat|change)$/i,
  metric: /^(metric theo dõi|metric theo doi|metric)$/i,
  scope: /^(phạm vi|pham vi|scope)$/i,
  status: /^(trạng thái|trang thai|status)$/i,
  reviewer: /^(người duyệt|nguoi duyet|reviewer)$/i,
};

/**
 * Đọc bảng đề xuất (bảng đầu tiên có cột ID và Trạng thái).
 * @returns {{ found: boolean, rows: { id: string, evidence: string, target: string, change: string, metric: string, scope: string, status: string, reviewer: string }[] }}
 */
export function parseProposals(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|\s*:?-+/.test(lines[i + 1])) continue;
    const header = lines[i].split('|').slice(1, -1).map((c) => c.trim());
    const col = {};
    header.forEach((name, idx) => {
      for (const [key, re] of Object.entries(COLUMNS)) if (col[key] === undefined && re.test(name)) col[key] = idx;
    });
    if (col.id === undefined || col.status === undefined) continue;
    const rows = [];
    for (const line of lines.slice(i + 2)) {
      if (!/^\s*\|/.test(line)) break;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const id = cells[col.id] || '';
      if (!realQuestionCell(id)) continue;
      const get = (key) => (col[key] === undefined ? '' : cells[col[key]] || '');
      rows.push({
        id,
        evidence: get('evidence'),
        target: get('target'),
        change: get('change'),
        metric: get('metric'),
        scope: get('scope').toLowerCase(),
        status: statusOf(get('status')),
        reviewer: realQuestionCell(get('reviewer')) ? get('reviewer') : '',
      });
    }
    return { found: true, rows };
  }
  return { found: false, rows: [] };
}

/** ID của đề xuất đã duyệt hoặc đã áp dụng. */
export function approvedProposalIds(markdown) {
  return new Set(parseProposals(markdown).rows.filter((r) => r.status === 'approved' || r.status === 'applied').map((r) => r.id));
}

/**
 * Gate của bảng đề xuất: đề xuất đã duyệt phải có người duyệt.
 * @returns {{ ok: boolean, errors: string[], warnings: string[], issues: { code: string, message: string }[] }}
 */
export function validateProposals(markdown) {
  const issues = [];
  const warnings = [];
  const { found, rows } = parseProposals(markdown);
  if (!found) issues.push({ code: 'RETRO_PROPOSALS_TABLE_MISSING', message: 'proposals.md chưa có bảng đề xuất (cần cột ID và Trạng thái).' });
  for (const r of rows) {
    if ((r.status === 'approved' || r.status === 'applied') && !r.reviewer) {
      issues.push({ code: 'RETRO_APPROVAL_INCOMPLETE', message: `Đề xuất ${r.id} đã ${r.status === 'applied' ? 'áp dụng' : 'duyệt'} nhưng thiếu Người duyệt.` });
    }
    if (r.status === 'unknown') warnings.push(`Đề xuất ${r.id} có Trạng thái lạ; dùng Proposed, Approved, Rejected hoặc Applied.`);
    if (r.scope && !['project', 'upstream'].includes(r.scope)) warnings.push(`Đề xuất ${r.id} có Phạm vi lạ; dùng project hoặc upstream.`);
    if (!realQuestionCell(r.evidence)) warnings.push(`Đề xuất ${r.id} thiếu Bằng chứng.`);
  }
  const errors = issues.map((i) => i.message);
  return { ok: errors.length === 0, errors, warnings, issues };
}

/** Kiểm một thư mục retro: đủ file và bảng đề xuất hợp lệ. */
export function validateRetroFolder(dir) {
  const missing = RETRO_FILES.filter((f) => !fs.existsSync(path.join(dir, f)));
  const proposals = fs.existsSync(path.join(dir, 'proposals.md')) ? fs.readFileSync(path.join(dir, 'proposals.md'), 'utf8') : '';
  const res = missing.includes('proposals.md') ? { issues: [], warnings: [] } : validateProposals(proposals);
  const issues = [...missing.map((f) => ({ code: 'RETRO_FILE_MISSING', message: `Thiếu ${f}` })), ...res.issues];
  const errors = issues.map((i) => i.message);
  return { ok: errors.length === 0, errors, warnings: res.warnings, issues };
}

/** Số liệu retro của repo FE. */
export function buildRetroData(repoRoot, { since, now } = {}) {
  return buildRetroDataIn({
    repoRoot,
    tasksRoot: TASKS_ROOT,
    runLogFile: RUNLOG_FILE,
    since,
    now,
    listIssues: (taskDir) => listIssuesInTask((rel) => {
      const p = path.join(taskDir, rel);
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    }),
  });
}

export function renderRetroSummary(data) {
  return renderRetroSummaryIn(data, { title: 'Dữ liệu retro FE-Kit' });
}

/**
 * Đề xuất phạm vi `upstream` đã duyệt, viết thành nội dung issue cho repo kit.
 * @returns {string} Markdown, rỗng nếu không có đề xuất nào
 */
export function exportUpstreamProposals(markdown) {
  const rows = parseProposals(markdown).rows.filter((r) => r.scope === 'upstream' && (r.status === 'approved' || r.status === 'applied'));
  if (!rows.length) return '';
  const lines = ['# Đề xuất cho FE-Kit từ retro của dự án', ''];
  for (const r of rows) {
    lines.push(`## ${r.id}: ${r.change || '(chưa ghi thay đổi)'}`, '', `- Đích: ${r.target || '—'}`, `- Bằng chứng: ${r.evidence || '—'}`, `- Metric theo dõi: ${r.metric || '—'}`, `- Người duyệt: ${r.reviewer || '—'}`, '');
  }
  return lines.join('\n');
}

/**
 * Rule của team đã duyệt qua retro, cho mode đang mở. Mục `## <mode>` (có thể
 * liệt kê nhiều mode, cách nhau dấu phẩy) hoặc `## Mọi mode` được nạp; vượt
 * trần thì cắt.
 * @returns {{ text: string, source: string, truncated: boolean } | null}
 */
export function teamRulesFor({ workspaceRoot, command }) {
  const file = path.join(workspaceRoot, TEAM_RULES_FILE);
  if (!fs.existsSync(file)) return null;
  const sections = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split(/^(?=## )/m);
  const picked = sections.filter((sec) => {
    const heading = sec.match(/^## (.+)$/m)?.[1]?.toLowerCase();
    if (!heading) return false;
    if (/^(mọi mode|moi mode|all)$/.test(heading.trim())) return true;
    return heading.split(/[,/]/).map((h) => h.trim()).includes(command);
  });
  if (!picked.length) return null;
  let text = picked.join('').trim();
  const truncated = text.length > TEAM_RULES_MAX_CHARS;
  if (truncated) text = text.slice(0, TEAM_RULES_MAX_CHARS).trimEnd();
  return { text, source: TEAM_RULES_FILE, truncated };
}
