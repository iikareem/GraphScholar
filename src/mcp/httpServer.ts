import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { closeDriver, createDriver } from '../graph/driver.js';
import { createRepositories } from '../graph/repositories/index.js';
import { createMcpContext } from './context.js';
import { createMcpServer } from './createApp.js';
import { listToolNames } from './registerTools.js';

/**
 * GraphScholar MCP — Streamable HTTP transport (stateless).
 *
 * Same tools as stdio. Run: npm run mcp:http
 * Endpoint: POST http://127.0.0.1:<port>/mcp
 *
 * Auth is not included yet — bind to localhost only for learning.
 */
async function main(): Promise<void> {
  const host = process.env.MCP_HTTP_HOST ?? '127.0.0.1';
  const port = Number(process.env.MCP_HTTP_PORT ?? 3000);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('MCP_HTTP_PORT must be a positive number');
  }

  const driver = createDriver();
  const session = driver.session();
  const repos = createRepositories(session);
  const ctx = createMcpContext(session, repos);

  const app = createMcpExpressApp({ host });

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      name: 'graph-scholar',
      transport: 'streamable-http',
      tools: listToolNames(),
    });
  });

  app.post('/mcp', async (req, res) => {
    const server = createMcpServer(ctx);
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      res.on('close', () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error('[mcp:http] request error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
      await server.close();
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST /mcp.' },
      id: null,
    });
  });

  app.delete('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST /mcp.' },
      id: null,
    });
  });

  const httpServer = app.listen(port, host, () => {
    console.error(
      `[mcp:http] graph-scholar listening on http://${host}:${port}/mcp (tools: ${listToolNames().join(', ')})`,
    );
  });

  const shutdown = async (signal: string) => {
    console.error(`[mcp:http] shutting down (${signal})`);
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
    await session.close();
    await closeDriver(driver);
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[mcp:http] fatal error:', error);
  process.exit(1);
});
