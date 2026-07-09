import {
  ARXIV_ID_PATTERN,
  extractArxivIdFromText,
  normalizeArxivId,
} from './arxiv-id.js';

export { extractArxivIdFromText, normalizeArxivId } from './arxiv-id.js';

const VENUE_STOP_PATTERN =
  /\b(?:in proceedings of|proceedings of|journal of|ieee|acm|vol\.|pp\.|arxiv preprint|doi:|http)/i;

/** Split a references section into individual bibliography entries */
export function splitReferenceEntries(referencesText: string): string[] {
  const byBracket = referencesText
    .split(/(?=\[\d+\])/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (byBracket.length > 1) {
    return byBracket;
  }

  const byNumber = referencesText
    .split(/(?=^\d+\.\s+)/m)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return byNumber.length > 1 ? byNumber : [referencesText.trim()];
}

/** Collect unique ArXiv ids found anywhere in the references section */
export function extractArxivIdsFromReferences(referencesText: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = ARXIV_ID_PATTERN.exec(referencesText)) !== null) {
    const id = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (id) {
      ids.add(id);
    }
  }

  ARXIV_ID_PATTERN.lastIndex = 0;
  return [...ids];
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function looksLikeAuthorList(part: string): boolean {
  if (!part.includes(',')) {
    return false;
  }

  return /\band\b/i.test(part) && part.split(',').length >= 2;
}

/** Best-effort title extraction for ArXiv title search */
export function extractTitleFromEntry(entry: string): string | null {
  let text = entry.replace(/^\s*(?:\[\d+\]|\d+\.)\s*/, '').trim();
  text = text.replace(/https?:\/\/\S+/gi, ' ');
  text = text.replace(ARXIV_ID_PATTERN, ' ');
  ARXIV_ID_PATTERN.lastIndex = 0;

  const parts = text
    .split(/\.\s+/)
    .map((part) => normalizeTitle(part))
    .filter((part) => part.length >= 8);

  for (const part of parts) {
    if (VENUE_STOP_PATTERN.test(part)) {
      break;
    }

    if (/^\d{4}$/.test(part)) {
      continue;
    }

    if (looksLikeAuthorList(part)) {
      continue;
    }

    return part;
  }

  return null;
}
