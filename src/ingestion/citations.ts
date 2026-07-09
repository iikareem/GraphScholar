import type { Repositories } from '../graph/repositories/index.js';
import { fetchPaperMetadataList, searchArxivByTitle } from './arxiv.js';
import { persistMetadata } from './metadata.js';
import {
  extractArxivIdFromText,
  extractTitleFromEntry,
  normalizeArxivId,
  splitReferenceEntries,
} from './references.js';
import type { PaperSection } from './types.js';

const ARXIV_REQUEST_DELAY_MS = 3_000;
const METADATA_BATCH_SIZE = 20;

export interface CitationIngestResult {
  citedIds: string[];
  unresolved: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveEntryToArxivId(entry: string): Promise<string | null> {
  const embeddedId = extractArxivIdFromText(entry);
  if (embeddedId) {
    return normalizeArxivId(embeddedId);
  }

  const title = extractTitleFromEntry(entry);
  if (!title) {
    return null;
  }

  const id = await searchArxivByTitle(title);
  await sleep(ARXIV_REQUEST_DELAY_MS);
  return id ? normalizeArxivId(id) : null;
}

async function resolveCitedIds(
  referencesText: string,
  sourcePaperId: string,
): Promise<{ citedIds: string[]; unresolved: number }> {
  const entries = splitReferenceEntries(referencesText);
  const citedIds = new Set<string>();
  let unresolved = 0;

  for (const entry of entries) {
    const citedId = await resolveEntryToArxivId(entry);

    if (!citedId || citedId === sourcePaperId) {
      if (!citedId) {
        unresolved++;
      }
      continue;
    }

    citedIds.add(citedId);
  }

  return { citedIds: [...citedIds], unresolved };
}

async function persistCitedPapers(
  sourcePaperId: string,
  citedIds: string[],
  repos: Repositories,
): Promise<void> {
  for (let index = 0; index < citedIds.length; index += METADATA_BATCH_SIZE) {
    const batch = citedIds.slice(index, index + METADATA_BATCH_SIZE);
    const metadataList = await fetchPaperMetadataList(batch);

    for (const metadata of metadataList) {
      await persistMetadata(metadata, repos);
      await repos.paper.linkCites(sourcePaperId, metadata.paper.id);
    }

    if (index + METADATA_BATCH_SIZE < citedIds.length) {
      await sleep(ARXIV_REQUEST_DELAY_MS);
    }
  }
}

/** Phase 3: parse references, resolve cited papers on ArXiv, persist metadata and CITES edges */
export async function ingestCitations(
  sourcePaperId: string,
  sections: PaperSection[],
  repos: Repositories,
): Promise<CitationIngestResult> {
  const referencesSection = sections.find((section) => section.name === 'references');

  if (!referencesSection?.text.trim()) {
    return { citedIds: [], unresolved: 0 };
  }

  const { citedIds, unresolved } = await resolveCitedIds(
    referencesSection.text,
    sourcePaperId,
  );

  if (citedIds.length > 0) {
    await persistCitedPapers(sourcePaperId, citedIds, repos);
  }

  return { citedIds, unresolved };
}
