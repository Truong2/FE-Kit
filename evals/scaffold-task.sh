#!/usr/bin/env bash
# Dựng task folder cho một case eval từ fixture của packages/validators.
# Dùng: scaffold-task.sh <fixture> <tên-task> [có-source]
# Chạy trong thư mục làm việc của eval (cwd do `claude plugin eval --scaffold` cấp).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES="$HERE/../packages/validators/test/fixtures"
FIXTURE="$1"
TASK="docs/frontend-tasks/$2"

mkdir -p "$TASK"
cp -R "$FIXTURES/$FIXTURE/." "$TASK/"
# Fixture mang task id riêng (FE-99x-...): đổi sang tên task của case.
find "$TASK" -name '*.md' -exec sed -i -E \
  -e "s#docs/frontend-tasks/FE-99[0-9]-[A-Za-z0-9-]+#$TASK#g" \
  -e "s#^task_id:.*#task_id: $2#" {} +
mkdir -p "$TASK/output/figma-reference-screenshots"
touch "$TASK/output/figma-reference-screenshots/.gitkeep"

if [ "${3:-}" = "with-source" ]; then
  mkdir -p src/components
  cat > src/components/OrderCancelButton.tsx <<'EOF'
export function OrderCancelButton({ onCancel }: { onCancel: () => void }) {
  return <button onClick={onCancel}>Huỷ đơn</button>;
}
EOF
fi

git init -q
git add -A
git -c user.email=eval@example.com -c user.name=eval commit -qm "scaffold"
