import type { PaperMetadata, PaperSection } from './types.js';
import type { CitationIngestResult } from './citations.js';
import type { ConceptIngestResult } from './concepts.js';

export interface IngestionContext {
  paperId: string;
  metadata?: PaperMetadata;
  sections?: PaperSection[];
  citations?: CitationIngestResult;
  concepts?: ConceptIngestResult;
}

export interface IngestionResult extends IngestionContext {
  metadata: PaperMetadata;
  sections: PaperSection[];
  citations: CitationIngestResult;
  concepts: ConceptIngestResult;
}
