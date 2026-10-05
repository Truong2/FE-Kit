/**
 * Đo phần rule mà `fe_begin_mode` trả nguyên văn cho mỗi mode (số ký tự, task
 * có Figma — trường hợp lớn nhất). Trần = số đo lúc đặt (v2.1.0) + ~15%.
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

// Số đo khi đặt trần (v2.1.0): plan 7987, quick 8665, input-sync 7411, figma 7344,
// figma-review 8664, cook 9985, bugfix 9372, review 10692, test 8088, pr 9371.
const BUDGET = {
  plan: 9200,
  quick: 10000,
  'input-sync': 8600,
  figma: 8500,
  'figma-review': 10000,
  cook: 11500,
  bugfix: 10800,
  review: 12300,
  test: 9300,
  pr: 10800,
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
