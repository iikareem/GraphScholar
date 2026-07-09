import { getDocument, type TextItem } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PaperMetadata, ExtractedPaper, PaperSection } from './types.js';
import { splitIntoSections, type TextLine } from './sections.js';

const ARXIV_PDF_HEADERS = {
  'User-Agent': 'GraphScholar/0.1 (research ingestion; mailto:dev@local)',
};

export async function downloadPdf(pdfUrl: string): Promise<Uint8Array> {
  const response = await fetch(pdfUrl, { headers: ARXIV_PDF_HEADERS });

  if (!response.ok) {
    throw new Error(`Failed to download PDF (${response.status}): ${pdfUrl}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('pdf') && !pdfUrl.includes('/pdf/')) {
    throw new Error(`Unexpected content type for PDF: ${contentType}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function extractLinesFromPage(pageNumber: number, items: TextItem[]): TextLine[] {
  const buckets = new Map<number, { items: TextItem[]; fontSize: number }>();

  for (const item of items) {
    if (!item.str.trim()) continue;

    const y = Math.round(item.transform[5] ?? 0);
    const fontSize = item.transform[0] ?? 10;
    const bucket = buckets.get(y) ?? { items: [], fontSize: 0 };
    bucket.items.push(item);
    bucket.fontSize = Math.max(bucket.fontSize, fontSize);
    buckets.set(y, bucket);
  }

  const lines: TextLine[] = [];

  for (const [, bucket] of [...buckets.entries()].sort((a, b) => b[0] - a[0])) {
    const sorted = bucket.items.sort(
      (a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0),
    );
    const text = sorted
      .map((item) => item.str)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      lines.push({ text, page: pageNumber, fontSize: bucket.fontSize });
    }
  }

  return lines;
}

export async function extractLines(pdfBytes: Uint8Array): Promise<TextLine[]> {
  const document = await getDocument({ data: pdfBytes, useSystemFonts: true }).promise;
  const lines: TextLine[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    lines.push(...extractLinesFromPage(pageNumber, content.items as TextItem[]));
  }

  return lines;
}

function ensureAbstractSection(
  sections: PaperSection[],
  metadata: PaperMetadata,
): PaperSection[] {
  if (sections.some((section) => section.name === 'abstract')) {
    return sections;
  }

  if (!metadata.paper.abstract.trim()) {
    return sections;
  }

  return [
    { name: 'abstract', text: metadata.paper.abstract },
    ...sections,
  ];
}

/** Phase 2: download PDF, extract text, split into sections */
export async function ingestPdf(
  paperId: string,
  metadata: PaperMetadata,
): Promise<ExtractedPaper> {
  const pdfBytes = await downloadPdf(metadata.paper.pdfUrl);
  const lines = await extractLines(pdfBytes);
  const sections = ensureAbstractSection(splitIntoSections(lines), metadata);

  if (sections.length === 0) {
    throw new Error(`No sections extracted from PDF for ${paperId}`);
  }

  return { paperId, sections };
}
