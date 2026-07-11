import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpContext } from '../context.js';
import { getAuthorPapers } from '../queries/getAuthorPapers.js';

export function registerGetAuthorPapersTool(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    'get_author_papers',
    {
      description:
        'Find all papers in the graph by a given author, including concepts they introduce or use. Use when exploring an author\'s work.',
      inputSchema: {
        author_name: z.string().describe('Author full name (case-insensitive)'),
      },
    },
    async ({ author_name }) => {
      try {
        const result = await getAuthorPapers(ctx.session, author_name);

        if (!result) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Author not found: ${author_name}` }),
              },
            ],
          };
        }

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
