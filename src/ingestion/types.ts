import type { AuthorNode, CategoryNode, PaperNode } from '../graph/model/index.js';

/** Metadata fetched from ArXiv — ready to write to Neo4j in a later step */
export interface PaperMetadata {
  paper: PaperNode;
  authors: AuthorNode[];
  categories: CategoryNode[];
}
