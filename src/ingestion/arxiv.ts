import { XMLParser } from 'fast-xml-parser';
import { NodeLabel } from '../graph/model/index.js';
import { buildArxivPdfUrl, parseArxivId } from './arxiv-id.js';
import type { PaperMetadata } from './types.js';

const ARXIV_API = 'https://export.arxiv.org/api/query';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  trimValues: true,
  isArray: (name) => name === 'entry' || name === 'author' || name === 'category' || name === 'link',
});

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function mapEntryToMetadata(entry: Record<string, unknown>): PaperMetadata {
  const entryId = String(entry.id);
  const { id, version } = parseArxivId(entryId);

  const authorNames = asArray<{ name: string }>(entry.author as { name: string } | { name: string }[])
    .map((a) => normalizeText(a.name))
    .filter(Boolean);

  const categoryNames = asArray<{ '@_term'?: string }>(
    entry.category as { '@_term'?: string } | { '@_term'?: string }[],
  )
    .map((c) => c['@_term'])
    .filter((name): name is string => Boolean(name));

  const links = asArray<{ '@_href'?: string; '@_rel'?: string; '@_type'?: string }>(
    entry.link as { '@_href'?: string; '@_rel'?: string; '@_type'?: string } | object[],
  );
  const pdfLink = links.find((l) => l['@_type'] === 'application/pdf');

  const paper: PaperMetadata['paper'] = {
    label: NodeLabel.Paper,
    id,
    version,
    title: normalizeText(String(entry.title)),
    abstract: normalizeText(String(entry.summary)),
    published: String(entry.published),
    updated: String(entry.updated),
    pdfUrl: pdfLink?.['@_href'] ?? buildArxivPdfUrl(id, version),
  };

  return {
    paper,
    authors: authorNames.map((name) => ({ label: NodeLabel.Author, name })),
    categories: categoryNames.map((name) => ({ label: NodeLabel.Category, name })),
  };
}

/** Fetch paper metadata from ArXiv API and map to graph model types */
export async function fetchPaperMetadata(paperId: string): Promise<PaperMetadata> {
  const results = await fetchPaperMetadataList([paperId]);
  const metadata = results[0];

  if (!metadata) {
    throw new Error(`Paper not found: ${paperId}`);
  }

  return metadata;
}

/** Fetch metadata for multiple papers in one ArXiv API request */
export async function fetchPaperMetadataList(paperIds: string[]): Promise<PaperMetadata[]> {
  if (paperIds.length === 0) {
    return [];
  }

  const url = new URL(ARXIV_API);
  url.searchParams.set('id_list', paperIds.join(','));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ArXiv API error: ${response.status} ${response.statusText}`);
  }

  const parsed = xmlParser.parse(await response.text()) as {
    feed: { entry?: Record<string, unknown> | Record<string, unknown>[] };
  };

  const entries = asArray(parsed.feed.entry);
  return entries.map((entry) => mapEntryToMetadata(entry));
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Search ArXiv by title and return the best-matching paper id, if any */
export async function searchArxivByTitle(title: string): Promise<string | null> {
  const queryTitle = normalizeTitle(title);
  if (queryTitle.length < 8) {
    return null;
  }

  const url = new URL(ARXIV_API);
  url.searchParams.set('search_query', `ti:"${title.replace(/"/g, '')}"`);
  url.searchParams.set('max_results', '5');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ArXiv API error: ${response.status} ${response.statusText}`);
  }

  const parsed = xmlParser.parse(await response.text()) as {
    feed: { entry?: Record<string, unknown> | Record<string, unknown>[] };
  };

  const entries = asArray(parsed.feed.entry);
  if (entries.length === 0) {
    return null;
  }

  for (const entry of entries) {
    const metadata = mapEntryToMetadata(entry);
    const resultTitle = normalizeTitle(metadata.paper.title);

    if (resultTitle === queryTitle || resultTitle.includes(queryTitle)) {
      return metadata.paper.id;
    }
  }

  return mapEntryToMetadata(entries[0]).paper.id;
}
