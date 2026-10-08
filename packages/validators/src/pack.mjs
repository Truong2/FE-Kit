/**
 * Domain pack FE: dữ liệu và hàm mà engine cần để chạy state machine, gate kết
 * thúc mode và nội dung mở mode cho frontend.
 */
import { createModeCompletion, createModeBriefing } from '@frontend-delivery-kit/engine';
import { parseWorkflowStatus } from './parse.mjs';
import { countOpenBlockingQuestions, effectiveOpenIssues } from './gates.mjs';
import { countOpenIssuesInTask } from './review-bugs.mjs';
import { COMMAND_TO_MODE, evaluateModeEntry } from './transitions.mjs';
import { MODE_REQUIRED_ARTIFACTS, AGENT_FOR_COMMAND, rulesForMode } from './modes.mjs';
import { validateWorkflow, validateWorkflowAtGate } from './workflow.mjs';

export const fePack = {
  id: 'fe',
  statusFile: 'tracking/workflow-status.md',
  label: (command) => `FE ${command}`,
  commandToMode: COMMAND_TO_MODE,
  requiredArtifacts: MODE_REQUIRED_ARTIFACTS,
  agentFor: AGENT_FOR_COMMAND,
  readInputsHint: 'Input cần đọc: mục "Input ledger bắt buộc cho FE plan" trong tracking/workflow-status.md.',
  parseStatus: parseWorkflowStatus,
  rulesFor: (command, data) => rulesForMode(command, { figmaRequired: data.figma_required === true }),
  /** Số câu hỏi blocking và issue Critical/High đang mở, đếm từ file của task. */
  entryInputs: ({ data, read }) => ({
    openBlockingQuestions: countOpenBlockingQuestions(read('planning/questions.md')),
    openIssues: effectiveOpenIssues(data, countOpenIssuesInTask(read)),
  }),
  evaluateModeEntry,
  validateWorkflow,
  validateWorkflowAtGate,
};

/**
 * Gate kết thúc mode của FE (hook `SubagentStop`/`Stop`, CLI `fe-kit mode end`).
 * Xem `createModeCompletion` trong engine.
 */
export const evaluateModeCompletion = createModeCompletion(fePack);

/** Nội dung của MCP `fe_begin_mode` và CLI `fe-kit mode begin`. Xem `createModeBriefing` trong engine. */
export const modeBriefing = createModeBriefing(fePack);
