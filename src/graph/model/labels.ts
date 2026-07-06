/** Neo4j node labels — maps to :Paper, :Author, etc. in Cypher */
export const NodeLabel = {
  Paper: 'Paper',
  Author: 'Author',
  Category: 'Category',
  Concept: 'Concept',
  Chunk: 'Chunk',
} as const;

export type NodeLabel = (typeof NodeLabel)[keyof typeof NodeLabel];

/** Neo4j relationship types — maps to [:WROTE], [:CITES], etc. in Cypher */
export const RelationshipType = {
  Wrote: 'WROTE',
  BelongsTo: 'BELONGS_TO',
  HasChunk: 'HAS_CHUNK',
  Introduces: 'INTRODUCES',
  Uses: 'USES',
  Cites: 'CITES',
  RelatedTo: 'RELATED_TO',
} as const;

export type RelationshipType = (typeof RelationshipType)[keyof typeof RelationshipType];
