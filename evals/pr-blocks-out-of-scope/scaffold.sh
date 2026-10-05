#!/usr/bin/env bash
# Task đã review + test đạt, nhưng working tree có thêm file NGOÀI plan (src/store/global.ts).
set -euo pipefail
HERE="$(dirname "${BASH_SOURCE[0]}")"
bash "$HERE/../scaffold-task.sh" task-ready-to-cook FE-80-cancel with-source
TASK=docs/frontend-tasks/FE-80-cancel
bash "$HERE/../cancel-order-task.sh" "$TASK"
mkdir -p "$TASK/output"
echo "# Báo cáo review" > "$TASK/output/review-report.md"
cat > "$TASK/output/test-summary.md" <<'EOF'
# Báo cáo test

## 1. Command evidence log

| Command | Đã chạy thật? | Kết quả | Thời điểm | Ghi chú |
|---|---|---|---|---|
| `npm test` | Có | Passed | 2026-10-05 10:00 |  |
EOF
sed -i -e 's/^current_mode:.*/current_mode: testing-mode/' -e 's/^next_mode:.*/next_mode: pr/' \
  -e 's/^review_status:.*/review_status: passed/' \
  -e "s|^next_prompt:.*|next_prompt: \"FE pr $TASK\"|" "$TASK/tracking/workflow-status.md"
git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "test done"
# Thay đổi ngoài plan, chưa commit: release manager phải phát hiện qua fe_scope_diff.
mkdir -p src/store
echo "export const globalFlag = true;" > src/store/global.ts