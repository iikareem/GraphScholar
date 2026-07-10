import { getAiConfig, isLightIngestionMode } from '../config/ai.js';
import type { Embedding } from '../graph/model/index.js';
import { createEmbedding } from './ai/client.js';

function createPlaceholderEmbedding(dimensions: number): Embedding {
  return Array.from({ length: dimensions }, () => 0);
}

/** Convert text to a numeric vector for semantic search */
export async function embedText(text: string): Promise<Embedding> {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new Error('Cannot embed empty text');
  }

  const { embeddingDimensions } = getAiConfig();

  if (isLightIngestionMode()) {
    return createPlaceholderEmbedding(embeddingDimensions);
  }

  const vector = await createEmbedding(normalized);

  if (vector.length !== embeddingDimensions) {
    throw new Error(
      `Embedding size mismatch: got ${vector.length}, expected ${embeddingDimensions}. ` +
        'Update EMBEDDING_DIMENSIONS in .env to match your embedding model.',
    );
  }

  return vector;
}
