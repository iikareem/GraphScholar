import type { Repositories } from '../graph/repositories/index.js';
import { isLightIngestionMode } from '../config/ai.js';
import type { PaperMetadata } from './types.js';
import { embedText } from './embedder.js';
import { extractConceptsLight } from './concepts-light.js';
import {
  extractConceptsFromAbstract,
  normalizeConceptName,
} from './concepts-extract.js';

export interface ConceptIngestResult {
  introduces: string[];
  uses: string[];
  related: number;
  mode: 'light' | 'llm';
}

async function ensureConcept(name: string, repos: Repositories): Promise<void> {
  if (await repos.concept.exists(name)) {
    return;
  }

  const embedding = await embedText(name);
  await repos.concept.upsert(name, embedding);
}

/** Phase 4: extract concepts and persist Concept nodes + relationships */
export async function ingestConcepts(
  paperId: string,
  metadata: PaperMetadata,
  repos: Repositories,
): Promise<ConceptIngestResult> {
  const extracted = isLightIngestionMode()
    ? extractConceptsLight(metadata)
    : await extractConceptsFromAbstract(metadata.paper.abstract);

  const introduces = new Set<string>();
  const uses = new Set<string>();

  for (const name of extracted.introduces) {
    const normalized = normalizeConceptName(name);
    if (!normalized) continue;

    introduces.add(normalized);
    await ensureConcept(normalized, repos);
    await repos.concept.linkIntroduces(paperId, normalized);
  }

  for (const name of extracted.uses) {
    const normalized = normalizeConceptName(name);
    if (!normalized) continue;

    uses.add(normalized);
    await ensureConcept(normalized, repos);
    await repos.concept.linkUses(paperId, normalized);
  }

  let relatedCount = 0;

  if (!isLightIngestionMode()) {
    for (const [from, to] of extracted.related) {
      const fromName = normalizeConceptName(from);
      const toName = normalizeConceptName(to);
      if (!fromName || !toName || fromName === toName) continue;

      await ensureConcept(fromName, repos);
      await ensureConcept(toName, repos);
      await repos.concept.linkRelatedTo(fromName, toName);
      relatedCount++;
    }
  }

  return {
    introduces: [...introduces],
    uses: [...uses],
    related: relatedCount,
    mode: isLightIngestionMode() ? 'light' : 'llm',
  };
}
