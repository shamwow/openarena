import { createReadStream, createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ensureScryfallCacheDir, getScryfallCacheDir } from './mtgjson-common.mjs';
import { loadLocalEnv } from './db.mjs';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function getScryfallApiBase() {
  loadLocalEnv();
  return process.env.SCRYFALL_API_BASE || 'https://api.scryfall.com';
}

function getBulkType() {
  loadLocalEnv();
  return process.env.SCRYFALL_BULK_DATA_TYPE || 'all_cards';
}

function getBulkMetadataPath() {
  return path.join(getScryfallCacheDir(), 'bulk-data-metadata.json');
}

function getBulkCardsPath() {
  return path.join(getScryfallCacheDir(), `${getBulkType()}.json`);
}

function getImageMapPath() {
  loadLocalEnv();
  return path.resolve(getScryfallCacheDir(), process.env.SCRYFALL_IMAGE_MAP_FILE || 'all-cards-image-map.json');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json;q=0.9,*/*;q=0.8',
      'User-Agent': 'openarena-scryfall-image-map/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}: ${await response.text()}`);
  }

  return response.json();
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json;q=0.9,*/*;q=0.8',
      'User-Agent': 'openarena-scryfall-image-map/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Bulk download failed (${response.status}) for ${url}: ${await response.text()}`);
  }

  if (!response.body) {
    throw new Error(`Bulk download for ${url} did not include a response body.`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));
}

function toImageEntry(card) {
  const imageUris = card.image_uris ?? null;
  const faceImages = Array.isArray(card.card_faces)
    ? card.card_faces
        .filter((face) => face?.image_uris)
        .map((face) => ({
          name: face.name ?? null,
          image_uris: face.image_uris,
        }))
    : [];

  return {
    id: card.id,
    oracle_id: card.oracle_id ?? null,
    set: card.set ?? null,
    collector_number: card.collector_number ?? null,
    name: card.name ?? null,
    image_uris: imageUris,
    card_faces: faceImages,
  };
}

async function buildImageMapFromBulkFile(bulkCardsPath) {
  const imageMap = Object.create(null);
  const stream = createReadStream(bulkCardsPath, { encoding: 'utf8' });

  let inString = false;
  let escapeNext = false;
  let objectDepth = 0;
  let collecting = false;
  let objectBuffer = '';

  for await (const chunk of stream) {
    for (const char of chunk) {
      if (!collecting) {
        if (char === '{') {
          collecting = true;
          objectDepth = 1;
          objectBuffer = '{';
        }
        continue;
      }

      objectBuffer += char;

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        objectDepth += 1;
        continue;
      }

      if (char === '}') {
        objectDepth -= 1;
        if (objectDepth === 0) {
          const card = JSON.parse(objectBuffer);
          if (card?.id && (card.image_uris || card.card_faces?.some((face) => face?.image_uris))) {
            imageMap[card.id] = toImageEntry(card);
          }
          collecting = false;
          objectBuffer = '';
          inString = false;
          escapeNext = false;
        }
      }
    }
  }

  if (collecting || objectDepth !== 0) {
    throw new Error(`Failed to parse Scryfall bulk JSON cleanly from ${bulkCardsPath}.`);
  }

  return imageMap;
}

async function main() {
  await ensureScryfallCacheDir();

  const bulkIndex = await fetchJson(`${getScryfallApiBase()}/bulk-data`);
  const bulkType = getBulkType();
  const selectedBulk = bulkIndex.data?.find((entry) => entry.type === bulkType);
  if (!selectedBulk) {
    throw new Error(`Could not find Scryfall bulk data type ${bulkType}.`);
  }

  const metadataPath = getBulkMetadataPath();
  const bulkCardsPath = getBulkCardsPath();
  const imageMapPath = getImageMapPath();

  await writeFile(metadataPath, JSON.stringify(selectedBulk, null, 2), 'utf8');
  console.log(`Wrote Scryfall bulk metadata to ${metadataPath}`);

  await downloadFile(selectedBulk.download_uri, bulkCardsPath);
  console.log(`Downloaded Scryfall bulk card data to ${bulkCardsPath}`);

  const imageMap = await buildImageMapFromBulkFile(bulkCardsPath);

  const payload = {
    generated_at: new Date().toISOString(),
    bulk_type: bulkType,
    bulk_updated_at: selectedBulk.updated_at ?? null,
    bulk_download_uri: selectedBulk.download_uri,
    source_metadata_path: metadataPath,
    source_cards_path: bulkCardsPath,
    count: Object.keys(imageMap).length,
    sha256: sha256(JSON.stringify(imageMap)),
    images_by_scryfall_id: imageMap,
  };

  await writeFile(imageMapPath, JSON.stringify(payload), 'utf8');
  console.log(`Wrote Scryfall image map to ${imageMapPath}`);
  console.log(`Image map entries: ${payload.count}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
