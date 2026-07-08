import type { Repositories } from './graph/repositories/index.js';
import type { IngestionResult } from './ingestion/context.js';
import { ingestMetadata } from './ingestion/metadata.js';

/** Orchestrates ingestion phases for one paper — no business logic here */
export async function runPipeline(
  paperId: string,
  repos: Repositories,
): Promise<IngestionResult> {
  const metadata = await ingestMetadata(paperId, repos);

  // await ingestPdf(paperId, metadata, repos);
  // await ingestCitations(paperId, repos);
  // await ingestConcepts(metadata, repos);
  // await ingestChunks(paperId, repos);

  return { paperId, metadata };
}
