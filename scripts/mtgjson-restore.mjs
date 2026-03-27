import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { spawn } from 'node:child_process';
import { Transform } from 'node:stream';
import process from 'node:process';
import {
  getAdminDatabaseUrl,
  getDatabaseName,
  getDownloadFilePath,
  getPsqlBin,
  getStagingDatabaseUrl,
  withAdminClient,
} from './mtgjson-common.mjs';

async function assertDownloadExists(filePath) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`MTGJSON download not found at ${filePath}. Run npm run mtgjson:download first.`);
  }
}

async function recreateStagingDatabase() {
  const stagingDatabaseUrl = getStagingDatabaseUrl();
  const databaseName = getDatabaseName(stagingDatabaseUrl);

  await withAdminClient(async (client) => {
    await client.query(`drop database if exists "${databaseName}" with (force)`);
    await client.query(`create database "${databaseName}"`);
  });
}

async function restoreDump(filePath) {
  const stagingDatabaseUrl = getStagingDatabaseUrl();
  const psql = spawn(
    getPsqlBin(),
    ['-v', 'ON_ERROR_STOP=1', '-d', stagingDatabaseUrl],
    {
      stdio: ['pipe', 'inherit', 'inherit'],
      env: process.env,
    }
  );

  const integerToBigintTransform = new Transform({
    transform(chunk, _encoding, callback) {
      const rewritten = chunk.toString('utf8').replaceAll(' INTEGER', ' BIGINT');
      callback(null, rewritten);
    },
  });

  const input = createReadStream(filePath);
  const source = filePath.endsWith('.gz') ? input.pipe(createGunzip()) : input;
  source
    .pipe(integerToBigintTransform)
    .pipe(psql.stdin);

  await new Promise((resolve, reject) => {
    psql.stdin.on('error', (error) => {
      if (error.code === 'EPIPE') {
        return;
      }
      reject(error);
    });
    psql.on('error', reject);
    psql.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`psql restore failed with exit code ${code}`));
    });
  });
}

async function main() {
  const filePath = getDownloadFilePath();
  await assertDownloadExists(filePath);
  await recreateStagingDatabase();
  await restoreDump(filePath);

  console.log(`Restored MTGJSON staging database ${getDatabaseName(getStagingDatabaseUrl())}`);
  console.log(`Admin DB URL: ${getAdminDatabaseUrl()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
