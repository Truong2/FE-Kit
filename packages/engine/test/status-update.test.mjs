import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { setFrontMatterFields, setBodySection, yamlScalar, createStatusUpdater } from '../src/status-update.mjs';

const RAW = [
  '---',
  'task_id: T-1',
  'current_mode: planning-mode  # planning-mode | review-mode',
  'next_prompt: "DOC draft x"',
  'count: 0',
  '---',
  '',
  '# Trạng thái',
  '',
  '## Bước tiếp theo',
  '',
  'DOC draft x',
  '',
  '> Ghi chú giữ nguyên.',
  '',
  '## Mục khác',
  'nội dung',
  '',
].join('\n');

describe('yamlScalar', () => {
  it('chuỗi đơn giản để trần, chuỗi có ký tự đặc biệt dùng nháy đơn', () => {
    expect(yamlScalar('review-mode')).toBe('review-mode');
    expect(yamlScalar('FE pr docs/x')).toBe("'FE pr docs/x'");
    expect(yamlScalar("it's: a")).toBe("'it''s: a'");
    expect(yamlScalar('true')).toBe("'true'");
    expect(yamlScalar(true)).toBe('true');
    expect(yamlScalar(3)).toBe('3');
  });

  it('từ chối null, object và chuỗi nhiều dòng', () => {
    expect(() => yamlScalar(null)).toThrow();
    expect(() => yamlScalar({ a: 1 })).toThrow();
    expect(() => yamlScalar('a\nb')).toThrow();
  });
});

describe('setFrontMatterFields', () => {
  it('thay value, giữ comment cuối dòng; key mới chèn trước dòng đóng', () => {
    const out = setFrontMatterFields(RAW, { current_mode: 'review-mode', count: 2, extra: 'x y' });
    expect(out).toContain('current_mode: review-mode  # planning-mode | review-mode');
    expect(out).toContain('count: 2');
    expect(out).toMatch(/extra: 'x y'\n---/);
    expect(matter(out).data).toMatchObject({ current_mode: 'review-mode', count: 2, extra: 'x y', task_id: 'T-1' });
    expect(out.split('---\n')[2]).toBe(RAW.split('---\n')[2]); // body không đổi
  });

  it('giữ CRLF và không coi `#` trong nháy là comment', () => {
    const crlf = RAW.replace(/\n/g, '\r\n').replace('next_prompt: "DOC draft x"', 'next_prompt: "a # b"  # note');
    const out = setFrontMatterFields(crlf, { next_prompt: 'c' });
    expect(out).toContain('next_prompt: c  # note\r\n');
    expect(out.includes('\n') && !/[^\r]\n/.test(out)).toBe(true);
  });

  it('file không có frontmatter thì báo lỗi', () => {
    expect(() => setFrontMatterFields('# không có', { a: 1 })).toThrow(/frontmatter/);
  });
});

describe('setBodySection', () => {
  it('thay đoạn prompt, giữ dòng ghi chú `>` và mục sau', () => {
    const out = setBodySection(RAW, 'Bước tiếp theo', 'DOC review x');
    expect(out).toMatch(/## Bước tiếp theo\n\nDOC review x\n\n> Ghi chú giữ nguyên\.\n\n## Mục khác/);
  });

  it('mục chưa có thì thêm vào cuối file', () => {
    expect(setBodySection('---\na: 1\n---\n# x\n', 'Bước tiếp theo', 'P')).toMatch(/# x\n\n## Bước tiếp theo\n\nP\n$/);
  });
});

describe('createStatusUpdater', () => {
  const pack = {
    statusFile: 'state/status.md',
    parseStatus: (raw) => {
      const data = matter(raw).data;
      return ['planning-mode', 'review-mode'].includes(data.current_mode) ? { ok: true, data } : { ok: false, errors: [`current_mode sai: ${data.current_mode}`] };
    },
    statusUpdate: { protectedFields: ['human_override'], timestampField: 'updated_at', nextPromptField: 'next_prompt', nextPromptHeading: 'Bước tiếp theo' },
  };
  const update = createStatusUpdater(pack);

  function task() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-update-'));
    fs.mkdirSync(path.join(dir, 'state'));
    fs.writeFileSync(path.join(dir, 'state', 'status.md'), RAW);
    return dir;
  }
  const read = (dir) => fs.readFileSync(path.join(dir, 'state', 'status.md'), 'utf8');

  it('(pass) ghi field, prompt ở cả frontmatter lẫn body, tự đặt timestamp', () => {
    const dir = task();
    const res = update(dir, { fields: { current_mode: 'review-mode' }, nextPrompt: 'DOC review docs\\x', now: new Date('2026-01-02T03:04:05Z') });
    expect(res).toMatchObject({ ok: true, changed: ['current_mode', 'next_prompt', 'updated_at'] });
    const out = read(dir);
    expect(matter(out).data).toMatchObject({ current_mode: 'review-mode', next_prompt: 'DOC review docs/x', updated_at: '2026-01-02T03:04:05.000Z' });
    expect(out).toMatch(/## Bước tiếp theo\n\nDOC review docs\/x\n/);
  });

  it('(fail) giá trị sai schema: không ghi, trả lỗi của parser', () => {
    const dir = task();
    const res = update(dir, { fields: { current_mode: 'bad-mode' } });
    expect(res).toEqual({ ok: false, errors: ['current_mode sai: bad-mode'] });
    expect(read(dir)).toBe(RAW);
  });

  it('(fail) field được bảo vệ, field tự ghi, tên field sai hoặc không có gì để ghi', () => {
    const dir = task();
    expect(update(dir, { fields: { human_override: true } }).errors[0]).toMatch(/human_override/);
    expect(update(dir, { fields: { updated_at: 'x' } }).errors[0]).toMatch(/tự động/);
    expect(update(dir, { fields: { next_prompt: 'x' } }).errors[0]).toMatch(/next_prompt/);
    expect(update(dir, { fields: { 'Bad-Key': 1 } }).errors[0]).toMatch(/không hợp lệ/);
    expect(update(dir, {}).errors[0]).toMatch(/Không có field/);
    expect(read(dir)).toBe(RAW);
  });
});
