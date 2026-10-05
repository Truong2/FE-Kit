#!/usr/bin/env node
import { createRequire as __fdkCreateRequire } from 'node:module';
const require = __fdkCreateRequire(import.meta.url);
import {
  validateWorkflow
} from "./chunks/chunk-VQYJZHVW.mjs";

// core/scripts/validate-workflow.mjs
import fs from "node:fs";
import path from "node:path";
var taskArg = process.argv[2];
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error("Usage: node validate-workflow.mjs <task-folder>");
  process.exit(1);
}
var result = validateWorkflow(path.resolve(taskArg));
for (const w of result.warnings || []) console.warn("C\u1EA3nh b\xE1o: " + w);
if (!result.ok) {
  result.errors.forEach((e) => console.error(e));
  process.exit(1);
}
console.log("validate-workflow passed.");
