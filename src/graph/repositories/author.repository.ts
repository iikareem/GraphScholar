import type { Session } from 'neo4j-driver';

export class AuthorRepository {
  constructor(private readonly session: Session) {}
}
