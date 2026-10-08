import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkflowStatusSchema, DEPRECATED_FIELDS } from '../src/schema.mjs';
import { parseWorkflowStatus } from '../src/parse.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureStatus = fs.readFileSync(path.join(__dirname, 'fixtures', 'task-ready-to-cook', 'tracking', 'workflow-status.md'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'core', 'templates', 'tracking', 'workflow-status.md'), 'utf8');

const dropFields = (text, fields) => fields.reduce((t, f) => t.replace(new RegExp(`^${f}:.*\\r?\\n`, 'm'), ''), text);

describe('DEPRECATED_FIELDS', () => {
  it('mọi field deprecated đều có trong schema và trong template', () => {
    const shape = WorkflowStatusSchema.shape;
    for (const { field, reason } of DEPRECATED_FIELDS) {
      expect(shape[field], field).toBeDefined();
      expect(template, field).toMatch(new RegExp(`^${field}:`, 'm'));
      expect(reason.length).toBeGreaterThan(10);
    }
  });

  it('task bỏ hết field deprecated (và Medium/Low) vẫn qua schema', () => {
    const fields = [...DEPRECATED_FIELDS.map((d) => d.field), 'medium_issues_open', 'low_issues_open'];
    const stripped = dropFields(fixtureStatus, fields);
    for (const f of fields) expect(stripped).not.toMatch(new RegExp(`^${f}:`, 'm'));
    expect(parseWorkflowStatus(stripped).ok).toBe(true);
  });

  it('task tạo từ template cũ (đủ field) vẫn qua schema', () => {
    expect(parseWorkflowStatus(fixtureStatus).ok).toBe(true);
  });

  it('review_bug_status nhận các giá trị template/standard gợi ý', () => {
    for (const v of ['resolved', 'fixed', 'waived']) {
      const text = fixtureStatus.replace(/^review_bug_status:.*$/m, 'review_bug_status: ' + v);
      expect(parseWorkflowStatus(text).ok, v).toBe(true);
    }
    const bad = fixtureStatus.replace(/^review_bug_status:.*$/m, 'review_bug_status: done');
    expect(parseWorkflowStatus(bad).ok).toBe(false);
  });
});
