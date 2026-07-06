import { NodeLabel, RelationshipType } from './labels.js';

export const GraphSchema = {
  nodes: {
    [NodeLabel.Paper]: ['id', 'version', 'title', 'abstract', 'published', 'updated', 'pdfUrl'],
    [NodeLabel.Author]: ['name'],
    [NodeLabel.Category]: ['name'],
    [NodeLabel.Concept]: ['name', 'embedding'],
    [NodeLabel.Chunk]: ['id', 'chunkIndex', 'section', 'text', 'embedding', 'page?'],
  },
  relationships: [
    { type: RelationshipType.Wrote, from: NodeLabel.Author, to: NodeLabel.Paper },
    { type: RelationshipType.BelongsTo, from: NodeLabel.Paper, to: NodeLabel.Category },
    { type: RelationshipType.HasChunk, from: NodeLabel.Paper, to: NodeLabel.Chunk },
    { type: RelationshipType.Introduces, from: NodeLabel.Paper, to: NodeLabel.Concept },
    { type: RelationshipType.Uses, from: NodeLabel.Paper, to: NodeLabel.Concept },
    { type: RelationshipType.Cites, from: NodeLabel.Paper, to: NodeLabel.Paper },
    { type: RelationshipType.RelatedTo, from: NodeLabel.Concept, to: NodeLabel.Concept },
  ],
} as const;
