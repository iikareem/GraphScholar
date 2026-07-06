import { NodeLabel } from './labels.js';

export type Embedding = number[];

export interface PaperNode {
  label: typeof NodeLabel.Paper;
  id: string;
  version: string;
  title: string;
  /** Display metadata only — searchable copy is on Chunk with section "abstract" */
  abstract: string;
  published: string;
  updated: string;
  pdfUrl: string;
}

export interface AuthorNode {
  label: typeof NodeLabel.Author;
  name: string;
}

export interface CategoryNode {
  label: typeof NodeLabel.Category;
  name: string;
}

export interface ConceptNode {
  label: typeof NodeLabel.Concept;
  name: string;
  embedding: Embedding;
}

export interface ChunkNode {
  label: typeof NodeLabel.Chunk;
  id: string;
  chunkIndex: number;
  section: string;
  text: string;
  embedding: Embedding;
  page?: number;
}

export type GraphNode = PaperNode | AuthorNode | CategoryNode | ConceptNode | ChunkNode;
