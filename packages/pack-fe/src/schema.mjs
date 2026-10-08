import { z } from 'zod';

/**
 * Schema cho frontmatter của tracking/workflow-status.md.
 * Đây là NGUỒN DUY NHẤT định nghĩa field/kiểu/enum hợp lệ.
 * Trước đây các allow-list (vd. danh sách giá trị hợp lệ của
 * `questions_resolution_gate_status`) bị lặp lại bằng regex ở cả
 * `bin/fe-kit.mjs` và `scripts/validate-workflow.ts`. Từ giờ CLI,
 * script standalone và test suite đều import schema này.
 *
 * v2.0.0: field mà validator tự tính được từ file/git (trạng thái artifact
 * theo mode, scope diff, command evidence, token budget) trở thành OPTIONAL.
 * Không field nào bị xoá — task folder tạo từ v1.x vẫn hợp lệ.
 *
 * v2.3.0: field không gate nào đọc được liệt kê ở `DEPRECATED_FIELDS` và trở
 * thành optional; số issue Medium/Low tự tính được từ bảng issue nên cũng optional.
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
  // Các giá trị template và PR validator đã dùng từ v1.x nhưng schema thiếu.
  'partial',
  'manual_review',
  'waived',
  'substituted',
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

/** Field tự khai: giữ để tương thích, không còn bắt buộc. */
const SelfReported = GateStatus.optional();

const REF_REASON = 'Mục "Input ledger" trong body của workflow-status.md mới là danh sách input; không gate nào đọc field này.';
const UNREAD = 'Không gate nào đọc field này.';
const FROM_FILE = 'Suy ra được từ việc artifact tương ứng có tồn tại.';

/**
 * Field giữ lại để tương thích nhưng không gate nào đọc. Template vẫn có để
 * task cũ và task mới cùng dạng; agent không cần cập nhật các field này.
 * @type {{ field: string, since: string, reason: string }[]}
 */
export const DEPRECATED_FIELDS = [
  ...['srs_input_refs', 'api_input_refs', 'figma_input_refs', 'project_context_refs', 'feature_context_refs', 'design_context_refs', 'source_inspection_refs', 'rule_refs'].map(
    (field) => ({ field, since: '2.3.0', reason: REF_REASON })
  ),
  { field: 'required_input_count', since: '2.3.0', reason: 'Gate chỉ đọc missing_input_count.' },
  ...['srs_logic_coverage_status', 'api_contract_mapping_status', 'api_error_mapping_status', 'fe_error_display_status'].map((field) => ({
    field,
    since: '2.3.0',
    reason: `${UNREAD} SRS được kiểm qua srs_trace_matrix_status và ma trận trace trong plan.`,
  })),
  ...['ui_implementation_contract_status', 'figma_node_matrix_status', 'figma_component_binding_status'].map((field) => ({
    field,
    since: '2.3.0',
    reason: `${UNREAD} Figma được kiểm qua figma_gate_status và ui_match_review_status.`,
  })),
  ...['rule_contract_application_status', 'clean_code_gate_status'].map((field) => ({ field, since: '2.3.0', reason: UNREAD })),
  ...['input_sync_report_status', 'figma_summary_status', 'cook_status', 'review_report_status', 'test_summary_status', 'ui_figma_review_report_status', 'pr_summary_status'].map(
    (field) => ({ field, since: '2.3.0', reason: FROM_FILE })
  ),
];

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
    required_input_count: z.number().int().min(0).optional(),
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
    srs_logic_coverage_status: SelfReported,
    api_contract_mapping_status: SelfReported,
    api_error_mapping_status: SelfReported,
    fe_error_display_status: SelfReported,
    rule_contract_application_status: SelfReported,
    clean_code_gate_status: SelfReported,
    questions_status: z.enum(['none', 'open', 'blocked', 'resolved', 'not_required']),
    blocking_questions_open: z.number().int().min(0),
    questions_resolution_gate_status: GateStatus,
    input_sync_required: z.boolean(),
    plan_recheck_required_after_input_sync: z.boolean(),

    // --- Efficiency / evidence gates (tự khai → optional) ---
    token_budget_status: SelfReported,
    required_files_read_status: SelfReported,
    scope_diff_status: SelfReported,
    command_evidence_status: SelfReported,
    test_command_log_status: SelfReported,
    playwright_screenshot_diff_status: SelfReported,

    // --- Figma/UI gates ---
    figma_required: TriState,
    figma_gate_status: GateStatus,
    ui_implementation_contract_status: SelfReported,
    figma_node_matrix_status: SelfReported,
    figma_component_binding_status: SelfReported,
    ui_match_review_status: GateStatus,
    ui_match_severity_status: z.enum(['unknown', 'none', 'low', 'medium', 'high', 'critical']),

    // --- Mode output status (suy ra được từ file tồn tại → optional) ---
    input_sync_report_status: SelfReported,
    figma_summary_status: SelfReported,
    cook_status: SelfReported,
    review_status: z.enum([
      'not_started',
      'passed',
      'needs_bugfix',
      'blocked',
      'insufficient_evidence',
      'not_required',
    ]),
    review_report_status: SelfReported,
    // 'resolved', 'fixed', 'waived' có trong template/standard từ v1.x nhưng schema thiếu.
    review_bug_status: z.enum(['none', 'open', 'blocked', 'closed', 'resolved', 'fixed', 'waived']),
    critical_issues_open: z.number().int().min(0),
    high_issues_open: z.number().int().min(0),
    // Medium/Low tự đếm được từ bảng issue (`countOpenIssuesBySeverity`).
    medium_issues_open: z.number().int().min(0).optional(),
    low_issues_open: z.number().int().min(0).optional(),
    bugfix_required: z.boolean(),
    test_summary_status: z
      .enum(['not_started', 'created', 'updated', 'passed', 'failed', 'partial'])
      .optional(),
    ui_figma_review_report_status: SelfReported,
    pr_summary_status: SelfReported,
    pr_status: z.enum(['not_started', 'ready', 'opened', 'merged', 'blocked']),
    build_ready: z.boolean(),
  })
  // giữ passthrough để field mới do team tự thêm không làm validator crash;
  // muốn strict tuyệt đối thì đổi thành .strict()
  .passthrough();

export { GateStatus, CoreMode };
