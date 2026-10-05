#!/usr/bin/env bash
# Task đã review xong, chờ FE test. Case không cấp Bash nên tester KHÔNG chạy được lệnh nào.
set -euo pipefail
HERE="$(dirname "${BASH_SOURCE[0]}")"
bash "$HERE/../scaffold-task.sh" task-ready-to-cook FE-50-cancel with-source
TASK=docs/frontend-tasks/FE-50-cancel
bash "$HERE/../cancel-order-task.sh" "$TASK"
cat > package.json <<'EOF'
{ "name": "eval-app", "private": true, "scripts": { "test": "vitest run", "lint": "eslint src", "typecheck": "tsc --noEmit" } }
EOF
mkdir -p "$TASK/output" && echo "# Báo cáo review" > "$TASK/output/review-report.md"
sed -i -e 's/^current_mode:.*/current_mode: review-mode/' -e 's/^next_mode:.*/next_mode: test/' \
  -e 's/^review_status:.*/review_status: passed/' \
  -e 's/^command_evidence_status:.*/command_evidence_status: not_started/' \
  -e 's/^test_command_log_status:.*/test_command_log_status: not_started/' \
  -e "s|^next_prompt:.*|next_prompt: \"FE test $TASK\"|" "$TASK/tracking/workflow-status.md"
git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "review done"