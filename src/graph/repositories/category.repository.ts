import type { Session } from 'neo4j-driver';
import { NodeLabel } from '../model/index.js';
import type { CategoryNode } from '../model/index.js';

export class CategoryRepository {
  constructor(private readonly session: Session) {}

  async upsert(category: CategoryNode): Promise<void> {
    await this.session.run(
      `
      MERGE (c:${NodeLabel.Category} { name: $name })
      `,
      { name: category.name },
    );
  }
}
