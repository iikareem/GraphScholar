import type { Session } from 'neo4j-driver';
import { NodeLabel, RelationshipType } from '../../graph/model/index.js';

export interface CitationNode {
  id: string;
  title: string;
  cites: CitationNode[];
}

export interface CitationChainResult {
  paperId: string;
  title: string;
  depth: number;
  cites: CitationNode[];
}

const DEFAULT_DEPTH = 2;
const MAX_DEPTH = 4;

function clampDepth(depth: number): number {
  return Math.min(Math.max(1, Math.floor(depth)), MAX_DEPTH);
}

/** Build a nested citation tree from path node chains (root → … → leaf) */
function buildCitationTree(chains: Array<Array<{ id: string; title: string }>>): CitationNode[] {
  type MutableNode = { id: string; title: string; children: Map<string, MutableNode> };

  const roots = new Map<string, MutableNode>();

  for (const chain of chains) {
    if (chain.length < 2) {
      continue;
    }

    // chain[0] is the root paper — children start at index 1
    let parentMap = roots;
    for (let i = 1; i < chain.length; i++) {
      const step = chain[i];
      let node = parentMap.get(step.id);
      if (!node) {
        node = { id: step.id, title: step.title, children: new Map() };
        parentMap.set(step.id, node);
      }
      parentMap = node.children;
    }
  }

  const toTree = (node: MutableNode): CitationNode => ({
    id: node.id,
    title: node.title,
    cites: [...node.children.values()].map(toTree),
  });

  return [...roots.values()].map(toTree);
}

/**
 * Multi-hop outbound citation traversal: Paper -[:CITES*1..depth]-> Paper
 * Depth is clamped and inlined (Neo4j does not accept path length as a parameter).
 */
export async function getCitationChain(
  session: Session,
  paperId: string,
  depth: number = DEFAULT_DEPTH,
): Promise<CitationChainResult | null> {
  const safeDepth = clampDepth(depth);

  const result = await session.run(
    `
    MATCH (root:${NodeLabel.Paper} { id: $paperId })
    OPTIONAL MATCH path = (root)-[:${RelationshipType.Cites}*1..${safeDepth}]->(cited:${NodeLabel.Paper})
    WITH root, path
    RETURN root.id AS rootId,
           root.title AS rootTitle,
           CASE
             WHEN path IS NULL THEN []
             ELSE [n IN nodes(path) | { id: n.id, title: n.title }]
           END AS chain
    `,
    { paperId },
  );

  if (result.records.length === 0) {
    return null;
  }

  const rootId = String(result.records[0].get('rootId'));
  const rootTitle = String(result.records[0].get('rootTitle') ?? '');

  const chains: Array<Array<{ id: string; title: string }>> = [];
  for (const record of result.records) {
    const chain = record.get('chain');
    if (!Array.isArray(chain) || chain.length === 0) {
      continue;
    }

    chains.push(
      chain.map((node: { id?: unknown; title?: unknown }) => ({
        id: String(node.id ?? ''),
        title: String(node.title ?? ''),
      })),
    );
  }

  return {
    paperId: rootId,
    title: rootTitle,
    depth: safeDepth,
    cites: buildCitationTree(chains),
  };
}
