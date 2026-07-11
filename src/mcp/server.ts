import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { closeDriver, createDriver } from '../graph/driver.js';
import { createRepositories } from '../graph/repositories/index.js';
import { createMcpContext } from './context.js';
import { createMcpServer } from './createApp.js';
import { listToolNames } from './registerTools.js';

/**
 * GraphScholar MCP — stdio transport (Cursor / Claude Desktop local).
 *
 * Important: never use console.log here — stdout is reserved for MCP messages.
 */
async function main(): Promise<void> {
  const driver = createDriver();
  const session = driver.session();
  const repos = createRepositories(session);
  const ctx = createMcpContext(session, repos);

  const server = createMcpServer(ctx);
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
    `[mcp] graph-scholar stdio listening (tools: ${listToolNames().join(', ')})`,
  );
}

main().catch((error) => {
  console.error('[mcp] fatal error:', error);
  process.exit(1);
});
