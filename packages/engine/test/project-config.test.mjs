import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadProjectConfig } from '../src/project-config.mjs';

function repoWith(yaml) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-config-'));
  if (yaml !== undefined) {
    fs.mkdirSync(path.join(dir, '.cfg'));
    fs.writeFileSync(path.join(dir, '.cfg', 'standard.yaml'), yaml);
  }
  return dir;
}
const load = (dir) => loadProjectConfig(dir, { file: '.cfg/standard.yaml' });

describe('auto_advance', () => {
  it('mặc định bật khi không có file hoặc không khai key', () => {
    expect(load(repoWith()).config.auto_advance).toBe(true);
    expect(load(repoWith('source_paths:\n  - src/\n')).config.auto_advance).toBe(true);
  });

  it('(pass) team tắt được bằng auto_advance: false', () => {
    const res = load(repoWith('auto_advance: false\n'));
    expect(res.config.auto_advance).toBe(false);
    expect(res.warnings).toEqual([]);
  });

  it('(fail) giá trị không phải boolean: cảnh báo và dùng mặc định', () => {
    const res = load(repoWith('auto_advance: "có"\n'));
    expect(res.config.auto_advance).toBe(true);
    expect(res.warnings[0]).toMatch(/auto_advance không hợp lệ/);
  });
});
