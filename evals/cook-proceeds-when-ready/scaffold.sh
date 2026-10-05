#!/usr/bin/env bash
# Task sẵn sàng cook, plan khai đúng một file: đo việc gate KHÔNG chặn nhầm.
set -euo pipefail
HERE="$(dirname "${BASH_SOURCE[0]}")"
bash "$HERE/../scaffold-task.sh" task-ready-to-cook FE-70-cancel
TASK=docs/frontend-tasks/FE-70-cancel
bash "$HERE/../cancel-order-task.sh" "$TASK"
sed -i -e 's/^current_mode:.*/current_mode: planning-mode/' -e 's/^next_mode:.*/next_mode: cook/' \
  -e "s|^next_prompt:.*|next_prompt: \"FE cook $TASK\"|" "$TASK/tracking/workflow-status.md"
git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "plan ready"