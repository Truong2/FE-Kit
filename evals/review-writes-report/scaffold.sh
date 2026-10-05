#!/usr/bin/env bash
# Task đã cook xong: có source thật, workflow-status route sang review.
set -euo pipefail
bash "$(dirname "${BASH_SOURCE[0]}")/../scaffold-task.sh" task-ready-to-cook FE-40-cancel with-source
STATUS=docs/frontend-tasks/FE-40-cancel/tracking/workflow-status.md
sed -i -e 's/^current_mode:.*/current_mode: implementation-mode/' -e 's/^next_mode:.*/next_mode: review/' \
  -e 's|^next_prompt:.*|next_prompt: "FE review docs/frontend-tasks/FE-40-cancel"|' "$STATUS"
git add -A && git -c user.email=eval@example.com -c user.name=eval commit -qm "cook done"
