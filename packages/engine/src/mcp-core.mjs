/**
 * Tool MCP chung của kit: mở mode, tạo task, validate, scope diff, bước tiếp
 * theo, trạng thái và danh sách task. Tên tool là `<toolPrefix>_<tên>`; mô tả và
 * chuỗi riêng của domain lấy từ `pack.mcp`. Engine không phụ thuộc MCP SDK:
 * script server của plugin nối `tools`/`callTool` vào SDK.
 */
import fs from 'node:fs';
import path from 'node:path';
import { relativePosix, toPosix } from './paths.mjs';
import { detectBaseRef } from './scope.mjs';
import { appendRunLog, codesOf } from './runlog.mjs';
import { createModeBriefing } from './briefing.mjs';

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError };
}

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {object} pack domain pack; dùng các field chung (statusFile, tasksRoot,
 *   commands, label, planUpdateRoute, normalizeCommand, resolveTaskDir, ...) và `pack.mcp`
 * @param {{ version?: string, pluginRoot: string }} opts
 * @returns {{ serverName: string, tools: object[], callTool: (name: string, args: object) => object }}
 */
export function createMcpTools(pack, { version = 'dev', pluginRoot }) {
  const m = pack.mcp;
  const tool = (name) => `${m.toolPrefix}_${name}`;
  const statusName = path.posix.basename(pack.statusFile);
  const nextPromptRe = new RegExp(`^##\\s+${escapeRe(m.nextPromptHeading)}\\s*\\r?\\n+([\\s\\S]*?)(?=\\r?\\n##\\s|(?![\\s\\S]))`, 'm');
  const modeBriefing = createModeBriefing(pack);

  /**
   * Thư mục chứa rule/template: bản override của team trong repo dự án nếu có
   * (`<configDir>/<kind>/`), nếu không thì bản đi kèm plugin.
   */
  function kitDir(workspaceRoot, kind) {
    const project = path.join(path.resolve(workspaceRoot), m.configDir, kind);
    if (fs.existsSync(project)) return { dir: project, source: 'project' };
    return { dir: path.join(pluginRoot, m.skillDir, kind), source: 'plugin' };
  }

  function nextPrompt(taskDir) {
    const match = readIfExists(path.join(taskDir, pack.statusFile)).match(nextPromptRe);
    return match ? match[1].trim() : '';
  }

  const workspaceProp = { type: 'string', description: 'Đường dẫn tuyệt đối tới repo dự án.' };
  const taskProp = { type: 'string', description: m.taskPropDescription };
  const baseRefProp = (description) => ({ type: 'string', description });

  const tools = [
    {
      name: tool('begin_mode'),
      description: m.descriptions.beginMode,
      inputSchema: {
        type: 'object',
        properties: {
          workspace_root: workspaceProp,
          task_folder: taskProp,
          mode: { type: 'string', description: `Mode muốn chạy: ${pack.commands.join(', ')}.` },
        },
        required: ['workspace_root', 'task_folder', 'mode'],
      },
    },
    {
      name: tool('new_task'),
      description: m.descriptions.newTask,
      inputSchema: {
        type: 'object',
        properties: {
          workspace_root: workspaceProp,
          task_name: { type: 'string', description: m.taskNameDescription },
        },
        required: ['workspace_root', 'task_name'],
      },
    },
    {
      name: tool('validate_task'),
      description: m.descriptions.validateTask,
      inputSchema: {
        type: 'object',
        properties: { workspace_root: workspaceProp, task_folder: taskProp },
        required: ['workspace_root', 'task_folder'],
      },
    },
    {
      name: tool('validate_workflow'),
      description: m.descriptions.validateWorkflow,
      inputSchema: {
        type: 'object',
        properties: {
          workspace_root: workspaceProp,
          task_folder: taskProp,
          base_ref: baseRefProp('Nhánh/commit gốc để tính scope ở review/test/pr (vd origin/main). Bỏ trống thì tự dò.'),
        },
        required: ['workspace_root', 'task_folder'],
      },
    },
    {
      name: tool('scope_diff'),
      description: m.descriptions.scopeDiff,
      inputSchema: {
        type: 'object',
        properties: {
          workspace_root: workspaceProp,
          task_folder: taskProp,
          base_ref: baseRefProp('Nhánh/commit gốc để so (vd origin/main). Bỏ trống thì tự dò; không dò được thì chỉ xét thay đổi chưa commit.'),
        },
        required: ['workspace_root', 'task_folder'],
      },
    },
    {
      name: tool('next_step'),
      description: m.descriptions.nextStep,
      inputSchema: {
        type: 'object',
        properties: { workspace_root: workspaceProp, task_folder: taskProp },
        required: ['workspace_root', 'task_folder'],
      },
    },
    {
      name: tool('task_status'),
      description: m.descriptions.taskStatus,
      inputSchema: {
        type: 'object',
        properties: { workspace_root: workspaceProp, task_folder: taskProp },
        required: ['workspace_root', 'task_folder'],
      },
    },
    {
      name: tool('list_tasks'),
      description: `Liệt kê mọi task folder trong ${pack.tasksRoot} kèm mode hiện tại của từng task.`,
      inputSchema: {
        type: 'object',
        properties: { workspace_root: workspaceProp },
        required: ['workspace_root'],
      },
    },
  ];

  if (pack.retro) {
    tools.push(
      {
        name: tool('retro_data'),
        description: m.descriptions.retroData,
        inputSchema: {
          type: 'object',
          properties: {
            workspace_root: workspaceProp,
            since: { type: 'string', description: 'Chỉ tính task có hoạt động từ ngày này (YYYY-MM-DD). Bỏ trống = mọi task.' },
            date: { type: 'string', description: 'Tên thư mục retro (YYYY-MM-DD). Bỏ trống = hôm nay.' },
          },
          required: ['workspace_root'],
        },
      },
      {
        name: tool('validate_retro'),
        description: m.descriptions.validateRetro,
        inputSchema: {
          type: 'object',
          properties: {
            workspace_root: workspaceProp,
            retro_folder: { type: 'string', description: `Thư mục retro, vd ${pack.retro.root}/2026-10-08.` },
          },
          required: ['workspace_root', 'retro_folder'],
        },
      }
    );
  }

  const handlers = {
    begin_mode({ workspace_root, task_folder, mode }) {
      const command = pack.normalizeCommand(mode);
      if (!command) {
        return textResult(`Không nhận ra mode "${mode}". Mode hợp lệ: ${pack.commands.join(', ')}.`, true);
      }
      const taskDir = pack.resolveTaskDir(workspace_root, task_folder);
      const taskRef = relativePosix(workspace_root, taskDir) || toPosix(task_folder);
      const rules = kitDir(workspace_root, 'rules');
      const briefing = modeBriefing({
        taskDir,
        taskRef,
        command,
        rulesDir: rules.dir,
        rulesLabel: rules.source === 'project' ? `${m.configDir}/rules của repo` : 'plugin',
        newTaskHint: `Gọi MCP tool ${tool('new_task')} (hoặc /${pack.pluginName}:new-task ${path.basename(taskDir)}) để tạo task từ template, rồi chạy lại ${pack.label(command)} ${taskRef}.`,
        finishHint: `Trước khi kết thúc: cập nhật ${pack.statusFile} rồi gọi ${tool('validate_workflow')}.`,
        workspaceRoot: workspace_root,
      });
      return textResult(briefing.text, !briefing.ok);
    },

    new_task({ workspace_root, task_name }) {
      const templates = kitDir(workspace_root, 'templates');
      const res = pack.scaffoldTask({ workspaceRoot: workspace_root, name: task_name, templatesDir: templates.dir });
      if (!res.ok) return textResult(res.error, true);
      const lines = [
        `Task folder: ${res.taskRef}`,
        `Template nguồn: ${templates.source === 'project' ? `${m.configDir}/templates của repo` : 'plugin'}`,
        ...res.created.map((f) => `TẠO ${f}`),
        ...res.skipped.map((f) => `GIỮ NGUYÊN (đã có) ${f}`),
      ];
      if (!res.created.length) lines.push('', 'Task đã tồn tại đầy đủ, không ghi đè gì.');
      lines.push('', 'Tiếp theo: ' + (nextPrompt(res.taskDir) || pack.label(`${m.firstCommand} ${res.taskRef}`)));
      lines.push(...m.afterNewTask(res.taskRef));
      return textResult(lines.join('\n'));
    },

    validate_task({ workspace_root, task_folder }) {
      const taskDir = pack.resolveTaskDir(workspace_root, task_folder);
      if (!fs.existsSync(taskDir)) return textResult(`Không tìm thấy task folder: ${taskDir}`, true);

      const lines = [];
      let ok = true;
      for (const rel of pack.requiredTaskFiles) {
        const present = fs.existsSync(path.join(taskDir, rel));
        lines.push(`${present ? 'OK' : 'THIẾU'} ${rel}`);
        if (!present) ok = false;
      }
      lines.push('');
      lines.push(ok ? 'validate-task: PASSED' : 'validate-task: FAILED');
      const np = nextPrompt(taskDir);
      if (ok && np) lines.push('', 'Tiếp theo: ' + np);
      return textResult(lines.join('\n'), !ok);
    },

    validate_workflow({ workspace_root, task_folder, base_ref }) {
      const taskDir = pack.resolveTaskDir(workspace_root, task_folder);
      if (!fs.existsSync(taskDir)) return textResult(`Không tìm thấy task folder: ${taskDir}`, true);

      const res = pack.validateWorkflowAtGate(taskDir, { repoRoot: workspace_root, base: base_ref });
      appendRunLog(
        taskDir,
        { pack: pack.id, event: 'validate', source: 'mcp', actor: 'claude', kit: version, outcome: res.ok ? 'ok' : 'failed', codes: codesOf(res) },
        { file: pack.runLogFile }
      );
      const warnings = (res.warnings || []).map((w) => '- Cảnh báo: ' + w);
      const scopeLine = {
        git: `Scope: tính từ git (base: ${res.base || 'chỉ thay đổi chưa commit'}).`,
        self_reported: m.scopeSelfReported,
      }[res.scopeSource];
      const head = scopeLine ? [scopeLine] : [];
      if (!res.ok) {
        return textResult(['validate-workflow: FAILED', ...head, '', ...res.errors.map((e) => '- ' + e), ...warnings].join('\n'), true);
      }
      const np = nextPrompt(taskDir);
      return textResult(['validate-workflow: PASSED', ...head, ...warnings, ...(np ? ['', 'Tiếp theo: ' + np] : [])].join('\n'));
    },

    scope_diff({ workspace_root, task_folder, base_ref }) {
      const taskDir = pack.resolveTaskDir(workspace_root, task_folder);
      if (!fs.existsSync(taskDir)) return textResult(`Không tìm thấy task folder: ${taskDir}`, true);

      const base = base_ref || detectBaseRef(workspace_root);
      const scope = pack.scopeDiffForTask(taskDir, { repoRoot: workspace_root, base });
      if (!scope) return textResult(m.scopeUnavailable);
      const lines = [
        `Base: ${base || '(không có — chỉ xét thay đổi chưa commit và file untracked)'}`,
        `File khai trong plan: ${scope.plannedFiles.length}`,
        `Trong plan: ${scope.inScope.length}; ngoài plan: ${scope.outOfPlan.length}; bỏ qua (artifact/lockfile): ${scope.ignored.length}`,
      ];
      if (scope.plannedEmpty) lines.push('', m.plannedFilesMissing);
      if (scope.outOfPlan.length) {
        lines.push('', 'File sửa NGOÀI plan:', ...scope.outOfPlan.map((f) => '- ' + f));
        lines.push('', `scope-diff: FAILED — cập nhật plan/${pack.planUpdateRoute} hoặc hoàn tác các file trên.`);
        return textResult(lines.join('\n'), true);
      }
      lines.push('', 'scope-diff: PASSED');
      return textResult(lines.join('\n'));
    },

    next_step({ workspace_root, task_folder }) {
      const taskDir = pack.resolveTaskDir(workspace_root, task_folder);
      const np = nextPrompt(taskDir);
      if (!np) return textResult(`Không đọc được "${m.nextPromptHeading}" trong ${pack.statusFile}.`, true);
      return textResult(np);
    },

    task_status({ workspace_root, task_folder }) {
      const taskDir = pack.resolveTaskDir(workspace_root, task_folder);
      const statusPath = path.join(taskDir, pack.statusFile);
      if (!fs.existsSync(statusPath)) return textResult(`Thiếu ${pack.statusFile}`, true);

      const parsed = pack.parseStatus(fs.readFileSync(statusPath, 'utf8'));
      if (!parsed.ok) return textResult(`Không parse được ${statusName}:\n` + parsed.errors.join('\n'), true);
      const d = parsed.data;
      const lines = m.statusFields.filter((k) => d[k] !== undefined).map((k) => `${k}: ${d[k]}`);
      lines.push(...m.statusExtras((rel) => readIfExists(path.join(taskDir, rel))));
      return textResult(lines.join('\n'));
    },

    list_tasks({ workspace_root }) {
      const root = path.resolve(workspace_root, pack.tasksRoot);
      if (!fs.existsSync(root)) return textResult(`Chưa có thư mục ${pack.tasksRoot}.`);

      const entries = fs
        .readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => {
          const statusPath = path.join(root, e.name, pack.statusFile);
          let mode = `chưa có ${path.posix.basename(pack.statusFile, '.md')}`;
          if (fs.existsSync(statusPath)) {
            const match = fs.readFileSync(statusPath, 'utf8').match(/^current_mode:\s*(.+)$/m);
            if (match) mode = match[1].trim();
          }
          return `- ${e.name} (${mode})`;
        });
      return textResult(entries.length ? entries.join('\n') : `Chưa có task nào trong ${pack.tasksRoot}.`);
    },
  };

  if (pack.retro) {
    handlers.retro_data = ({ workspace_root, since, date }) => {
      const day = date || new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return textResult(`date phải dạng YYYY-MM-DD: ${day}`, true);
      const data = pack.retro.buildData(workspace_root, { since });
      const dir = path.join(workspace_root, pack.retro.root, day);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'retro-data.json'), JSON.stringify(data, null, 2) + '\n');
      const rel = `${pack.retro.root}/${day}`;
      return textResult(
        [pack.retro.renderSummary(data), `Đã ghi ${rel}/retro-data.json.`, `Tiếp theo: viết ${rel}/retro-report.md và ${rel}/proposals.md theo template retro, rồi gọi ${tool('validate_retro')}.`].join('\n')
      );
    };
    handlers.validate_retro = ({ workspace_root, retro_folder }) => {
      const dir = path.resolve(workspace_root, retro_folder);
      const res = pack.retro.validateFolder(dir);
      const warnings = res.warnings.map((w) => '- Cảnh báo: ' + w);
      if (!res.ok) return textResult(['validate-retro: FAILED', '', ...res.errors.map((e) => '- ' + e), ...warnings].join('\n'), true);
      return textResult(['validate-retro: PASSED', ...warnings].join('\n'));
    };
  }

  function callTool(name, args) {
    const prefix = `${m.toolPrefix}_`;
    const handler = name.startsWith(prefix) ? handlers[name.slice(prefix.length)] : undefined;
    if (!handler) return textResult(`Tool không tồn tại: ${name}`, true);
    try {
      return handler(args ?? {});
    } catch (err) {
      return textResult(`Lỗi khi chạy ${name}: ${err.message}`, true);
    }
  }

  return { serverName: m.serverName, tools, callTool };
}
