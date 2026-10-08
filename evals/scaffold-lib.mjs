/**
 * Hàm dựng workspace cho các case eval. Mỗi case có `scaffold.sh` (runner chỉ
 * chạy bash) gọi `node scaffold.mjs`, và `scaffold.mjs` dùng các hàm ở đây.
 * Viết bằng Node thay cho bash + GNU `sed -i` để chạy được trên Windows/macOS
 * và để `tests/evals.test.mjs` dựng lại đúng workspace mà không tốn API.
 *
 * Mọi path tương đối tính từ cwd, tức workspace mà `claude plugin eval --scaffold`
 * cấp. Chỉ dùng module có sẵn của Node: scaffold chạy với môi trường tối thiểu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// `evals/run.mjs` chép evals vào bản sao tạm của plugin, kèm fixture ở `evals/fixtures`;
// chạy ngay trong repo (test tự kiểm) thì đọc fixture của validators.
const FIXTURES = [path.join(HERE, 'fixtures'), path.join(HERE, '..', 'packages', 'validators', 'test', 'fixtures')].find((p) =>
  fs.existsSync(p),
);

export const TASKS_ROOT = 'docs/frontend-tasks';

/** Source có sẵn của các case `with-source`: nút huỷ đơn chưa có xác nhận và chưa xử lý lỗi 409. */
export const ORDER_CANCEL_BUTTON = 'src/components/OrderCancelButton.tsx';
const ORDER_CANCEL_BUTTON_SOURCE = `export function OrderCancelButton({ onCancel }: { onCancel: () => void }) {
  return <button onClick={onCancel}>Huỷ đơn</button>;
}
`;

function writeFile(rel, content) {
  fs.mkdirSync(path.dirname(path.resolve(rel)), { recursive: true });
  fs.writeFileSync(rel, content);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function markdownFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) markdownFiles(p, out);
    else if (ent.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function git(...args) {
  const r = spawnSync('git', ['-c', 'user.email=eval@example.com', '-c', 'user.name=eval', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} thất bại (exit ${r.status})`);
}

/**
 * `git add -A` rồi commit mọi thay đổi trong workspace. Không có gì thay đổi
 * thì bỏ qua: bản bash cũ dừng ở đây (`set -e`) khi fixture đã đúng trạng thái.
 */
export function commit(message) {
  git('add', '-A');
  const staged = spawnSync('git', ['diff', '--cached', '--quiet']);
  if (staged.status === 0) return;
  git('commit', '-qm', message);
}

/**
 * Dựng task folder từ fixture của packages/validators rồi `git init` + commit.
 * @param {string} fixture `task-ready-to-cook` hoặc `task-blocked-question`
 * @param {string} name tên task, vd `FE-20-cancel`
 * @param {{ withSource?: boolean }} [opts] thêm `src/components/OrderCancelButton.tsx`
 * @returns {string} path tương đối của task folder
 */
export function scaffoldTask(fixture, name, { withSource = false } = {}) {
  const task = `${TASKS_ROOT}/${name}`;
  copyDir(path.join(FIXTURES, fixture), task);
  // Fixture mang task id riêng (FE-99x-...): đổi sang tên task của case.
  for (const file of markdownFiles(task)) {
    const text = fs.readFileSync(file, 'utf8')
      .replace(/docs\/frontend-tasks\/FE-99[0-9]-[A-Za-z0-9-]+/g, task)
      .replace(/^task_id:.*$/m, `task_id: ${name}`);
    fs.writeFileSync(file, text);
  }
  writeFile(`${task}/output/figma-reference-screenshots/.gitkeep`, '');
  if (withSource) writeFile(ORDER_CANCEL_BUTTON, ORDER_CANCEL_BUTTON_SOURCE);

  git('init', '-q');
  commit('scaffold');
  return task;
}

/**
 * Ghi nội dung thật cho task "nút huỷ đơn" (fixture chỉ có placeholder):
 * task.md, implementation-plan (có bảng "File sẽ tạo / cập nhật"), build-checklist.
 * Không commit.
 */
export function writeCancelOrderTask(task) {
  writeFile(`${task}/task.md`, `# Nút huỷ đơn hàng

## Yêu cầu (SRS 3.2)

- Trang chi tiết đơn có nút "Huỷ đơn" khi đơn ở trạng thái \`PENDING\`.
- Bấm nút thì hiện hộp thoại xác nhận; chỉ khi người dùng xác nhận mới gọi \`POST /orders/{id}/cancel\`.
- API trả \`409 ORDER_ALREADY_SHIPPED\` thì hiện thông báo lỗi inline dưới nút: "Đơn đã giao cho đơn vị vận chuyển, không thể huỷ".
`);

  writeFile(`${task}/planning/implementation-plan.md`, `# Kế hoạch triển khai

## 1. Tóm tắt phạm vi

Thêm nút huỷ đơn có hộp thoại xác nhận và xử lý lỗi \`409 ORDER_ALREADY_SHIPPED\` theo SRS 3.2.

## 3. Ma trận trace SRS → FE logic → UI → Test

| SRS | FE logic | UI | Test |
|---|---|---|---|
| 3.2 xác nhận trước khi huỷ | \`onCancel\` chỉ gọi API sau khi xác nhận | Hộp thoại xác nhận | Unit test component |
| 3.2 lỗi 409 | Map \`ORDER_ALREADY_SHIPPED\` sang thông báo inline | Text lỗi dưới nút | Unit test component |

## 7. File sẽ tạo / cập nhật

| File | Hành động | Lý do | Checklist ref |
|---|---|---|---|
| \`${ORDER_CANCEL_BUTTON}\` | Tạo / cập nhật | Nút huỷ, hộp thoại xác nhận, lỗi inline | IMP-01 |

## 8. Scope diff guard

| Quy tắc | Quyết định |
|---|---|
| File ngoài bảng trên có được sửa không? | Không, trừ khi update plan/input-sync trước |
`);

  writeFile(`${task}/planning/build-checklist.md`, `# Build checklist

| ID | Nội dung | Trạng thái | Evidence |
|---|---|---|---|
| IMP-01 | \`OrderCancelButton\` hỏi xác nhận trước khi gọi API, hiện lỗi 409 inline | Chưa làm |  |
`);
}

/**
 * Thay giá trị các key frontmatter của workflow-status.md (thay cho `sed -i` của bản bash cũ).
 * Giá trị ghi nguyên văn: cần dấu ngoặc kép thì truyền cả dấu ngoặc kép.
 * Key không có trong file thì bỏ qua, giống sed.
 */
export function setStatus(task, values) {
  const file = `${task}/tracking/workflow-status.md`;
  let text = fs.readFileSync(file, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    text = text.replace(new RegExp(`^${key}:.*$`, 'm'), () => `${key}: ${value}`);
  }
  fs.writeFileSync(file, text);
}

export { writeFile };
