import { z } from 'zod';

/**
 * Schema cho frontmatter của tracking/workflow-status.md.
 * Đây là NGUỒN DUY NHẤT định nghĩa field/kiểu/enum hợp lệ.
 * Trước đây các allow-list (vd. danh sách giá trị hợp lệ của
 * `questions_resolution_gate_status`) bị lặp lại bằng regex ở cả
 * `bin/fe-kit.mjs` và `scripts/validate-workflow.ts`. Từ giờ CLI,
 * script standalone và test suite đều import schema này.
 */

const GateStatus = z.enum([
  'not_started',
  'in_progress',
  'documented',
  'completed',
  'passed',
  'failed',
  'blocked',
  'not_required',
  'unknown',
]);

const CoreMode = z.enum([
  'planning-mode',
  'quick-mode',
  'input-sync-mode',
  'figma-extraction-mode',
  'implementation-mode',
  'bugfix-mode',
  'review-mode',
  'testing-mode',
  'figma-review-mode',
  'pr-ready-mode',
]);

const TriState = z.union([z.boolean(), z.literal('unknown')]);

export const WorkflowStatusSchema = z
  .object({
    // --- Header ---
    task_id: z.string().min(1, 'task_id không được rỗng'),
    status: z.string().min(1),
    layout: z.string().default('standard'),
    current_mode: CoreMode,
    step_status: z.string().min(1),
    blocker: z.boolean(),
    next_mode: z.string().min(1),
    next_prompt: z.string().min(1),
    updated_by: z.string().min(1),
    updated_at: z.string(),
    human_override: z.boolean().default(false),
    vietnamese_diacritics_cache_marker: z.string().min(1),

    // --- Plan input ledger gates ---
    input_inventory_status: GateStatus,
    plan_input_ledger_status: GateStatus,
    required_input_count: z.number().int().min(0),
    missing_input_count: z.number().int().min(0),
    srs_input_refs: z.string().default(''),
    api_input_refs: z.string().default(''),
    figma_input_refs: z.string().default(''),
    project_context_refs: z.string().default(''),
    feature_context_refs: z.string().default(''),
    design_context_refs: z.string().default(''),
    source_inspection_refs: z.string().default(''),
    rule_refs: z.string().default(''),

    // --- Core gates ---
    srs_required: TriState,
    srs_trace_matrix_status: GateStatus,
    srs_logic_coverage_status: GateStatus,
    api_contract_mapping_status: GateStatus,
    api_error_mapping_status: GateStatus,
    fe_error_display_status: GateStatus,
    rule_contract_application_status: GateStatus,
    clean_code_gate_status: GateStatus,
    questions_status: z.enum(['none', 'open', 'blocked', 'resolved', 'not_required']),
    blocking_questions_open: z.number().int().min(0),
    questions_resolution_gate_status: GateStatus,
    input_sync_required: z.boolean(),
    plan_recheck_required_after_input_sync: z.boolean(),

    // --- Efficiency / evidence gates ---
    token_budget_status: GateStatus,
    required_files_read_status: GateStatus,
    scope_diff_status: GateStatus,
    command_evidence_status: GateStatus,
    test_command_log_status: GateStatus,
    playwright_screenshot_diff_status: GateStatus,

    // --- Figma/UI gates ---
    figma_required: TriState,
    figma_gate_status: z.union([GateStatus, z.literal('waived'), z.literal('substituted')]),
    ui_implementation_contract_status: GateStatus,
    figma_node_matrix_status: GateStatus,
    figma_component_binding_status: GateStatus,
    ui_match_review_status: GateStatus,
    ui_match_severity_status: z.enum(['unknown', 'none', 'low', 'medium', 'high', 'critical']),

    // --- Mode output status ---
    input_sync_report_status: GateStatus,
    figma_summary_status: GateStatus,
    cook_status: GateStatus,
    review_status: z.enum([
      'not_started',
      'passed',
      'needs_bugfix',
      'blocked',
      'insufficient_evidence',
    ]),
    review_report_status: GateStatus,
    review_bug_status: z.enum(['none', 'open', 'blocked', 'closed']),
    critical_issues_open: z.number().int().min(0),
    high_issues_open: z.number().int().min(0),
    medium_issues_open: z.number().int().min(0),
    low_issues_open: z.number().int().min(0),
    bugfix_required: z.boolean(),
    test_summary_status: z.enum(['not_started', 'created', 'updated', 'passed', 'failed']),
    ui_figma_review_report_status: GateStatus,
    pr_summary_status: GateStatus,
    pr_status: z.enum(['not_started', 'ready', 'opened', 'merged', 'blocked']),
    build_ready: z.boolean(),
  })
  // giữ passthrough để field mới do team tự thêm không làm validator crash;
  // muốn strict tuyệt đối thì đổi thành .strict()
  .passthrough();

export { GateStatus, CoreMode };
