import type { Session } from 'neo4j-driver';
import { NodeLabel, RelationshipType } from '../model/index.js';
import type { Embedding } from '../model/index.js';

export class ConceptRepository {
  constructor(private readonly session: Session) {}

  async exists(name: string): Promise<boolean> {
    const result = await this.session.run(
      `
      MATCH (c:${NodeLabel.Concept} { name: $name })
      RETURN c
      LIMIT 1
      `,
      { name },
    );

    return result.records.length > 0;
  }

  /** Create concept on first sight; keep existing embedding if already present */
  async upsert(name: string, embedding: Embedding): Promise<void> {
    await this.session.run(
      `
      MERGE (c:${NodeLabel.Concept} { name: $name })
      ON CREATE SET c.embedding = $embedding
      `,
      { name, embedding },
    );
  }

  async linkIntroduces(paperId: string, conceptName: string): Promise<void> {
    await this.session.run(
      `
      MATCH (p:${NodeLabel.Paper} { id: $paperId })
      MATCH (c:${NodeLabel.Concept} { name: $conceptName })
      MERGE (p)-[:${RelationshipType.Introduces}]->(c)
      `,
      { paperId, conceptName },
    );
  }

  async linkUses(paperId: string, conceptName: string): Promise<void> {
    await this.session.run(
      `
      MATCH (p:${NodeLabel.Paper} { id: $paperId })
      MATCH (c:${NodeLabel.Concept} { name: $conceptName })
      MERGE (p)-[:${RelationshipType.Uses}]->(c)
      `,
      { paperId, conceptName },
    );
  }

  async linkRelatedTo(fromConcept: string, toConcept: string): Promise<void> {
    await this.session.run(
      `
      MATCH (a:${NodeLabel.Concept} { name: $fromConcept })
      MATCH (b:${NodeLabel.Concept} { name: $toConcept })
      MERGE (a)-[:${RelationshipType.RelatedTo}]->(b)
      `,
      { fromConcept, toConcept },
    );
  }
}
