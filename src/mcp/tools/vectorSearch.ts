import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpContext } from '../context.js';
import { vectorSearchChunks } from '../queries/vectorSearch.js';

export function registerVectorSearchTool(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    'vector_search',
    {
      description:
        'Semantic search over paper text chunks. Use for natural-language questions about paper content (methods, results, claims). Returns the most similar chunks with paper metadata and similarity scores.',
      inputSchema: {
        query: z.string().describe('Natural-language search query'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe('Max number of chunks to return (default 5)'),
      }
    },
    async ({ query,limit}) => {
      try {
        const result = await vectorSearchChunks(ctx.session, query, limit ?? 5);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: message }),
            },
          ],
        };
      }
    },
  );
}
