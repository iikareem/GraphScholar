import type { PaperMetadata, PaperSection } from './types.js';
import type { CitationIngestResult } from './citations.js';
import type { ChunkIngestResult } from './chunks.js';
import type { ConceptIngestResult } from './concepts.js';

export interface IngestionContext {
  paperId: string;
  metadata?: PaperMetadata;
  sections?: PaperSection[];
  citations?: CitationIngestResult;
  concepts?: ConceptIngestResult;
  chunks?: ChunkIngestResult;
}

export interface IngestionResult extends IngestionContext {
  metadata: PaperMetadata;
  sections: PaperSection[];
  citations: CitationIngestResult;
  concepts: ConceptIngestResult;
  chunks: ChunkIngestResult;
}
