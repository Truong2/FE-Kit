#!/usr/bin/env node
/**
 * Sinh lại các bản "adapter" (rules/templates/docs dùng cho Claude skill và
 * ChatGPT skill) từ core/ — nguồn duy nhất.
 *
 * TRƯỚC ĐÂY: rules/, templates/, docs/ tồn tại y hệt (byte-for-byte) ở
 * top-level, .claude/skills/frontend-delivery-standard/, và
 * chatgpt-skill/frontend-delivery-standard/ — không có script nào đồng bộ,
 * sửa 1 chỗ phải nhớ sửa tay 3-4 chỗ.
 *
 * TỪ BÂY GIỜ: core/rules, core/templates, core/docs, core/standards,
 * core/scripts là NGUỒN DUY NHẤT. Script này copy chúng ra các đích cần
 * thiết; riêng core/scripts được BUNDLE bằng esbuild thành file .mjs độc
 * lập (không cần ts-node, không cần node_modules ở đích) vì các script này
 * phải chạy được sau khi skill folder bị copy ra khỏi monorepo (ChatGPT
 * Skill zip, hoặc team khác copy riêng .claude/skills/ vào repo của họ).
 *
 * Dùng:
 *   node build/generate-adapters.mjs          # ghi đè các đích
 *   node build/generate-adapters.mjs --check   # không ghi, exit 1 nếu lệch (dùng trong CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'core');
const CHECK_ONLY = process.argv.includes('--check');

/** Mỗi entry: copy core/<from> -> <to>, đồng thời set lại top-level rules/templates/docs = symlink-equivalent copy để giữ tương thích ngược cho ai đang tham chiếu path cũ. */
const TARGETS = [
  { from: 'rules', to: 'rules' }, // top-level rules/ (tương thích ngược, README cũ còn trỏ tới đây)
  { from: 'templates', to: 'templates' }, // top-level templates/
  { from: 'docs', to: 'docs' }, // top-level docs/
  { from: 'rules', to: '.claude/skills/frontend-delivery-standard/rules' },
  { from: 'templates', to: '.claude/skills/frontend-delivery-standard/templates' },
  { from: 'docs', to: '.claude/skills/frontend-delivery-standard/docs' },
  { from: 'standards', to: '.claude/skills/frontend-delivery-standard/standards' },
  { from: 'rules', to: 'chatgpt-skill/frontend-delivery-standard/rules' },
  { from: 'templates', to: 'chatgpt-skill/frontend-delivery-standard/templates' },
  { from: 'docs', to: 'chatgpt-skill/frontend-delivery-standard/docs' },
  { from: 'standards', to: 'chatgpt-skill/frontend-delivery-standard/standards' },
];

/** scripts/ được bundle (esbuild), không copy nguyên văn như các target khác. */
const SCRIPT_ENTRIES = ['validate-task.mjs', 'validate-workflow.mjs', 'validate-pr.mjs'];
const SCRIPT_TARGET_DIRS = [
  '.claude/skills/frontend-delivery-standard/scripts',
  'chatgpt-skill/frontend-delivery-standard/scripts',
];

/** File đơn copy thẳng (không phải cả thư mục) tới nhiều đích. */
const SINGLE_FILE_TARGETS = [
  { from: 'skill-package.json', to: '.claude/skills/frontend-delivery-standard/package.json' },
  { from: 'skill-package.json', to: 'chatgpt-skill/frontend-delivery-standard/package.json' },
  { from: 'SKILL.md', to: '.claude/skills/frontend-delivery-standard/SKILL.md' },
  { from: 'SKILL.md', to: 'chatgpt-skill/frontend-delivery-standard/SKILL.md' },
  { from: 'SKILL.md', to: 'plugins/frontend-delivery/skills/frontend-delivery-standard/SKILL.md' },
  { from: 'plugin.json', to: 'plugins/frontend-delivery/.claude-plugin/plugin.json' },
  { from: 'mcp.json', to: 'plugins/frontend-delivery/.mcp.json' },
];

/**
 * Plugin Claude Code phải TỰ CHỨA: khi user cài, Claude Code copy nguyên thư
 * mục plugin vào cache (~/.claude/plugins/cache), nên không được tham chiếu
 * file ngoài thư mục plugin bằng `../`. Vì vậy commands/agents/rules/templates
 * đều được copy vào trong plugin thay vì symlink.
 */
