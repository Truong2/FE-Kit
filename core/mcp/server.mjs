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
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { validateWorkflow, parseWorkflowStatus } from '@frontend-delivery-kit/validators';

const TASKS_ROOT = 'docs/frontend-tasks';

const REQUIRED_TASK_FILES = [
  'task.md',
  'planning/implementation-plan.md',
  'planning/build-checklist.md',
  'planning/questions.md',
  'tracking/workflow-status.md',
  'output/figma-reference-screenshots/.gitkeep',
];

/** Chặn path traversal: mọi task path phải nằm trong workspace. */
function resolveTaskDir(workspaceRoot, taskFolder) {
  const root = path.resolve(workspaceRoot);
  const candidate = path.resolve(
    root,
    taskFolder.includes('/') ? taskFolder : path.join(TASKS_ROOT, taskFolder),
  );
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    throw new Error(`Task path nằm ngoài workspace: ${taskFolder}`);
  }
  return candidate;
}

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError };
}

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function nextPrompt(taskDir) {
  const raw = readIfExists(path.join(taskDir, 'tracking', 'workflow-status.md'));
  const m = raw.match(/^##\s+Prompt bước tiếp theo\s*\n+([\s\S]*?)(?=\n##\s|$)/m);
  return m ? m[1].trim() : '';
}

const TOOLS = [
  {
    name: 'fe_validate_task',
    description:
      'Kiểm tra task folder có đủ file bắt buộc theo chuẩn Frontend Delivery không (task.md, implementation-plan, build-checklist, questions, workflow-status, thư mục figma screenshot). Dùng trước khi chuyển mode.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_root: { type: 'string', description: 'Đường dẫn tuyệt đối tới repo dự án.' },
        task_folder: {
          type: 'string',
          description: 'Tên task (FE-123-abc) hoặc đường dẫn tương đối tới task folder.',
        },
      },
      required: ['workspace_root', 'task_folder'],
    },
  },
  {
    name: 'fe_validate_workflow',
    description:
      'Chạy toàn bộ gate của workflow-status.md: schema 63 field, blocking-question gate, SRS/Figma gate, evidence & scope gate, routing hợp lệ. Đây là gate chính chặn agent nhảy mode sai.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_root: { type: 'string', description: 'Đường dẫn tuyệt đối tới repo dự án.' },
        task_folder: { type: 'string', description: 'Tên task hoặc đường dẫn task folder.' },
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
      properties: {
        workspace_root: { type: 'string', description: 'Đường dẫn tuyệt đối tới repo dự án.' },
        task_folder: { type: 'string', description: 'Tên task hoặc đường dẫn task folder.' },
      },
      required: ['workspace_root', 'task_folder'],
    },
  },
  {
    name: 'fe_task_status',
    description:
      'Đọc tóm tắt trạng thái task: mode hiện tại, các gate status chính, số câu hỏi blocking, số issue theo severity. Chỉ đọc, không sửa file.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_root: { type: 'string', description: 'Đường dẫn tuyệt đối tới repo dự án.' },
        task_folder: { type: 'string', description: 'Tên task hoặc đường dẫn task folder.' },
      },
      required: ['workspace_root', 'task_folder'],
    },
  },
  {
    name: 'fe_list_tasks',
    description: 'Liệt kê mọi task folder trong docs/frontend-tasks kèm mode hiện tại của từng task.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_root: { type: 'string', description: 'Đường dẫn tuyệt đối tới repo dự án.' },
      },
      required: ['workspace_root'],
    },
  },
];

const handlers = {
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
    if (!res.ok) {
      return textResult(
        'validate-workflow: FAILED\n\n' + res.errors.map((e) => '- ' + e).join('\n'),
        true,
      );
    }
    const np = nextPrompt(taskDir);
    return textResult('validate-workflow: PASSED' + (np ? '\n\nTiếp theo: ' + np : ''));
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
      'plan_status',
      'build_ready',
      'questions_resolution_gate_status',
      'blocking_questions_open',
      'figma_required',
      'review_status',
      'critical_issues_open',
      'high_issues_open',
      'pr_status',
    ];
    const lines = pick
      .filter((k) => d[k] !== undefined)
      .map((k) => `${k}: ${d[k]}`);
    return textResult(lines.join('\n') || 'Không có field nào để hiển thị.');
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
  { name: 'frontend-delivery', version: '1.0.0' },
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
