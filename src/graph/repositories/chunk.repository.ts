import type { Session } from 'neo4j-driver';

export class ChunkRepository {
  constructor(private readonly session: Session) {}
}
