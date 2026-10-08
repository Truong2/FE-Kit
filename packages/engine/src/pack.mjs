import { z } from 'zod';

/**
 * Manifest của domain pack: dữ liệu khai báo trong `packages/pack-<id>/pack.yaml`,
 * được `build/compile-packs.mjs` kiểm schema rồi sinh `src/manifest.gen.mjs`.
 * Gate phức tạp và chuỗi cần tính toán vẫn là JS trong pack; manifest chỉ chứa
 * dữ liệu (bảng mode, agent, artifact, rule, đường dẫn, chuỗi hiển thị).
 */

const name = z.string().min(1);
const list = z.array(name);

const ModeSchema = z.object({
  /** Giá trị `current_mode` trong file trạng thái. */
  state: name,
  /** Subagent đảm nhận; `null` = main thread. */
  agent: name.nullable(),
  /** Artifact phải tồn tại khi mode kết thúc (tương đối task folder). */
  artifacts: list,
  /** `next_mode` hợp lý sau mode này; lệch chỉ cảnh báo. */
  next: list,
});

export const PackManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'id chỉ gồm chữ thường, số, gạch ngang'),
    display_name: name,
    plugin: name,
    prompt_prefix: name,
    env_prefix: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'env_prefix chỉ gồm chữ hoa, số, gạch dưới'),
    agent_prefix: name,
    tasks_root: name,
    config_dir: name,
    project_config_file: name,
    status_file: name,
    writable_prefixes: list,
    scope_ignore: list,
    planned_files_heading: name,
    task_name_hint: name,
    task_files: z.object({
      required_docs: list.min(1),
      empty: list.default([]),
      conditional: list.default([]),
    }),
    modes: z.record(name, ModeSchema),
    aliases: z.record(name, name).default({}),
    terminal_next: list,
    always_allowed: list,
    source_edit_modes: list,
    source_edit_agent: name,
    source_fix_route: name,
    plan_update_route: name,
    read_inputs_hint: name,
    rules: z.object({
      always: list,
      by_mode: z.record(name, list).default({}),
      /** Rule nạp cho `always`, hoặc cho `modes` khi field `when_field` của file trạng thái là true. */
      conditional: z
        .array(z.object({ rule: name, always: list.default([]), modes: list.default([]), when_field: name }))
        .default([]),
    }),
    mcp: z.object({
      server_name: name,
      tool_prefix: z.string().regex(/^[a-z][a-z0-9]*$/),
      skill_dir: name,
      next_prompt_heading: name,
      first_command: name,
      task_prop_description: name,
      task_name_description: name,
      scope_self_reported: name,
      scope_unavailable: name,
      planned_files_missing: name,
      status_fields: list,
      descriptions: z.object({
        begin_mode: name,
        new_task: name,
        validate_task: name,
        validate_workflow: name,
        scope_diff: name,
        next_step: name,
        task_status: name,
      }),
    }),
  })
  .superRefine((m, ctx) => {
    const commands = Object.keys(m.modes);
    const known = new Set(commands);
    const check = (values, where) => {
      for (const v of values) {
        if (!known.has(v)) ctx.addIssue({ code: 'custom', message: `${where}: mode "${v}" không có trong modes` });
      }
    };
    for (const [cmd, mode] of Object.entries(m.modes)) check(mode.next, `modes.${cmd}.next`);
    check(Object.values(m.aliases), 'aliases');
    check(m.always_allowed, 'always_allowed');
    check(m.source_edit_modes, 'source_edit_modes');
    check([m.mcp.first_command], 'mcp.first_command');
    for (const [rule, modes] of Object.entries(m.rules.by_mode)) check(modes, `rules.by_mode.${rule}`);
    m.rules.conditional.forEach((c, i) => check([...c.always, ...c.modes], `rules.conditional[${i}]`));
    const states = commands.map((c) => m.modes[c].state);
    if (new Set(states).size !== states.length) ctx.addIssue({ code: 'custom', message: 'modes: hai mode trùng state' });
  });

/**
 * Kiểm schema của manifest.
 * @returns {{ ok: true, manifest: object } | { ok: false, errors: string[] }}
 */
export function validateManifest(raw) {
  const res = PackManifestSchema.safeParse(raw);
  if (res.success) return { ok: true, manifest: res.data };
  return { ok: false, errors: res.error.issues.map((i) => `${i.path.join('.') || '(gốc)'}: ${i.message}`) };
}

/** Lệnh → `current_mode`, theo thứ tự khai báo trong manifest. */
export function commandToModeOf(manifest) {
  return Object.fromEntries(Object.entries(manifest.modes).map(([cmd, m]) => [cmd, m.state]));
}

/**
 * File rule cần nạp cho một mode: rule luôn nạp, rule theo mode, rồi rule có
 * điều kiện (theo thứ tự khai báo).
 * @param {object} manifest
 * @param {string} command lệnh đã chuẩn hoá
 * @param {object} [data] frontmatter của file trạng thái
 */
export function rulesForManifest(manifest, command, data = {}) {
  const rules = [...manifest.rules.always];
  for (const [rule, commands] of Object.entries(manifest.rules.by_mode)) {
    if (commands.includes(command)) rules.push(rule);
  }
  for (const c of manifest.rules.conditional) {
    if (c.always.includes(command) || (data[c.when_field] === true && c.modes.includes(command))) rules.push(c.rule);
  }
  return rules;
}

/** Mọi file rule mà ít nhất một mode có thể nạp. */
export function allRuleFilesOf(manifest) {
  return [...manifest.rules.always, ...Object.keys(manifest.rules.by_mode), ...manifest.rules.conditional.map((c) => c.rule)];
}
