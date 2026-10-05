#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "${BASH_SOURCE[0]}")/../scaffold-task.sh" task-blocked-question FE-20-cancel with-source
