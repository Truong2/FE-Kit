#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateWorkflowGates, parseWorkflowStatus } from '@frontend-delivery-kit/validators';

const taskArg = process.argv[2];
if (!taskArg) {
  console.error('Usage: node validate-workflow.mjs <task-folder>');
  process.exit(1);
}
const taskDir = path.resolve(taskArg);
if (!fs.existsSync(taskDir)) {
  console.error('Usage: node validate-workflow.mjs <task-folder>');
  process.exit(1);
}

const requiredFiles = [
  'task.md',
  'planning/implementation-plan.md',
  'planning/build-checklist.md',
  'planning/questions.md',
  'tracking/workflow-status.md',
];

const errors = [];
for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(taskDir, rel))) errors.push('Thiếu ' + rel);
}

const workflowPath = path.join(taskDir, 'tracking', 'workflow-status.md');
if (fs.existsSync(workflowPath)) {
  const raw = fs.readFileSync(workflowPath, 'utf8');
  const parsed = parseWorkflowStatus(raw);
  if (!parsed.ok) {
    errors.push(...parsed.errors);
  } else {
    const exists = (rel) => fs.existsSync(path.join(taskDir, rel));
    const read = (rel) => {
      const p = path.join(taskDir, rel);
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    };
    const result = evaluateWorkflowGates({ data: parsed.data, body: parsed.body, exists, read });
    errors.push(...result.errors);
  }
}

if (errors.length) {
  errors.forEach((e) => console.error(e));
  process.exit(1);
}
console.log('validate-workflow passed.');
