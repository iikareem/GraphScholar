import {PAPER_IDS} from './config/papers.js';
import type {IngestionResult} from './ingestion/context.js';
import {runPipeline} from './pipeline.js';

function logResult({paperId, metadata}: IngestionResult) {
    console.log(`[seed] ${paperId} — ${metadata.paper.title}`);
    console.log(`       authors: ${metadata.authors.map((a) => a.name).join(', ')}`);
    console.log(`       categories: ${metadata.categories.map((c) => c.name).join(', ')}`);
}

async function main() {
    console.log(`Seeding ${PAPER_IDS.length} papers from config...\n`);

    for (const paperId of PAPER_IDS) {
        console.log(`[seed] ${paperId} — starting...`);
        const result = await runPipeline(paperId);
        logResult(result);
        console.log('');
    }

    console.log('Done.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
