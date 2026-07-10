import type { PaperMetadata } from './types.js';
import type { ExtractedConcepts } from './ai/types.js';
import { normalizeConceptName } from './concepts-extract.js';

/** Proof-of-concept extraction — no LLM, uses ArXiv categories as concept seeds */
export function extractConceptsLight(metadata: PaperMetadata): ExtractedConcepts {
  const uses = metadata.categories
    .map((category) => normalizeConceptName(category.name))
    .filter(Boolean);

  const titleConcept = normalizeConceptName(metadata.paper.title);
  const introduces =
    titleConcept && titleConcept.length <= 80 ? [titleConcept] : [];

  return {
    introduces,
    uses,
    related: [],
  };
}