const PLUGIN_ROOT = 'plugins/frontend-delivery';
const PLUGIN_COPY_TARGETS = [
  { fromRepo: '.claude/agents', to: `${PLUGIN_ROOT}/agents` },
  { fromCore: 'rules', to: `${PLUGIN_ROOT}/skills/frontend-delivery-standard/rules` },
  { fromCore: 'templates', to: `${PLUGIN_ROOT}/skills/frontend-delivery-standard/templates` },
  { fromCore: 'standards', to: `${PLUGIN_ROOT}/skills/frontend-delivery-standard/standards` },
];

/**
 * Command files sinh từ core/commands/ cho từng adapter.
 * - Claude (.claude/commands/fe/): giữ nguyên (nguồn đã có frontmatter description).
 * - Codex (.codex/prompts/): bỏ frontmatter, thay bằng heading `# FE <cmd>`.
 * Tên file Codex khác tên Claude ở 2 chỗ (lịch sử): cook→build, figma→figma-extract.
 */
const COMMAND_CODEX_NAME = { 'cook.md': 'build.md', 'figma.md': 'figma-extract.md' };

function generateCommands() {
  const srcDir = path.join(CORE, 'commands');
  if (!fs.existsSync(srcDir)) {
    hadDrift = true;
    console.error('[generate-adapters] Thiếu core/commands');
    return;
  }
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.md'));

  const outputs = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(srcDir, f), 'utf8');
    outputs.push({ to: path.join('.claude/commands/fe', f), content: raw });

    const cmdName = f.replace(/\.md$/, '');
    const fm = raw.match(/^---\n[\s\S]*?\n---\n\n?/);
    const body = fm ? raw.slice(fm[0].length) : raw;
    const codexFile = COMMAND_CODEX_NAME[f] || f;
    const codexCmd = codexFile.replace(/\.md$/, '').replace('figma-extract', 'figma');
    outputs.push({ to: path.join('.codex/prompts', codexFile), content: `# FE ${codexCmd}\n\n${body}` });

    // Plugin: commands/ trong plugin CHỈ nhận file .md phẳng — thư mục con bị
    // Claude Code hiểu là skill (phải có SKILL.md) và bị bỏ qua. Vì vậy plugin
    // dùng file phẳng prefix fe- => slash command /frontend-delivery:fe-<cmd>.
    outputs.push({ to: path.join(PLUGIN_ROOT, 'commands', `fe-${f}`), content: raw });
  }

  for (const o of outputs) {
    const destFile = path.join(ROOT, o.to);
    if (CHECK_ONLY) {
      const cur = fs.existsSync(destFile) ? fs.readFileSync(destFile, 'utf8') : null;
      if (cur !== o.content) {
        hadDrift = true;
        console.error(`[generate-adapters] Lệch tại ${o.to} (nguồn: core/commands)`);
      }
    } else {
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.writeFileSync(destFile, o.content);
    }
  }
  if (!CHECK_ONLY) console.log(`[generate-adapters] core/commands -> .claude/commands/fe + .codex/prompts (${files.length} lệnh)`);
}

/**
 * Command files sinh từ core/commands/ cho từng adapter.
 * - Claude (.claude/commands/fe/): giữ nguyên (nguồn đã có frontmatter description).
 * - Codex (.codex/prompts/): bỏ frontmatter, thay bằng heading `# FE <cmd>`.
 * Tên file Codex khác tên Claude ở 2 chỗ (lịch sử): cook→build, figma→figma-extract.
 */
const COMMAND_CODEX_NAME = { 'cook.md': 'build.md', 'figma.md': 'figma-extract.md' };

function generateCommands() {
  const srcDir = path.join(CORE, 'commands');
  if (!fs.existsSync(srcDir)) {
    hadDrift = true;
    console.error('[generate-adapters] Thiếu core/commands');
    return;
  }
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.md'));

  const outputs = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(srcDir, f), 'utf8');
    outputs.push({ to: path.join('.claude/commands/fe', f), content: raw });

    const cmdName = f.replace(/\.md$/, '');
    const fm = raw.match(/^---\n[\s\S]*?\n---\n\n?/);
    const body = fm ? raw.slice(fm[0].length) : raw;
    const codexFile = COMMAND_CODEX_NAME[f] || f;
    const codexCmd = codexFile.replace(/\.md$/, '').replace('figma-extract', 'figma');
    outputs.push({ to: path.join('.codex/prompts', codexFile), content: `# FE ${codexCmd}\n\n${body}` });

    // Plugin: commands/ trong plugin CHỈ nhận file .md phẳng — thư mục con bị
    // Claude Code hiểu là skill (phải có SKILL.md) và bị bỏ qua. Vì vậy plugin
    // dùng file phẳng prefix fe- => slash command /frontend-delivery:fe-<cmd>.
    outputs.push({ to: path.join(PLUGIN_ROOT, 'commands', `fe-${f}`), content: raw });
  }

  for (const o of outputs) {
    const destFile = path.join(ROOT, o.to);
    if (CHECK_ONLY) {
      const cur = fs.existsSync(destFile) ? fs.readFileSync(destFile, 'utf8') : null;
      if (cur !== o.content) {
        hadDrift = true;
        console.error(`[generate-adapters] Lệch tại ${o.to} (nguồn: core/commands)`);
      }
    } else {
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.writeFileSync(destFile, o.content);
    }
  }
  if (!CHECK_ONLY) console.log(`[generate-adapters] core/commands -> .claude/commands/fe + .codex/prompts (${files.length} lệnh)`);
}

