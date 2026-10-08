import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * Cấu hình của repo dự án (file YAML do pack quy định, nằm trong thư mục cấu
 * hình của pack). File này do `init` tạo một lần rồi thuộc về team. Chỉ đọc các key trong whitelist; key lạ bị bỏ qua, giá trị sai kiểu
 * chỉ sinh cảnh báo và dùng mặc định.
 */

export const PROJECT_CONFIG_DEFAULTS = Object.freeze({
  /** PR sửa source mà không task nào khai file đó trong plan: `off` | `warn` | `error`. */
  require_task_for_source: 'warn',
  /** Thư mục được coi là source khi kiểm PR không gắn task. */
  source_paths: ['src/', 'app/', 'apps/', 'packages/'],
});

const VALIDATORS = {
  require_task_for_source: (v) => ['off', 'warn', 'error'].includes(v),
  source_paths: (v) => Array.isArray(v) && v.length > 0 && v.every((p) => typeof p === 'string' && p.trim()),
};

/**
 * @param {string} repoRoot
 * @param {{ file: string }} opts path tương đối repo của file cấu hình
 * @returns {{ config: typeof PROJECT_CONFIG_DEFAULTS, warnings: string[], source: 'file' | 'default' }}
 */
export function loadProjectConfig(repoRoot, { file: configFile }) {
  const file = path.join(repoRoot, configFile);
  const config = { ...PROJECT_CONFIG_DEFAULTS };
  const warnings = [];
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return { config, warnings, source: 'default' };
  }
  let data = {};
  try {
    data = matter(`---\n${raw}\n---\n`).data || {};
  } catch (err) {
    warnings.push(`${configFile} không parse được YAML (${err.message}); dùng cấu hình mặc định.`);
    return { config, warnings, source: 'default' };
  }
  for (const [key, valid] of Object.entries(VALIDATORS)) {
    if (data[key] === undefined) continue;
    if (valid(data[key])) config[key] = data[key];
    else warnings.push(`${configFile}: giá trị ${key} không hợp lệ; dùng mặc định ${JSON.stringify(PROJECT_CONFIG_DEFAULTS[key])}.`);
  }
  config.source_paths = config.source_paths.map((p) => (p.endsWith('/') ? p : `${p}/`));
  return { config, warnings, source: 'file' };
}
