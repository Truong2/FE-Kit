# Codex Adapter

Dùng `AGENTS.md` làm instruction chính. Prompt trong `.codex/prompts/` (do `fe-kit init --agents codex` sinh từ `core/commands/`) giúp gọi đúng mode: plan, build, review, test, pr.

Codex không có MCP tool và hook của plugin Claude Code, nên gate dựa vào rule trong `.frontend-delivery/rules/` và CLI: chạy `node bin/fe-kit.mjs validate-workflow <task>` trước khi kết thúc mỗi mode, `validate-pr` trước PR.
