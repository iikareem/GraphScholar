import type { Session } from 'neo4j-driver';
import { NodeLabel, RelationshipType } from '../model/index.js';
import type { AuthorNode } from '../model/index.js';

export class AuthorRepository {
  constructor(private readonly session: Session) {}

  async upsert(author: AuthorNode): Promise<void> {
    await this.session.run(
      `
      MERGE (a:${NodeLabel.Author} { name: $name })
      `,
      { name: author.name },
    );
  }

  async linkWrote(authorName: string, paperId: string): Promise<void> {
    await this.session.run(
      `
      MATCH (a:${NodeLabel.Author} { name: $authorName })
      MATCH (p:${NodeLabel.Paper} { id: $paperId })
      MERGE (a)-[:${RelationshipType.Wrote}]->(p)
      `,
      { authorName, paperId },
    );
  }
}
