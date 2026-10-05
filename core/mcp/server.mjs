/**
 * MCP server của Frontend Delivery Kit.
 *
 * Mục đích: đưa các gate/validator của kit thành tool gọi được từ agent, để
 * plugin tự chạy được validation mà KHÔNG cần clone repo kit + npm install CLI
 * riêng. Nhờ vậy mọi người cài plugin là chạy đồng nhất cùng một logic gate.
 *
 * File này được esbuild bundle thành 1 file .mjs standalone (kèm zod,
 * gray-matter, MCP SDK) rồi đặt trong plugin — plugin bị copy vào cache nên
 * không thể dựa vào node_modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  validateWorkflow,
  parseWorkflowStatus,
  parseFrontMatterLoose,
  countOpenBlockingQuestions,
  evaluateModeEntry,
  normalizeCommand,
  rulesForMode,
  scopeDiffForTask,
  scaffoldTask,
  detectBaseRef,
  resolveTaskDir,
  relativePosix,
  toPosix,
  MODE_REQUIRED_ARTIFACTS,
  AGENT_FOR_COMMAND,
  COMMANDS,
  TASKS_ROOT,
} from '@frontend-delivery-kit/validators';

// esbuild `define` thay hằng này khi bundle; chạy trực tiếp từ source thì là 'dev'.
const KIT_VERSION = typeof __FE_KIT_VERSION__ !== 'undefined' ? __FE_KIT_VERSION__ : 'dev';

const REQUIRED_TASK_FILES = [
  'task.md',
  'planning/implementation-plan.md',
  'planning/build-checklist.md',
  'planning/questions.md',
  'tracking/workflow-status.md',
  'output/figma-reference-screenshots/.gitkeep',
];

const SKILL_DIR_IN_PLUGIN = 'skills/frontend-delivery-standard';

/** Thư mục gốc của plugin: Claude Code set `CLAUDE_PLUGIN_ROOT`; fallback theo vị trí file bundle (`<plugin>/mcp/`). */
function pluginRoot() {
  if (process.env.CLAUDE_PLUGIN_ROOT) return path.resolve(process.env.CLAUDE_PLUGIN_ROOT);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/**
 * Thư mục chứa rule/template: bản override của team trong repo dự án nếu có
 * (`.frontend-delivery/<kind>/`), nếu không thì bản đi kèm plugin.
 */
function kitDir(workspaceRoot, kind) {
  const project = path.join(path.resolve(workspaceRoot), '.frontend-delivery', kind);
  if (fs.existsSync(project)) return { dir: project, source: 'project' };
  return { dir: path.join(pluginRoot(), SKILL_DIR_IN_PLUGIN, kind), source: 'plugin' };
}

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError };
}

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function nextPrompt(taskDir) {
  const raw = readIfExists(path.join(taskDir, 'tracking', 'workflow-status.md'));
  const m = raw.match(/^##\s+Prompt bước tiếp theo\s*\r?\n+([\s\S]*?)(?=\r?\n##\s|(?![\s\S]))/m);
  return m ? m[1].trim() : '';
}

const workspaceProp = { type: 'string', description: 'Đường dẫn tuyệt đối tới repo dự án.' };
const taskProp = { type: 'string', description: 'Tên task (FE-123-abc) hoặc đường dẫn task folder.' };

const TOOLS = [
  {
    name: 'fe_begin_mode',
    description:
      'GỌI ĐẦU TIÊN khi bắt đầu bất kỳ mode FE nào (plan/quick/input-sync/figma/cook/bugfix/review/test/figma-review/pr). Trả về: mode có được chạy không (gate câu hỏi blocking, build_ready, Figma, review), prompt phải chạy thay thế nếu bị chặn, artifact bắt buộc của mode và nguyên văn các rule áp dụng cho mode (không cần đọc file rule riêng).',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_root: workspaceProp,
        task_folder: taskProp,
        mode: { type: 'string', description: `Mode muốn chạy: ${COMMANDS.join(', ')}.` },
      },
      required: ['workspace_root', 'task_folder', 'mode'],
    },
  },
  {
    name: 'fe_new_task',
    description:
      'Tạo task folder chuẩn trong docs/frontend-tasks/<tên> từ template của kit (task.md, implementation-plan, build-checklist, questions, workflow-status, thư mục figma screenshot). Không ghi đè file đã có. Dùng cho /fe:new-task thay vì tự copy template.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_root: workspaceProp,
        task_name: { type: 'string', description: 'Tên task dạng FE-<id>-<slug>, vd FE-123-login-form.' },
      },
      required: ['workspace_root', 'task_name'],
    },
  },
  {
    name: 'fe_validate_task',
    description:
      'Kiểm tra task folder có đủ file bắt buộc theo chuẩn Frontend Delivery không (task.md, implementation-plan, build-checklist, questions, workflow-status, thư mục figma screenshot). Dùng trước khi chuyển mode.',
    inputSchema: {
      type: 'object',
      properties: { workspace_root: workspaceProp, task_folder: taskProp },
      required: ['workspace_root', 'task_folder'],
    },
  },
  {
    name: 'fe_validate_workflow',
    description:
      'Chạy toàn bộ gate của workflow-status.md: schema, blocking-question gate, SRS/Figma gate, evidence gate, routing hợp lệ. GỌI TRƯỚC KHI KẾT THÚC mọi mode; đây là gate chính chặn agent nhảy mode sai.',
    inputSchema: {
      type: 'object',
      properties: { workspace_root: workspaceProp, task_folder: taskProp },
      required: ['workspace_root', 'task_folder'],
    },
  },
  {
    name: 'fe_scope_diff',
    description:
      'So file thực sự thay đổi (git) với bảng "File sẽ tạo / cập nhật" trong implementation-plan.md. Dùng trong cook/bugfix/review/pr để phát hiện file sửa ngoài plan thay vì tự khai scope_diff_status.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_root: workspaceProp,
        task_folder: taskProp,
        base_ref: {
          type: 'string',
          description: 'Nhánh/commit gốc để so (vd origin/main). Bỏ trống thì tự dò; không dò được thì chỉ xét thay đổi chưa commit.',
        },
      },
      required: ['workspace_root', 'task_folder'],
    },
  },
  {
    name: 'fe_next_step',
    description:
      'Trả về prompt bước tiếp theo đọc trực tiếp từ tracking/workflow-status.md của task. Dùng khi không chắc mode kế tiếp là gì.',
    inputSchema: {
      type: 'object',
      properties: { workspace_root: workspaceProp, task_folder: taskProp },
      required: ['workspace_root', 'task_folder'],
    },
  },
  {
    name: 'fe_task_status',
    description:
      'Đọc tóm tắt trạng thái task: mode hiện tại, các gate status chính, số câu hỏi blocking, số issue theo severity. Chỉ đọc, không sửa file.',
    inputSchema: {
      type: 'object',
      properties: { workspace_root: workspaceProp, task_folder: taskProp },
      required: ['workspace_root', 'task_folder'],
    },
  },
  {
    name: 'fe_list_tasks',
    description: `Liệt kê mọi task folder trong ${TASKS_ROOT} kèm mode hiện tại của từng task.`,
    inputSchema: {
      type: 'object',
      properties: { workspace_root: workspaceProp },
      required: ['workspace_root'],
    },
  },
];

