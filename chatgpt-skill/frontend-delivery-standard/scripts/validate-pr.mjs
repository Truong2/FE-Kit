#!/usr/bin/env node
import { createRequire as __fdkCreateRequire } from 'node:module';
const require = __fdkCreateRequire(import.meta.url);
import {
  detectBaseRef,
  scopeDiffForTask,
  validatePr
} from "./chunks/chunk-RXGQ2CEI.mjs";

// core/scripts/validate-pr.mjs
import fs from "node:fs";
import path from "node:path";
var args = process.argv.slice(2);
var taskArg = args.find((a) => !a.startsWith("--"));
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error("Usage: node validate-pr.mjs <task-folder> [--base <ref>]");
  process.exit(1);
}
var taskDir = path.resolve(taskArg);
var baseIndex = args.indexOf("--base");
var repoRoot = process.cwd();
var base = baseIndex >= 0 && args[baseIndex + 1] || detectBaseRef(repoRoot);
var scope = scopeDiffForTask(taskDir, { repoRoot, base }) || void 0;
var result = validatePr(taskDir, { scope });
for (const w of result.warnings) console.warn("C\u1EA3nh b\xE1o: " + w);
if (!result.ok) {
  result.errors.forEach((e) => console.error(e));
  process.exit(1);
}
console.log("validate-pr passed.");
