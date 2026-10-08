import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendRunLog, readRunLog, codesOf, hashSession, RUNLOG_FILE, RUNLOG_MAX_BYTES } from '../src/runlog.mjs';

let task;

beforeEach(() => {
  task = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-runlog-'));
  fs.mkdirSync(path.join(task, 'tracking'));
});

afterEach(() => {
  delete process.env.FE_KIT_RUNLOG;
  fs.rmSync(task, { recursive: true, force: true });
});

describe('appendRunLog / readRunLog', () => {
  it('ghi mỗi sự kiện một dòng, tự điền v/ts/pack/task và bỏ field rỗng', () => {
    expect(appendRunLog(task, { event: 'mode_start', source: 'hook', mode: 'cook', codes: [], agent: undefined })).toBe(true);
    expect(appendRunLog(task, { event: 'mode_end', source: 'hook', mode: 'cook', outcome: 'pass', attempt: 1 })).toBe(true);

    const lines = fs.readFileSync(path.join(task, RUNLOG_FILE), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first).toMatchObject({ v: 1, pack: 'fe', task: path.basename(task), event: 'mode_start', mode: 'cook' });
    expect(first).not.toHaveProperty('codes');
    expect(first).not.toHaveProperty('agent');
    expect(Date.parse(first.ts)).not.toBeNaN();

    const { records, skipped } = readRunLog(task);
    expect(records.map((r) => r.event)).toEqual(['mode_start', 'mode_end']);
    expect(skipped).toBe(0);
  });

  it('không tạo thư mục: task chưa có tracking/ thì bỏ qua', () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-runlog-bare-'));
    expect(appendRunLog(bare, { event: 'mode_start', source: 'cli' })).toBe(false);
    expect(fs.readdirSync(bare)).toEqual([]);
    fs.rmSync(bare, { recursive: true });
  });

  it('tắt được bằng FE_KIT_RUNLOG=off', () => {
    process.env.FE_KIT_RUNLOG = 'off';
    expect(appendRunLog(task, { event: 'mode_start', source: 'cli' })).toBe(false);
    expect(fs.existsSync(path.join(task, RUNLOG_FILE))).toBe(false);
  });

  it('ngừng ghi khi file vượt ngưỡng', () => {
    fs.writeFileSync(path.join(task, RUNLOG_FILE), 'x'.repeat(RUNLOG_MAX_BYTES + 1));
    expect(appendRunLog(task, { event: 'mode_start', source: 'cli' })).toBe(false);
  });

  it('không throw khi không ghi được (run-log.jsonl là thư mục)', () => {
    fs.mkdirSync(path.join(task, RUNLOG_FILE));
    expect(() => appendRunLog(task, { event: 'mode_start', source: 'cli' })).not.toThrow();
    expect(appendRunLog(task, { event: 'mode_start', source: 'cli' })).toBe(false);
  });

  it('cắt bản ghi quá dài nhưng vẫn giữ phần nhận diện sự kiện', () => {
    const codes = Array.from({ length: 400 }, (_, i) => `CODE_${i}`);
    appendRunLog(task, { event: 'validate', source: 'cli', outcome: 'failed', codes });
    const [rec] = readRunLog(task).records;
    expect(rec.truncated).toBe(true);
    expect(rec.codes).toHaveLength(20);
    expect(rec.event).toBe('validate');
  });

  it('đọc bỏ qua dòng hỏng, version lạ hoặc sai schema', () => {
    appendRunLog(task, { event: 'mode_start', source: 'hook' });
    fs.appendFileSync(path.join(task, RUNLOG_FILE), 'không phải json\n{"v":2,"event":"mode_start"}\n{"v":1,"event":"lạ","source":"hook","ts":"t","pack":"fe","task":"x"}\n\n');
    const { records, skipped } = readRunLog(task);
    expect(records).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  it('task chưa có run-log thì trả rỗng', () => {
    expect(readRunLog(task)).toEqual({ records: [], skipped: 0 });
  });
});

describe('codesOf / hashSession', () => {
  it('lấy code từ issues của validator hoặc reasonCodes của gate vào mode, bỏ trùng', () => {
    expect(codesOf({ issues: [{ code: 'A' }, { code: 'B' }, { code: 'A' }] })).toEqual(['A', 'B']);
    expect(codesOf({ reasonCodes: ['ENTRY_NOT_BUILD_READY'] })).toEqual(['ENTRY_NOT_BUILD_READY']);
    expect(codesOf(null)).toEqual([]);
  });

  it('hash session id ổn định, không lộ nguyên văn', () => {
    expect(hashSession('abc')).toBe(hashSession('abc'));
    expect(hashSession('abc')).toMatch(/^[0-9a-f]{12}$/);
    expect(hashSession('abc')).not.toContain('abc');
    expect(hashSession('')).toBeUndefined();
  });
});
