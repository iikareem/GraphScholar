import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpContext } from './context.js';
import { registerGetPaperTool } from './tools/getPaper.js';

const TOOL_NAMES = ['get_paper'] as const;

/** Register all MCP tools on the server */
export function registerTools(server: McpServer, ctx: McpContext): void {
  registerGetPaperTool(server, ctx);
}

export function listToolNames(): readonly string[] {
  return TOOL_NAMES;
}
