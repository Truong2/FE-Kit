import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { parsePlannedFiles, computeScopeDiff } from '../src/scope.mjs';
import { resolveTaskDir, isPathInside, relativePosix } from '../src/resolve.mjs';

const PLAN = `# Kế hoạch triển khai

## 6. Quyết định UI/Figma

Không áp dụng.

## 7. File sẽ tạo / cập nhật

| File | Hành động | Lý do | Checklist ref |
|---|---|---|---|
| \`src/features/login/LoginForm.tsx\` | Tạo | Form | C1 |
| \`src/features/login/hooks/\` | Tạo | Hook | C2 |
| src/api/**/*.ts | Cập nhật | Client | C3 |
| \`src/i18n/vi.json\`, \`src/i18n/en.json\` | Cập nhật | Chuỗi | C4 |
|  |  |  |  |

## 8. Scope diff guard

| Quy tắc | Quyết định |
|---|---|
| \`src/should-not-count.ts\` | nằm ngoài mục 7 |
`;

describe('parsePlannedFiles', () => {
  it('chỉ đọc bảng ở mục File sẽ tạo / cập nhật, bỏ header và dòng trống', () => {
    expect(parsePlannedFiles(PLAN)).toEqual([
      'src/features/login/LoginForm.tsx',
      'src/features/login/hooks/',
      'src/api/**/*.ts',
      'src/i18n/vi.json',
      'src/i18n/en.json',
    ]);
  });

  it('trả mảng rỗng khi plan chưa có mục này hoặc còn nguyên template', () => {
    expect(parsePlannedFiles('# Plan')).toEqual([]);
    expect(parsePlannedFiles('## 7. File sẽ tạo / cập nhật\n\n| File | Hành động |\n|---|---|\n|  |  |\n')).toEqual([]);
  });

  it('lấy path đầu ô khi agent viết kèm chú thích, bỏ ô không phải path', () => {
    const plan = [
      '## 7. File sẽ tạo / cập nhật',
      '',
      '| File | Hành động |',
      '|---|---|',
      '| src/services/auth.ts hoặc tương đương | Tạo |',
      '| Chưa xác định | Tạo |',
      '',
    ].join('\n');
    expect(parsePlannedFiles(plan)).toEqual(['src/services/auth.ts']);
  });

  it('đọc được file CRLF', () => {
    expect(parsePlannedFiles(PLAN.replace(/\n/g, '\r\n'))).toHaveLength(5);
  });
});

describe('computeScopeDiff', () => {
  const plannedFiles = parsePlannedFiles(PLAN);

  it('khớp file chính xác, thư mục và glob', () => {
    const r = computeScopeDiff({
      plannedFiles,
      changedFiles: ['src/features/login/LoginForm.tsx', 'src/features/login/hooks/useLogin.ts', 'src/api/auth/client.ts'],
    });
    expect(r.ok).toBe(true);
    expect(r.inScope).toHaveLength(3);
  });

  it('báo file sửa ngoài plan', () => {
    const r = computeScopeDiff({ plannedFiles, changedFiles: ['src/features/login/LoginForm.tsx', 'src/store/global.ts'] });
    expect(r.ok).toBe(false);
    expect(r.outOfPlan).toEqual(['src/store/global.ts']);
  });

  it('bỏ qua artifact của task, context và lockfile', () => {
    const r = computeScopeDiff({
      plannedFiles,
      changedFiles: ['docs/frontend-tasks/FE-1/tracking/workflow-status.md', 'package-lock.json', 'apps/web/pnpm-lock.yaml'],
    });
    expect(r.ok).toBe(true);
    expect(r.ignored).toHaveLength(3);
  });

  it('chuẩn hoá path Windows và ./', () => {
    const r = computeScopeDiff({ plannedFiles, changedFiles: ['src\\features\\login\\LoginForm.tsx', './src/i18n/vi.json'] });
    expect(r.ok).toBe(true);
  });

  it('đánh dấu plannedEmpty khi plan chưa khai file', () => {
    const r = computeScopeDiff({ plannedFiles: [], changedFiles: ['src/a.ts'] });
    expect(r.plannedEmpty).toBe(true);
    expect(r.ok).toBe(false);
  });
});

describe('resolveTaskDir', () => {
  const root = path.resolve('/tmp/repo');

  it('tên trần được ghép vào docs/frontend-tasks', () => {
    expect(resolveTaskDir(root, 'FE-1')).toBe(path.join(root, 'docs', 'frontend-tasks', 'FE-1'));
  });

  it('path tương đối dạng POSIX và Windows cho cùng kết quả', () => {
    const expected = path.join(root, 'docs', 'frontend-tasks', 'FE-1');
    expect(resolveTaskDir(root, 'docs/frontend-tasks/FE-1/')).toBe(expected);
    expect(resolveTaskDir(root, 'docs\\frontend-tasks\\FE-1')).toBe(expected);
  });

  it('chặn path traversal và task rỗng', () => {
    expect(() => resolveTaskDir(root, '../../etc')).toThrow(/ngoài workspace/);
    expect(() => resolveTaskDir(root, '')).toThrow(/Thiếu task folder/);
  });

  it('isPathInside / relativePosix', () => {
    expect(isPathInside(root, path.join(root, 'src', 'a.ts'))).toBe(true);
    expect(isPathInside(root, path.resolve('/tmp/repo-other/a.ts'))).toBe(false);
    expect(relativePosix(root, path.join(root, 'src', 'a.ts'))).toBe('src/a.ts');
  });
});
