import type { Session } from 'neo4j-driver';
import { AuthorRepository } from './author.repository.js';
import { CategoryRepository } from './category.repository.js';
import { ChunkRepository } from './chunk.repository.js';
import { ConceptRepository } from './concept.repository.js';
import { PaperRepository } from './paper.repository.js';

export interface Repositories {
  paper: PaperRepository;
  author: AuthorRepository;
  category: CategoryRepository;
  concept: ConceptRepository;
  chunk: ChunkRepository;
}

export function createRepositories(session: Session): Repositories {
  return {
    paper: new PaperRepository(session),
    author: new AuthorRepository(session),
    category: new CategoryRepository(session),
    concept: new ConceptRepository(session),
    chunk: new ChunkRepository(session),
  };
}

export { AuthorRepository } from './author.repository.js';
export { CategoryRepository } from './category.repository.js';
export { ChunkRepository } from './chunk.repository.js';
export { ConceptRepository } from './concept.repository.js';
export { PaperRepository } from './paper.repository.js';
