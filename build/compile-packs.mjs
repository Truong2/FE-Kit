#!/usr/bin/env node
/**
 * Compile domain pack: `packages/pack-<id>/pack.yaml` → `src/manifest.gen.mjs`,
 * sau khi kiểm `PackManifestSchema` của engine. Chạy TRƯỚC generate-adapters vì
 * generator và các bundle import manifest đã sinh.
 *
 * Sinh thêm `kit.yaml` từ manifest của pack FE (danh sách mode và file của task),
 * thay cho bản viết tay từng bị lệch với code.
 *
 *   node build/compile-packs.mjs          # ghi
 *   node build/compile-packs.mjs --check  # không ghi, exit 1 nếu lệch (CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');
const { validateManifest, commandToModeOf } = await import(pathToFileURL(path.join(ROOT, 'packages', 'engine', 'src', 'pack.mjs')).href);

const lf = (text) => String(text).replace(/\r\n/g, '\n');
let drift = false;

function write(rel, content) {
  const file = path.join(ROOT, rel);
  const current = fs.existsSync(file) ? lf(fs.readFileSync(file, 'utf8')) : null;
  if (current === content) return false;
  if (CHECK_ONLY) {
    drift = true;
    console.error(`[compile-packs] ${current === null ? 'THIẾU' : 'LỆCH NỘI DUNG'}: ${rel}`);
    return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

/** Đọc YAML thuần (không frontmatter) bằng parser của gray-matter. */
function readYaml(file) {
  return matter(`---\n${lf(fs.readFileSync(file, 'utf8'))}\n---\n`).data;
}

export function compilePack(packDir) {
  const res = validateManifest(readYaml(path.join(packDir, 'pack.yaml')));
  if (!res.ok) throw new Error(`${path.relative(ROOT, packDir)}/pack.yaml không hợp lệ:\n- ${res.errors.join('\n- ')}`);
  return res.manifest;
}

function manifestModule(manifest, packRel) {
  return (
    `// Sinh từ ${packRel}/pack.yaml bởi build/compile-packs.mjs. Không sửa tay: sửa pack.yaml rồi chạy \`npm run build\`.\n` +
    `export default ${JSON.stringify(manifest, null, 2)};\n`
  );
}

function kitYaml(manifest, version) {
  const commands = Object.entries(commandToModeOf(manifest)).map(([cmd, mode]) => `  ${cmd}: ${mode}`);
  const required = [...manifest.task_files.required_docs, ...manifest.task_files.empty].map((f) => `  - ${f}`);
  const conditional = manifest.task_files.conditional.map((f) => `  - ${f}`);
  return [
    `# Sinh từ packages/pack-${manifest.id}/pack.yaml bởi build/compile-packs.mjs. Không sửa tay.`,
    'name: frontend-delivery-agent-kit',
    `version: ${version}`,
    'status: stable',
    'description: >',
    '  Frontend delivery kit for SRS-grounded planning, low-risk quick tasks, Figma UI contract/extraction,',
    '  input sync, implementation, review with mandatory report/bug tracking, testing, and PR readiness.',
    '',
    'standard:',
    '  config: standard.yaml',
    '  one_task_structure: true',
    '',
    'commands:',
    ...commands,
    '',
    'required_task_files:',
    ...required,
    '',
    'conditional_task_files:',
    ...conditional,
    '',
  ].join('\n');
}

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const packsDir = path.join(ROOT, 'packages');
let count = 0;
for (const ent of fs.readdirSync(packsDir, { withFileTypes: true })) {
  if (!ent.isDirectory() || !ent.name.startsWith('pack-')) continue;
  const packDir = path.join(packsDir, ent.name);
  if (!fs.existsSync(path.join(packDir, 'pack.yaml'))) continue;
  const manifest = compilePack(packDir);
  const packRel = `packages/${ent.name}`;
  write(`${packRel}/src/manifest.gen.mjs`, manifestModule(manifest, packRel));
  if (manifest.id === 'fe') write('kit.yaml', kitYaml(manifest, version));
  count += 1;
}

if (CHECK_ONLY && drift) {
  console.error('\n[compile-packs] Manifest đã sinh lệch với pack.yaml. Chạy `npm run build` rồi commit lại.');
  process.exit(1);
}
console.log(`[compile-packs] ${count} pack${CHECK_ONLY ? ' khớp với pack.yaml' : ' đã compile'}.`);
