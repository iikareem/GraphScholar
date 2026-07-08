import neo4j, { type Driver } from 'neo4j-driver';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

export function createNeo4jConfig(): Neo4jConfig {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    throw new Error('Missing NEO4J_URI, NEO4J_USERNAME, or NEO4J_PASSWORD');
  }

  return { uri, username, password };
}

export function createDriver(config?: Neo4jConfig): Driver {
  const { uri, username, password } = config ?? createNeo4jConfig();
  return neo4j.driver(uri, neo4j.auth.basic(username, password));
}

export async function verifyConnectivity(driver: Driver): Promise<void> {
  await driver.verifyConnectivity();
}

export async function closeDriver(driver: Driver): Promise<void> {
  await driver.close();
}
