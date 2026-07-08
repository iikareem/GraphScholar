import {fetchPaperMetadata} from './arxiv.js';
import type {PaperMetadata} from './types.js';

/** Phase 1: fetch metadata from ArXiv */
export async function ingestMetadata(paperId: string): Promise<PaperMetadata> {
    const metaData = await fetchPaperMetadata(paperId);


    return metaData;

}
