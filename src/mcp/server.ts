import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * GraphScholar MCP server entry point.
 *
 * Important: never use console.log here — stdout is reserved for MCP messages.
 */
async function main(): Promise<void> {
  const server = new McpServer({
    name: 'graph-scholar',
    version: '0.1.0',
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[mcp] graph-scholar listening on stdio');
}

main().catch((error) => {
  console.error('[mcp] fatal error:', error);
  process.exit(1);
});
