import type { Session } from 'neo4j-driver';

export class ConceptRepository {
  constructor(private readonly session: Session) {}
}
