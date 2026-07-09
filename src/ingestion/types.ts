import type { AuthorNode, CategoryNode, PaperNode } from '../graph/model/index.js';

/** Metadata fetched from ArXiv — ready to write to Neo4j in a later step */
export interface PaperMetadata {
  paper: PaperNode;
  authors: AuthorNode[];
  categories: CategoryNode[];
}

/** Canonical section names used across ingestion and chunking */
export type SectionName =
  | 'abstract'
  | 'introduction'
  | 'methodology'
  | 'results'
  | 'conclusion'
  | 'references'
  | 'unknown';

export interface PaperSection {
  name: SectionName;
  text: string;
  startPage?: number;
  endPage?: number;
}

/** Text extracted from a paper PDF, split into sections */
export interface ExtractedPaper {
  paperId: string;
  sections: PaperSection[];
}
