#!/usr/bin/env bash
# Task mới tinh: lấy template từ fixture ready-to-cook rồi đưa workflow-status về trạng thái chưa plan.
set -euo pipefail
bash "$(dirname "${BASH_SOURCE[0]}")/../scaffold-task.sh" task-ready-to-cook FE-10-export
STATUS=docs/frontend-tasks/FE-10-export/tracking/workflow-status.md
sed -i -e 's/^build_ready:.*/build_ready: false/' -e 's/^next_mode:.*/next_mode: plan/' -e 's/^current_mode:.*/current_mode: planning-mode/' "$STATUS"
git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "reset to unplanned"
