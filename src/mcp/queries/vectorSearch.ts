import type { Session } from 'neo4j-driver';
import { NodeLabel, RelationshipType } from '../../graph/model/index.js';
import { embedText } from '../../ingestion/embedder.js';

export interface VectorSearchHit {
  chunkId: string;
  chunkText: string;
  section: string;
  paperId: string;
  paperTitle: string;
  score: number;
}

export interface VectorSearchResult {
  query: string;
  limit: number;
  hits: VectorSearchHit[];
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/** Embed a natural-language query and find the most similar Chunk nodes */
export async function vectorSearchChunks(
  session: Session,
  query: string,
  limit: number = DEFAULT_LIMIT,
): Promise<VectorSearchResult> {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  if (!normalizedQuery) {
    throw new Error('query must not be empty');
  }

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  const queryEmbedding = await embedText(normalizedQuery);

  const result = await session.run(
    `
    CALL db.index.vector.queryNodes('chunk_embeddings', $limit, $queryEmbedding)
    YIELD node, score
    MATCH (p:${NodeLabel.Paper})-[:${RelationshipType.HasChunk}]->(node)
    RETURN node.id AS chunkId,
           node.text AS chunkText,
           node.section AS section,
           p.id AS paperId,
           p.title AS paperTitle,
           score
    ORDER BY score DESC
    `,
    { limit: safeLimit, queryEmbedding },
  );

  const hits: VectorSearchHit[] = result.records.map((record) => ({
    chunkId: String(record.get('chunkId') ?? ''),
    chunkText: String(record.get('chunkText') ?? ''),
    section: String(record.get('section') ?? ''),
    paperId: String(record.get('paperId') ?? ''),
    paperTitle: String(record.get('paperTitle') ?? ''),
    score: Number(record.get('score') ?? 0),
  }));

  return {
    query: normalizedQuery,
    limit: safeLimit,
    hits,
  };
}
