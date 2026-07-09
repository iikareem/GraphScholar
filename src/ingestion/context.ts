import type { PaperMetadata, PaperSection } from './types.js';
import type { CitationIngestResult } from './citations.js';

export interface IngestionContext {
  paperId: string;
  metadata?: PaperMetadata;
  sections?: PaperSection[];
  citations?: CitationIngestResult;
}

export interface IngestionResult extends IngestionContext {
  metadata: PaperMetadata;
  sections: PaperSection[];
  citations: CitationIngestResult;
}
