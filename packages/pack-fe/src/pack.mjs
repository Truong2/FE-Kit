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
import manifest from './manifest.gen.mjs';
import { RUNLOG_FILE } from './runlog.mjs';

const m = manifest;

export const fePack = {
  id: m.id,
  displayName: m.display_name,
  /** Namespace slash command và agent của plugin: `/fe:<mode>`, `fe:<agent>`. */
  pluginName: m.plugin,
  /** Tiền tố lệnh dạng chữ: `FE <mode> <task>`. */
  promptPrefix: m.prompt_prefix,
  /** Tiền tố biến môi trường: `FE_KIT_HOOKS`, `FE_KIT_BASH_GUARD`, `FE_KIT_HOOKS_DEBUG`. */
  envPrefix: m.env_prefix,
  agentPrefix: m.agent_prefix,
  tasksRoot: TASKS_ROOT,
  statusFile: m.status_file,
  runLogFile: RUNLOG_FILE,
  writablePrefixes: KIT_WRITABLE_PREFIXES,
  commands: COMMANDS,
  commandToMode: COMMAND_TO_MODE,
  sourceEditCommands: SOURCE_EDIT_COMMANDS,
  sourceEditAgent: SOURCE_EDIT_AGENT,
  requiredArtifacts: MODE_REQUIRED_ARTIFACTS,
  agentFor: AGENT_FOR_COMMAND,
  label: (command) => `${m.prompt_prefix} ${command}`,
  sourceFixRoute: m.source_fix_route,
  planUpdateRoute: m.plan_update_route,
  readInputsHint: m.read_inputs_hint,
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
    serverName: m.mcp.server_name,
    toolPrefix: m.mcp.tool_prefix,
    configDir: m.config_dir,
    skillDir: m.mcp.skill_dir,
    nextPromptHeading: m.mcp.next_prompt_heading,
    firstCommand: m.mcp.first_command,
    afterNewTask: (taskRef) => [`Task nhỏ, rủi ro thấp có thể dùng: ${m.prompt_prefix} quick ${taskRef}`],
    taskPropDescription: m.mcp.task_prop_description,
    taskNameDescription: m.mcp.task_name_description,
    scopeSelfReported: m.mcp.scope_self_reported,
    scopeUnavailable: m.mcp.scope_unavailable,
    plannedFilesMissing: m.mcp.planned_files_missing,
    statusFields: m.mcp.status_fields,
    statusExtras: (read) => [`blocking_questions_open (đếm từ questions.md): ${countOpenBlockingQuestions(read('planning/questions.md'))}`],
    descriptions: {
      beginMode: m.mcp.descriptions.begin_mode,
      newTask: m.mcp.descriptions.new_task,
      validateTask: m.mcp.descriptions.validate_task,
      validateWorkflow: m.mcp.descriptions.validate_workflow,
      scopeDiff: m.mcp.descriptions.scope_diff,
      nextStep: m.mcp.descriptions.next_step,
      taskStatus: m.mcp.descriptions.task_status,
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
