/** OpenAI text-embedding-3-small */
export const EMBEDDING_DIMENSIONS = 1536;

export const CONSTRAINTS = [
  `CREATE CONSTRAINT paper_id IF NOT EXISTS FOR (p:Paper) REQUIRE p.id IS UNIQUE`,
  `CREATE CONSTRAINT author_name IF NOT EXISTS FOR (a:Author) REQUIRE a.name IS UNIQUE`,
  `CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE`,
  `CREATE CONSTRAINT concept_name IF NOT EXISTS FOR (c:Concept) REQUIRE c.name IS UNIQUE`,
  `CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE`,
] as const;

export const INDEXES = [
  `CREATE INDEX paper_title IF NOT EXISTS FOR (p:Paper) ON (p.title)`,
  `CREATE INDEX chunk_section IF NOT EXISTS FOR (c:Chunk) ON (c.section)`,
] as const;

export const VECTOR_INDEXES = [
  `CREATE VECTOR INDEX chunk_embeddings IF NOT EXISTS
   FOR (c:Chunk) ON (c.embedding)
   OPTIONS { indexConfig: {
     \`vector.dimensions\`: ${EMBEDDING_DIMENSIONS},
     \`vector.similarity_function\`: 'cosine'
   }}`,
  `CREATE VECTOR INDEX concept_embeddings IF NOT EXISTS
   FOR (c:Concept) ON (c.embedding)
   OPTIONS { indexConfig: {
     \`vector.dimensions\`: ${EMBEDDING_DIMENSIONS},
     \`vector.similarity_function\`: 'cosine'
   }}`,
] as const;

export const SCHEMA_STATEMENTS = [...CONSTRAINTS, ...INDEXES, ...VECTOR_INDEXES] as const;
