import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { Pool } from 'pg';

let envLoaded = false;

export function loadLocalEnv() {
  if (envLoaded) {
    return;
  }

  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile('.env');
    } catch {
      // Missing local env files should not crash CLI scripts.
    }
  }

  envLoaded = true;
}

export function getDatabaseUrl() {
  loadLocalEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }
  return databaseUrl;
}

export function createPool(options = {}) {
  return new Pool({
    connectionString: getDatabaseUrl(),
    max: 4,
    ...options,
  });
}

export async function withPool(fn) {
  const pool = createPool();
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function readSchemaSql() {
  const schemaPath = new URL('../db/schema.sql', import.meta.url);
  return readFile(schemaPath, 'utf8');
}
