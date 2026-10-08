/**
 * Golden test cho bước tách engine/pack: output của validators, hook, MCP và
 * CLI phải giống hệt `tests/golden/golden.json` (xem `tests/golden/capture.mjs`).
 *
 * Cố ý đổi hành vi thì chạy lại `node tests/golden/capture.mjs` trong cùng PR
 * và giải thích phần lệch trong CHANGELOG.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { captureAll, GOLDEN_FILE } from './golden/capture.mjs';

const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
let current;

beforeAll(async () => {
  current = await captureAll();
}, 180_000);

describe.each(Object.keys(golden))('golden %s', (section) => {
  it('có đúng các trường hợp đã chụp', () => {
    expect(Object.keys(current[section]).sort()).toEqual(Object.keys(golden[section]).sort());
  });

  it.each(Object.keys(golden[section]))('%s', (key) => {
    if (section === 'validators' && key === 'exports') {
      // API công khai chỉ được thêm, không được mất export.
      expect(current[section][key]).toEqual(expect.arrayContaining(golden[section][key]));
      return;
    }
    expect(current[section][key]).toEqual(golden[section][key]);
  });
});
