import type { Session } from 'neo4j-driver';
import { NodeLabel, RelationshipType } from '../../graph/model/index.js';

export type ConceptRelationship = 'INTRODUCES' | 'USES';

export interface ConceptPaperHit {
  id: string;
  title: string;
  published: string;
  relationships: ConceptRelationship[];
}

export interface ConceptPapersResult {
  concept: string;
  papers: ConceptPaperHit[];
}

/** Find papers that INTRODUCE or USE a concept (case-insensitive name match) */
export async function getConceptPapers(
  session: Session,
  concept: string,
): Promise<ConceptPapersResult | null> {
  const normalized = concept.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new Error('concept must not be empty');
  }

  const result = await session.run(
    `
    MATCH (c:${NodeLabel.Concept})
    WHERE toLower(c.name) = toLower($concept)
    OPTIONAL MATCH (p:${NodeLabel.Paper})-[r:${RelationshipType.Introduces}|${RelationshipType.Uses}]->(c)
    RETURN c.name AS conceptName,
           p.id AS paperId,
           p.title AS paperTitle,
           p.published AS published,
           type(r) AS relType
    `,
    { concept: normalized },
  );

  if (result.records.length === 0) {
    return null;
  }

  const conceptName = String(result.records[0].get('conceptName'));
  const byPaper = new Map<string, ConceptPaperHit>();

  for (const record of result.records) {
    const paperId = record.get('paperId');
    if (paperId == null) {
      continue;
    }

    const id = String(paperId);
    const relType = record.get('relType');
    const relationship =
      relType === RelationshipType.Introduces || relType === RelationshipType.Uses
        ? (relType as ConceptRelationship)
        : null;

    let hit = byPaper.get(id);
    if (!hit) {
      hit = {
        id,
        title: String(record.get('paperTitle') ?? ''),
        published: String(record.get('published') ?? ''),
        relationships: [],
      };
      byPaper.set(id, hit);
    }

    if (relationship && !hit.relationships.includes(relationship)) {
      hit.relationships.push(relationship);
    }
  }

  return {
    concept: conceptName,
    papers: [...byPaper.values()],
  };
}
