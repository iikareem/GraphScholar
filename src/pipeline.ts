import type { Repositories } from './graph/repositories/index.js';
import type { IngestionResult } from './ingestion/context.js';
import { ingestCitations } from './ingestion/citations.js';
import { ingestMetadata } from './ingestion/metadata.js';
import { ingestPdf } from './ingestion/pdf.js';

/** Orchestrates ingestion phases for one paper — no business logic here */
export async function runPipeline(
  paperId: string,
  repos: Repositories,
): Promise<IngestionResult> {
  const metadata = await ingestMetadata(paperId, repos);
  const { sections } = await ingestPdf(paperId, metadata);
  const citations = await ingestCitations(paperId, sections, repos);

  // await ingestConcepts(metadata, repos);
  // await ingestChunks(paperId, sections, repos);

  return { paperId, metadata, sections, citations };
}
