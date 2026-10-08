#!/usr/bin/env node
import { createRequire as __fdkCreateRequire } from 'node:module';
const require = __fdkCreateRequire(import.meta.url);
import {
  REQUIRED_TASK_FILES
} from "./chunks/chunk-QDMQKSCV.mjs";

// core/scripts/validate-task.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var taskArg = process.argv[2];
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error("Usage: node validate-task.mjs <task-folder>");
  process.exit(1);
}
var taskDir = path.resolve(taskArg);
var ok = true;
for (const rel of REQUIRED_TASK_FILES) {
  const present = fs.existsSync(path.join(taskDir, rel));
  console.log((present ? "OK" : "MISSING") + " " + rel);
  if (!present) ok = false;
}
var r = spawnSync(process.execPath, [path.join(__dirname, "validate-workflow.mjs"), taskDir], {
  stdio: "inherit"
});
if (r.status !== 0) ok = false;
if (!ok) process.exit(1);
console.log("validate-task passed.");
