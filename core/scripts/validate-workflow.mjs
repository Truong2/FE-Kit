#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { validateWorkflowAtGate } from '@frontend-delivery-kit/validators';

const args = process.argv.slice(2);
const taskArg = args.find((a) => !a.startsWith('--'));
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error('Usage: node validate-workflow.mjs <task-folder> [--base <ref>]');
  process.exit(1);
}
const baseIndex = args.indexOf('--base');

// Cùng gate với MCP `fe_validate_workflow`: task ở review/test/pr-ready thì
// đối chiếu file đã sửa (git, tính từ thư mục hiện tại) với plan.
const result = validateWorkflowAtGate(path.resolve(taskArg), {
  repoRoot: process.cwd(),
  base: (baseIndex >= 0 && args[baseIndex + 1]) || undefined,
});
if (result.scopeSource === 'git') console.log(`Scope: tính từ git (base: ${result.base || 'chỉ thay đổi chưa commit'}).`);
for (const w of result.warnings || []) console.warn('Cảnh báo: ' + w);
if (!result.ok) {
  result.errors.forEach((e) => console.error(e));
  process.exit(1);
}
console.log('validate-workflow passed.');
