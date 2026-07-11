import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpContext } from '../context.js';
import { getCitationChain } from '../queries/getCitationChain.js';

export function registerGetCitationChainTool(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    'get_citation_chain',
    {
      description:
        'Traverse the citation graph outbound from a paper (what it cites) up to N hops. Use to explore foundations and related prior work.',
      inputSchema: {
        paper_id: z.string().describe('ArXiv paper ID to start from, e.g. 2310.11511'),
        depth: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe('How many CITES hops to follow (default 2, max 4)'),
      },
    },
    async ({ paper_id, depth }) => {
      const chain = await getCitationChain(ctx.session, paper_id, depth ?? 2);

      if (!chain) {
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
            text: JSON.stringify(chain),
          },
        ],
      };
    },
  );
}
