/**
 * Test CLI ở dạng người dùng thật sự nhận: bản bundle standalone/fe-kit.mjs,
 * chạy trong repo tạm KHÔNG có node_modules. Chạy `npm run build` trước nếu
 * vừa sửa bin/, core/ hoặc packages/validators.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT_CLI = path.join(ROOT, 'standalone', 'fe-kit.mjs');

let target;

function run(cli, args, cwd = target) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const kit = (...args) => run(KIT_CLI, args, ROOT);
const project = (...args) => run(path.join(target, 'bin', 'fe-kit.mjs'), args);
const exists = (rel) => fs.existsSync(path.join(target, rel));
const read = (rel) => fs.readFileSync(path.join(target, rel), 'utf8');

beforeEach(() => {
  target = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-kit-cli-'));
});

afterEach(() => {
  fs.rmSync(target, { recursive: true, force: true });
});

describe('fe-kit init', () => {
  it('claude: chỉ ghi CLAUDE.md, .claude/rules và bật plugin — không copy commands/agents/skill', () => {
    expect(kit('init', '--target', target, '--agents', 'claude', '--yes').status).toBe(0);

    expect(exists('CLAUDE.md')).toBe(true);
    expect(exists('.claude/rules/frontend-delivery.md')).toBe(true);
    expect(exists('.claude/commands')).toBe(false);
    expect(exists('.claude/agents')).toBe(false);
    expect(exists('.claude/skills')).toBe(false);

    const settings = JSON.parse(read('.claude/settings.json'));
    expect(settings.enabledPlugins['fe@frontend-delivery']).toBe(true);
    expect(settings.extraKnownMarketplaces['frontend-delivery'].source.source).toBe('github');
  });

  it('giữ key sẵn có trong .claude/settings.json', () => {
    fs.mkdirSync(path.join(target, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(target, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test)'] }, enabledPlugins: { 'other@x': true } }));
    kit('init', '--target', target, '--agents', 'claude', '--yes');
    const settings = JSON.parse(read('.claude/settings.json'));
    expect(settings.permissions.allow).toEqual(['Bash(npm test)']);
    expect(settings.enabledPlugins).toMatchObject({ 'other@x': true, 'fe@frontend-delivery': true });
  });

  it('github: không rò workflow CI của chính kit', () => {
    kit('init', '--target', target, '--agents', 'github', '--yes');
    expect(exists('.github/workflows/frontend-delivery-standard.yml')).toBe(true);
    expect(exists('.github/workflows/kit-ci.yml')).toBe(false);
    expect(exists('.github/workflows/plugin-evals.yml')).toBe(false);
  });

  it('codex: sinh prompt từ core/commands, bỏ frontmatter', () => {
    kit('init', '--target', target, '--agents', 'codex', '--yes');
    const prompt = read('.codex/prompts/build.md');
    expect(prompt.startsWith('# FE cook\n')).toBe(true);
    expect(prompt).not.toMatch(/^---/m);
    expect(prompt).not.toMatch(/Điều phối \(Claude Code\)/);
    expect(exists('.codex/prompts/figma-extract.md')).toBe(true);
  });

  it('init lại không đè file của team', () => {
    fs.writeFileSync(path.join(target, 'CLAUDE.md'), '# Dự án của team\n\nGhi chú riêng.\n');
    kit('init', '--target', target, '--agents', 'claude', '--yes');
    fs.appendFileSync(path.join(target, 'docs', 'frontend-context', 'project-source-context.md'), '\nTEAM EDIT\n');

    kit('init', '--target', target, '--agents', 'claude', '--yes');

    expect(read('docs/frontend-context/project-source-context.md')).toMatch(/TEAM EDIT/);
    const claudeMd = read('CLAUDE.md');
    expect(claudeMd.startsWith('# Dự án của team')).toBe(true);
    expect(claudeMd.match(/fe-kit:start/g)).toHaveLength(1);
  });
});

describe('CLI bundle trong repo dự án (không có node_modules)', () => {
  beforeEach(() => {
    kit('init', '--target', target, '--agents', 'all', '--yes');
  });

  it('doctor --strict đạt ngay sau init', () => {
    const r = project('doctor', '--strict');
    expect(r.out).toMatch(/Doctor passed/);
    expect(r.status).toBe(0);
  });

  it('doctor báo bản copy v1.x gây trùng với plugin', () => {
    fs.mkdirSync(path.join(target, '.claude', 'commands', 'fe'), { recursive: true });
    const r = project('doctor', '--strict');
    expect(r.out).toMatch(/TRÙNG \.claude\/commands\/fe/);
    expect(r.status).toBe(1);
  });

  it('new-task → validate-task → validate-workflow → next', () => {
    expect(project('new-task', 'FE-1-demo').status).toBe(0);
    expect(project('validate-task', 'FE-1-demo').out).toMatch(/validate-task passed/);
    expect(project('validate-workflow', 'docs/frontend-tasks/FE-1-demo').out).toMatch(/validate-workflow passed/);
    // path kiểu Windows cũng phải resolve được
    expect(project('next', 'docs\\frontend-tasks\\FE-1-demo').out).toMatch(/FE plan docs\/frontend-tasks\/FE-1-demo/);
  });

  it('new-task từ chối tên có path traversal', () => {
    const r = project('new-task', '../escape');
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/không hợp lệ/);
  });

  it('validate-pr fail trên task mới và nêu rõ thiếu gì', () => {
    project('new-task', 'FE-2-demo');
    const r = project('validate-pr', 'FE-2-demo');
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/Thiếu output\/pr-summary\.md/);
    expect(r.out).toMatch(/review_status phải passed/);
  });

  describe('validate-pr với scope diff tính từ git', () => {
    const git = (...a) => spawnSync('git', a, { cwd: target, encoding: 'utf8' });

    /** Task sẵn sàng PR; `plannedFiles` rỗng = plan kiểu v1.x không có bảng file. */
    function readyTask(name, plannedFiles) {
      const dir = path.join(target, 'docs', 'frontend-tasks', name);
      fs.cpSync(path.join(ROOT, 'packages', 'validators', 'test', 'fixtures', 'task-ready-to-cook'), dir, { recursive: true });
      const status = path.join(dir, 'tracking', 'workflow-status.md');
      let text = fs.readFileSync(status, 'utf8');
      for (const [k, v] of Object.entries({ current_mode: 'pr-ready-mode', next_mode: 'none', review_status: 'passed', pr_status: 'ready', scope_diff_status: 'passed', command_evidence_status: 'completed', test_command_log_status: 'completed' })) {
        text = text.replace(new RegExp(`^${k}:.*$`, 'm'), `${k}: ${v}`);
      }
      fs.writeFileSync(status, text);
      fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'output', 'review-report.md'), '# Review\n');
      fs.writeFileSync(path.join(dir, 'output', 'pr-summary.md'), '# PR\n');
      fs.writeFileSync(path.join(dir, 'output', 'test-summary.md'), '## 1. Command evidence log\n\n| Command | Đã chạy thật? | Kết quả |\n|---|---|---|\n| `npm test` | Có | Passed |\n');
      if (plannedFiles.length) {
        const rows = plannedFiles.map((f) => `| \`${f}\` | Tạo | x | C1 |`).join('\n');
        fs.appendFileSync(path.join(dir, 'planning', 'implementation-plan.md'), `\n## 7. File sẽ tạo / cập nhật\n\n| File | Hành động | Lý do | Checklist ref |\n|---|---|---|---|\n${rows}\n`);
      }
    }

    function commitBase() {
      git('init', '-q');
      git('add', '-A');
      git('-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-qm', 'base');
    }

    function writeSource(rel) {
      fs.mkdirSync(path.dirname(path.join(target, rel)), { recursive: true });
      fs.writeFileSync(path.join(target, rel), 'export const x = 1;\n');
    }

    it('task v1.x không có bảng file trong plan vẫn qua như v1.1, kèm cảnh báo', () => {
      readyTask('FE-1-old', []);
      commitBase();
      writeSource('src/components/OrderCancelButton.tsx');
      const r = project('validate-pr', 'FE-1-old');
      expect(r.out).toMatch(/validate-pr passed/);
      expect(r.out).toMatch(/chưa khai file nào/);
    });

    it('chặn file sửa ngoài plan', () => {
      readyTask('FE-2-new', ['src/components/OrderCancelButton.tsx']);
      commitBase();
      writeSource('src/components/OrderCancelButton.tsx');
      writeSource('src/store/global.ts');
      const r = project('validate-pr', 'FE-2-new');
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/file sửa ngoài plan: src\/store\/global\.ts/);
    });

    it('PR gộp hai task: file thuộc plan của task kia không bị tính là ngoài plan', () => {
      readyTask('FE-3-a', ['src/a.ts']);
      readyTask('FE-4-b', ['src/b.ts']);
      commitBase();
      writeSource('src/a.ts');
      writeSource('src/b.ts');
      expect(project('validate-pr', 'FE-3-a').out).toMatch(/validate-pr passed/);
      expect(project('validate-pr', 'FE-4-b').out).toMatch(/validate-pr passed/);
    });

    it('validate-workflow ở pr-ready-mode tự đối chiếu scope; --no-scope tắt được', () => {
      readyTask('FE-5-wf', ['src/components/OrderCancelButton.tsx']);
      commitBase();
      writeSource('src/store/global.ts');
      const r = project('validate-workflow', 'FE-5-wf');
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/Scope: tính từ git/);
      expect(r.out).toMatch(/src\/store\/global\.ts/);
      expect(project('validate-workflow', 'FE-5-wf', '--no-scope').out).toMatch(/validate-workflow passed/);
    });

    it('test-summary có dòng evidence trống không qua validate-pr', () => {
      readyTask('FE-6-ev', []);
      fs.writeFileSync(
        path.join(target, 'docs', 'frontend-tasks', 'FE-6-ev', 'output', 'test-summary.md'),
        '## 1. Command evidence log\n\n| Command | Đã chạy thật? | Kết quả | Thời điểm | Ghi chú |\n|---|---|---|---|---|\n| `npm test` |  |  |  |  |\n'
      );
      commitBase();
      const r = project('validate-pr', 'FE-6-ev');
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/chưa có dòng command đã chạy thật/);
    });
  });

  it('in đúng version của kit, không đọc package.json của dự án', () => {
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'app', version: '9.9.9' }));
    const kitVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
    expect(project('help').out).toContain(`CLI v${kitVersion}`);
  });

  it('init từ bản copy trong dự án báo lỗi rõ ràng', () => {
    const r = project('init', '--agents', 'claude', '--yes');
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/phải chạy từ repo kit/);
  });
});
