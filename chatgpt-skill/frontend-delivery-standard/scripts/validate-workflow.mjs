#!/usr/bin/env node
import { createRequire as __fdkCreateRequire } from 'node:module';
const require = __fdkCreateRequire(import.meta.url);
import {
  validateWorkflowAtGate
} from "./chunks/chunk-Q5DWVIRU.mjs";

// core/scripts/validate-workflow.mjs
import fs from "node:fs";
import path from "node:path";
var args = process.argv.slice(2);
var taskArg = args.find((a) => !a.startsWith("--"));
if (!taskArg || !fs.existsSync(path.resolve(taskArg))) {
  console.error("Usage: node validate-workflow.mjs <task-folder> [--base <ref>]");
  process.exit(1);
}
var baseIndex = args.indexOf("--base");
var result = validateWorkflowAtGate(path.resolve(taskArg), {
  repoRoot: process.cwd(),
  base: baseIndex >= 0 && args[baseIndex + 1] || void 0
});
if (result.scopeSource === "git") console.log(`Scope: t\xEDnh t\u1EEB git (base: ${result.base || "ch\u1EC9 thay \u0111\u1ED5i ch\u01B0a commit"}).`);
for (const w of result.warnings || []) console.warn("C\u1EA3nh b\xE1o: " + w);
if (!result.ok) {
  result.errors.forEach((e) => console.error(e));
  process.exit(1);
}
console.log("validate-workflow passed.");
