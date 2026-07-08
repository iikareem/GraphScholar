import type { PaperMetadata } from './types.js';

export interface IngestionContext {
  paperId: string;
  metadata?: PaperMetadata;
}

export interface IngestionResult extends IngestionContext {
  metadata: PaperMetadata;
}
