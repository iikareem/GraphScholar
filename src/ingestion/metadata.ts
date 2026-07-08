import type { Repositories } from '../graph/repositories/index.js';
import { fetchPaperMetadata } from './arxiv.js';
import type { PaperMetadata } from './types.js';

/** Phase 1: fetch metadata from ArXiv and persist Paper, Author, Category nodes */
export async function ingestMetadata(
  paperId: string,
  repos: Repositories,
): Promise<PaperMetadata> {
  const metadata = await fetchPaperMetadata(paperId);

  await repos.paper.upsert(metadata.paper);

  for (const author of metadata.authors) {
    await repos.author.upsert(author);
    await repos.author.linkWrote(author.name, metadata.paper.id);
  }

  for (const category of metadata.categories) {
    await repos.category.upsert(category);
    await repos.paper.linkBelongsTo(metadata.paper.id, category.name);
  }

  return metadata;
}
