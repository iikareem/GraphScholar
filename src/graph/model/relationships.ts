import { RelationshipType } from './labels.js';

/** (:Author)-[:WROTE]->(:Paper) */
export interface WroteRelationship {
  type: typeof RelationshipType.Wrote;
}

/** (:Paper)-[:BELONGS_TO]->(:Category) */
export interface BelongsToRelationship {
  type: typeof RelationshipType.BelongsTo;
}

/** (:Paper)-[:HAS_CHUNK]->(:Chunk) */
export interface HasChunkRelationship {
  type: typeof RelationshipType.HasChunk;
}

/** (:Paper)-[:INTRODUCES]->(:Concept) */
export interface IntroducesRelationship {
  type: typeof RelationshipType.Introduces;
  confidence?: number;
  excerpt?: string;
  source?: string;
}

/** (:Paper)-[:USES]->(:Concept) */
export interface UsesRelationship {
  type: typeof RelationshipType.Uses;
  confidence?: number;
  excerpt?: string;
  source?: string;
}

/** (:Paper)-[:CITES]->(:Paper) */
export interface CitesRelationship {
  type: typeof RelationshipType.Cites;
}

/** (:Concept)-[:RELATED_TO]->(:Concept) */
export interface RelatedToRelationship {
  type: typeof RelationshipType.RelatedTo;
}

export type GraphRelationship =
  | WroteRelationship
  | BelongsToRelationship
  | HasChunkRelationship
  | IntroducesRelationship
  | UsesRelationship
  | CitesRelationship
  | RelatedToRelationship;

export interface GraphEdge<
  TType extends GraphRelationship['type'] = GraphRelationship['type'],
> {
  type: TType;
  from: string;
  to: string;
  properties?: Omit<Extract<GraphRelationship, { type: TType }>, 'type'>;
}
