import type { Repositories } from './graph/repositories/index.js';
import type { IngestionResult } from './ingestion/context.js';
import { ingestChunks } from './ingestion/chunks.js';
import { ingestCitations } from './ingestion/citations.js';
import { ingestConcepts } from './ingestion/concepts.js';
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
  const concepts = await ingestConcepts(paperId, metadata, repos);
  const chunks = await ingestChunks(paperId, sections, repos);

  return { paperId, metadata, sections, citations, concepts, chunks };
}
