import type { Session } from 'neo4j-driver';

export class CategoryRepository {
  constructor(private readonly session: Session) {}
}