const handlers = {
  fe_begin_mode({ workspace_root, task_folder, mode }) {
    const command = normalizeCommand(mode);
    if (!command) {
      return textResult(`Không nhận ra mode "${mode}". Mode hợp lệ: ${COMMANDS.join(', ')}.`, true);
    }
    const taskDir = resolveTaskDir(workspace_root, task_folder);
    const taskRef = relativePosix(workspace_root, taskDir) || toPosix(task_folder);
    const rules = kitDir(workspace_root, 'rules');
    const lines = [];

    const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
    if (!fs.existsSync(workflowPath)) {
      lines.push(`GATE: CHƯA CÓ TASK FOLDER HỢP LỆ (${taskRef}/tracking/workflow-status.md không tồn tại).`);
      lines.push(`Gọi MCP tool fe_new_task (hoặc /fe:new-task ${path.basename(taskDir)}) để tạo task từ template, rồi chạy lại FE ${command} ${taskRef}.`);
      return textResult(lines.join('\n'), true);
    }

    const raw = fs.readFileSync(workflowPath, 'utf8');
    const strict = parseWorkflowStatus(raw);
    const data = strict.ok ? strict.data : parseFrontMatterLoose(raw).data;
    const openBlockingQuestions = countOpenBlockingQuestions(
      readIfExists(path.join(taskDir, 'planning', 'questions.md'))
    );
    const entry = evaluateModeEntry({ requested: command, data, openBlockingQuestions, taskRef });

    if (entry.allowed) {
      lines.push(`GATE: ĐƯỢC CHẠY FE ${command} (${entry.mode}) cho ${taskRef}.`);
    } else {
      lines.push(`GATE: BỊ CHẶN — không được chạy FE ${command} cho ${taskRef}.`);
      for (const r of entry.reasons) lines.push(`- ${r}`);
      lines.push(`Việc phải làm: cập nhật tracking/workflow-status.md (next_mode, next_prompt) và dừng. Prompt đúng: ${entry.redirect}`);
      lines.push('Không sửa source code trong lượt này.');
    }
    for (const w of entry.warnings) lines.push(`Cảnh báo: ${w}`);
    if (!strict.ok) {
      lines.push('', 'workflow-status.md chưa hợp lệ schema (sửa trong lượt này):');
      for (const e of strict.errors.slice(0, 10)) lines.push(`- ${e}`);
    }

    if (entry.allowed) {
      const agent = AGENT_FOR_COMMAND[command];
      lines.push('', `Agent đảm nhận: ${agent ? agent : 'main thread (inline)'}`);
      lines.push('', 'Artifact bắt buộc khi kết thúc mode (tương đối task folder):');
      for (const rel of MODE_REQUIRED_ARTIFACTS[command]) lines.push(`- ${rel}`);
      lines.push('Input cần đọc: mục "Input ledger bắt buộc cho FE plan" trong tracking/workflow-status.md.');
      lines.push('Trước khi kết thúc: cập nhật tracking/workflow-status.md rồi gọi fe_validate_workflow.');

      // Trả nguyên văn rule thay vì đường dẫn: rule của plugin nằm trong cache
      // ngoài workspace, agent Read sẽ bị hỏi quyền (hoặc bị từ chối khi chạy headless).
      lines.push('', `=== RULE ÁP DỤNG CHO FE ${command} (nguồn: ${rules.source === 'project' ? '.frontend-delivery/rules của repo' : 'plugin'}) — không cần đọc lại file rule ===`);
      for (const file of rulesForMode(command, { figmaRequired: data.figma_required === true })) {
        const body = readIfExists(path.join(rules.dir, file)).trim();
        if (body) lines.push('', `--- ${file} ---`, body);
      }
    }
    return textResult(lines.join('\n'), !entry.allowed);
  },

  fe_new_task({ workspace_root, task_name }) {
    const templates = kitDir(workspace_root, 'templates');
    const res = scaffoldTask({ workspaceRoot: workspace_root, name: task_name, templatesDir: templates.dir });
    if (!res.ok) return textResult(res.error, true);
    const lines = [
      `Task folder: ${res.taskRef}`,
      `Template nguồn: ${templates.source === 'project' ? '.frontend-delivery/templates của repo' : 'plugin'}`,
      ...res.created.map((f) => `TẠO ${f}`),
      ...res.skipped.map((f) => `GIỮ NGUYÊN (đã có) ${f}`),
    ];
    if (!res.created.length) lines.push('', 'Task đã tồn tại đầy đủ, không ghi đè gì.');
    lines.push('', 'Tiếp theo: ' + (nextPrompt(res.taskDir) || `FE plan ${res.taskRef}`));
    lines.push(`Task nhỏ, rủi ro thấp có thể dùng: FE quick ${res.taskRef}`);
    return textResult(lines.join('\n'));
  },

  fe_validate_task({ workspace_root, task_folder }) {
    const taskDir = resolveTaskDir(workspace_root, task_folder);
    if (!fs.existsSync(taskDir)) return textResult(`Không tìm thấy task folder: ${taskDir}`, true);

    const lines = [];
    let ok = true;
    for (const rel of REQUIRED_TASK_FILES) {
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

  fe_validate_workflow({ workspace_root, task_folder }) {
    const taskDir = resolveTaskDir(workspace_root, task_folder);
    if (!fs.existsSync(taskDir)) return textResult(`Không tìm thấy task folder: ${taskDir}`, true);

    const res = validateWorkflow(taskDir);
    const warnings = (res.warnings || []).map((w) => '- Cảnh báo: ' + w);
    if (!res.ok) {
      return textResult(
        ['validate-workflow: FAILED', '', ...res.errors.map((e) => '- ' + e), ...warnings].join('\n'),
        true,
      );
    }
    const np = nextPrompt(taskDir);
    return textResult(
      ['validate-workflow: PASSED', ...warnings, ...(np ? ['', 'Tiếp theo: ' + np] : [])].join('\n'),
    );
  },

  fe_scope_diff({ workspace_root, task_folder, base_ref }) {
    const taskDir = resolveTaskDir(workspace_root, task_folder);
    if (!fs.existsSync(taskDir)) return textResult(`Không tìm thấy task folder: ${taskDir}`, true);

    const base = base_ref || detectBaseRef(workspace_root);
    const scope = scopeDiffForTask(taskDir, { repoRoot: workspace_root, base });
    if (!scope) {
      return textResult('Không tính được scope diff (không phải git repo hoặc không diff được base). Ghi scope_diff_status theo review thủ công và nêu lý do.');
    }
    const lines = [
      `Base: ${base || '(không có — chỉ xét thay đổi chưa commit và file untracked)'}`,
      `File khai trong plan: ${scope.plannedFiles.length}`,
      `Trong plan: ${scope.inScope.length}; ngoài plan: ${scope.outOfPlan.length}; bỏ qua (artifact/lockfile): ${scope.ignored.length}`,
    ];
    if (scope.plannedEmpty) {
      lines.push('', 'implementation-plan.md chưa khai file nào ở mục "File sẽ tạo / cập nhật" nên không đối chiếu được.');
    }
    if (scope.outOfPlan.length) {
      lines.push('', 'File sửa NGOÀI plan:', ...scope.outOfPlan.map((f) => '- ' + f));
      lines.push('', 'scope-diff: FAILED — cập nhật plan/input-sync hoặc hoàn tác các file trên.');
      return textResult(lines.join('\n'), true);
    }
    lines.push('', 'scope-diff: PASSED');
    return textResult(lines.join('\n'));
  },

  fe_next_step({ workspace_root, task_folder }) {
    const taskDir = resolveTaskDir(workspace_root, task_folder);
    const np = nextPrompt(taskDir);
    if (!np) {
      return textResult(
        'Không đọc được "Prompt bước tiếp theo" trong tracking/workflow-status.md.',
        true,
      );
    }
    return textResult(np);
  },

  fe_task_status({ workspace_root, task_folder }) {
    const taskDir = resolveTaskDir(workspace_root, task_folder);
    const wf = path.join(taskDir, 'tracking', 'workflow-status.md');
    if (!fs.existsSync(wf)) return textResult('Thiếu tracking/workflow-status.md', true);

    const parsed = parseWorkflowStatus(fs.readFileSync(wf, 'utf8'));
    if (!parsed.ok) {
      return textResult('Không parse được workflow-status.md:\n' + parsed.errors.join('\n'), true);
    }
    const d = parsed.data;
    const pick = [
      'current_mode',
      'next_mode',
      'build_ready',
      'questions_resolution_gate_status',
      'blocking_questions_open',
      'figma_required',
      'figma_gate_status',
      'review_status',
      'critical_issues_open',
      'high_issues_open',
      'pr_status',
      'human_override',
    ];
    const lines = pick
      .filter((k) => d[k] !== undefined)
      .map((k) => `${k}: ${d[k]}`);
    const derived = countOpenBlockingQuestions(readIfExists(path.join(taskDir, 'planning', 'questions.md')));
    lines.push(`blocking_questions_open (đếm từ questions.md): ${derived}`);
    return textResult(lines.join('\n'));
  },

  fe_list_tasks({ workspace_root }) {
    const root = path.resolve(workspace_root, TASKS_ROOT);
    if (!fs.existsSync(root)) return textResult(`Chưa có thư mục ${TASKS_ROOT}.`);

    const entries = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const wf = path.join(root, e.name, 'tracking', 'workflow-status.md');
        let mode = 'chưa có workflow-status';
        if (fs.existsSync(wf)) {
          const m = fs.readFileSync(wf, 'utf8').match(/^current_mode:\s*(.+)$/m);
          if (m) mode = m[1].trim();
        }
        return `- ${e.name} (${mode})`;
      });
    return textResult(entries.length ? entries.join('\n') : `Chưa có task nào trong ${TASKS_ROOT}.`);
  },
};

const server = new Server(
  { name: 'frontend-delivery', version: KIT_VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const handler = handlers[req.params.name];
  if (!handler) return textResult(`Tool không tồn tại: ${req.params.name}`, true);
  try {
    return handler(req.params.arguments ?? {});
  } catch (err) {
    return textResult(`Lỗi khi chạy ${req.params.name}: ${err.message}`, true);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
