/**
 * MCP server của plugin `fe`.
 *
 * Mục đích: đưa các gate/validator của kit thành tool gọi được từ agent, để
 * plugin tự chạy được validation mà KHÔNG cần clone repo kit + npm install CLI
 * riêng. Tool và handler nằm trong `createMcpTools` của engine
 * (`packages/engine/src/mcp-core.mjs`); file này gắn domain pack FE và nối vào
 * MCP SDK.
 *
 * File này được esbuild bundle thành 1 file .mjs standalone (kèm zod,
 * gray-matter, MCP SDK) rồi đặt trong plugin — plugin bị copy vào cache nên
 * không thể dựa vào node_modules.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createMcpTools } from '@frontend-delivery-kit/engine';
import { fePack } from '@frontend-delivery-kit/validators';

// esbuild `define` thay hằng này khi bundle; chạy trực tiếp từ source thì là 'dev'.
const KIT_VERSION = typeof __FE_KIT_VERSION__ !== 'undefined' ? __FE_KIT_VERSION__ : 'dev';

/** Thư mục gốc của plugin: Claude Code set `CLAUDE_PLUGIN_ROOT`; fallback theo vị trí file bundle (`<plugin>/mcp/`). */
function pluginRoot() {
  if (process.env.CLAUDE_PLUGIN_ROOT) return path.resolve(process.env.CLAUDE_PLUGIN_ROOT);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

const { serverName, tools, callTool } = createMcpTools(fePack, { version: KIT_VERSION, pluginRoot: pluginRoot() });

const server = new Server({ name: serverName, version: KIT_VERSION }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (req) => callTool(req.params.name, req.params.arguments));

const transport = new StdioServerTransport();
await server.connect(transport);
