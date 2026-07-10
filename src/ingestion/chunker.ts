import { getChunkConfig } from '../config/ingestion.js';
import type { PaperSection, SectionName } from './types.js';

export interface TextChunk {
  chunkIndex: number;
  section: SectionName;
  text: string;
  page?: number;
}

const CHUNKABLE_SECTIONS = new Set<SectionName>([
  'abstract',
  'introduction',
  'methodology',
  'results',
  'conclusion',
]);

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function takeLastWords(text: string, wordCount: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= wordCount) {
    return text.trim();
  }

  return words.slice(-wordCount).join(' ');
}

function splitByWordWindow(text: string, wordLimit: number, overlapWords: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) {
    return [words.join(' ')];
  }

  const chunks: string[] = [];
  const step = Math.max(1, wordLimit - overlapWords);

  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + wordLimit);
    if (slice.length === 0) {
      break;
    }

    chunks.push(slice.join(' '));
    if (start + wordLimit >= words.length) {
      break;
    }
  }

  return chunks;
}

/** Split one section into one or more text chunks */
export function chunkSection(section: PaperSection): TextChunk[] {
  const text = section.text.replace(/\s+/g, ' ').trim();
  if (!text) {
    return [];
  }

  const { wordLimit, overlapWords } = getChunkConfig();

  if (countWords(text) <= wordLimit) {
    return [
      {
        chunkIndex: 0,
        section: section.name,
        text,
        page: section.startPage,
      },
    ];
  }

  const paragraphs = section.text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunkTexts: string[] = [];
  let currentParts: string[] = [];
  let currentWordCount = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph);

    if (paragraphWords > wordLimit) {
      if (currentParts.length > 0) {
        chunkTexts.push(currentParts.join('\n\n'));
        currentParts = [];
        currentWordCount = 0;
      }

      chunkTexts.push(...splitByWordWindow(paragraph, wordLimit, overlapWords));
      continue;
    }

    if (currentWordCount + paragraphWords > wordLimit && currentParts.length > 0) {
      const currentText = currentParts.join('\n\n');
      chunkTexts.push(currentText);

      const overlap = takeLastWords(currentText, overlapWords);
      currentParts = overlap ? [overlap, paragraph] : [paragraph];
      currentWordCount = countWords(currentParts.join('\n\n'));
      continue;
    }

    currentParts.push(paragraph);
    currentWordCount += paragraphWords;
  }

  if (currentParts.length > 0) {
    chunkTexts.push(currentParts.join('\n\n'));
  }

  return chunkTexts.map((chunkText, chunkIndex) => ({
    chunkIndex,
    section: section.name,
    text: chunkText.trim(),
    page: section.startPage,
  }));
}

/** Split all ingestible sections into chunks (skips references) */
export function chunkSections(sections: PaperSection[]): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    if (!CHUNKABLE_SECTIONS.has(section.name)) {
      continue;
    }

    chunks.push(...chunkSection(section));
  }

  return chunks;
}

export function buildChunkId(paperId: string, section: SectionName, chunkIndex: number): string {
  return `${paperId}:${section}:${chunkIndex}`;
}
