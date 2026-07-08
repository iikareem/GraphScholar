import type { Session } from 'neo4j-driver';

export class PaperRepository {
  constructor(private readonly session: Session) {}
}
