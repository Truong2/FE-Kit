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

/** GitHub Actions đặt CI=true, mà CLI không ghi run-log trên CI: test tự quyết biến này. */
function run(cli, args, cwd = target, env = {}) {
  const base = { ...process.env };
  delete base.CI;
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', env: { ...base, ...env } });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const kit = (...args) => run(KIT_CLI, args, ROOT);
const project = (...args) => run(path.join(target, 'bin', 'fe-kit.mjs'), args);
const projectEnv = (env, ...args) => run(path.join(target, 'bin', 'fe-kit.mjs'), args, target, env);
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

    describe('validate-pr --orphans', () => {
      const setConfig = (yaml) => fs.writeFileSync(path.join(target, '.frontend-delivery', 'standard.yaml'), yaml);

      beforeEach(() => {
        readyTask('FE-8-orphan', ['src/features/order/']);
        commitBase();
        writeSource('src/features/order/Cancel.tsx'); // thuộc plan
        writeSource('src/store/global.ts'); // không task nào khai
        writeSource('docs/notes.md'); // không phải source
      });

      it('mặc định chỉ cảnh báo, nêu đúng file source không thuộc plan nào', () => {
        const r = project('validate-pr', '--orphans');
        expect(r.status).toBe(0);
        expect(r.out).toMatch(/1 file source đã đổi nhưng không task nào khai/);
        expect(r.out).toMatch(/src\/store\/global\.ts/);
        expect(r.out).not.toMatch(/Cancel\.tsx|docs\/notes\.md/);
      });

      it('require_task_for_source: error thì chặn; off thì bỏ qua', () => {
        setConfig('require_task_for_source: error\n');
        expect(project('validate-pr', '--orphans').status).toBe(1);
        setConfig('require_task_for_source: off\n');
        expect(project('validate-pr', '--orphans').out).toMatch(/bỏ qua/);
      });

      it('source_paths giới hạn phạm vi; giá trị sai kiểu thì cảnh báo và dùng mặc định', () => {
        setConfig('require_task_for_source: error\nsource_paths: [lib/]\n');
        expect(project('validate-pr', '--orphans').out).toMatch(/passed/);
        setConfig('require_task_for_source: always\n');
        const r = project('validate-pr', '--orphans');
        expect(r.status).toBe(0);
        expect(r.out).toMatch(/giá trị require_task_for_source không hợp lệ/);
      });

      it('mọi file source đều thuộc plan thì pass', () => {
        fs.rmSync(path.join(target, 'src', 'store'), { recursive: true });
        expect(project('validate-pr', '--orphans').out).toMatch(/validate-pr --orphans passed/);
      });
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

  describe('run-log, mode begin/end, report', () => {
    const TASK = 'docs/frontend-tasks/FE-7-log';
    const runLog = () => {
      const file = path.join(target, TASK, 'tracking', 'run-log.jsonl');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
    };
    const blockTask = () =>
      fs.copyFileSync(
        path.join(ROOT, 'packages', 'validators', 'test', 'fixtures', 'task-blocked-question', 'planning', 'questions.md'),
        path.join(target, TASK, 'planning', 'questions.md')
      );
    const touchStatus = () => {
      const file = path.join(target, TASK, 'tracking', 'workflow-status.md');
      const future = new Date(Date.now() + 5000);
      fs.utimesSync(file, future, future);
    };

    beforeEach(() => {
      project('new-task', 'FE-7-log');
    });

    it('init thêm merge=union cho run-log vào .gitattributes đúng một lần', () => {
      kit('init', '--target', target, '--agents', 'codex', '--yes');
      expect(read('.gitattributes').match(/run-log\.jsonl merge=union/g)).toHaveLength(1);
    });

    it('mode begin bị gate chặn: exit 1, in lý do và ghi mode_start + entry_blocked', () => {
      blockTask();
      const r = project('mode', 'begin', TASK, 'cook', '--actor', 'codex');
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/GATE: BỊ CHẶN/);
      expect(r.out).toMatch(/FE input-sync docs\/frontend-tasks\/FE-7-log/);
      expect(runLog().map((e) => [e.event, e.mode, e.source, e.actor])).toEqual([
        ['mode_start', 'cook', 'cli', 'codex'],
        ['entry_blocked', 'cook', 'cli', 'codex'],
      ]);
      expect(runLog()[1].codes).toEqual(['ENTRY_QUESTIONS_BLOCKING', 'ENTRY_NOT_BUILD_READY']);
    });

    it('mode begin được chạy: in nguyên văn rule của mode và lệnh kết thúc', () => {
      const r = project('mode', 'begin', 'FE-7-log', 'plan');
      expect(r.status).toBe(0);
      expect(r.out).toMatch(/GATE: ĐƯỢC CHẠY FE plan/);
      expect(r.out).toMatch(/--- core\.md ---/);
      expect(r.out).toMatch(/mode end docs\/frontend-tasks\/FE-7-log plan/);
    });

    it('mode end: chưa sửa workflow-status.md thì fail, sửa rồi thì pass, attempt tăng', () => {
      const status = path.join(target, TASK, 'tracking', 'workflow-status.md');
      const past = new Date(Date.now() - 60_000);
      fs.utimesSync(status, past, past);
      project('mode', 'begin', TASK, 'plan');
      const first = project('mode', 'end', TASK, 'plan');
      expect(first.status).toBe(1);
      expect(first.out).toMatch(/chưa được cập nhật trong lượt này/);

      touchStatus();
      const second = project('mode', 'end', TASK, 'plan');
      expect(second.status).toBe(0);
      expect(second.out).toMatch(/mode end: PASSED/);

      const ends = runLog().filter((e) => e.event === 'mode_end');
      expect(ends.map((e) => [e.outcome, e.attempt])).toEqual([['failed', 1], ['pass', 2]]);
      expect(ends[0].codes).toContain('END_STATUS_NOT_UPDATED');
      expect(ends[1].duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('mode end của mode bị chặn: status đã route đúng thì pass mà không cần artifact', () => {
      fs.cpSync(path.join(ROOT, 'packages', 'validators', 'test', 'fixtures', 'task-blocked-question'), path.join(target, TASK), { recursive: true });
      const r = project('mode', 'end', TASK, 'cook');
      expect(r.status).toBe(0);
      expect(r.out).toMatch(/mode bị gate từ chối và đã route đúng/);
    });

    it('mode sai cú pháp thì in hướng dẫn', () => {
      const r = project('mode', 'start', TASK, 'cook');
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/fe-kit mode begin\|end/);
    });

    it('validate-* ghi sự kiện validate; CI=true hoặc --no-log thì không ghi', () => {
      project('validate-task', 'FE-7-log');
      blockTask();
      project('validate-workflow', TASK, '--actor', 'cursor');
      expect(runLog().map((e) => [e.event, e.check, e.outcome, e.actor])).toEqual([
        ['validate', 'validate-task', 'ok', 'cli'],
        ['validate', 'validate-workflow', 'failed', 'cursor'],
      ]);
      expect(runLog()[1].codes).toContain('QUESTIONS_NEXT_MODE_NOT_INPUT_SYNC');

      projectEnv({ CI: 'true' }, 'validate-task', 'FE-7-log');
      project('validate-task', 'FE-7-log', '--no-log');
      expect(runLog()).toHaveLength(2);
    });

    it('report: Markdown và JSON', () => {
      blockTask();
      project('mode', 'begin', TASK, 'cook');
      const md = project('report');
      expect(md.status).toBe(0);
      expect(md.out).toMatch(/# Báo cáo run-log FE-Kit/);
      expect(md.out).toMatch(/`ENTRY_QUESTIONS_BLOCKING`/);

      const json = JSON.parse(project('report', TASK, '--json').out);
      expect(json.tasks[0].task).toBe('FE-7-log');
      expect(json.total.entryBlocked.ENTRY_QUESTIONS_BLOCKING).toBe(1);
    });

    it('report khi chưa có run-log', () => {
      fs.rmSync(path.join(target, 'docs', 'frontend-tasks'), { recursive: true, force: true });
      expect(project('report').out).toMatch(/Chưa có run-log nào/);
    });
  });

  describe('retro', () => {
    it('retro in số liệu, --write ghi retro-data.json, check và export', () => {
      project('new-task', 'FE-9-retro');
      const summary = project('retro');
      expect(summary.status).toBe(0);
      expect(summary.out).toMatch(/^# Dữ liệu retro FE-Kit/);
      expect(JSON.parse(project('retro', '--json').out)).toMatchObject({ schema: 1, tasks_total: 1 });

      project('retro', '--write', '--date', '2026-10-08');
      const dir = 'docs/frontend-retro/2026-10-08';
      expect(exists(`${dir}/retro-data.json`)).toBe(true);
      const check = project('retro', 'check', dir);
      expect(check.status).toBe(1);
      expect(check.out).toMatch(/Thiếu retro-report\.md/);

      fs.writeFileSync(path.join(target, dir, 'retro-report.md'), '# Báo cáo retro\n');
      fs.writeFileSync(
        path.join(target, dir, 'proposals.md'),
        '## Đề xuất\n\n| ID | Bằng chứng | Đích | Thay đổi đề xuất | Metric theo dõi | Phạm vi | Trạng thái | Người duyệt |\n|---|---|---|---|---|---|---|---|\n| R-01 | 3 lần SCOPE_OUT_OF_PLAN | template:implementation-plan.md | Bảng file có cột test | SCOPE_OUT_OF_PLAN | upstream | Approved |  |\n'
      );
      expect(project('retro', 'check', dir).out).toMatch(/Đề xuất R-01 đã duyệt nhưng thiếu Người duyệt/);
      fs.writeFileSync(path.join(target, dir, 'proposals.md'), read(`${dir}/proposals.md`).replace('| Approved |  |', '| Approved | Lan |'));
      expect(project('retro', 'check', dir).out).toMatch(/retro check passed/);
      expect(project('retro', 'export', dir).out).toMatch(/## R-01: Bảng file có cột test/);
    });

    it('mode begin nạp rule của team', () => {
      project('new-task', 'FE-9-team');
      fs.writeFileSync(path.join(target, 'docs', 'frontend-context', 'team-rules.md'), '## Mọi mode\n\n- Ghi nguồn cho mọi quyết định.\n');
      expect(project('mode', 'begin', 'FE-9-team', 'plan').out).toMatch(/=== RULE CỦA TEAM[^\n]*===\n## Mọi mode\n\n- Ghi nguồn cho mọi quyết định\./);
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