function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

function filesEqual(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  return fs.readFileSync(a).equals(fs.readFileSync(b));
}

function diffDirs(srcDir, destDir) {
  const srcFiles = listFilesRecursive(srcDir).map((p) => path.relative(srcDir, p));
  const destFiles = listFilesRecursive(destDir).map((p) => path.relative(destDir, p));
  const drift = [];
  for (const rel of srcFiles) {
    const s = path.join(srcDir, rel);
    const d = path.join(destDir, rel);
    if (!fs.existsSync(d)) drift.push(`THIẾU: ${rel} (có ở core, chưa generate ở đích)`);
    else if (!filesEqual(s, d)) drift.push(`LỆCH NỘI DUNG: ${rel}`);
  }
  for (const rel of destFiles) {
    if (!srcFiles.includes(rel)) drift.push(`THỪA: ${rel} (không có trong core, có thể bị sửa tay)`);
  }
  return drift;
}

function copyDir(srcDir, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
}

let hadDrift = false;

for (const t of TARGETS) {
  const srcDir = path.join(CORE, t.from);
  const destDir = path.join(ROOT, t.to);

  if (!fs.existsSync(srcDir)) {
    console.error(`[generate-adapters] Thiếu core/${t.from}, bỏ qua đích ${t.to}`);
    hadDrift = true;
    continue;
  }

  if (CHECK_ONLY) {
    const drift = diffDirs(srcDir, destDir);
    if (drift.length) {
      hadDrift = true;
      console.error(`\n[generate-adapters] Lệch tại ${t.to} (nguồn: core/${t.from}):`);
      for (const d of drift) console.error('  - ' + d);
    }
  } else {
    copyDir(srcDir, destDir);
    console.log(`[generate-adapters] core/${t.from} -> ${t.to}`);
  }
}

