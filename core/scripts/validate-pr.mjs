#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { validatePr, scopeDiffForTask, detectBaseRef } from '@frontend-delivery-kit/validators';

const args = process.argv.slice(2);
const taskArg = args.find((a) => !a.startsWith('--'));
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error('Usage: node validate-pr.mjs <task-folder> [--base <ref>]');
  process.exit(1);
}
const taskDir = path.resolve(taskArg);
const baseIndex = args.indexOf('--base');
const repoRoot = process.cwd();

// Scope diff tính từ git; không có git (vd skill chạy ngoài repo) thì
// validatePr rơi về field tự khai scope_diff_status.
const base = (baseIndex >= 0 && args[baseIndex + 1]) || detectBaseRef(repoRoot);
const scope = scopeDiffForTask(taskDir, { repoRoot, base }) || undefined;

const result = validatePr(taskDir, { scope });
for (const w of result.warnings) console.warn('Cảnh báo: ' + w);
if (!result.ok) {
  result.errors.forEach((e) => console.error(e));
  process.exit(1);
}
console.log('validate-pr passed.');
