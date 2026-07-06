/** Example: model types + label constants → raw Cypher → session.run() */
import {
  NodeLabel,
  RelationshipType,
  type AuthorNode,
  type PaperNode,
  SCHEMA_STATEMENTS,
} from '../model/index.js';

const paper: PaperNode = {
  label: NodeLabel.Paper,
  id: '2310.11511',
  version: 'v1',
  title: 'Self-RAG: Learning to Retrieve, Generate, and Critique',
  abstract: 'Despite their remarkable capabilities, large language models...',
  published: '2023-10-17T18:18:32Z',
  updated: '2023-10-17T18:18:32Z',
  pdfUrl: 'https://arxiv.org/pdf/2310.11511v1',
};

const author: AuthorNode = {
  label: NodeLabel.Author,
  name: 'Akari Asai',
};

const upsertPaperCypher = `
  MERGE (p:${NodeLabel.Paper} { id: $id })
  SET p.version   = $version,
      p.title     = $title,
      p.abstract  = $abstract,
      p.published = $published,
      p.updated   = $updated,
      p.pdfUrl    = $pdfUrl
  RETURN p
`;

const linkAuthorCypher = `
  MERGE (a:${NodeLabel.Author} { name: $authorName })
  MERGE (p:${NodeLabel.Paper} { id: $paperId })
  MERGE (a)-[:${RelationshipType.Wrote}]->(p)
`;

async function exampleWithDriver(session: {
  run: (query: string, params?: Record<string, unknown>) => Promise<unknown>;
}) {
  await session.run(upsertPaperCypher, {
    id: paper.id,
    version: paper.version,
    title: paper.title,
    abstract: paper.abstract,
    published: paper.published,
    updated: paper.updated,
    pdfUrl: paper.pdfUrl,
  });

  await session.run(linkAuthorCypher, {
    authorName: author.name,
    paperId: paper.id,
  });

  return session.run(
    `
    MATCH (a:${NodeLabel.Author} { name: $name })-[:${RelationshipType.Wrote}]->(p:${NodeLabel.Paper})
    RETURN p.id AS id, p.title AS title
    `,
    { name: author.name },
  );
}

async function setupDatabase(session: { run: (query: string) => Promise<unknown> }) {
  for (const statement of SCHEMA_STATEMENTS) {
    await session.run(statement);
  }
}

console.log('--- upsertPaperCypher ---\n', upsertPaperCypher);
console.log('\n--- linkAuthorCypher ---\n', linkAuthorCypher);
console.log('\n--- schema statements ---\n', SCHEMA_STATEMENTS.length);

export { paper, author, upsertPaperCypher, linkAuthorCypher, exampleWithDriver, setupDatabase };
