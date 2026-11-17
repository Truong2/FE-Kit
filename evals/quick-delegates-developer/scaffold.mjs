// Task nhỏ đã phân loại low, chưa có Figma: quick được chạy và phải giao cho developer.
import { scaffoldTask, writeFile, setStatus, commit, ORDER_CANCEL_BUTTON } from '../scaffold-lib.mjs';

const task = scaffoldTask('task-ready-to-cook', 'FE-80-label', { withSource: true });
writeFile(`${task}/task.md`, `# Đổi nhãn nút huỷ đơn

## Yêu cầu gốc

PO yêu cầu đổi nhãn nút "Huỷ đơn" thành "Huỷ đơn hàng" trong \`${ORDER_CANCEL_BUTTON}\`. Không đổi hành vi.
`);
setStatus(task, {
  current_mode: 'planning-mode',
  task_type: 'chore',
  risk_level: 'low',
  figma_required: 'false',
  next_mode: 'quick',
  next_prompt: `"FE quick ${task}"`,
});
commit('task classified low');
