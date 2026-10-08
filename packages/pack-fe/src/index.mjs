/**
 * API công khai của validators (FE). Logic chung nằm trong
 * `@frontend-delivery-kit/engine`; các module ở đây bind dữ liệu và gate của FE.
 */
export { parseWorkflowStatus, parseFrontMatterLoose, realQuestionCell } from './parse.mjs';
export {
  evaluateWorkflowGates,
  evaluatePrGates,
  countOpenBlockingQuestions,
  effectiveOpenIssues,
  hasCommandEvidence,
  summarizeCommandEvidence,
} from './gates.mjs';
export { computeScopeDiff, parsePlannedFiles, listChangedFiles, detectBaseRef } from './scope.mjs';
export { WorkflowStatusSchema, GateStatus, CoreMode, DEPRECATED_FIELDS } from './schema.mjs';
export {
  scopeDiffForTask,
  findUntrackedSourceChanges,
  validateWorkflow,
  validateWorkflowAtGate,
  validatePr,
  SCOPE_CHECKED_MODES,
} from './workflow.mjs';
export { evaluateModeCompletion, fePack } from './pack.mjs';
export { snapshotFiles, filesTouchedSince, fingerprintFile } from './scope.mjs';
export {
  appendRunLog,
  readRunLog,
  codesOf,
  hashSession,
  RunLogRecordSchema,
  RUNLOG_FILE,
  RUNLOG_EVENTS,
} from './runlog.mjs';
export { summarizeRunLog, buildReport, renderReport } from './report.mjs';
export { modeBriefing } from './pack.mjs';
export { loadProjectConfig, PROJECT_CONFIG_DEFAULTS, PROJECT_CONFIG_FILE } from './project-config.mjs';
export {
  validateSrsReference,
  validateQuestionsRouting,
  validatePlanArchitecture,
  validatePlanChecklistSync,
  validateInputSyncReport,
  validateFigmaEvidence,
  validateAssetGate,
} from './fe-checks.mjs';
export {
  parseIssueTable,
  countOpenIssuesBySeverity,
  countOpenIssuesInTask,
  ISSUE_CATEGORIES,
  ISSUE_ROOT_CAUSES,
  ISSUE_SEVERITIES,
} from './review-bugs.mjs';
export { resolveTaskDir, isPathInside, relativePosix, toPosix, TASKS_ROOT } from './resolve.mjs';
export { scaffoldTask, isValidTaskName, TASK_TEMPLATE_FILES } from './scaffold.mjs';
export {
  COMMAND_TO_MODE,
  COMMANDS,
  ALLOWED_NEXT,
  SOURCE_EDIT_COMMANDS,
  normalizeCommand,
  evaluateModeEntry,
  checkRecordedNextMode,
} from './transitions.mjs';
export {
  MODE_REQUIRED_ARTIFACTS,
  AGENT_FOR_COMMAND,
  SOURCE_EDIT_AGENT,
  KIT_WRITABLE_PREFIXES,
  REQUIRED_TASK_DOCS,
  REQUIRED_TASK_FILES,
  CONDITIONAL_TASK_FILES,
  TASK_GITKEEP,
  rulesForMode,
  allRuleFiles,
} from './modes.mjs';
