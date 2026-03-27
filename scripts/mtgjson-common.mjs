import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { loadLocalEnv } from './db.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function getRepoRoot() {
  return repoRoot;
}

export function getCacheDir() {
  loadLocalEnv();
  const configured = process.env.OPENARENA_CACHE_DIR || './.cache';
  return path.resolve(getRepoRoot(), configured);
}

export function getMtgjsonDownloadUrl() {
  loadLocalEnv();
  return process.env.MTGJSON_DOWNLOAD_URL || 'https://mtgjson.com/api/v5/AllPrintings.psql.gz';
}

export function getMtgjsonDownloadDir() {
  loadLocalEnv();
  const configured = process.env.MTGJSON_DOWNLOAD_DIR || './.cache/mtgjson';
  return path.resolve(getRepoRoot(), configured);
}

export function getScryfallCacheDir() {
  loadLocalEnv();
  const configured = process.env.SCRYFALL_CACHE_DIR || './.cache/scryfall';
  return path.resolve(getRepoRoot(), configured);
}

export function getDownloadFilePath() {
  const downloadUrl = new URL(getMtgjsonDownloadUrl());
  return path.join(getMtgjsonDownloadDir(), path.basename(downloadUrl.pathname));
}

export function getPsqlBin() {
  loadLocalEnv();
  return process.env.PSQL_BIN || 'psql';
}

export function getStagingDatabaseUrl() {
  loadLocalEnv();
  const databaseUrl = process.env.MTGJSON_STAGING_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('MTGJSON_STAGING_DATABASE_URL is required.');
  }
  return databaseUrl;
}

export function getAdminDatabaseUrl() {
  loadLocalEnv();
  const configured = process.env.POSTGRES_ADMIN_URL;
  if (configured) {
    return configured;
  }

  const stagingUrl = new URL(getStagingDatabaseUrl());
  stagingUrl.pathname = '/postgres';
  return stagingUrl.toString();
}

export async function ensureDownloadDir() {
  const dir = getMtgjsonDownloadDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureScryfallCacheDir() {
  const dir = getScryfallCacheDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function getDatabaseName(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const name = parsed.pathname.replace(/^\//, '');
  if (!name) {
    throw new Error(`Database name missing from URL: ${databaseUrl}`);
  }
  return name;
}

export async function withAdminClient(fn) {
  const client = new Client({ connectionString: getAdminDatabaseUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
