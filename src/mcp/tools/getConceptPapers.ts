import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpContext } from '../context.js';
import { getConceptPapers } from '../queries/getConceptPapers.js';

export function registerGetConceptPapersTool(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    'get_concept_papers',
    {
      description:
        'Find all papers that introduce or use a given concept. Use when exploring which papers relate to a method or idea (e.g. retrieval-augmented generation).',
      inputSchema: {
        concept: z.string().describe('Concept name to look up (case-insensitive)'),
      },
    },
    async ({ concept }) => {
      try {
        const result = await getConceptPapers(ctx.session, concept);

        if (!result) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Concept not found: ${concept}` }),
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
