import type { Session } from 'neo4j-driver';
import { NodeLabel, RelationshipType } from '../../graph/model/index.js';

export interface AuthorPaperHit {
  id: string;
  title: string;
  published: string;
  introduces: string[];
  uses: string[];
}

export interface AuthorPapersResult {
  author: string;
  papers: AuthorPaperHit[];
}

function distinctStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.filter((value): value is string => typeof value === 'string'))];
}

/** Find papers written by an author (case-insensitive name match) */
export async function getAuthorPapers(
  session: Session,
  authorName: string,
): Promise<AuthorPapersResult | null> {
  const normalized = authorName.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new Error('author_name must not be empty');
  }

  const result = await session.run(
    `
    MATCH (a:${NodeLabel.Author})
    WHERE toLower(a.name) = toLower($authorName)
    OPTIONAL MATCH (a)-[:${RelationshipType.Wrote}]->(p:${NodeLabel.Paper})
    WITH a, p
    OPTIONAL MATCH (p)-[:${RelationshipType.Introduces}]->(intro:${NodeLabel.Concept})
    WITH a, p, collect(DISTINCT intro.name) AS introduces
    OPTIONAL MATCH (p)-[:${RelationshipType.Uses}]->(use:${NodeLabel.Concept})
    RETURN a.name AS authorName,
           p.id AS paperId,
           p.title AS paperTitle,
           p.published AS published,
           introduces,
           collect(DISTINCT use.name) AS uses
    `,
    { authorName: normalized },
  );

  if (result.records.length === 0) {
    return null;
  }

  const author = String(result.records[0].get('authorName'));
  const papers: AuthorPaperHit[] = [];

  for (const record of result.records) {
    const paperId = record.get('paperId');
    if (paperId == null) {
      continue;
    }

    papers.push({
      id: String(paperId),
      title: String(record.get('paperTitle') ?? ''),
      published: String(record.get('published') ?? ''),
      introduces: distinctStrings(record.get('introduces')),
      uses: distinctStrings(record.get('uses')),
    });
  }

  papers.sort((left, right) => right.published.localeCompare(left.published));

  return { author, papers };
}