async function bundleScripts() {
  const entries = SCRIPT_ENTRIES.map((f) => path.join(CORE, 'scripts', f));
  const missing = entries.filter((e) => !fs.existsSync(e));
  if (missing.length) {
    hadDrift = true;
    console.error('[generate-adapters] Thiếu core/scripts: ' + missing.join(', '));
    return;
  }

  for (const destRel of SCRIPT_TARGET_DIRS) {
    const destDir = path.join(ROOT, destRel);

    if (CHECK_ONLY) {
      // check mode: bundle vào thư mục tạm rồi so sánh nội dung, không ghi đè đích thật
      const tmpDir = fs.mkdtempSync(path.join(ROOT, '.tmp-bundle-check-'));
      try {
        await esbuild.build({
          entryPoints: entries,
          outdir: tmpDir,
          bundle: true,
          splitting: true,
          platform: 'node',
          format: 'esm',
          target: 'node18',
          outExtension: { '.js': '.mjs' },
          chunkNames: 'chunks/[name]-[hash]',
          banner: {
            js: "import { createRequire as __fdkCreateRequire } from 'node:module';\nconst require = __fdkCreateRequire(import.meta.url);",
          },
          logLevel: 'silent',
        });
        const drift = diffDirs(tmpDir, destDir).filter((d) => !d.startsWith('THỪA: README.md'));
        if (drift.length) {
          hadDrift = true;
          console.error(`\n[generate-adapters] Lệch tại ${destRel} (bundle từ core/scripts):`);
          for (const d of drift) console.error('  - ' + d);
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } else {
      fs.rmSync(destDir, { recursive: true, force: true });
      fs.mkdirSync(destDir, { recursive: true });
      await esbuild.build({
        entryPoints: entries,
        outdir: destDir,
        bundle: true,
        splitting: true,
        platform: 'node',
        format: 'esm',
        target: 'node18',
        outExtension: { '.js': '.mjs' },
        chunkNames: 'chunks/[name]-[hash]',
        banner: {
          // gray-matter (CJS) gọi require('fs') tĩnh; ở output ESM không có
          // `require` sẵn trong scope, nên esbuild rơi vào nhánh lỗi
          // "Dynamic require ... not supported". Tạo require thật bằng
          // node:module để shim của esbuild dùng được.
          js: "import { createRequire as __fdkCreateRequire } from 'node:module';\nconst require = __fdkCreateRequire(import.meta.url);",
        },
      });
      const readmeSrc = path.join(CORE, 'scripts', 'README.md');
      if (fs.existsSync(readmeSrc)) fs.copyFileSync(readmeSrc, path.join(destDir, 'README.md'));
      console.log(`[generate-adapters] core/scripts (bundled) -> ${destRel}`);
    }
  }
}

await bundleScripts();

/**
 * MCP server được bundle thành 1 file standalone đặt trong plugin.
 * Plugin bị copy vào cache của Claude Code nên không có node_modules —
 * mọi dependency (MCP SDK, zod, gray-matter) phải nằm trong bundle.
 */
async function bundleMcpServer() {
  const entry = path.join(CORE, 'mcp', 'server.mjs');
  const outfile = path.join(ROOT, PLUGIN_ROOT, 'mcp', 'fe-kit-mcp.mjs');
  if (!fs.existsSync(entry)) {
    hadDrift = true;
    console.error('[generate-adapters] Thiếu core/mcp/server.mjs');
    return;
  }

  const prev = fs.existsSync(outfile) ? fs.readFileSync(outfile, 'utf8') : null;
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    write: false,
    // gray-matter là CJS và dùng `require` — shim để chạy được trong ESM bundle.
    banner: { js: "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);" },
  });
  const next = result.outputFiles[0].text;

  if (CHECK_ONLY) {
    if (prev !== next) {
      hadDrift = true;
      console.error(`[generate-adapters] Lệch tại ${PLUGIN_ROOT}/mcp/fe-kit-mcp.mjs (nguồn: core/mcp/server.mjs)`);
    }
  } else {
    fs.mkdirSync(path.dirname(outfile), { recursive: true });
    fs.writeFileSync(outfile, next);
    console.log(`[generate-adapters] core/mcp -> ${PLUGIN_ROOT}/mcp/fe-kit-mcp.mjs`);
  }
}

await bundleMcpServer();

generateCommands();

// --- Plugin Claude Code: copy commands/agents/rules/templates vào trong plugin ---
for (const t of PLUGIN_COPY_TARGETS) {
  const srcDir = t.fromCore ? path.join(CORE, t.fromCore) : path.join(ROOT, t.fromRepo);
  const destDir = path.join(ROOT, t.to);
  const label = t.fromCore ? `core/${t.fromCore}` : t.fromRepo;

  if (!fs.existsSync(srcDir)) {
    hadDrift = true;
    console.error(`[generate-adapters] Thiếu nguồn ${label}`);
    continue;
  }

  if (CHECK_ONLY) {
    const drift = diffDirs(srcDir, destDir);
    if (drift.length) {
      hadDrift = true;
      console.error(`\n[generate-adapters] Lệch tại ${t.to} (nguồn: ${label}):`);
      for (const d of drift) console.error('  - ' + d);
    }
  } else {
    copyDir(srcDir, destDir);
    console.log(`[generate-adapters] ${label} -> ${t.to}`);
  }
}

for (const t of SINGLE_FILE_TARGETS) {
  const srcFile = path.join(CORE, t.from);
  const destFile = path.join(ROOT, t.to);
  if (!fs.existsSync(srcFile)) {
    hadDrift = true;
    console.error(`[generate-adapters] Thiếu core/${t.from}`);
    continue;
  }
  if (CHECK_ONLY) {
    if (!filesEqual(srcFile, destFile)) {
      hadDrift = true;
      console.error(`[generate-adapters] Lệch tại ${t.to} (nguồn: core/${t.from})`);
    }
  } else {
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
    console.log(`[generate-adapters] core/${t.from} -> ${t.to}`);
  }
}

if (CHECK_ONLY) {
  if (hadDrift) {
    console.error(
      '\n[generate-adapters] Có lệch giữa core/ và các đích generate. Chạy `npm run build` rồi commit lại, hoặc nếu đã sửa tay ở đích thì đưa thay đổi đó vào core/ trước.'
    );
    process.exit(1);
  }
  console.log('[generate-adapters] Không có lệch. core/ và các đích đã đồng bộ.');
} else {
  console.log('[generate-adapters] Hoàn tất. Không sửa tay các thư mục đích ở trên — sửa trong core/ rồi chạy lại script này.');
}
