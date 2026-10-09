import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkflowStatusSchema } from '../src/schema.mjs';
import { parseWorkflowStatus } from '../src/parse.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const template = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'core', 'templates', 'tracking', 'workflow-status.md'), 'utf8');
const fixtureStatus = fs.readFileSync(path.join(__dirname, 'fixtures', 'task-ready-to-cook', 'tracking', 'workflow-status.md'), 'utf8');

/** Giá trị enum của một field trong schema (bỏ lớp optional nếu có). */
function enumValues(field) {
  let t = WorkflowStatusSchema.shape[field];
  while (t && !t.options && typeof t.unwrap === 'function') t = t.unwrap();
  return t?.options ?? null;
}

const split = (list) => list.split('|').map((v) => v.trim()).filter(Boolean);

describe('comment giá trị hợp lệ trong template workflow-status.md', () => {
  const inline = [...template.matchAll(/^(\w+): [^#\r\n]*#\s*([^\r\n]+)$/gm)].map(([, field, list]) => ({ field, values: split(list) }));

  it('có comment cho các trường enum agent hay ghi', () => {
    expect(inline.map((x) => x.field).sort()).toEqual(
      ['current_mode', 'pr_status', 'questions_status', 'review_bug_status', 'review_status', 'ui_match_severity_status'].sort()
    );
  });

  it('mỗi comment khớp đúng enum trong schema', () => {
    for (const { field, values } of inline) expect(values, field).toEqual(enumValues(field));
  });

  it('comment chung của trường *_status dạng gate khớp GateStatus', () => {
    const block = template.match(/# Trường \*_status dạng gate \(([^)]+)\) nhận:\s*\r?\n# ([^\r\n]+)/);
    expect(block).not.toBeNull();
    const gateFields = block[1].split(',').map((f) => `${f.replace(/#/g, '').trim()}_status`);
    for (const f of gateFields) expect(enumValues(f), f).toEqual(split(block[2]));
  });
});

describe('thông báo lỗi schema', () => {
  const withValue = (field, value) => fixtureStatus.replace(new RegExp(`^${field}:.*$`, 'm'), `${field}: ${value}`);

  it('giá trị mới (needs_recheck, not_required) hợp lệ', () => {
    expect(parseWorkflowStatus(withValue('review_status', 'needs_recheck')).ok).toBe(true);
    expect(parseWorkflowStatus(withValue('review_bug_status', 'not_required')).ok).toBe(true);
    expect(parseWorkflowStatus(withValue('ui_match_severity_status', 'not_required')).ok).toBe(true);
  });

  it('giá trị lạ: nêu tên trường, giá trị đang ghi và danh sách hợp lệ', () => {
    const r = parseWorkflowStatus(withValue('review_status', 'fixed'));
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([
      'workflow-status.md frontmatter — review_status = "fixed" không hợp lệ. Giá trị hợp lệ: not_started | passed | needs_bugfix | needs_recheck | blocked | insufficient_evidence | not_required.',
    ]);
  });

  it('sai kiểu: nêu giá trị và kiểu cần', () => {
    const r = parseWorkflowStatus(withValue('critical_issues_open', '"hai"'));
    expect(r.errors).toEqual(['workflow-status.md frontmatter — critical_issues_open = "hai" sai kiểu, cần number.']);
  });
});
