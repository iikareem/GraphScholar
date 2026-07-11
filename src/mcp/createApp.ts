import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpContext } from './context.js';
import { registerTools } from './registerTools.js';

/** Create a GraphScholar MCP server with all tools registered */
export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer({
    name: 'graph-scholar',
    version: '0.1.0',
  });

  registerTools(server, ctx);
  return server;
}
