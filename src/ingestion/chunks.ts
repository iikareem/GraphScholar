import type { Repositories } from '../graph/repositories/index.js';
import { embedText } from './embedder.js';
import { buildChunkId, chunkSections } from './chunker.js';
import type { PaperSection } from './types.js';

export interface ChunkIngestResult {
  chunkCount: number;
}

/** Phase 5: split sections into chunks, embed, and persist Chunk nodes */
export async function ingestChunks(
  paperId: string,
  sections: PaperSection[],
  repos: Repositories,
): Promise<ChunkIngestResult> {
  const textChunks = chunkSections(sections);
  let chunkCount = 0;

  for (const textChunk of textChunks) {
    const id = buildChunkId(paperId, textChunk.section, textChunk.chunkIndex);
    const embedding = await embedText(textChunk.text);

    await repos.chunk.upsert({
      id,
      chunkIndex: textChunk.chunkIndex,
      section: textChunk.section,
      text: textChunk.text,
      embedding,
      page: textChunk.page,
    });

    await repos.chunk.linkHasChunk(paperId, id);
    chunkCount++;
  }

  return { chunkCount };
}
