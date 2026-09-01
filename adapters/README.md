# Agent Adapter Matrix

Kit này hỗ trợ nhiều coding agents bằng cách cung cấp đúng artifact mà từng tool ưu tiên, đồng thời giữ `AGENTS.md` làm instruction canonical chung.

| Agent/tool | Primary files | Mục đích |
|---|---|---|
| Codex / OpenAI agents | `AGENTS.md`, `.codex/prompts/*` | Prompt và rule chung cho planning/build/review/test |
| Claude Code | `CLAUDE.md`, `.claude/commands/*`, `.claude/agents/*`, `.claude/skills/*` | Slash commands, agents và skill local |
| Cursor | `.cursor/rules/*.mdc` | Rule theo path cho task docs và source code |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/*` | Repository và path-specific instructions |
| ChatGPT | `dist/chatgpt-skill.zip` | Upload skill trực tiếp |
