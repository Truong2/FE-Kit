#!/usr/bin/env node
import { createRequire as __fdkCreateRequire } from 'node:module';
const require = __fdkCreateRequire(import.meta.url);
import {
  parseWorkflowStatus
} from "./chunks/chunk-P7ZAUX2T.mjs";

// core/scripts/validate-pr.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var taskArg = process.argv[2];
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error("Usage: node validate-pr.mjs <task-folder>");
  process.exit(1);
}
var taskDir = path.resolve(taskArg);
function norm(v) {
  return String(v ?? "").toLowerCase().trim();
}
function bool(v) {
  return v === true || norm(v) === "true";
}
function read(rel) {
  const p = path.join(taskDir, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}
var ok = true;
var r = spawnSync(process.execPath, [path.join(__dirname, "validate-workflow.mjs"), taskDir], {
  stdio: "inherit"
});
if (r.status !== 0) ok = false;
for (const rel of [
  "output/review-report.md",
  "output/test-summary.md",
  "output/pr-summary.md",
  "tracking/workflow-status.md"
]) {
  const present = fs.existsSync(path.join(taskDir, rel));
  console.log((present ? "OK" : "MISSING") + " " + rel);
  if (!present) ok = false;
}
var parsed = parseWorkflowStatus(read("tracking/workflow-status.md"));
var data = parsed.ok ? parsed.data : {};
if (!parsed.ok) {
  ok = false;
  parsed.errors.forEach((e) => console.error(e));
}
if (!["passed", "not_required"].includes(norm(data.review_status))) {
  console.error("review_status ph\u1EA3i passed/not_required tr\u01B0\u1EDBc PR.");
  ok = false;
}
if (bool(data.bugfix_required) || Number(data.critical_issues_open || 0) > 0 || Number(data.high_issues_open || 0) > 0 || ["open", "blocked"].includes(norm(data.review_bug_status))) {
  console.error("C\xF2n review bug/Critical/High tr\u01B0\u1EDBc PR.");
  ok = false;
}
if (!["passed", "not_required"].includes(norm(data.scope_diff_status))) {
  console.error("scope_diff_status ph\u1EA3i passed/not_required tr\u01B0\u1EDBc PR.");
  ok = false;
}
if (!["completed", "passed", "not_required"].includes(norm(data.command_evidence_status))) {
  console.error("command_evidence_status ph\u1EA3i completed/passed/not_required tr\u01B0\u1EDBc PR.");
  ok = false;
}
if (!["completed", "passed", "not_required"].includes(norm(data.test_command_log_status))) {
  console.error("test_command_log_status ph\u1EA3i completed/passed/not_required tr\u01B0\u1EDBc PR.");
  ok = false;
}
if (bool(data.figma_required)) {
  if (!["passed", "waived", "not_required"].includes(norm(data.ui_match_review_status))) {
    console.error("Task UI/Figma c\u1EA7n ui_match_review_status=passed/waived/not_required tr\u01B0\u1EDBc PR.");
    ok = false;
  }
  if (["critical", "high", "blocked"].includes(norm(data.ui_match_severity_status))) {
    console.error("C\xF2n UI mismatch Critical/High/Blocked tr\u01B0\u1EDBc PR.");
    ok = false;
  }
  if (!["passed", "manual_review", "not_required", "waived"].includes(
    norm(data.playwright_screenshot_diff_status)
  )) {
    console.error(
      "Task UI/Figma c\u1EA7n playwright_screenshot_diff_status=passed/manual_review/not_required/waived tr\u01B0\u1EDBc PR."
    );
    ok = false;
  }
}
if (!["ready", "opened", "merged"].includes(norm(data.pr_status))) {
  console.error("pr_status ph\u1EA3i ready/opened/merged tr\u01B0\u1EDBc PR validation.");
  ok = false;
}
if (!ok) process.exit(1);
console.log("validate-pr passed.");
