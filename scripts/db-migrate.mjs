import process from 'node:process';
import { readSchemaSql, withPool } from './db.mjs';

async function main() {
  await withPool(async (pool) => {
    const sql = await readSchemaSql();
    await pool.query(sql);
  });

  console.log('Applied db/schema.sql');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
