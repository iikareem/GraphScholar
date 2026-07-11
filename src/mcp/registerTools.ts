import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpContext } from './context.js';
import { registerGetCitationChainTool } from './tools/getCitationChain.js';
import { registerGetPaperTool } from './tools/getPaper.js';
import { registerVectorSearchTool } from './tools/vectorSearch.js';

const TOOL_NAMES = ['get_paper', 'vector_search', 'get_citation_chain'] as const;

/** Register all MCP tools on the server */
export function registerTools(server: McpServer, ctx: McpContext): void {
  registerGetPaperTool(server, ctx);
  registerVectorSearchTool(server, ctx);
  registerGetCitationChainTool(server, ctx);
}

export function listToolNames(): readonly string[] {
  return TOOL_NAMES;
}
