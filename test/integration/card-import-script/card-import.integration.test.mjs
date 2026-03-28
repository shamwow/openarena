import { chmod, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { readSchemaSql } from '../../../scripts/db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const fixturesDir = path.join(__dirname, 'fixtures');
const configPath = path.join(fixturesDir, 'card-import-test.config.mjs');
const fakeCodexPath = path.join(fixturesDir, 'fake-codex.mjs');
const importerPath = path.join(repoRoot, 'scripts/import-cards.mjs');
const adminDatabaseUrl = process.env.TEST_POSTGRES_ADMIN_URL || 'postgres://ironsha@127.0.0.1:5432/postgres';

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function withAdminClient(fn) {
  const client = new Client({ connectionString: adminDatabaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function recreateDatabase(databaseName) {
  await withAdminClient(async (client) => {
    const quotedName = quoteIdentifier(databaseName);
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
      [databaseName]
    );
    await client.query(`drop database if exists ${quotedName}`);
    await client.query(`create database ${quotedName}`);
  });
}

async function dropDatabase(databaseName) {
  await withAdminClient(async (client) => {
    const quotedName = quoteIdentifier(databaseName);
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
      [databaseName]
    );
    await client.query(`drop database if exists ${quotedName}`);
  });
}

function getDatabaseUrl(databaseName) {
  const parsed = new URL(adminDatabaseUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

async function executeSql(databaseUrl, sql) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function applyAppSchema(databaseUrl) {
  const schemaSql = await readSchemaSql();
  await executeSql(databaseUrl, schemaSql);
}

async function createStagingSchema(databaseUrl) {
  await executeSql(
    databaseUrl,
    `
      create table sets (
        "code" text primary key,
        "name" text not null,
        "releaseDate" date,
        "type" text,
        "isOnlineOnly" boolean,
        "isPaperOnly" boolean
      );

      create table cards (
        "uuid" uuid primary key,
        "name" text not null,
        "setCode" text not null,
        "number" text not null,
        "language" text not null,
        "manaCost" text,
        "manaValue" numeric,
        "type" text not null,
        "text" text,
        "power" text,
        "toughness" text,
        "loyalty" text,
        "rarity" text,
        "colorIdentity" text,
        "types" text,
        "supertypes" text,
        "subtypes" text,
        "side" text,
        "layout" text,
        "isOnlineOnly" boolean,
        "isFunny" boolean,
        "isPromo" boolean,
        "isRebalanced" boolean,
        "isFullArt" boolean,
        "isTextless" boolean,
        "originalText" text,
        "printedText" text,
        "printings" text,
        "otherFaceIds" text
      );

      create table "cardIdentifiers" (
        "uuid" uuid primary key,
        "scryfallId" uuid,
        "scryfallOracleId" uuid
      );
    `
  );
}

async function seedStagingData(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      `
        insert into sets ("code", "name", "releaseDate", "type", "isOnlineOnly", "isPaperOnly")
        values ('TST', 'Test Set', '2026-01-01', 'expansion', false, true)
      `
    );

    await client.query(
      `
        insert into cards (
          "uuid", "name", "setCode", "number", "language", "manaCost", "manaValue", "type", "text",
          "power", "toughness", "loyalty", "rarity", "colorIdentity", "types", "supertypes", "subtypes",
          "side", "layout", "isOnlineOnly", "isFunny", "isPromo", "isRebalanced", "isFullArt", "isTextless",
          "originalText", "printedText", "printings", "otherFaceIds"
        )
        values
        (
          '11111111-1111-1111-1111-111111111111', 'Test Wall', 'TST', '1', 'English', '{1}{W}', 2, 'Creature — Wall', 'Defender',
          '0', '4', null, 'common', 'W', 'Creature', '', 'Wall',
          null, 'normal', false, false, false, false, false, false,
          null, null, null, null
        ),
        (
          '22222222-2222-2222-2222-222222222222', 'Test Wrath', 'TST', '2', 'English', '{2}{W}{W}', 4, 'Sorcery', 'Destroy all creatures.',
          null, null, null, 'rare', 'W', 'Sorcery', '', '',
          null, 'normal', false, false, false, false, false, false,
          null, null, null, null
        )
      `
    );

    await client.query(
      `
        insert into "cardIdentifiers" ("uuid", "scryfallId", "scryfallOracleId")
        values
          ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999991'),
          ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-9999-9999-9999-999999999992')
      `
    );
  } finally {
    await client.end();
  }
}

async function createScryfallImageMap(cacheDir) {
  const scryfallCacheDir = path.join(cacheDir, 'scryfall');
  await mkdir(scryfallCacheDir, { recursive: true });
  const imageMapPath = path.join(scryfallCacheDir, 'all-cards-image-map.json');

  await writeFile(
    imageMapPath,
    JSON.stringify({
      generated_at: new Date().toISOString(),
      bulk_type: 'all_cards',
      bulk_updated_at: new Date().toISOString(),
      bulk_download_uri: 'https://data.scryfall.test/all_cards.json',
      source_metadata_path: path.join(scryfallCacheDir, 'bulk-data-metadata.json'),
      source_cards_path: path.join(scryfallCacheDir, 'all_cards.json'),
      count: 2,
      sha256: 'test',
      images_by_scryfall_id: {
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          oracle_id: '99999999-9999-9999-9999-999999999991',
          set: 'tst',
          collector_number: '1',
          name: 'Test Wall',
          image_uris: {
            png: 'https://cards.scryfall.io/png/front/a/a/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png?123',
          },
          card_faces: [],
        },
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          oracle_id: '99999999-9999-9999-9999-999999999992',
          set: 'tst',
          collector_number: '2',
          name: 'Test Wrath',
          image_uris: {
            png: 'https://cards.scryfall.io/png/front/b/b/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png?456',
          },
          card_faces: [],
        },
      },
    }),
    'utf8'
  );

  return imageMapPath;
}

