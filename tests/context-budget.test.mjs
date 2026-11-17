/**
 * Đo phần rule mà `fe_begin_mode` trả nguyên văn cho mỗi mode (số ký tự, task
 * có Figma — trường hợp lớn nhất). Trần = số đo lúc đặt (v2.3.0) + ~15%.
 *
 * Test này không nhằm cắt rule: nó chặn rule phình lên mà không ai để ý. Khi
 * cố ý thêm rule, đo lại và nâng trần trong cùng PR, ghi lý do trong CHANGELOG.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulesForMode, COMMANDS } from '../packages/validators/src/index.mjs';

const RULES = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'core', 'rules');

// Số đo khi đặt trần (v2.3.0, thêm untrusted-input-contract.md cho mọi mode): plan 8855,
// quick 9543, input-sync 8272, figma 8204, figma-review 9524, cook 10863, bugfix 10665,
// review 11985, test 8941, pr 10646. (v2.1.0: plan 7987 … review 10692.)
const BUDGET = {
  plan: 10200,
  quick: 11000,
  'input-sync': 9600,
  figma: 9500,
  'figma-review': 11000,
  cook: 12500,
  bugfix: 12300,
  review: 13800,
  test: 10300,
  pr: 12300,
};

/** Kích thước payload rule giống cách `fe_begin_mode` ghép: `--- file ---` + nội dung. */
function payloadSize(command) {
  return rulesForMode(command, { figmaRequired: true })
    .map((file) => `--- ${file} ---\n${fs.readFileSync(path.join(RULES, file), 'utf8').trim()}`.length)
    .reduce((a, b) => a + b, 0);
}

describe('ngân sách context rule theo mode', () => {
  it('mọi mode đều có trần', () => {
    expect(Object.keys(BUDGET).sort()).toEqual([...COMMANDS].sort());
  });

  for (const command of COMMANDS) {
    it(`FE ${command} không vượt trần`, () => {
      expect(payloadSize(command)).toBeLessThanOrEqual(BUDGET[command]);
    });
  }
});

// Phần main thread và mọi subagent nạp cố định (đo trên output đã build, v2.8.0).
// Command có subagent chỉ còn đoạn điều phối (~1,4k ký tự; trước đó tới 6,3k);
// SKILL.md của plugin bỏ khối full-only (~2,5k; bản đầy đủ ~7,9k chỉ cho ChatGPT).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = path.join(ROOT, 'plugins', 'fe');
const DELEGATED_COMMAND_MAX = 1600;
const PLUGIN_SKILL_MAX = 2700;

describe('ngân sách context cố định của plugin', () => {
  const commands = fs.readdirSync(path.join(PLUGIN, 'commands'));

  for (const file of commands) {
    const text = fs.readFileSync(path.join(PLUGIN, 'commands', file), 'utf8');
    if (!text.includes('## Điều phối (Claude Code)') || file === 'retro.md') continue;
    it(`command ${file} chỉ còn đoạn điều phối (≤ ${DELEGATED_COMMAND_MAX} ký tự)`, () => {
      expect(text).not.toMatch(/## Hướng dẫn mode/);
      expect(text.length).toBeLessThanOrEqual(DELEGATED_COMMAND_MAX);
    });
  }

  it(`SKILL.md của plugin gọn (≤ ${PLUGIN_SKILL_MAX} ký tự), bản ChatGPT vẫn đủ mục`, () => {
    const plugin = fs.readFileSync(path.join(PLUGIN, 'skills', 'frontend-delivery-standard', 'SKILL.md'), 'utf8');
    const chatgpt = fs.readFileSync(path.join(ROOT, 'chatgpt-skill', 'frontend-delivery-standard', 'SKILL.md'), 'utf8');
    expect(plugin.length).toBeLessThanOrEqual(PLUGIN_SKILL_MAX);
    expect(plugin).toMatch(/## Ai được sửa source/);
    for (const heading of ['## Bắt đầu và kết thúc một mode', '## Rule loading theo mode', '## Mode output bắt buộc', '## Validation']) {
      expect(plugin).not.toContain(heading);
      expect(chatgpt).toContain(heading);
    }
    expect(plugin + chatgpt).not.toMatch(/full-only/);
  });
});
