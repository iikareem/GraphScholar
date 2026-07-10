import './env.js';

export interface ChunkConfig {
  wordLimit: number;
  overlapWords: number;
}

export function getChunkConfig(): ChunkConfig {
  const wordLimit = Number(process.env.CHUNK_WORD_LIMIT ?? 400);
  const overlapWords = Number(process.env.CHUNK_OVERLAP_WORDS ?? 40);

  if (!Number.isFinite(wordLimit) || wordLimit <= 0) {
    throw new Error('CHUNK_WORD_LIMIT must be a positive number');
  }

  if (!Number.isFinite(overlapWords) || overlapWords < 0 || overlapWords >= wordLimit) {
    throw new Error('CHUNK_OVERLAP_WORDS must be between 0 and CHUNK_WORD_LIMIT');
  }

  return { wordLimit, overlapWords };
}