function spawnImporter(args, env) {
  const child = spawn(process.execPath, [importerPath, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  return {
    child,
    async wait() {
      const result = await new Promise((resolve) => {
        child.on('close', (code, signal) => resolve({ code, signal }));
      });
      return { ...result, stdout, stderr };
    },
    async stop(signal = 'SIGINT') {
      child.kill(signal);
      return this.wait();
    },
  };
}

async function queryRows(databaseUrl, sql, params = []) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function waitFor(assertion, timeoutMs = 20000, intervalMs = 100) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await assertion();
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return assertion();
}

async function createHarness(testName) {
  const suffix = `${process.pid}_${Date.now()}_${testName.replaceAll(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
  const appDatabaseName = `openarena_it_${suffix}`;
  const stagingDatabaseName = `mtgjson_it_${suffix}`;
  const appDatabaseUrl = getDatabaseUrl(appDatabaseName);
  const stagingDatabaseUrl = getDatabaseUrl(stagingDatabaseName);
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'openarena-card-import-cache-'));

  await recreateDatabase(appDatabaseName);
  await recreateDatabase(stagingDatabaseName);
  await applyAppSchema(appDatabaseUrl);
  await createStagingSchema(stagingDatabaseUrl);
  await seedStagingData(stagingDatabaseUrl);
  await chmod(fakeCodexPath, 0o755);
  await createScryfallImageMap(cacheDir);

  return {
    appDatabaseName,
    stagingDatabaseName,
    appDatabaseUrl,
    stagingDatabaseUrl,
    cacheDir,
    baseEnv(extraEnv = {}) {
      return {
        DATABASE_URL: appDatabaseUrl,
        MTGJSON_STAGING_DATABASE_URL: stagingDatabaseUrl,
        CARD_IMPORT_SET_CONFIG: configPath,
        CARD_IMPORT_PARALLELISM: '1',
        SCRYFALL_CACHE_DIR: path.join(cacheDir, 'scryfall'),
        CODEX_BIN: fakeCodexPath,
        ...extraEnv,
      };
    },
    async cleanup() {
      await dropDatabase(appDatabaseName);
      await dropDatabase(stagingDatabaseName);
      await rm(cacheDir, { recursive: true, force: true });
    },
  };
}

test('full import stores cards, images, logic, and completed checkpoint', async (t) => {
  const harness = await createHarness(t.name);
  t.after(async () => {
    await harness.cleanup();
  });

  const run = spawnImporter([], harness.baseEnv());
  const result = await run.wait();

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Importing set tst \(2 cards\)/);
  assert.match(result.stdout, /Import job .* completed\./);

  const cards = await queryRows(
    harness.appDatabaseUrl,
    `
      select name, set_code, collector_number, image_url
      from cards
      order by collector_number asc
    `
  );
  assert.deepEqual(
    cards.map((row) => row.name),
    ['Test Wall', 'Test Wrath']
  );
  assert.deepEqual(
    cards.map((row) => row.image_url),
    [
      'https://cards.scryfall.io/png/front/a/a/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png?123',
      'https://cards.scryfall.io/png/front/b/b/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png?456',
    ]
  );

  const logicFiles = await queryRows(
    harness.appDatabaseUrl,
    `
      select canonical_name, status, content
      from logic_files
      order by canonical_name asc
    `
  );
  assert.equal(logicFiles.length, 2);
  assert.deepEqual(
    logicFiles.map((row) => row.status),
    ['ready', 'ready']
  );
  assert.match(logicFiles[0].content, /\.build\(\);/);
  assert.match(logicFiles[1].content, /\.build\(\);/);

  const checkpoints = await queryRows(
    harness.appDatabaseUrl,
    `
      select set_code, processed_count, completed_at is not null as completed
      from import_checkpoints
    `
  );
  assert.deepEqual(checkpoints, [
    {
      set_code: 'tst',
      processed_count: 2,
      completed: true,
    },
  ]);

  const jobs = await queryRows(
    harness.appDatabaseUrl,
    `
      select source, status
      from import_jobs
    `
  );
  assert.deepEqual(jobs, [
    {
      source: 'mtgjson_staging',
      status: 'completed',
    },
  ]);
});

test('resume continues from checkpoint after mid-set interruption', async (t) => {
  const harness = await createHarness(t.name);
  t.after(async () => {
    await harness.cleanup();
  });

  const firstRun = spawnImporter([], harness.baseEnv({ FAKE_CODEX_DELAY_MS: '10000' }));

  const jobId = await waitFor(async () => {
    const jobs = await queryRows(
      harness.appDatabaseUrl,
      `
        select id, status
        from import_jobs
      `
    );
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].status, 'running');
    return jobs[0].id;
  });

  await waitFor(async () => {
    const cards = await queryRows(
      harness.appDatabaseUrl,
      `
        select name
        from cards
      `
    );
    const checkpoints = await queryRows(
      harness.appDatabaseUrl,
      `
        select processed_count, completed_at
        from import_checkpoints
        where set_code = 'tst'
      `
    );

    assert.deepEqual(cards, [{ name: 'Test Wall' }]);
    assert.equal(checkpoints.length, 1);
    assert.equal(checkpoints[0].processed_count, 1);
    assert.equal(checkpoints[0].completed_at, null);
  });

  const interrupted = await firstRun.stop();
  assert.notEqual(interrupted.code, 0);

  const partialCards = await queryRows(
    harness.appDatabaseUrl,
    `
      select name
      from cards
      order by name asc
    `
  );
  assert.deepEqual(partialCards, [{ name: 'Test Wall' }]);

  const partialCheckpoint = await queryRows(
    harness.appDatabaseUrl,
    `
      select job_id, set_code, processed_count, completed_at
      from import_checkpoints
      where set_code = 'tst'
    `
  );
  assert.equal(partialCheckpoint.length, 1);
  assert.equal(partialCheckpoint[0].processed_count, 1);
  assert.equal(partialCheckpoint[0].completed_at, null);
  assert.equal(partialCheckpoint[0].job_id, jobId);

  const resumeRun = spawnImporter(['--resume'], harness.baseEnv());
  const resumed = await resumeRun.wait();
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.match(resumed.stdout, /  2 Test Wrath/);

  const finalCards = await queryRows(
    harness.appDatabaseUrl,
    `
      select name
      from cards
      order by collector_number asc
    `
  );
  assert.deepEqual(finalCards, [{ name: 'Test Wall' }, { name: 'Test Wrath' }]);

  const finalCheckpoint = await queryRows(
    harness.appDatabaseUrl,
    `
      select job_id, processed_count, completed_at is not null as completed
      from import_checkpoints
      where set_code = 'tst'
    `
  );
  assert.deepEqual(finalCheckpoint, [
    {
      job_id: jobId,
      processed_count: 2,
      completed: true,
    },
  ]);

  const finalJob = await queryRows(
    harness.appDatabaseUrl,
    `
      select id, status
      from import_jobs
    `
  );
  assert.deepEqual(finalJob, [
    {
      id: jobId,
      status: 'completed',
    },
  ]);
});
