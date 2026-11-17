/**
 * Team agent của plugin `fe`: model theo vai, agent điều phối chạy làm main
 * thread, agent research không chạy mode. Đọc output đã build (plugins/fe/agents).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { fePack } from '../packages/pack-fe/src/pack.mjs';
import manifest from '../packages/pack-fe/src/manifest.gen.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS_DIR = path.join(ROOT, 'plugins', 'fe', 'agents');
const PROTOCOL_HEADING = '## Giao thức bắt buộc của mọi agent FE';

/** Vai → model đã chốt cho team. Đổi model thì sửa cả bảng này và README. */
const TEAM = {
  'frontend-orchestrator': 'opus',
  'frontend-planner': 'opus',
  'frontend-developer': 'sonnet',
  'frontend-reviewer': 'opus',
  'frontend-tester': 'haiku',
  'frontend-researcher': 'haiku',
  'frontend-figma-specialist': 'sonnet',
  'frontend-release-manager': 'haiku',
  'frontend-retro-analyst': 'opus',
};

const agents = Object.fromEntries(
  fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const parsed = matter(fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8'));
      return [path.basename(f, '.md'), parsed];
    })
);

describe('team agent của plugin fe', () => {
  it('đủ agent của team, không thừa agent ngoài bảng', () => {
    expect(Object.keys(agents).sort()).toEqual(Object.keys(TEAM).sort());
  });

  it('mỗi agent có model đúng vai', () => {
    for (const [name, model] of Object.entries(TEAM)) {
      expect(agents[name].data.model, name).toBe(model);
      expect(agents[name].data.name, name).toBe(name);
    }
  });

  it('chỉ agent đảm nhận mode mới nhận giao thức mode', () => {
    const modeAgents = new Set(Object.values(manifest.modes).map((m) => m.agent).filter(Boolean));
    for (const [name, parsed] of Object.entries(agents)) {
      expect(parsed.content.includes(PROTOCOL_HEADING), name).toBe(modeAgents.has(name));
    }
  });

  it('agent điều phối là main thread của pack, không phải agent của mode nào', () => {
    expect(fePack.mainThreadAgent).toBe('frontend-orchestrator');
    expect(Object.values(manifest.modes).some((m) => m.agent === fePack.mainThreadAgent)).toBe(false);
    expect(agents[fePack.mainThreadAgent].data.disallowedTools).toBeUndefined();
  });

  it('agent research chỉ đọc: không Bash/PowerShell/Agent, không chạy mode', () => {
    const disallowed = String(agents['frontend-researcher'].data.disallowedTools);
    for (const tool of ['Bash', 'PowerShell', 'Agent']) expect(disallowed).toContain(tool);
    expect(agents['frontend-researcher'].content).not.toContain('Tiếp theo: <next_prompt>');
  });

  it('quick giao cho developer; input-sync delegate kèm model sonnet', () => {
    expect(manifest.modes.quick.agent).toBe('frontend-developer');
    const read = (f) => fs.readFileSync(path.join(ROOT, 'plugins', 'fe', 'commands', f), 'utf8');
    expect(read('quick.md')).toContain('`fe:frontend-developer`');
    expect(read('input-sync.md')).toMatch(/fe:frontend-planner` bằng Agent tool với tham số `model: "sonnet"`/);
    expect(read('plan.md')).not.toMatch(/model: "/);
    for (const [cmd, mode] of Object.entries(manifest.modes)) {
      if (mode.model) expect(['opus', 'sonnet', 'haiku', 'fable', 'inherit'], cmd).toContain(mode.model);
    }
  });

  it('agent điều phối chạy vòng /fe:next, không còn dặn dừng sau mỗi bước', () => {
    const body = agents['frontend-orchestrator'].content;
    expect(body).toContain('fe:next');
    expect(body).toContain('CẦN BẠN XỬ LÝ');
    expect(body).not.toMatch(/Không tự chuyển sang mode kế tiếp khi chưa được yêu cầu/);
  });

  const GUARD = 'Chỉ dùng khi người dùng gọi lệnh /fe:*';

  it('kit chỉ chạy khi người dùng gọi: skill và subagent không tự kích hoạt', () => {
    const skill = matter(fs.readFileSync(path.join(ROOT, 'plugins', 'fe', 'skills', 'frontend-delivery-standard', 'SKILL.md'), 'utf8')).data;
    // disable-model-invocation chặn cả preload vào subagent, nên giới hạn bằng description.
    expect(skill['disable-model-invocation']).toBeUndefined();
    expect(skill.description).toContain(GUARD);
    for (const [name, parsed] of Object.entries(agents)) {
      expect(parsed.data.description, name).not.toMatch(/proactively|chủ động/i);
      if (name !== 'frontend-orchestrator') expect(parsed.data.description, name).toContain(GUARD);
    }
  });
});
