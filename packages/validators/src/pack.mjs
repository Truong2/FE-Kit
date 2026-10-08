/**
 * Domain pack FE: dữ liệu và hàm mà engine cần để chạy state machine, gate kết
 * thúc mode, nội dung mở mode, hook và MCP cho frontend.
 */
import { createModeCompletion, createModeBriefing } from '@frontend-delivery-kit/engine';
import { parseWorkflowStatus } from './parse.mjs';
import { countOpenBlockingQuestions, effectiveOpenIssues } from './gates.mjs';
import { countOpenIssuesInTask } from './review-bugs.mjs';
import { COMMAND_TO_MODE, COMMANDS, SOURCE_EDIT_COMMANDS, normalizeCommand, evaluateModeEntry } from './transitions.mjs';
import {
  MODE_REQUIRED_ARTIFACTS,
  AGENT_FOR_COMMAND,
  SOURCE_EDIT_AGENT,
  KIT_WRITABLE_PREFIXES,
  REQUIRED_TASK_FILES,
  rulesForMode,
} from './modes.mjs';
import { validateWorkflow, validateWorkflowAtGate, scopeDiffForTask } from './workflow.mjs';
import { TASKS_ROOT, resolveTaskDir } from './resolve.mjs';
import { loadProjectConfig } from './project-config.mjs';
import { scaffoldTask } from './scaffold.mjs';

export const fePack = {
  id: 'fe',
  displayName: 'FE-Kit',
  /** Namespace slash command và agent của plugin: `/fe:<mode>`, `fe:<agent>`. */
  pluginName: 'fe',
  /** Tiền tố lệnh dạng chữ: `FE <mode> <task>`. */
  promptPrefix: 'FE',
  /** Tiền tố biến môi trường: `FE_KIT_HOOKS`, `FE_KIT_BASH_GUARD`, `FE_KIT_HOOKS_DEBUG`. */
  envPrefix: 'FE_KIT',
  agentPrefix: 'frontend-',
  tasksRoot: TASKS_ROOT,
  statusFile: 'tracking/workflow-status.md',
  writablePrefixes: KIT_WRITABLE_PREFIXES,
  commands: COMMANDS,
  commandToMode: COMMAND_TO_MODE,
  sourceEditCommands: SOURCE_EDIT_COMMANDS,
  sourceEditAgent: SOURCE_EDIT_AGENT,
  requiredArtifacts: MODE_REQUIRED_ARTIFACTS,
  agentFor: AGENT_FOR_COMMAND,
  label: (command) => `FE ${command}`,
  /** Mode nào sửa lỗi source mà mode chỉ đọc phát hiện. */
  sourceFixRoute: 'FE bugfix/cook',
  /** Mode cập nhật plan khi phạm vi đổi. */
  planUpdateRoute: 'input-sync',
  readInputsHint: 'Input cần đọc: mục "Input ledger bắt buộc cho FE plan" trong tracking/workflow-status.md.',
  parseStatus: parseWorkflowStatus,
  rulesFor: (command, data) => rulesForMode(command, { figmaRequired: data.figma_required === true }),
  /** Số câu hỏi blocking và issue Critical/High đang mở, đếm từ file của task. */
  entryInputs: ({ data, read }) => ({
    openBlockingQuestions: countOpenBlockingQuestions(read('planning/questions.md')),
    openIssues: effectiveOpenIssues(data, countOpenIssuesInTask(read)),
  }),
  normalizeCommand,
  evaluateModeEntry,
  resolveTaskDir,
  scopeDiffForTask,
  loadProjectConfig,
  scaffoldTask,
  requiredTaskFiles: REQUIRED_TASK_FILES,
  validateWorkflow,
  validateWorkflowAtGate,
  /** Chuỗi và cấu hình riêng của FE cho MCP server (`createMcpTools` trong engine). */
  mcp: {
    serverName: 'frontend-delivery',
    toolPrefix: 'fe',
    configDir: '.frontend-delivery',
    skillDir: 'skills/frontend-delivery-standard',
    nextPromptHeading: 'Prompt bước tiếp theo',
    firstCommand: 'plan',
    afterNewTask: (taskRef) => [`Task nhỏ, rủi ro thấp có thể dùng: FE quick ${taskRef}`],
    taskPropDescription: 'Tên task (FE-123-abc) hoặc đường dẫn task folder.',
    taskNameDescription: 'Tên task dạng FE-<id>-<slug>, vd FE-123-login-form.',
    scopeSelfReported: 'Scope: dùng scope_diff_status tự khai.',
    scopeUnavailable:
      'Không tính được scope diff (không phải git repo hoặc không diff được base). Ghi scope_diff_status theo review thủ công và nêu lý do.',
    plannedFilesMissing: 'implementation-plan.md chưa khai file nào ở mục "File sẽ tạo / cập nhật" nên không đối chiếu được.',
    statusFields: [
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
    ],
    statusExtras: (read) => [`blocking_questions_open (đếm từ questions.md): ${countOpenBlockingQuestions(read('planning/questions.md'))}`],
    descriptions: {
      beginMode:
        'GỌI ĐẦU TIÊN khi bắt đầu bất kỳ mode FE nào (plan/quick/input-sync/figma/cook/bugfix/review/test/figma-review/pr). Trả về: mode có được chạy không (gate câu hỏi blocking, build_ready, Figma, review), prompt phải chạy thay thế nếu bị chặn, artifact bắt buộc của mode và nguyên văn các rule áp dụng cho mode (không cần đọc file rule riêng).',
      newTask:
        'Tạo task folder chuẩn trong docs/frontend-tasks/<tên> từ template của kit (task.md, implementation-plan, build-checklist, questions, workflow-status, thư mục figma screenshot). Không ghi đè file đã có. Dùng cho /fe:new-task thay vì tự copy template.',
      validateTask:
        'Kiểm tra task folder có đủ file bắt buộc theo chuẩn Frontend Delivery không (task.md, implementation-plan, build-checklist, questions, workflow-status, thư mục figma screenshot). Dùng trước khi chuyển mode.',
      validateWorkflow:
        'Chạy toàn bộ gate của workflow-status.md: schema, blocking-question gate, SRS/Figma gate, evidence gate, routing hợp lệ. Task ở review/test/pr-ready thì đối chiếu thêm file đã sửa (git) với plan. GỌI TRƯỚC KHI KẾT THÚC mọi mode; đây là gate chính chặn agent nhảy mode sai.',
      scopeDiff:
        'So file thực sự thay đổi (git) với bảng "File sẽ tạo / cập nhật" trong implementation-plan.md. Dùng trong cook/bugfix/review/pr để phát hiện file sửa ngoài plan thay vì tự khai scope_diff_status.',
      nextStep:
        'Trả về prompt bước tiếp theo đọc trực tiếp từ tracking/workflow-status.md của task. Dùng khi không chắc mode kế tiếp là gì.',
      taskStatus:
        'Đọc tóm tắt trạng thái task: mode hiện tại, các gate status chính, số câu hỏi blocking, số issue theo severity. Chỉ đọc, không sửa file.',
    },
  },
};

/**
 * Gate kết thúc mode của FE (hook `SubagentStop`/`Stop`, CLI `fe-kit mode end`).
 * Xem `createModeCompletion` trong engine.
 */
export const evaluateModeCompletion = createModeCompletion(fePack);
fePack.evaluateModeCompletion = evaluateModeCompletion;

/** Nội dung của MCP `fe_begin_mode` và CLI `fe-kit mode begin`. Xem `createModeBriefing` trong engine. */
export const modeBriefing = createModeBriefing(fePack);
