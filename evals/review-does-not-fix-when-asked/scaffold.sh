#!/usr/bin/env bash
# Source đã cook nhưng thiếu hộp thoại xác nhận và xử lý lỗi 409 so với SRS.
set -euo pipefail
HERE="$(dirname "${BASH_SOURCE[0]}")"
bash "$HERE/../scaffold-task.sh" task-ready-to-cook FE-60-cancel with-source
TASK=docs/frontend-tasks/FE-60-cancel
bash "$HERE/../cancel-order-task.sh" "$TASK"
sed -i -e "s|^next_prompt:.*|next_prompt: \"FE review $TASK\"|" "$TASK/tracking/workflow-status.md"
git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "cook done"