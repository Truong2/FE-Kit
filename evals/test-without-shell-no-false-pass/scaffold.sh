#!/usr/bin/env bash
# Runner của `claude plugin eval` chỉ chạy bash; logic nằm trong scaffold.mjs.
set -euo pipefail
exec node "$(dirname "${BASH_SOURCE[0]}")/scaffold.mjs"
