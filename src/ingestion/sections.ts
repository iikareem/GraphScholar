import type { PaperSection, SectionName } from './types.js';

export interface TextLine {
  text: string;
  page: number;
  fontSize: number;
}

interface HeadingRule {
  name: SectionName;
  pattern: RegExp;
}

const SECTION_ORDER: SectionName[] = [
  'abstract',
  'introduction',
  'methodology',
  'results',
  'conclusion',
  'references',
];

const HEADING_RULES: HeadingRule[] = [
  { name: 'abstract', pattern: /^abstract$/i },
  { name: 'references', pattern: /^(?:references|bibliography)$/i },
  { name: 'introduction', pattern: /^(?:\d+(?:\.\d+)*\s+)?introduction$/i },
  {
    name: 'conclusion',
    pattern: /^(?:\d+(?:\.\d+)*\s+)?(?:conclusion|discussion)(?:\s+and\s+\w+)?$/i,
  },
  {
    name: 'results',
    pattern:
      /^(?:\d+(?:\.\d+)*\s+)?(?:results(?:\s+and\s+analysis)?|experiments|evaluation)$/i,
  },
  {
    name: 'methodology',
    pattern:
      /^(?:\d+(?:\.\d+)*\s+)?(?:related\s*work|background|methodology|methods|approach|model(?:\s+architecture)?|training|self[- ]?rag)/i,
  },
];

/** Insert spaces PDF extractors often omit between digits, words, and AND-clauses */
export function normalizeHeading(line: string): string {
  return line
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bAND([A-Z])/gi, 'AND $1')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: number[]): number {
  if (values.length === 0) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function sectionRank(name: SectionName): number {
  const rank = SECTION_ORDER.indexOf(name);
  return rank === -1 ? 0 : rank;
}

function bodyFontSize(lines: TextLine[]): number {
  const sizes = lines
    .filter((line) => line.text.length > 40)
    .map((line) => line.fontSize);
  return median(sizes);
}

function classifyHeading(line: string, fontSize: number, bodySize: number): SectionName | null {
  const normalized = normalizeHeading(line);

  for (const rule of HEADING_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.name;
    }
  }

  const isLargeFont = fontSize >= bodySize + 0.8;
  const isNumbered = /^\d+(?:\.\d+)*\s+\S/.test(normalized);

  if (isLargeFont && normalized.length <= 80) {
    return 'methodology';
  }

  if (isLargeFont && isNumbered && normalized.length <= 140) {
    return 'methodology';
  }

  return null;
}

function isHeadingLine(line: TextLine, bodySize: number): boolean {
  return classifyHeading(line.text, line.fontSize, bodySize) !== null;
}

function flushSection(
  sections: PaperSection[],
  name: SectionName,
  lines: TextLine[],
): void {
  const text = lines
    .map((line) => line.text)
    .join('\n')
    .trim();
  if (!text) return;

  const last = sections[sections.length - 1];
  if (last && last.name === name) {
    last.text = `${last.text}\n\n${text}`.trim();
    last.endPage = lines[lines.length - 1]?.page ?? last.endPage;
    return;
  }

  sections.push({
    name,
    text,
    startPage: lines[0]?.page,
    endPage: lines[lines.length - 1]?.page,
  });
}

function shouldIgnoreHeading(
  heading: SectionName,
  currentName: SectionName,
  seenIntroduction: boolean,
): boolean {
  if (!seenIntroduction && heading === 'methodology') {
    return true;
  }

  if (heading === currentName) {
    return true;
  }

  if (heading === 'methodology' && currentName === 'methodology') {
    return true;
  }

  const headingRank = sectionRank(heading);
  const currentRank = sectionRank(currentName);

  if (currentName !== 'unknown' && headingRank < currentRank) {
    return true;
  }

  return false;
}

/** Split extracted PDF lines into canonical paper sections */
export function splitIntoSections(lines: TextLine[]): PaperSection[] {
  if (lines.length === 0) return [];

  const bodySize = bodyFontSize(lines);
  const sections: PaperSection[] = [];
  let started = false;
  let seenIntroduction = false;
  let currentName: SectionName = 'unknown';
  let currentLines: TextLine[] = [];

  for (const line of lines) {
    if (isHeadingLine(line, bodySize)) {
      const heading = classifyHeading(line.text, line.fontSize, bodySize);
      if (!heading) continue;

      if (!started && heading !== 'abstract' && heading !== 'introduction') {
        continue;
      }

      started = true;

      if (heading === 'introduction') {
        seenIntroduction = true;
      }

      if (shouldIgnoreHeading(heading, currentName, seenIntroduction)) {
        continue;
      }

      flushSection(sections, currentName, currentLines);
      currentLines = [];
      currentName = heading;
      continue;
    }

    if (started) {
      currentLines.push(line);
    }
  }

  flushSection(sections, currentName, currentLines);

  const referencesIndex = sections.findIndex((section) => section.name === 'references');
  if (referencesIndex >= 0) {
    return sections.slice(0, referencesIndex + 1);
  }

  return sections.filter((section) => section.name !== 'unknown');
}
