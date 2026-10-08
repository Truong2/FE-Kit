/**
 * Tự kiểm bộ eval hành vi mà không gọi API: dựng lại workspace của từng case
 * bằng `scaffold.mjs`, rồi kiểm
 *   1. gate lúc bắt đầu đúng như case muốn đo (bị chặn hay được chạy);
 *   2. grader tất định cho kết quả đúng khi agent CHƯA làm gì:
 *      - grader kiềm chế (không sửa source, không ghi pass giả...) phải pass,
 *        nếu không thì case fail kể cả khi agent làm đúng;
 *      - grader hành động (tạo report, route input-sync...) phải fail,
 *        nếu không thì grader pass mà chẳng đo được gì.
 *
 * Ngữ nghĩa grader theo tài liệu `claude plugin eval`: `file_exists` chỉ tính
 * file tạo ra trong lượt chạy; `tool_used` đếm lời gọi tool (mặc định min 1).
 * Tài liệu không nói `regex` xử lý file không tồn tại thế nào; ở đây coi như
 * nội dung rỗng.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  parseFrontMatterLoose,
  countOpenBlockingQuestions,
  evaluateModeEntry,
  COMMANDS,
} from '../packages/validators/src/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVALS = path.join(ROOT, 'evals');

/** Case nào đo việc gate CHẶN; các case còn lại phải được chạy. */
const ENTRY_BLOCKED = new Set(['cook-refuses-when-blocked']);

/** Grader kiềm chế viết bằng `contains`: kiểm source còn nguyên. */
const RESTRAINT_BY_NAME = new Set(['source-unchanged']);

const CASES = fs
  .readdirSync(EVALS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(EVALS, d.name, 'prompt.md')))
  .map((d) => d.name);

function loadCase(name) {
  const dir = path.join(EVALS, name);
  const prompt = matter(fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8'));
  const [, command, task] = prompt.content.trim().match(/^\/fe:([\w-]+)\s+(\S+)/) || [];
  const graders = fs
    .readdirSync(path.join(dir, 'graders'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: f.replace(/\.md$/, ''), ...matter(fs.readFileSync(path.join(dir, 'graders', f), 'utf8')).data }));
  return { dir, command, task, graders };
}

function isRestraint(g) {
  if (RESTRAINT_BY_NAME.has(g.name)) return true;
  if (g.type === 'file_exists') return g.exists === false;
  if (g.type === 'regex') return g.match === 'not_contains';
  if (g.type === 'tool_used') return g.max === 0;
  return false;
}

/** Kết quả của grader trên workspace chưa bị agent đụng tới; `null` = cần agent mới chấm được. */
function gradeUntouched(g, ws) {
  switch (g.type) {
    case 'file_exists':
      return g.exists === false; // chưa tạo file nào trong lượt chạy
    case 'tool_used':
      return (g.min ?? 1) <= 0; // chưa gọi tool nào
    case 'regex': {
      if (g.target?.source !== 'file') return null; // last_message: cần câu trả lời của agent
      const file = path.join(ws, g.target.path);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      const found = new RegExp(g.pattern, g.flags || '').test(text);
      return g.match === 'not_contains' ? !found : found;
    }
    default:
      return null; // llm
  }
}

const workspaces = {};

beforeAll(() => {
  for (const name of CASES) {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), `fe-kit-eval-${name}-`));
    const r = spawnSync(process.execPath, [path.join(EVALS, name, 'scaffold.mjs')], { cwd: ws, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`scaffold của ${name} lỗi:\n${r.stderr}`);
    workspaces[name] = ws;
  }
}, 120_000);

afterAll(() => {
  for (const ws of Object.values(workspaces)) fs.rmSync(ws, { recursive: true, force: true });
});

describe.each(CASES)('eval case %s', (name) => {
  const c = loadCase(name);

  it('chạy scaffold qua shim bash gọi scaffold.mjs', () => {
    expect(matter(`---\n${fs.readFileSync(path.join(c.dir, 'case.yaml'), 'utf8')}\n---\n`).data.context.scaffold_script).toBe('scaffold.sh');
    expect(fs.readFileSync(path.join(c.dir, 'scaffold.sh'), 'utf8')).toMatch(/exec node .*scaffold\.mjs/);
  });

  it('gate lúc bắt đầu đúng như case muốn đo', () => {
    if (!COMMANDS.includes(c.command)) return; // lệnh cấp repo (vd retro), không có gate vào mode
    const ws = workspaces[name];
    const taskDir = path.join(ws, c.task);
    const status = parseFrontMatterLoose(fs.readFileSync(path.join(taskDir, 'tracking', 'workflow-status.md'), 'utf8'));
    const entry = evaluateModeEntry({
      requested: c.command,
      data: status.data,
      openBlockingQuestions: countOpenBlockingQuestions(fs.readFileSync(path.join(taskDir, 'planning', 'questions.md'), 'utf8')),
      taskRef: c.task,
    });
    expect(entry.allowed, entry.reasons.join('; ')).toBe(!ENTRY_BLOCKED.has(name));
  });

  it('grader kiềm chế pass và grader hành động fail khi agent chưa làm gì', () => {
    const results = c.graders
      .map((g) => ({ name: g.name, restraint: isRestraint(g), passed: gradeUntouched(g, workspaces[name]) }))
      .filter((r) => r.passed !== null);
    for (const r of results) {
      expect(r.passed, `${r.name} (${r.restraint ? 'kiềm chế' : 'hành động'})`).toBe(r.restraint);
    }
  });

  it('cấm sửa source thì cấm đủ Edit, Write và MultiEdit', () => {
    const banned = c.graders.filter((g) => g.type === 'tool_used' && g.max === 0);
    if (!banned.length) return;
    const byTool = new Map(banned.map((g) => [g.tool, g.input_match]));
    for (const tool of ['Edit', 'Write', 'MultiEdit']) {
      expect(byTool.get(tool), `thiếu grader cấm ${tool}`).toBe(banned[0].input_match);
    }
  });
});
