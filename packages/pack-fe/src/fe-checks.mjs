/**
 * Gate kiểm cấu trúc artifact của FE (SRS map, questions routing, kiến trúc
 * plan, plan ↔ checklist, input-sync report, Figma evidence, asset log).
 * Trước v2.3.0 các hàm này nằm trong `bin/fe-kit.mjs`, trái quy ước "gate logic
 * chỉ nằm trong packages/validators"; nay CLI chỉ gọi và in kết quả.
 * Nội dung chuyển nguyên văn, không đổi hành vi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontMatterLoose } from './parse.mjs';

const parseFrontMatter = parseFrontMatterLoose;

function read(relOrAbs) {
  const p = path.resolve(relOrAbs);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

function exists(p) {
  return fs.existsSync(p);
}

function boolValue(v) {
  return v === true || String(v || '').toLowerCase() === 'true' || String(v || '').toLowerCase() === 'yes' || String(v || '').toLowerCase() === 'có';
}
function normValue(v) {
  return String(v || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
}
function imageFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) imageFiles(p, out);
    else if (/\.(png|jpg|jpeg|webp)$/i.test(ent.name)) out.push(p);
  }
  return out;
}
function hasRealScreenshotReference(summary, taskDir) {
  const lines = summary.split(/\r?\n/).filter(line => line.includes('|'));
  const candidates = [];
  for (const line of lines) {
    if (!/(figma-reference-screenshots|screenshot|ảnh|anh|png|jpg|jpeg|webp)/i.test(line)) continue;
    if (/<frame|<state|\.\.\.png|`output\/figma-reference-screenshots\/\.\.\.png`|\|\s*\|\s*\|/i.test(line)) continue;
    const matches = line.match(/`?([A-Za-z0-9_\.\-\/]+\.(?:png|jpg|jpeg|webp))`?/ig) || [];
    for (const m of matches) candidates.push(m.replace(/`/g, ''));
    if (/user screenshot|manual screenshot|ảnh user|anh user|screenshot user|manual/i.test(line) && !/<|\.\.\./.test(line)) return true;
  }
  for (const rel of candidates) {
    if (/^output\/figma-reference-screenshots\//.test(rel) && !exists(path.join(taskDir, rel))) return false;
  }
  return candidates.length > 0;
}
function mdSection(text, headingRe) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(line => headingRe.test(line));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+\d+\./.test(lines[i]) && !headingRe.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}
function tableRows(md) {
  return md.split(/\r?\n/)
    .filter(line => line.trim().startsWith('|') && !/^\|\s*-+/.test(line.trim()))
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim().replace(/^`|`$/g, '')))
    .filter(cells => cells.length >= 3 && !cells.every(c => !c));
}
function isPlaceholderCell(text) {
  return !text || /<|\.\.\.|chưa làm\s*\/|icon\s*\/\s*image|svg\s*\/\s*jsx|mcp export\s*\/|^\s*$|^n\/a$/i.test(text);
}
function noAssetDecision(text) {
  return /(no new asset|không có asset mới|khong co asset moi|không áp dụng|khong ap dung|not applicable|reuse existing|reused)/i.test(text);
}
function hasExportDecisionText(text) {
  return /\b(SVG|JSX|TSX|PNG|WebP|Reuse existing|Reused|No new asset|required|Không có asset mới|Không áp dụng)\b/i.test(text);
}
function hasHeading(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^#{1,4}\\s+' + escaped + '\\s*$', 'im').test(text);
}
function tableItems(text, headerPhrase) {
  const idx = text.toLowerCase().indexOf(headerPhrase.toLowerCase());
  if (idx < 0) return [];
  const part = text.slice(idx, idx + 4000);
  const rows = part.split(/\r?\n/).filter(l => /^\|/.test(l) && !/---/.test(l));
  const items = [];
  for (const row of rows.slice(1)) {
    const first = row.split('|').map(x => x.trim()).filter(Boolean)[0] || '';
    if (!first || /^<|planned file|name|state \/ data|file$/i.test(first)) continue;
    const ticks = first.match(/`([^`]+)`/g);
    if (ticks) items.push(...ticks.map(t => t.replace(/`/g, '')));
    else if (/^(src|app|components|features|pages|hooks|stores|lib|services)\//.test(first) || /^use[A-Z]/.test(first) || /(Store|Context|Query|Mutation)$/.test(first)) items.push(first);
  }
  return items;
}
export function validateFigmaEvidence(taskDir) {
  const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
  const summaryPath = path.join(taskDir, 'output', 'figma-extraction-summary.md');
  const errors = [];
  if (!exists(workflowPath)) return { ok: false, errors: ['Missing tracking/workflow-status.md. Cannot evaluate Figma evidence gate.'] };
  const fm = parseFrontMatter(read(workflowPath));
  if (!fm.hasFrontMatter) return { ok: false, errors: ['workflow-status.md missing YAML front matter.'] };
  const figmaRequired = boolValue(fm.data.figma_required);
  if (!figmaRequired) return { ok: true, errors: [], skipped: true };
  const gate = normValue(fm.data.figma_gate_status);
  const access = normValue(fm.data.figma_access_status);
  const extraction = normValue(fm.data.figma_extraction_status);
  const source = normValue(fm.data.figma_decision_source);
  const allowedGate = ['passed','waived','substituted_by_source_pattern','substituted_by_cr_or_screenshot'];
  if (!allowedGate.includes(gate)) errors.push(`Figma gate is not build-eligible: ${gate || '(missing)'}.`);
  if (!source) errors.push('figma_decision_source is required when figma_required=true.');
  if (!exists(summaryPath)) errors.push('Missing output/figma-extraction-summary.md for figma_required=true.');
  if (exists(summaryPath)) {
    const summary = read(summaryPath);
    if (!/^#\s+(Tổng hợp Figma extraction|Figma Extraction)/im.test(summary)) errors.push('figma-extraction-summary.md phải dùng template Tổng hợp Figma extraction.');
    if (!/##\s+Trạng thái gate \/ truy cập/i.test(summary)) errors.push('figma-extraction-summary.md missing Trạng thái gate / truy cập section.');
    if (!/##\s+1\.\s+(Evidence truy cập Figma|Figma Access Evidence)/i.test(summary)) errors.push('figma-extraction-summary.md thiếu mục Evidence truy cập Figma.');
    if (!/##\s+2\.\s+(Frame mục tiêu và screenshot tham chiếu|Target Frames and Reference Screenshots)/i.test(summary)) errors.push('figma-extraction-summary.md thiếu mục Frame mục tiêu và screenshot tham chiếu.');
    if (!/Node tree/i.test(summary) || !/Tokens\/styles/i.test(summary) || !/Components\/variants/i.test(summary) || !/Vector nodes\/assets/i.test(summary)) errors.push('Evidence Figma phải cover node tree, tokens/styles, components/variants và vector nodes/assets.');
    if (figmaRequired && !/UI Implementation Contract/i.test(summary)) errors.push('figma-extraction-summary.md thiếu UI Implementation Contract để FE cook bám khi implement UI.');
    if (figmaRequired && !/UI Node Implementation Matrix/i.test(summary)) errors.push('figma-extraction-summary.md thiếu UI Node Implementation Matrix để map từng node/state quan trọng.');
    if (figmaRequired && !/(Props\/variant\/class\/token|Props\/variant\/class\/style|Source component)/i.test(summary)) errors.push('figma-extraction-summary.md thiếu Figma → Source component binding cụ thể.');
    if (figmaRequired && !/(visual source of truth|visual source|Figma evidence là visual source|Figma là visual)/i.test(summary)) errors.push('UI Implementation Contract phải ghi rõ Figma là visual source of truth khi gate passed.');
    if (figmaRequired && !/(Source component mapping|Component mapping chi tiết|Source component)/i.test(summary)) errors.push('UI Implementation Contract thiếu source component mapping.');
    if (figmaRequired && !/(Allowed deviation|Deviation log|deviation)/i.test(summary)) errors.push('UI Implementation Contract thiếu allowed deviation/deviation log.');
    const needsScreenshotEvidence = gate !== 'waived' && gate !== 'substituted_by_source_pattern';
    if (needsScreenshotEvidence) {
      const hasImage = imageFiles(path.join(taskDir, 'output', 'figma-reference-screenshots')).length > 0;
      const hasReference = hasRealScreenshotReference(summary, taskDir);
      if (!hasImage && !hasReference) errors.push('Figma reference screenshot evidence is required: add output/figma-reference-screenshots/* or a concrete user/manual screenshot reference in figma-extraction-summary.md.');
    }
    if (gate === 'passed') {
      if (access !== 'connected' && access !== 'api' && !/mcp|api|node data/i.test(summary)) errors.push('Figma gate passed requires connected/API/MCP evidence, not only URL/source pattern.');
      if (extraction !== 'completed') errors.push(`Figma gate passed requires figma_extraction_status=completed, got ${extraction || '(missing)'}.`);
    }
    if (gate === 'substituted_by_source_pattern' && !/source pattern|reuse existing|substituted_by_source_pattern|source-pattern/i.test(summary)) errors.push('Source-pattern substitution must be explicitly documented in figma-extraction-summary.md.');
    if (gate === 'substituted_by_cr_or_screenshot' && !/cr|screenshot|ảnh|anh|manual spec|user/i.test(summary)) errors.push('CR/screenshot substitution must cite CR/user screenshot/manual spec evidence in figma-extraction-summary.md.');
  }
  return { ok: errors.length === 0, errors };
}
export function validateAssetGate(taskDir) {
  const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
  const summaryPath = path.join(taskDir, 'output', 'figma-extraction-summary.md');
  const workflow = read(workflowPath);
  const fm = parseFrontMatter(workflow);
  const figmaRequired = fm.hasFrontMatter && boolValue(fm.data.figma_required);
  const errors = [];
  if (!figmaRequired && !exists(summaryPath)) return { ok: true, errors: [], skipped: true };
  if (!exists(summaryPath)) return { ok: false, errors: ['Missing output/figma-extraction-summary.md. Cannot validate Asset Extraction Log.'] };
  const summary = read(summaryPath);
  const assetSection = mdSection(summary, /^##\s+6\.\s+Asset Extraction Log/i);
  if (!assetSection) return { ok: false, errors: ['figma-extraction-summary.md missing section 6. Asset Extraction Log.'] };
  if (!/###\s+6\.1\s+Source Base Asset Convention/i.test(assetSection)) errors.push('Asset Extraction Log missing 6.1 Source Base Asset Convention.');
  if (!/###\s+6\.2\s+Vector\s*\/\s*Asset Inspection/i.test(assetSection)) errors.push('Asset Extraction Log missing 6.2 Vector / Asset Inspection.');
  if (!/###\s+6\.3\s+Format Decision Rules Applied/i.test(assetSection)) errors.push('Asset Extraction Log missing 6.3 Format Decision Rules Applied.');
  const rows = tableRows(assetSection);
  const dataRows = rows.filter(cells => !/Asset Type|Asset\s*\|\s*Loại|Loại|Type/i.test(cells.join(' ')));
  const decisionRows = dataRows.filter(cells => /^(Icon|Image|Logo|Illustration|Background)$/i.test((cells[0] || '').trim()) && cells.length >= 5);
  let meaningfulDecision = false;
  for (const cells of decisionRows) {
    const joined = cells.join(' ');
    if (/Icon\s*\/\s*Image|SVG file\s*\/\s*JSX|PNG\s*\/\s*WebP|CSS\/token\/image asset|<|\.\.\./i.test(joined)) continue;
    if (hasExportDecisionText(joined)) meaningfulDecision = true;
    const type = cells[0] || '(unknown asset type)';
    const existingConvention = cells[1] || '';
    const userFolder = cells[2] || '';
    const decision = cells[3] || '';
    const blocker = cells[4] || '';
    if (!hasExportDecisionText(decision)) errors.push(`Asset convention row for ${type} missing concrete decision (SVG/JSX/TSX/PNG/WebP/Reuse/No new asset).`);
    if (!noAssetDecision(decision) && isPlaceholderCell(existingConvention) && isPlaceholderCell(userFolder)) errors.push(`Asset convention row for ${type} must include existing source convention or user-provided target folder.`);
    if (/blocked|bị chặn|bi chan/i.test(decision + ' ' + blocker)) errors.push(`Asset convention row for ${type} is blocked.`);
  }
  if (!meaningfulDecision) errors.push('Asset Extraction Log must include at least one concrete asset decision row, or explicitly state No new asset required / Không có asset mới.');
  const inspectionRows = dataRows.filter(cells => /^(Icon|Image|Logo|Illustration|Background)$/i.test((cells[1] || '').trim()) && cells.length >= 9);
  for (const cells of inspectionRows) {
    const joined = cells.join(' ');
    if (/Icon\s*\/\s*Image|SVG\s*\/\s*JSX|MCP export\s*\/|<|\.\.\./i.test(joined)) continue;
    const asset = cells[0] || '(unnamed asset)';
    const node = cells[2] || '';
    const bbox = cells[3] || '';
    const format = cells[4] || '';
    const targetPath = cells[5] || '';
    const usage = cells[6] || '';
    const method = cells[7] || '';
    const status = cells[8] || '';
    if (/blocked|bị chặn|bi chan/i.test(status)) errors.push(`Asset inspection row for ${asset} is blocked.`);
    if (!hasExportDecisionText(format)) errors.push(`Asset inspection row for ${asset} missing target format.`);
    if (!noAssetDecision(format + ' ' + status)) {
      if (isPlaceholderCell(node)) errors.push(`Asset inspection row for ${asset} missing Figma node id/name.`);
      if (isPlaceholderCell(bbox)) errors.push(`Asset inspection row for ${asset} missing bounding box.`);
      if (isPlaceholderCell(targetPath)) errors.push(`Asset inspection row for ${asset} missing target path.`);
      if (isPlaceholderCell(usage)) errors.push(`Asset inspection row for ${asset} missing source usage.`);
      if (isPlaceholderCell(method)) errors.push(`Asset inspection row for ${asset} missing export method.`);
    }
  }
  return { ok: errors.length === 0, errors };
}
export function validateSrsReference(taskDir) {
  const errors = [];
  const task = read(path.join(taskDir, 'task.md'));
  const plan = read(path.join(taskDir, 'planning', 'implementation-plan.md'));
  const checklist = read(path.join(taskDir, 'planning', 'build-checklist.md'));
  if (!task) errors.push('Thiếu task.md');
  if (task && !/Bản đồ tham chiếu SRS/i.test(task)) errors.push('task.md thiếu Bản đồ tham chiếu SRS');
  if (task && !/Bản đồ sử dụng API contract/i.test(task)) errors.push('task.md thiếu Bản đồ sử dụng API contract');
  if (task && !/Bản đồ lỗi API và cách hiển thị FE/i.test(task)) errors.push('task.md thiếu Bản đồ lỗi API và cách hiển thị FE');
  if (plan && !/Section SRS liên quan/i.test(plan)) errors.push('implementation-plan.md thiếu Section SRS liên quan');
  if (checklist && !/SRS\s*\/\s*API Contract|SRS\s*\/\s*API/i.test(checklist)) errors.push('build-checklist.md thiếu SRS/API Contract checklist');
  return { ok: errors.length === 0, errors };
}
export function validateQuestionsRouting(taskDir) {
  const errors = [];
  const q = read(path.join(taskDir, 'planning', 'questions.md'));
  if (!q) return { ok: false, errors: ['Thiếu planning/questions.md'] };
  for (const h of ['Mục đích','Quy tắc route câu hỏi','Câu hỏi blocking','Câu hỏi non-blocking','Quyết định đã xác nhận']) {
    if (!hasHeading(q, h)) errors.push(`questions.md thiếu section: ${h}`);
  }
  for (const col of ['Bên trả lời','Bằng chứng nguồn','Conflict / thiếu thông tin','Câu hỏi','Trạng thái']) {
    if (!new RegExp('\\|[^\\n]*' + col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*\\|', 'i').test(q)) errors.push(`questions.md thiếu cột: ${col}`);
  }
  const badOwner = q.split(/\r?\n/).filter(line => /^\|\s*Q\w+/i.test(line) && !/\|\s*(Dev|BA\/PM|BE\/API|Design|Design\/Dev|PM)\s*\|/i.test(line));
  for (const line of badOwner) errors.push('questions.md có owner không hợp lệ hoặc thiếu trong dòng: ' + line.slice(0,120));
  return { ok: errors.length === 0, errors };
}
export function validatePlanArchitecture(taskDir) {
  const errors = [];
  const planPath = path.join(taskDir, 'planning', 'implementation-plan.md');
  const plan = read(planPath);
  if (!plan) return { ok: false, errors: ['Thiếu planning/implementation-plan.md'] };
  for (const phrase of ['Ma trận trace SRS → FE logic → UI → Test','Quyết định kiến trúc logic frontend','File sẽ tạo / cập nhật','Quyết định hook / store','Quyết định vị trí state','Quyết định global state','Quyết định lỗi API và hiển thị lỗi FE','UI Implementation Contract từ Figma','Luồng người dùng','Luồng API','Luồng lỗi','Kế hoạch test']) {
    if (!plan.toLowerCase().includes(phrase.toLowerCase())) errors.push(`implementation-plan.md thiếu: ${phrase}`);
  }
  for (const phrase of ['Bản đồ lỗi API từ SRS/source','Quyết định kênh hiển thị lỗi','Quyết định component lỗi / toast']) {
    if (!plan.toLowerCase().includes(phrase.toLowerCase())) errors.push(`implementation-plan.md thiếu subsection lỗi API/FE display: ${phrase}`);
  }
  return { ok: errors.length === 0, errors };
}
export function validatePlanChecklistSync(taskDir) {
  const errors = [];
  const plan = read(path.join(taskDir, 'planning', 'implementation-plan.md'));
  const checklist = read(path.join(taskDir, 'planning', 'build-checklist.md'));
  if (!plan || !checklist) return { ok: false, errors: ['Thiếu plan hoặc checklist để sync'] };
  const plannedFiles = tableItems(plan, 'File sẽ tạo / cập nhật').filter(x => /[/.]/.test(x));
  const plannedHooks = tableItems(plan, 'Quyết định hook / store').filter(x => /use[A-Z]|Store|Context|Query|Mutation/i.test(x));
  for (const item of [...plannedFiles, ...plannedHooks]) {
    if (item.length > 2 && !checklist.includes(item)) errors.push(`build-checklist.md chưa verify planned item: ${item}`);
  }
  if (/Quyết định global state/i.test(plan) && !/global store|Zustand|global state|store\/context/i.test(checklist)) errors.push('build-checklist.md thiếu verification cho Quyết định global state');
  if (/Quyết định lỗi API và hiển thị lỗi FE/i.test(plan) && !/API error & FE error display|toast|snackbar|inline field|form alert|page error|custom error ui/i.test(checklist)) errors.push('build-checklist.md thiếu verification cho API error & FE error display');
  if (/UI Implementation Contract từ Figma/i.test(plan) && !/Figma là visual source of truth|UI Implementation Contract|visual deviation|Source component/i.test(checklist)) errors.push('build-checklist.md thiếu verification cho UI/Figma visual fidelity contract');
  return { ok: errors.length === 0, errors };
}
export function validateInputSyncReport(taskDir) {
  const errors = [];
  const reportPath = path.join(taskDir, 'tracking', 'input-sync-report.md');
  const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
  const workflow = read(workflowPath);
  const fm = parseFrontMatter(workflow);
  const syncStatus = fm.hasFrontMatter ? normValue(fm.data.input_sync_status) : '';
  const currentMode = fm.hasFrontMatter ? normValue(fm.data.current_mode) : '';
  const requiresReport = exists(reportPath) || currentMode === 'input-sync-mode' || ['synced','has_impact','no_impact','blocked','needs_task','pending'].includes(syncStatus);
  if (!requiresReport) return { ok: true, errors: [], skipped: true };
  if (!exists(reportPath)) return { ok: false, errors: ['Thiếu tracking/input-sync-report.md khi input_sync_status/current_mode cho thấy đã chạy hoặc đang chạy input-sync.'] };
  const report = read(reportPath);
  for (const phrase of ['# Báo cáo đồng bộ input','## Bước hiện tại','## 1. Nguồn CR/file trả lời','## 2. Quy ước version SRS','## 3. Kết quả đồng bộ câu hỏi','## 5. Kiểm tra lại Figma gate','## 6. Phân loại impact CR sau PR','## 7. Phạm vi bị ảnh hưởng','## 8. Hành động bắt buộc','## 9. File đã cập nhật','## Cập nhật workflow-status.md']) {
    if (!report.toLowerCase().includes(phrase.toLowerCase())) errors.push(`input-sync-report.md thiếu section: ${phrase}`);
  }
  if (/^##\s+(Prompt bước tiếp theo|Prompt bước tiếp theo)/im.test(report)) errors.push('input-sync-report.md không được chứa Prompt bước tiếp theo; chỉ workflow-status.md được chứa prompt bước tiếp theo.');
  if (!/SRS update status/i.test(report)) errors.push('input-sync-report.md phải ghi SRS update status để phân biệt SRS mới thật với CR/clarification.');
  if (!/Figma gate status sau sync/i.test(report)) errors.push('input-sync-report.md phải re-check Figma gate sau sync.');
  if (!/tracking\/workflow-status\.md/i.test(report)) errors.push('input-sync-report.md phải ghi workflow-status.md là file cập nhật next prompt/build_ready.');
  return { ok: errors.length === 0, errors };
}