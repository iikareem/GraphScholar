import { PAPER_IDS } from './config/papers.js';
import { closeDriver, createDriver } from './graph/driver.js';
import { createRepositories } from './graph/repositories/index.js';
import type { IngestionResult } from './ingestion/context.js';
import { runPipeline } from './pipeline.js';

function logResult({ paperId, metadata }: IngestionResult) {
  console.log(`[seed] ${paperId} — ${metadata.paper.title}`);
  console.log(`       authors: ${metadata.authors.map((a) => a.name).join(', ')}`);
  console.log(`       categories: ${metadata.categories.map((c) => c.name).join(', ')}`);
}

async function main() {
  const driver = createDriver();
  const session = driver.session();
  const repos = createRepositories(session);

  try {
    console.log(`Seeding ${PAPER_IDS.length} papers from config...\n`);

    for (const paperId of PAPER_IDS) {
      console.log(`[seed] ${paperId} — starting...`);
      const result = await runPipeline(paperId, repos);
      logResult(result);
      console.log('');
    }

    console.log('Done.');
  } finally {
    await session.close();
    await closeDriver(driver);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
