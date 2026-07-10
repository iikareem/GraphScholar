import './env.js';

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  conceptModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

/** Skip LLM + embedding API — use ArXiv categories as concepts (proof of concept) */
export function isLightIngestionMode(): boolean {
  return process.env.INGESTION_LIGHT_MODE === 'true';
}

/** AI / embedding settings — works with oMLX, OpenAI, or any OpenAI-compatible server */
export function getAiConfig(): AiConfig {
  const embeddingDimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? 1024);
  if (!Number.isFinite(embeddingDimensions) || embeddingDimensions <= 0) {
    throw new Error('EMBEDDING_DIMENSIONS must be a positive number (1024 for bge-m3).');
  }

  if (isLightIngestionMode()) {
    return {
      baseUrl: '',
      apiKey: '',
      conceptModel: 'light-mode',
      embeddingModel: 'light-mode',
      embeddingDimensions,
    };
  }

  const baseUrl = process.env.OPENAI_BASE_URL ?? 'http://localhost:8000/v1';
  const apiKey = process.env.OPENAI_API_KEY ?? 'none';
  const conceptModel = process.env.CONCEPT_MODEL;
  const embeddingModel = process.env.EMBEDDING_MODEL;

  if (!conceptModel || !embeddingModel) {
    throw new Error(
      'Missing CONCEPT_MODEL or EMBEDDING_MODEL. Set them in .env for your oMLX model names, ' +
        'or set INGESTION_LIGHT_MODE=true for a RAM-friendly proof of concept.',
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    conceptModel,
    embeddingModel,
    embeddingDimensions,
  };
}

/** Used by Neo4j vector indexes — must match your embedding model output size */
export const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 1024);
