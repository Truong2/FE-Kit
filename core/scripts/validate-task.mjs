#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REQUIRED_TASK_FILES } from '@frontend-delivery-kit/validators';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const taskArg = process.argv[2];
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error('Usage: node validate-task.mjs <task-folder>');
  process.exit(1);
}
const taskDir = path.resolve(taskArg);

let ok = true;
for (const rel of REQUIRED_TASK_FILES) {
  const present = fs.existsSync(path.join(taskDir, rel));
  console.log((present ? 'OK' : 'MISSING') + ' ' + rel);
  if (!present) ok = false;
}

const r = spawnSync(process.execPath, [path.join(__dirname, 'validate-workflow.mjs'), taskDir], {
  stdio: 'inherit',
});
if (r.status !== 0) ok = false;

if (!ok) process.exit(1);
console.log('validate-task passed.');
