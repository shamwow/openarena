import { createWriteStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import process from 'node:process';
import { ensureDownloadDir, getDownloadFilePath, getMtgjsonDownloadUrl } from './mtgjson-common.mjs';

function parseArgs(argv) {
  return {
    force: argv.includes('--force'),
  };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const downloadUrl = getMtgjsonDownloadUrl();
  const outputDir = await ensureDownloadDir();
  const outputPath = getDownloadFilePath();

  if (!args.force && await fileExists(outputPath)) {
    const existing = await stat(outputPath);
    console.log(`MTGJSON download already present: ${outputPath} (${existing.size} bytes)`);
    return;
  }

  const response = await fetch(downloadUrl, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'openarena-mtgjson-downloader/1.0',
    },
  });

  if (!response.ok || !response.body) {
    const body = await response.text();
    throw new Error(`Failed to download MTGJSON artifact (${response.status}): ${body}`);
  }

  await pipeline(response.body, createWriteStream(outputPath));
  const downloaded = await stat(outputPath);
  console.log(`Downloaded MTGJSON artifact to ${outputPath}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Size: ${downloaded.size} bytes`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
