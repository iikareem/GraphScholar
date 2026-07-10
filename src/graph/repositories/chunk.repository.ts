import type { Session } from 'neo4j-driver';
import { NodeLabel, RelationshipType } from '../model/index.js';
import type { Embedding } from '../model/index.js';

export interface ChunkUpsertInput {
  id: string;
  chunkIndex: number;
  section: string;
  text: string;
  embedding: Embedding;
  page?: number;
}

export class ChunkRepository {
  constructor(private readonly session: Session) {}

  async upsert(chunk: ChunkUpsertInput): Promise<void> {
    await this.session.run(
      `
      MERGE (c:${NodeLabel.Chunk} { id: $id })
      SET c.chunkIndex = $chunkIndex,
          c.section    = $section,
          c.text       = $text,
          c.embedding  = $embedding,
          c.page       = $page
      `,
      {
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        section: chunk.section,
        text: chunk.text,
        embedding: chunk.embedding,
        page: chunk.page ?? null,
      },
    );
  }

  async linkHasChunk(paperId: string, chunkId: string): Promise<void> {
    await this.session.run(
      `
      MATCH (p:${NodeLabel.Paper} { id: $paperId })
      MATCH (c:${NodeLabel.Chunk} { id: $chunkId })
      MERGE (p)-[:${RelationshipType.HasChunk}]->(c)
      `,
      { paperId, chunkId },
    );
  }
}
