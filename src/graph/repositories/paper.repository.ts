import type { Session } from 'neo4j-driver';
import { NodeLabel, RelationshipType } from '../model/index.js';
import type { PaperNode } from '../model/index.js';

export class PaperRepository {
  constructor(private readonly session: Session) {}

  async upsert(paper: PaperNode): Promise<void> {
    await this.session.run(
      `
      MERGE (p:${NodeLabel.Paper} { id: $id })
      SET p.version   = $version,
          p.title     = $title,
          p.abstract  = $abstract,
          p.published = $published,
          p.updated   = $updated,
          p.pdfUrl    = $pdfUrl
      `,
      {
        id: paper.id,
        version: paper.version,
        title: paper.title,
        abstract: paper.abstract,
        published: paper.published,
        updated: paper.updated,
        pdfUrl: paper.pdfUrl,
      },
    );
  }

  async linkBelongsTo(paperId: string, categoryName: string): Promise<void> {
    await this.session.run(
      `
      MATCH (p:${NodeLabel.Paper} { id: $paperId })
      MATCH (c:${NodeLabel.Category} { name: $categoryName })
      MERGE (p)-[:${RelationshipType.BelongsTo}]->(c)
      `,
      { paperId, categoryName },
    );
  }
}
