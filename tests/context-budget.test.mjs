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
