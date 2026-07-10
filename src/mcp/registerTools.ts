import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpContext } from './context.js';

/** Register all MCP tools on the server — add new tools here as they are implemented */
export function registerTools(_server: McpServer, _ctx: McpContext): void {
  // Step 4+: get_paper, vector_search, get_citation_chain, etc.
}

export function listToolNames(): readonly string[] {
  return [];
}
