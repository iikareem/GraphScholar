import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpContext } from '../context.js';
import { getPaperDetails } from '../queries/getPaper.js';

export function registerGetPaperTool(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    'get_paper',
    {
      description:
        'Return metadata and graph relationships for one paper by ArXiv ID (authors, categories, citations, concepts, chunk count).',
      inputSchema: {
        paper_id: z.string().describe('ArXiv paper ID, e.g. 2310.11511'),
      },
    },
    async ({ paper_id }) => {
      const paper = await getPaperDetails(ctx.session, paper_id);

      if (!paper) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Paper not found: ${paper_id}` }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(paper),
          },
        ],
      };
    },
  );
}
