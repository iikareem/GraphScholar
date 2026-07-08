import { XMLParser } from 'fast-xml-parser';
import { NodeLabel } from '../graph/model/index.js';
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

function parseArxivId(entryId: string): { id: string; version: string } {
  const match = entryId.match(/arxiv\.org\/abs\/(\d+\.\d+)(v\d+)?/i);
  if (!match) {
    throw new Error(`Could not parse ArXiv id from: ${entryId}`);
  }
  return { id: match[1], version: match[2] ?? 'v1' };
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
    pdfUrl: pdfLink?.['@_href'] ?? `https://arxiv.org/pdf/${id}${version}`,
  };

  return {
    paper,
    authors: authorNames.map((name) => ({ label: NodeLabel.Author, name })),
    categories: categoryNames.map((name) => ({ label: NodeLabel.Category, name })),
  };
}

/** Fetch paper metadata from ArXiv API and map to graph model types */
export async function fetchPaperMetadata(paperId: string): Promise<PaperMetadata> {
  const url = new URL(ARXIV_API);
  url.searchParams.set('id_list', paperId);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ArXiv API error: ${response.status} ${response.statusText}`);
  }

  const parsed = xmlParser.parse(await response.text()) as {
    feed: { entry?: Record<string, unknown> | Record<string, unknown>[] };
  };

  const entries = asArray(parsed.feed.entry);
  if (entries.length === 0) {
    throw new Error(`Paper not found: ${paperId}`);
  }

  return mapEntryToMetadata(entries[0]);
}
