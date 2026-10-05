#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { validateWorkflow } from '@frontend-delivery-kit/validators';

const taskArg = process.argv[2];
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error('Usage: node validate-workflow.mjs <task-folder>');
  process.exit(1);
}

const result = validateWorkflow(path.resolve(taskArg));
for (const w of result.warnings || []) console.warn('Cảnh báo: ' + w);
if (!result.ok) {
  result.errors.forEach((e) => console.error(e));
  process.exit(1);
}
console.log('validate-workflow passed.');
