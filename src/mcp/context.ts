import type { Session } from 'neo4j-driver';
import type { Repositories } from '../graph/repositories/index.js';

/** Shared dependencies passed to every MCP tool handler */
export interface McpContext {
  session: Session;
  repos: Repositories;
}

export function createMcpContext(session: Session, repos: Repositories): McpContext {
  return { session, repos };
}
