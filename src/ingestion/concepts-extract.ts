import { createChatJson } from './ai/client.js';
import type { ExtractedConcepts } from './ai/types.js';

const SYSTEM_PROMPT = `You extract research concepts from paper abstracts.
Return valid JSON only, with this exact shape:
{
  "introduces": ["concept the paper introduces"],
  "uses": ["existing concept or method the paper uses"],
  "related": [["concept A", "concept B"]]
}
Rules:
- Use short canonical names (2-5 words), lowercase preferred
- "introduces" = new ideas introduced by this paper (empty array if none)
- "uses" = existing methods/topics the paper builds on
- "related" = pairs of concepts that are related (can be empty)
- Do not include authors, paper titles, or venues as concepts`;

function parseConceptJson(raw: string): ExtractedConcepts {
  const parsed = JSON.parse(raw) as Partial<ExtractedConcepts>;

  return {
    introduces: normalizeList(parsed.introduces),
    uses: normalizeList(parsed.uses),
    related: normalizePairs(parsed.related),
  };
}

function coerceConceptItem(item: unknown): string | null {
  if (typeof item === 'string') {
    return normalizeConceptName(item);
  }

  if (item && typeof item === 'object' && 'name' in item) {
    return normalizeConceptName(String((item as { name: unknown }).name));
  }

  return null;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(coerceConceptItem).filter((name): name is string => Boolean(name)))];
}

function normalizePairs(value: unknown): [string, string][] {
  if (!Array.isArray(value)) {
    return [];
  }

  const pairs: [string, string][] = [];

  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) {
      continue;
    }

    const from = normalizeConceptName(String(item[0]));
    const to = normalizeConceptName(String(item[1]));

    if (from && to && from !== to) {
      pairs.push([from, to]);
    }
  }

  return pairs;
}

export function normalizeConceptName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Use the LLM to extract introduces / uses / related concept pairs from an abstract */
export async function extractConceptsFromAbstract(abstract: string): Promise<ExtractedConcepts> {
  const userPrompt = `Abstract:\n${abstract.trim()}`;
  const raw = await createChatJson(SYSTEM_PROMPT, userPrompt);
  return parseConceptJson(raw);
}
