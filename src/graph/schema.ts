import { closeDriver, createDriver } from './driver.js';
import { SCHEMA_STATEMENTS } from './model/index.js';

async function main() {
  const driver = createDriver();
  const session = driver.session();

  try {
    for (const statement of SCHEMA_STATEMENTS) {
      await session.run(statement);
    }
    console.log('Neo4j schema applied.');
  } finally {
    await session.close();
    await closeDriver(driver);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
