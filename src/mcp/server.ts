import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { closeDriver, createDriver } from '../graph/driver.js';
import { createRepositories } from '../graph/repositories/index.js';
import { createMcpContext } from './context.js';
import { listToolNames, registerTools } from './registerTools.js';

/**
 * GraphScholar MCP server entry point.
 *
 * server.ts only wires infrastructure — tool logic lives in tools/ and registerTools.ts.
 *
 * Important: never use console.log here — stdout is reserved for MCP messages.
 */
async function main(): Promise<void> {
  const driver = createDriver();
  const session = driver.session();
  const repos = createRepositories(session);
  const ctx = createMcpContext(session, repos);

  const server = new McpServer({
    name: 'graph-scholar',
    version: '0.1.0',
  });

  registerTools(server, ctx);

  const transport = new StdioServerTransport();

  const shutdown = async (signal: string) => {
    console.error(`[mcp] shutting down (${signal})`);
    await server.close();
    await session.close();
    await closeDriver(driver);
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await server.connect(transport);

  console.error(
    `[mcp] graph-scholar listening on stdio (tools: ${listToolNames().join(', ') || 'none'})`,
  );
}

main().catch((error) => {
  console.error('[mcp] fatal error:', error);
  process.exit(1);
});
