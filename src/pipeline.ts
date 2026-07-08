import {ingestMetadata} from './ingestion/metadata.js';
import type {IngestionResult} from './ingestion/context.js';

/** Orchestrates ingestion phases for one paper — no business logic here */
export async function runPipeline(paperId: string): Promise<IngestionResult> {
    const metadata = await ingestMetadata(paperId);

    // await ingestPdf(paperId, metadata);
    // await ingestCitations(paperId);
    // await ingestConcepts(metadata);
    // await ingestChunks(paperId);

    return {paperId, metadata};
}
