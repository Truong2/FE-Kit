#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseWorkflowStatus } from '@frontend-delivery-kit/validators';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const taskArg = process.argv[2];
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error('Usage: node validate-pr.mjs <task-folder>');
  process.exit(1);
}
const taskDir = path.resolve(taskArg);

function norm(v) {
  return String(v ?? '').toLowerCase().trim();
}
function bool(v) {
  return v === true || norm(v) === 'true';
}
function read(rel) {
  const p = path.join(taskDir, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

let ok = true;

const r = spawnSync(process.execPath, [path.join(__dirname, 'validate-workflow.mjs'), taskDir], {
  stdio: 'inherit',
});
if (r.status !== 0) ok = false;

for (const rel of [
  'output/review-report.md',
  'output/test-summary.md',
  'output/pr-summary.md',
  'tracking/workflow-status.md',
]) {
  const present = fs.existsSync(path.join(taskDir, rel));
  console.log((present ? 'OK' : 'MISSING') + ' ' + rel);
  if (!present) ok = false;
}

const parsed = parseWorkflowStatus(read('tracking/workflow-status.md'));
const data = parsed.ok ? parsed.data : {};
if (!parsed.ok) {
  ok = false;
  parsed.errors.forEach((e) => console.error(e));
}

if (!['passed', 'not_required'].includes(norm(data.review_status))) {
  console.error('review_status phải passed/not_required trước PR.');
  ok = false;
}
if (
  bool(data.bugfix_required) ||
  Number(data.critical_issues_open || 0) > 0 ||
  Number(data.high_issues_open || 0) > 0 ||
  ['open', 'blocked'].includes(norm(data.review_bug_status))
) {
  console.error('Còn review bug/Critical/High trước PR.');
  ok = false;
}
if (!['passed', 'not_required'].includes(norm(data.scope_diff_status))) {
  console.error('scope_diff_status phải passed/not_required trước PR.');
  ok = false;
}
if (!['completed', 'passed', 'not_required'].includes(norm(data.command_evidence_status))) {
  console.error('command_evidence_status phải completed/passed/not_required trước PR.');
  ok = false;
}
if (!['completed', 'passed', 'not_required'].includes(norm(data.test_command_log_status))) {
  console.error('test_command_log_status phải completed/passed/not_required trước PR.');
  ok = false;
}
if (bool(data.figma_required)) {
  if (!['passed', 'waived', 'not_required'].includes(norm(data.ui_match_review_status))) {
    console.error('Task UI/Figma cần ui_match_review_status=passed/waived/not_required trước PR.');
    ok = false;
  }
  if (['critical', 'high', 'blocked'].includes(norm(data.ui_match_severity_status))) {
    console.error('Còn UI mismatch Critical/High/Blocked trước PR.');
    ok = false;
  }
  if (
    !['passed', 'manual_review', 'not_required', 'waived'].includes(
      norm(data.playwright_screenshot_diff_status)
    )
  ) {
    console.error(
      'Task UI/Figma cần playwright_screenshot_diff_status=passed/manual_review/not_required/waived trước PR.'
    );
    ok = false;
  }
}
if (!['ready', 'opened', 'merged'].includes(norm(data.pr_status))) {
  console.error('pr_status phải ready/opened/merged trước PR validation.');
  ok = false;
}

if (!ok) process.exit(1);
console.log('validate-pr passed.');
