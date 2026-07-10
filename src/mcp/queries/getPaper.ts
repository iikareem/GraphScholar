import type { Session } from 'neo4j-driver';
import { NodeLabel, RelationshipType } from '../../graph/model/index.js';

export interface PaperDetails {
  id: string;
  title: string;
  abstract: string;
  published: string;
  updated: string;
  pdfUrl: string;
  authors: string[];
  categories: string[];
  citedPaperIds: string[];
  introduces: string[];
  uses: string[];
  chunkCount: number;
}

function distinctStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.filter((value): value is string => typeof value === 'string'))];
}

/** Load one paper and its direct graph relationships from Neo4j */
export async function getPaperDetails(
  session: Session,
  paperId: string,
): Promise<PaperDetails | null> {
  const result = await session.run(
    `
    MATCH (p:${NodeLabel.Paper} { id: $paperId })
    OPTIONAL MATCH (a:${NodeLabel.Author})-[:${RelationshipType.Wrote}]->(p)
    OPTIONAL MATCH (p)-[:${RelationshipType.BelongsTo}]->(c:${NodeLabel.Category})
    OPTIONAL MATCH (p)-[:${RelationshipType.Cites}]->(cited:${NodeLabel.Paper})
    OPTIONAL MATCH (p)-[:${RelationshipType.Introduces}]->(intro:${NodeLabel.Concept})
    OPTIONAL MATCH (p)-[:${RelationshipType.Uses}]->(use:${NodeLabel.Concept})
    OPTIONAL MATCH (p)-[:${RelationshipType.HasChunk}]->(ch:${NodeLabel.Chunk})
    RETURN p,
           collect(DISTINCT a.name) AS authors,
           collect(DISTINCT c.name) AS categories,
           collect(DISTINCT cited.id) AS citedPaperIds,
           collect(DISTINCT intro.name) AS introduces,
           collect(DISTINCT use.name) AS uses,
           count(DISTINCT ch) AS chunkCount
    `,
    { paperId },
  );

  if (result.records.length === 0) {
    return null;
  }

  const record = result.records[0];
  const paper = record.get('p').properties;

  return {
    id: String(paper.id),
    title: String(paper.title),
    abstract: String(paper.abstract ?? ''),
    published: String(paper.published ?? ''),
    updated: String(paper.updated ?? ''),
    pdfUrl: String(paper.pdfUrl ?? ''),
    authors: distinctStrings(record.get('authors')),
    categories: distinctStrings(record.get('categories')),
    citedPaperIds: distinctStrings(record.get('citedPaperIds')),
    introduces: distinctStrings(record.get('introduces')),
    uses: distinctStrings(record.get('uses')),
    chunkCount: Number(record.get('chunkCount') ?? 0),
  };
}
