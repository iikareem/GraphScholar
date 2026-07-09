const NEW_ARXIV_ID = /\d{4}\.\d{4,5}/;
const OLD_ARXIV_ID = /[a-z-]+\/\d{5,7}/;

/** Parse new (1706.03762) or legacy (math/0307087) ids from API urls or bare ids */
export function parseArxivId(value: string): { id: string; version: string } {
  const trimmed = value.trim();

  const newUrlMatch = trimmed.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})(v\d+)?/i);
  if (newUrlMatch) {
    return { id: newUrlMatch[1]!, version: newUrlMatch[2] ?? 'v1' };
  }

  const oldUrlMatch = trimmed.match(/arxiv\.org\/abs\/([a-z-]+\/\d{5,7})(v\d+)?/i);
  if (oldUrlMatch) {
    return { id: oldUrlMatch[1]!, version: oldUrlMatch[2] ?? 'v1' };
  }

  const newBareMatch = trimmed.match(/^(\d{4}\.\d{4,5})(v\d+)?$/i);
  if (newBareMatch) {
    return { id: newBareMatch[1]!, version: newBareMatch[2] ?? 'v1' };
  }

  const oldBareMatch = trimmed.match(/^([a-z-]+\/\d{5,7})(v\d+)?$/i);
  if (oldBareMatch) {
    return { id: oldBareMatch[1]!, version: oldBareMatch[2] ?? 'v1' };
  }

  throw new Error(`Could not parse ArXiv id from: ${value}`);
}

export function buildArxivPdfUrl(id: string, version: string): string {
  return `https://arxiv.org/pdf/${id}${version}`;
}

export function isValidArxivId(id: string): boolean {
  return NEW_ARXIV_ID.test(id) || OLD_ARXIV_ID.test(id);
}

/** Match new and legacy ArXiv ids in bibliography text or urls */
export const ARXIV_ID_PATTERN =
  /arxiv\.org\/(?:abs|pdf)\/(?:(\d{4}\.\d{4,5})|([a-z-]+\/\d{5,7}))(?:v\d+)?|arxiv\s*[:\s]+(?:(\d{4}\.\d{4,5})|([a-z-]+\/\d{5,7}))(?:v\d+)?/gi;

export function extractArxivIdFromText(text: string): string | null {
  const match = ARXIV_ID_PATTERN.exec(text);
  ARXIV_ID_PATTERN.lastIndex = 0;

  if (!match) {
    return null;
  }

  return match[1] ?? match[2] ?? match[3] ?? match[4] ?? null;
}

export function normalizeArxivId(id: string): string {
  return id.replace(/v\d+$/i, '');
}
