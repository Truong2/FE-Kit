# Claude Adapter

Từ v2.0.0, Claude Code dùng plugin `fe` (`/plugin install fe@frontend-delivery`): 12 slash command `/fe:*`, 7 subagent `fe:frontend-*`, skill `frontend-delivery-standard`, MCP server validator và hook runtime.

`fe-kit init --agents claude` chỉ ghi `CLAUDE.md` (khối `fe-kit:start…end`), `.claude/rules/` (rule theo path cho task docs và source) và bật plugin trong `.claude/settings.json`. Nguồn nằm ở `core/adapters/claude/`.

`FE quick <task>` chỉ dùng cho thay đổi nhỏ, rủi ro thấp, rõ scope. Chuyển sang `FE plan` hoặc `FE input-sync` khi requirement, Figma, API/DTO, kiến trúc state/store/hook hoặc hành vi liên module bị ảnh hưởng.
