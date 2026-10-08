/**
 * Pack mẫu "docs": dựng một domain pack hoàn chỉnh chỉ bằng API công khai của
 * engine. Dùng trong tests/engine-genericity.test.mjs; không build thành plugin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  createStateMachine,
  createModeCompletion,
  createModeBriefing,
  commandToModeOf,
  rulesForManifest,
  parseFrontMatterLoose,
  resolveTaskDir as resolveTaskDirIn,
  scaffoldTask as scaffoldTaskIn,
  computeScopeDiff,
  parsePlannedFiles,
  listChangedFiles,
  loadProjectConfig as loadProjectConfigIn,
  appendRunLog as appendRunLogIn,
  runLogFileFor,
  LOCKFILE_IGNORE,
} from '@frontend-delivery-kit/engine';
import manifest from './manifest.gen.mjs';

const m = manifest;
export const PACK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATES_DIR = path.join(PACK_ROOT, 'templates');
export const RULES_DIR = path.join(PACK_ROOT, 'rules');

const COMMAND_TO_MODE = commandToModeOf(m);
const STATES = Object.values(COMMAND_TO_MODE);

export const StatusSchema = z
  .object({
    task_id: z.string().min(1),
    current_mode: z.enum(STATES),
    next_mode: z.string().min(1),
    approved: z.boolean(),
    human_override: z.boolean().default(false),
  })
  .passthrough();

export function parseStatus(raw) {
  const loose = parseFrontMatterLoose(raw);
  if (!loose.hasFrontMatter || loose.error) return { ok: false, errors: ['status: frontmatter không đọc được'] };
  const res = StatusSchema.safeParse(loose.data);
  if (!res.success) return { ok: false, errors: res.error.issues.map((i) => `status — ${i.path.join('.')}: ${i.message}`) };
  return { ok: true, data: res.data, body: loose.body };
}

const machine = createStateMachine({
  commandToMode: COMMAND_TO_MODE,
  allowedNext: Object.fromEntries(Object.entries(m.modes).map(([cmd, mode]) => [cmd, mode.next])),
  aliases: m.aliases,
  terminalNext: m.terminal_next,
  alwaysAllowed: m.always_allowed,
  pluginName: m.plugin,
  promptPrefix: m.prompt_prefix,
  statusFileName: path.posix.basename(m.status_file),
  entryRules: ({ command, data, taskRef }) =>
    command === 'publish' && data.approved !== true
      ? [{ code: 'ENTRY_NOT_APPROVED', reason: 'Tài liệu chưa được duyệt (approved=false).', redirect: `${m.prompt_prefix} review ${taskRef}` }]
      : [],
});

export const resolveTaskDir = (root, input) => resolveTaskDirIn(root, input, { tasksRoot: m.tasks_root });
export const loadProjectConfig = (root) => loadProjectConfigIn(root, { file: m.project_config_file });
export const RUNLOG_FILE = runLogFileFor(m.status_file);
export const appendRunLog = (taskDir, record) => appendRunLogIn(taskDir, { pack: m.id, ...record }, { file: RUNLOG_FILE });

export function scaffoldTask({ workspaceRoot, name, templatesDir = TEMPLATES_DIR }) {
  return scaffoldTaskIn({
    workspaceRoot,
    name,
    templatesDir,
    tasksRoot: m.tasks_root,
    templateFiles: m.task_files.required_docs,
    emptyFiles: m.task_files.empty,
    nameHint: m.task_name_hint,
  });
}

export function scopeDiffForTask(taskDir, { repoRoot, base = '', changedFiles } = {}) {
  let files = changedFiles;
  if (!files) {
    const changed = listChangedFiles({ cwd: repoRoot, base });
    if (!changed.ok) return null;
    files = changed.files;
  }
  const brief = path.join(taskDir, 'brief.md');
  const plannedFiles = parsePlannedFiles(fs.existsSync(brief) ? fs.readFileSync(brief, 'utf8') : '', { heading: m.planned_files_heading });
  return { ...computeScopeDiff({ plannedFiles, changedFiles: files, ignore: [...m.scope_ignore, ...LOCKFILE_IGNORE] }), plannedFiles };
}

/** Gate của pack docs: đủ file bắt buộc, publish phải được duyệt, không sửa file ngoài brief. */
export function validateWorkflow(taskDir, { scope } = {}) {
  const issues = [];
  const fail = (code, message) => issues.push({ code, message });
  const statusPath = path.join(taskDir, m.status_file);
  if (!fs.existsSync(statusPath)) fail('STATUS_MISSING', `Thiếu ${m.status_file}`);
  else {
    const parsed = parseStatus(fs.readFileSync(statusPath, 'utf8'));
    if (!parsed.ok) parsed.errors.forEach((e) => fail('STATUS_SCHEMA_INVALID', e));
    else {
      for (const rel of m.task_files.required_docs) {
        if (!fs.existsSync(path.join(taskDir, rel))) fail('DOC_FILE_MISSING', `Thiếu ${rel}`);
      }
      if (parsed.data.current_mode === 'publishing' && !parsed.data.approved) fail('PUBLISH_NOT_APPROVED', 'Đang publish mà approved=false.');
    }
  }
  if (scope && !scope.plannedEmpty && scope.outOfPlan?.length) fail('SCOPE_OUT_OF_PLAN', `File ngoài brief: ${scope.outOfPlan.join(', ')}`);
  const errors = issues.map((i) => i.message);
  return { ok: errors.length === 0, errors, warnings: [], issues };
}

