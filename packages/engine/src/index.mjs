/**
 * Engine dùng chung của kit. Không chứa khái niệm của domain nào: tên thư mục
 * task, heading của artifact, mode, agent và gate đều do domain pack truyền vào.
 */
export { toPosix, isPathInside, relativePosix, resolveTaskDir } from './paths.mjs';
export {
  LOCKFILE_IGNORE,
  parsePlannedFiles,
  computeScopeDiff,
  detectBaseRef,
  listChangedFiles,
  fingerprintFile,
  snapshotFiles,
  filesTouchedSince,
} from './scope.mjs';
export {
  appendRunLog,
  readRunLog,
  codesOf,
  hashSession,
  RunLogRecordSchema,
  RUNLOG_FILE,
  RUNLOG_EVENTS,
  RUNLOG_MAX_BYTES,
  RUNLOG_VERSION,
} from './runlog.mjs';
export { summarizeRunLog, buildReport, renderReport } from './report.mjs';
export { loadProjectConfig, PROJECT_CONFIG_DEFAULTS } from './project-config.mjs';
export { scaffoldTask, isValidTaskName } from './scaffold.mjs';
