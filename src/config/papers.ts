/**
 * Papers to ingest. Add an ArXiv id here, then run: npm run seed
 */
export const PAPER_IDS = [
  '2310.11511', // Self-RAG
  '2312.10997', // Advanced RAG survey
  '1706.03762', // Attention Is All You Need
  '2005.11401', // RAG for Knowledge-Intensive NLP
  '2405.14831', // HippoRAG
] as const;

export type PaperId = (typeof PAPER_IDS)[number];