export function validateWorkflowAtGate(taskDir) {
  return { ...validateWorkflow(taskDir), scopeSource: 'not_checked', base: '' };
}

export const docsPack = {
  id: m.id,
  displayName: m.display_name,
  pluginName: m.plugin,
  promptPrefix: m.prompt_prefix,
  envPrefix: m.env_prefix,
  agentPrefix: m.agent_prefix,
  tasksRoot: m.tasks_root,
  statusFile: m.status_file,
  runLogFile: RUNLOG_FILE,
  writablePrefixes: m.writable_prefixes,
  commands: machine.COMMANDS,
  commandToMode: COMMAND_TO_MODE,
  sourceEditCommands: m.source_edit_modes,
  sourceEditAgent: m.source_edit_agent,
  requiredArtifacts: Object.fromEntries(Object.entries(m.modes).map(([cmd, mode]) => [cmd, mode.artifacts])),
  agentFor: Object.fromEntries(Object.entries(m.modes).map(([cmd, mode]) => [cmd, mode.agent])),
  label: (command) => `${m.prompt_prefix} ${command}`,
  sourceFixRoute: m.source_fix_route,
  planUpdateRoute: m.plan_update_route,
  readInputsHint: m.read_inputs_hint,
  parseStatus,
  rulesFor: (command, data) => rulesForManifest(m, command, data),
  entryInputs: () => ({}),
  normalizeCommand: machine.normalizeCommand,
  evaluateModeEntry: machine.evaluateModeEntry,
  resolveTaskDir,
  scopeDiffForTask,
  loadProjectConfig,
  scaffoldTask,
  requiredTaskFiles: [...m.task_files.required_docs, ...m.task_files.empty],
  validateWorkflow,
  validateWorkflowAtGate,
  mcp: {
    serverName: m.mcp.server_name,
    toolPrefix: m.mcp.tool_prefix,
    configDir: m.config_dir,
    skillDir: m.mcp.skill_dir,
    nextPromptHeading: m.mcp.next_prompt_heading,
    firstCommand: m.mcp.first_command,
    afterNewTask: () => [],
    taskPropDescription: m.mcp.task_prop_description,
    taskNameDescription: m.mcp.task_name_description,
    scopeSelfReported: m.mcp.scope_self_reported,
    scopeUnavailable: m.mcp.scope_unavailable,
    plannedFilesMissing: m.mcp.planned_files_missing,
    statusFields: m.mcp.status_fields,
    statusExtras: () => [],
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
docsPack.evaluateModeCompletion = createModeCompletion(docsPack);
docsPack.modeBriefing = createModeBriefing(docsPack);
export { machine };
