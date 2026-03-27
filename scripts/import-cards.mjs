import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { createPool, loadLocalEnv, withTransaction } from './db.mjs';
import { getScryfallCacheDir, getStagingDatabaseUrl } from './mtgjson-common.mjs';

const execFile = promisify(execFileCallback);

const CARD_TYPES = new Set([
  'Artifact',
  'Battle',
  'Creature',
  'Enchantment',
  'Instant',
  'Kindred',
  'Land',
  'Planeswalker',
  'Sorcery',
]);

const SUPERTYPES = new Set([
  'Basic',
  'Legendary',
  'Ongoing',
  'Snow',
  'Token',
  'World',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function getImportLogDir() {
  loadLocalEnv();
  return path.resolve(process.cwd(), process.env.CARD_IMPORT_LOG_DIR || './logs/card-import');
}

function formatLogTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function initializeRunLogger() {
  const logDir = getImportLogDir();
  await mkdir(logDir, { recursive: true });

  const logFilePath = path.join(logDir, `import-${formatLogTimestamp()}.log`);
  const writeQueue = [];
  let flushing = false;

  const flushWrites = async () => {
    if (flushing || writeQueue.length === 0) {
      return;
    }

    flushing = true;
    try {
      while (writeQueue.length > 0) {
        const entry = writeQueue.shift();
        await appendFile(logFilePath, entry, 'utf8');
      }
    } finally {
      flushing = false;
      if (writeQueue.length > 0) {
        void flushWrites();
      }
    }
  };

  const enqueueWrite = (level, message) => {
    const renderedMessage = typeof message === 'string' ? message : String(message);
    writeQueue.push(`[${new Date().toISOString()}] ${level} ${renderedMessage}\n`);
    void flushWrites();
  };

  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args) => {
    originalConsole.log(...args);
    enqueueWrite('INFO', args.map((value) => (typeof value === 'string' ? value : String(value))).join(' '));
  };
  console.info = (...args) => {
    originalConsole.info(...args);
    enqueueWrite('INFO', args.map((value) => (typeof value === 'string' ? value : String(value))).join(' '));
  };
  console.warn = (...args) => {
    originalConsole.warn(...args);
    enqueueWrite('WARN', args.map((value) => (typeof value === 'string' ? value : String(value))).join(' '));
  };
  console.error = (...args) => {
    originalConsole.error(...args);
    enqueueWrite('ERROR', args.map((value) => (typeof value === 'string' ? value : String(value))).join(' '));
  };

  console.log(`Writing importer logs to ${logFilePath}`);
  return logFilePath;
}

function usage() {
  console.log('Usage: node scripts/import-cards.mjs [--resume] [--set <setCode>]');
}

function getScryfallApiBase() {
  loadLocalEnv();
  return process.env.SCRYFALL_API_BASE || 'https://api.scryfall.com';
}

function getScryfallImageMapPath() {
  loadLocalEnv();
  return path.resolve(
    getScryfallCacheDir(),
    process.env.SCRYFALL_IMAGE_MAP_FILE || 'all-cards-image-map.json'
  );
}

function createMtgjsonPool() {
  return new Pool({
    connectionString: getStagingDatabaseUrl(),
    max: 2,
  });
}

function parseArgs(argv) {
  const args = { resume: false, setOverride: undefined, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--resume') {
      args.resume = true;
      continue;
    }
    if (arg === '--set') {
      args.setOverride = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

async function loadImportConfig(setOverride) {
  loadLocalEnv();

  const configPath = process.env.CARD_IMPORT_SET_CONFIG || './scripts/card-import.config.mjs';
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);
  const configUrl = pathToFileURL(absoluteConfigPath);
  const module = await import(configUrl.href);
  const config = module.cardImportConfig;

  if (!config || !Array.isArray(config.setCodes) || config.setCodes.length === 0) {
    throw new Error('cardImportConfig.setCodes must contain at least one set code.');
  }

  const normalizedSetCodes = config.setCodes.map((setCode) => setCode.toLowerCase());
  const startSet = (setOverride ?? process.env.CARD_IMPORT_START_SET ?? '').toLowerCase();
  const startIndex = startSet ? normalizedSetCodes.indexOf(startSet) : 0;
  if (startSet && startIndex === -1) {
    throw new Error(`Start set ${startSet} was not found in ${absoluteConfigPath}.`);
  }
  const filteredSetCodes = normalizedSetCodes.slice(startIndex);

  return {
    source: config.source ?? 'mtgjson_staging',
    setCodes: filteredSetCodes,
    language: config.language ?? 'en',
    includeDigital: config.includeDigital ?? false,
    includeTokens: config.includeTokens ?? false,
    cardLimit: Number.parseInt(process.env.CARD_IMPORT_CARD_LIMIT ?? '', 10) || null,
    parallelism: Math.max(1, Number.parseInt(process.env.CARD_IMPORT_PARALLELISM ?? '5', 10) || 5),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'openarena-card-importer/1.0',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}) for ${url}: ${body}`);
  }

  return response.json();
}

function parseDelimitedText(value) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapLanguageCodeToMtgjsonName(language) {
  const normalized = language.toLowerCase();
  if (normalized === 'en') {
    return 'English';
  }
  return language;
}

function compareCollectorNumbers(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

async function fetchSetCards(setCode, language, includeDigital, includeTokens) {
  const mtgjsonPool = createMtgjsonPool();
  try {
    const languageName = mapLanguageCodeToMtgjsonName(language);
    const result = await mtgjsonPool.query(
      `
        select
          c."uuid",
          c."name",
          c."setCode" as set_code,
          c."number",
          c."language",
          c."manaCost" as mana_cost,
          c."manaValue" as mana_value,
          c."type",
          c."text",
          c."power",
          c."toughness",
          c."loyalty",
          c."rarity",
          c."colorIdentity" as color_identity,
          c."types",
          c."supertypes",
          c."subtypes",
          c."side",
          c."layout",
          c."isOnlineOnly" as is_online_only,
          c."isFunny" as is_funny,
          c."isPromo" as is_promo,
          c."isRebalanced" as is_rebalanced,
          c."isFullArt" as is_full_art,
          c."isTextless" as is_textless,
          c."originalText" as original_text,
          c."printedText" as printed_text,
          c."printings",
          c."otherFaceIds" as other_face_ids,
          c."keywords",
          s."name" as set_name,
          s."releaseDate" as release_date,
          s."type" as set_type,
          s."isOnlineOnly" as set_is_online_only,
          s."isPaperOnly" as is_paper_only,
          ci."scryfallId" as scryfall_id,
          ci."scryfallOracleId" as scryfall_oracle_id,
          row_to_json(c) as mtgjson_card_payload,
          row_to_json(ci) as mtgjson_identifier_payload
        from cards c
        left join sets s on s."code" = c."setCode"
        left join "cardIdentifiers" ci on ci."uuid" = c."uuid"
        where c."setCode" = $1
          and c."language" = $2
          and ($3::boolean or coalesce(c."isOnlineOnly", false) = false)
          and ($4::boolean or coalesce(c."layout", '') <> 'token')
        order by c."number" asc, c."uuid" asc
      `,
      [setCode.toUpperCase(), languageName, includeDigital, includeTokens]
    );

    return result.rows.map((row) => ({
      id: row.scryfall_id ?? row.uuid,
      uuid: row.uuid,
      oracle_id: row.scryfall_oracle_id ?? row.uuid,
      scryfall_id: row.scryfall_id ?? null,
      name: row.name,
      lang: language.toLowerCase(),
      set: row.set_code.toLowerCase(),
      set_name: row.set_name,
      collector_number: row.number,
      released_at: row.release_date ?? null,
      rarity: row.rarity ?? null,
      mana_cost: row.mana_cost ?? null,
      cmc: row.mana_value ?? null,
      type_line: row.type,
      oracle_text: row.text ?? row.original_text ?? row.printed_text ?? null,
      power: row.power ?? null,
      toughness: row.toughness ?? null,
      loyalty: row.loyalty ?? null,
      color_identity: parseDelimitedText(row.color_identity),
      types: parseDelimitedText(row.types),
      supertypes: parseDelimitedText(row.supertypes),
      subtypes: parseDelimitedText(row.subtypes),
      scryfall_payload: {
        mtgjsonCard: row.mtgjson_card_payload,
        mtgjsonIdentifiers: row.mtgjson_identifier_payload,
      },
    }))
      .sort((left, right) => {
        const collectorComparison = compareCollectorNumbers(left.collector_number, right.collector_number);
        if (collectorComparison !== 0) {
          return collectorComparison;
        }
        return left.uuid.localeCompare(right.uuid);
      });
  } finally {
    await mtgjsonPool.end();
  }
}

function parseTypeLine(typeLine) {
  const normalized = typeLine.replace(/\s+—\s+/g, ' — ');
  const [left, right = ''] = normalized.split(' — ');
  const leftParts = left.split(/\s+/).filter(Boolean);
  const supertypes = leftParts.filter((part) => SUPERTYPES.has(part));
  const types = leftParts.filter((part) => CARD_TYPES.has(part));
  const subtypes = right.split(/\s+/).filter(Boolean);

  return { supertypes, types, subtypes };
}

function getOracleText(card) {
  if (card.oracle_text) {
    return card.oracle_text;
  }

  if (!Array.isArray(card.card_faces)) {
    return null;
  }

  return card.card_faces
    .map((face) => {
      const parts = [face.name, face.type_line, face.oracle_text].filter(Boolean);
      return parts.join('\n');
    })
    .join('\n//\n');
}

async function loadScryfallImageMap() {
  const imageMapPath = getScryfallImageMapPath();
  const imageMapText = await readFile(imageMapPath, 'utf8');
  const payload = JSON.parse(imageMapText);

  if (!payload || typeof payload !== 'object' || typeof payload.images_by_scryfall_id !== 'object') {
    throw new Error(`Scryfall image map at ${imageMapPath} is missing images_by_scryfall_id.`);
  }

  return payload.images_by_scryfall_id;
}

function getBestImageUrl(imageMetadata) {
  const imageUris = imageMetadata.image_uris ?? imageMetadata.card_faces?.find((face) => face.image_uris)?.image_uris;
  if (!imageUris) {
    return null;
  }
  return imageUris.png ?? imageUris.large ?? imageUris.normal ?? null;
}

function resolveCardImage(card, scryfallImageMap) {
  if (!card.scryfall_id) {
    throw new Error(`No Scryfall identifier available for ${card.name} (${card.uuid}).`);
  }

  const imageMetadata = scryfallImageMap[card.scryfall_id];
  if (!imageMetadata) {
    throw new Error(`No cached Scryfall image metadata available for ${card.name} (${card.scryfall_id}).`);
  }

  const imageUrl = getBestImageUrl(imageMetadata);
  if (!imageUrl) {
    return null;
  }

  return {
    url: imageUrl,
    scryfallCard: imageMetadata,
  };
}

async function getPromptContext() {
  const [cardBuilderSource, engineTypesSource] = await Promise.all([
    readFile(new URL('../src/cards/CardBuilder.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/engine/types.ts', import.meta.url), 'utf8'),
  ]);

  return { cardBuilderSource, engineTypesSource };
}

function buildLogicPrompt(card, promptContext) {
  const cardPayload = JSON.stringify({
    id: card.scryfall_id ?? card.uuid,
    oracle_id: card.oracle_id,
    name: card.name,
    mana_cost: card.mana_cost,
    cmc: card.cmc,
    type_line: card.type_line,
    oracle_text: getOracleText(card),
    power: card.power,
    toughness: card.toughness,
    loyalty: card.loyalty,
    color_identity: card.color_identity,
    card_faces: card.card_faces ?? null,
  }, null, 2);

  return [
    'You generate OpenArena card logic scripts.',
    'Return only a JavaScript function body with no markdown fences.',
    'The function body runs with these identifiers already in scope: CardBuilder, CardType, ManaColor, Keyword.',
    'The body must end with `return ...build();` and must not contain import or export statements.',
    'Prefer the CardBuilder fluent style already used in the repo.',
    'Preserve the exact printed card name.',
    'For targeting, use ctx.chooseTarget(spec) for single targets or ctx.chooseTargets(spec) for multiple.',
    'ctx.chooseTarget returns the target or null if none exist. Always check for null before using.',
    'Do NOT pass a targets array to spellEffect/activated/triggered. Handle targeting inside the effect function.',
    'Use ctx.controller for "you" effects and ctx.game.getOpponents(ctx.controller) for "each opponent" effects.',
    'If a card is too complex to encode faithfully right now, return a conservative placeholder and include a TODO comment in the body.',
    '',
    'Card payload:',
    cardPayload,
    '',
    'Relevant builder implementation:',
    promptContext.cardBuilderSource,
    '',
    'Relevant engine types:',
    promptContext.engineTypesSource,
  ].join('\n');
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === 'string' && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }

  const parts = [];
  for (const outputItem of responseJson.output ?? []) {
    if (outputItem.type !== 'message') {
      continue;
    }
    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
        parts.push(contentItem.text);
      }
    }
  }

  const text = parts.join('\n').trim();
  if (!text) {
    throw new Error('OpenAI response did not include output text.');
  }
  return text;
}

function validateLogicScript(content, card) {
  if (content.includes('```')) {
    throw new Error('Generated logic included markdown fences.');
  }

  if (/\b(import|export)\b/.test(content)) {
    throw new Error('Generated logic must not include import or export statements.');
  }

  if (!content.includes('return ') || !content.includes('.build()')) {
    throw new Error('Generated logic must end by returning a built card definition.');
  }

  // Parse-only validation of the generated function body.
  new Function('CardBuilder', 'CardType', 'ManaColor', 'Keyword', content);

  if (!content.includes(card.name)) {
    throw new Error(`Generated logic did not reference card name ${card.name}.`);
  }

}

function spawnCollect(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        const details = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n') ||
          `exit code ${code}`;
        reject(new Error(details));
      } else {
        resolve(stdout);
      }
    });
  });
}

function createLlmProvider() {
  loadLocalEnv();
  const providerString = process.env.CARD_IMPORT_PROVIDER || '';
  let providerName = 'codex';
  let model;

  if (providerString) {
    const colonIndex = providerString.indexOf(':');
    if (colonIndex === -1) {
      providerName = providerString.toLowerCase();
    } else {
      providerName = providerString.slice(0, colonIndex).toLowerCase();
      model = providerString.slice(colonIndex + 1) || undefined;
    }
  }

  switch (providerName) {
    case 'codex':
      return createCodexProvider(model);
    case 'claude':
      return createClaudeProvider(model);
    default:
      throw new Error(`Unknown CARD_IMPORT_PROVIDER: "${providerName}". Supported: codex, claude`);
  }
}

function createCodexProvider(model) {
  const codexBin = process.env.CODEX_BIN || 'codex';
  return {
    name: model ? `codex:${model}` : 'codex',
    async generate(prompt) {
      const tempOutputFile = path.join(
        os.tmpdir(),
        `openarena-codex-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
      );
      const args = [
        'exec',
        '--skip-git-repo-check',
        '--sandbox',
        'read-only',
        '--output-last-message',
        tempOutputFile,
      ];
      if (model) {
        args.push('--model', model);
      }
      args.push(prompt);

      try {
        await execFile(codexBin, args, {
          cwd: process.cwd(),
          maxBuffer: 20 * 1024 * 1024,
        });
        return (await readFile(tempOutputFile, 'utf8')).trim();
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string') {
          throw new Error(`Codex generation failed: ${error.stderr.trim()}`);
        }
        throw error;
      }
    },
  };
}

function createClaudeProvider(model) {
  const claudeBin = process.env.CLAUDE_BIN || 'claude';
  return {
    name: model ? `claude:${model}` : 'claude',
    async generate(prompt) {
      const args = ['-p', prompt, '--output-format', 'text', '--max-turns', '1'];
      if (model) {
        args.push('--model', model);
      }
      try {
        const stdout = await spawnCollect(claudeBin, args);
        return stdout.trim();
      } catch (error) {
        throw new Error(`Claude generation failed: ${error.message}`);
      }
    },
  };
}

async function generateLogicScript(card, promptContext, provider) {
  const prompt = buildLogicPrompt(card, promptContext);
  const content = await provider.generate(prompt);
  try {
    validateLogicScript(content, card);
  } catch (error) {
    console.error(`Validation failed for ${card.name}. Model output:\n${content}`);
    throw error;
  }
  return {
    content,
    contentSha256: sha256(content),
    generationModel: provider.name,
    generationPromptVersion: 'v1',
  };
}

async function findOrCreateJob(client, config) {
  const serializedSetCodes = JSON.stringify(config.setCodes);
  const existing = await client.query(
    `
      select *
      from import_jobs
      where source = $1
        and set_codes = $2::jsonb
      order by created_at desc
      limit 1
    `,
    [config.source, serializedSetCodes]
  );

  if (existing.rows[0]) {
    const job = existing.rows[0];

    if (job.status === 'completed') {
      return { ...job, alreadyComplete: true };
    }

    if (job.status !== 'running') {
      await client.query(
        `
          update import_jobs
          set status = 'running',
              started_at = coalesce(started_at, now()),
              updated_at = now()
          where id = $1
        `,
        [job.id]
      );
    }

    return {
      ...job,
      status: 'running',
      alreadyComplete: false,
    };
  }

  const created = await client.query(
    `
      insert into import_jobs (source, set_codes, status, started_at, created_at, updated_at)
      values ($1, $2::jsonb, 'running', now(), now(), now())
      returning *
    `,
    [config.source, serializedSetCodes]
  );

  return {
    ...created.rows[0],
    alreadyComplete: false,
  };
}

async function getCheckpoint(client, jobId, setCode) {
  const result = await client.query(
    `
      select *
      from import_checkpoints
      where job_id = $1 and set_code = $2
      limit 1
    `,
    [jobId, setCode]
  );
  return result.rows[0] ?? null;
}

function isPastCheckpoint(card, checkpoint) {
  if (!checkpoint?.last_collector_number) {
    return true;
  }

  const collectorComparison = compareCollectorNumbers(card.collector_number, checkpoint.last_collector_number);
  if (collectorComparison > 0) {
    return true;
  }
  if (collectorComparison < 0) {
    return false;
  }

  if (!checkpoint.last_scryfall_id) {
    return false;
  }

  return card.id.localeCompare(checkpoint.last_scryfall_id) > 0;
}

async function upsertLogicFile(client, card, promptContext, provider) {
  const inserted = await client.query(
    `
      insert into logic_files (
        oracle_id,
        canonical_name,
        status,
        created_at,
        updated_at
      )
      values ($1, $2, 'pending', now(), now())
      on conflict (oracle_id) do update
      set canonical_name = excluded.canonical_name,
          updated_at = now()
      returning *
    `,
    [card.oracle_id, card.name]
  );

  let logicFile = inserted.rows[0];
  if (logicFile.status === 'ready' && logicFile.content) {
    return logicFile;
  }

  const generated = await generateLogicScript(card, promptContext, provider);
  const updated = await client.query(
    `
      update logic_files
      set content = $2,
          content_sha256 = $3,
          generation_model = $4,
          generation_prompt_version = $5,
          status = 'ready',
          last_error = null,
          updated_at = now()
      where id = $1
      returning *
    `,
    [
      logicFile.id,
      generated.content,
      generated.contentSha256,
      generated.generationModel,
      generated.generationPromptVersion,
    ]
  );
  logicFile = updated.rows[0];

  return logicFile;
}

async function upsertCard(client, card, logicFileId, image) {
  const { supertypes, types, subtypes } = parseTypeLine(card.type_line);

  await client.query(
    `
      insert into cards (
        scryfall_id,
        oracle_id,
        logic_file,
        name,
        set_code,
        set_name,
        collector_number,
        lang,
        released_at,
        rarity,
        mana_cost,
        cmc,
        type_line,
        oracle_text,
        power,
        toughness,
        loyalty,
        color_identity,
        supertypes,
        types,
        subtypes,
        scryfall_payload,
        image_url,
        created_at,
        updated_at
      )
      values (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18::jsonb,
        $19::jsonb,
        $20::jsonb,
        $21::jsonb,
        $22::jsonb,
        $23,
        now(),
        now()
      )
      on conflict (scryfall_id) do update
      set oracle_id = excluded.oracle_id,
          logic_file = excluded.logic_file,
          name = excluded.name,
          set_code = excluded.set_code,
          set_name = excluded.set_name,
          collector_number = excluded.collector_number,
          lang = excluded.lang,
          released_at = excluded.released_at,
          rarity = excluded.rarity,
          mana_cost = excluded.mana_cost,
          cmc = excluded.cmc,
          type_line = excluded.type_line,
          oracle_text = excluded.oracle_text,
          power = excluded.power,
          toughness = excluded.toughness,
          loyalty = excluded.loyalty,
          color_identity = excluded.color_identity,
          supertypes = excluded.supertypes,
          types = excluded.types,
          subtypes = excluded.subtypes,
          scryfall_payload = excluded.scryfall_payload,
          image_url = excluded.image_url,
          updated_at = now()
    `,
      [
      card.scryfall_id ?? card.uuid,
      card.oracle_id,
      logicFileId,
      card.name,
      card.set,
      card.set_name,
      card.collector_number,
      card.lang,
      card.released_at ?? null,
      card.rarity ?? null,
      card.mana_cost ?? null,
      card.cmc ?? null,
      card.type_line,
      getOracleText(card),
      card.power ?? null,
      card.toughness ?? null,
      card.loyalty ?? null,
      JSON.stringify(card.color_identity ?? []),
      JSON.stringify(supertypes),
      JSON.stringify(types),
      JSON.stringify(subtypes),
      JSON.stringify({
        ...card.scryfall_payload,
        scryfallImageMetadata: image?.scryfallCard ?? null,
      }),
      image?.url ?? null,
    ]
  );
}

async function upsertCheckpointProgress(client, jobId, setCode, cardId, collectorNumber) {
  await client.query(
    `
      insert into import_checkpoints (
        job_id,
        set_code,
        last_scryfall_id,
        last_collector_number,
        processed_count,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, 1, now(), now())
      on conflict (job_id, set_code) do update
      set last_scryfall_id = excluded.last_scryfall_id,
          last_collector_number = excluded.last_collector_number,
          processed_count = import_checkpoints.processed_count + 1,
          updated_at = now()
    `,
    [jobId, setCode, cardId, collectorNumber]
  );
}

async function importCard(pool, card, promptContext, scryfallImageMap, provider) {
  const image = resolveCardImage(card, scryfallImageMap);

  // Generation currently happens inside this transaction via upsertLogicFile().
  // That is not ideal because long-running model calls can hold transactions open, but
  // we are accepting that tradeoff for now to keep the logic row and card write together.
  await withTransaction(pool, async (client) => {
    const logicFile = await upsertLogicFile(client, card, promptContext, provider);
    await upsertCard(client, card, logicFile.id, image);
  });
}

async function markSetCompleted(client, jobId, setCode) {
  await client.query(
    `
      insert into import_checkpoints (
        job_id,
        set_code,
        processed_count,
        completed_at,
        created_at,
        updated_at
      )
      values ($1, $2, 0, now(), now(), now())
      on conflict (job_id, set_code) do update
      set completed_at = now(),
          updated_at = now()
    `,
    [jobId, setCode]
  );
}

async function markJobCompleted(client, jobId) {
  await client.query(
    `
      update import_jobs
      set status = 'completed',
          completed_at = now(),
          updated_at = now()
      where id = $1
    `,
    [jobId]
  );
}

async function importSet(pool, jobId, setCode, config, promptContext, scryfallImageMap, provider) {
  const fetchedCards = await fetchSetCards(setCode, config.language, config.includeDigital, config.includeTokens);
  const cards = config.cardLimit ? fetchedCards.slice(0, config.cardLimit) : fetchedCards;

  const checkpointClient = await pool.connect();
  let checkpoint;
  try {
    checkpoint = await getCheckpoint(checkpointClient, jobId, setCode);
  } finally {
    checkpointClient.release();
  }

  console.log(`Importing set ${setCode} (${cards.length} cards)`);
  console.log(`Using card import parallelism ${config.parallelism}`);

  const remainingCards = cards.filter((card) => isPastCheckpoint(card, checkpoint));
  if (remainingCards.length === 0) {
    console.log(`Set ${setCode} is already fully checkpointed.`);
  } else {
    const completed = new Array(remainingCards.length).fill(false);
    let nextCardIndex = 0;
    let nextCheckpointIndex = 0;
    let checkpointFlush = Promise.resolve();
    let fatalError = null;

    const flushCheckpointProgress = () => {
      checkpointFlush = checkpointFlush.then(async () => {
        while (nextCheckpointIndex < remainingCards.length && completed[nextCheckpointIndex]) {
          const checkpointCard = remainingCards[nextCheckpointIndex];
          await withTransaction(pool, async (client) => {
            await upsertCheckpointProgress(
              client,
              jobId,
              setCode,
              checkpointCard.id,
              checkpointCard.collector_number
            );
          });
          nextCheckpointIndex += 1;
        }
      });

      return checkpointFlush;
    };

    async function runWorker() {
      while (true) {
        if (fatalError) {
          return;
        }

        const currentIndex = nextCardIndex;
        nextCardIndex += 1;

        if (currentIndex >= remainingCards.length) {
          return;
        }

        const card = remainingCards[currentIndex];

        try {
          console.log(`  ${card.collector_number} ${card.name}`);
          await importCard(pool, card, promptContext, scryfallImageMap, provider);
          completed[currentIndex] = true;
          await flushCheckpointProgress();
        } catch (error) {
          fatalError = error;
          return;
        }
      }
    }

    const workerCount = Math.min(config.parallelism, remainingCards.length);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    await checkpointFlush;

    if (fatalError) {
      throw fatalError;
    }
  }

  await withTransaction(pool, async (client) => {
    await markSetCompleted(client, jobId, setCode);
  });
}

async function main() {
  loadLocalEnv();
  await initializeRunLogger();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const config = await loadImportConfig(args.setOverride);
  const provider = createLlmProvider();
  const promptContext = await getPromptContext();
  const scryfallImageMap = await loadScryfallImageMap();
  const pool = createPool({
    max: Math.max(4, config.parallelism + 2),
  });

  try {
    const setupClient = await pool.connect();
    let job;
    try {
      job = await findOrCreateJob(setupClient, config);
    } finally {
      setupClient.release();
    }

    if (job.alreadyComplete) {
      console.log(`Import job ${job.id} is already completed for ${config.setCodes.join(', ')}.`);
      return;
    }

    for (const setCode of config.setCodes) {
      const checkpointClient = await pool.connect();
      let checkpoint;
      try {
        checkpoint = await getCheckpoint(checkpointClient, job.id, setCode);
      } finally {
        checkpointClient.release();
      }

      if (checkpoint?.completed_at) {
        console.log(`Skipping completed set ${setCode}`);
        continue;
      }

      await importSet(pool, job.id, setCode, config, promptContext, scryfallImageMap, provider);
    }

    const finalClient = await pool.connect();
    try {
      await markJobCompleted(finalClient, job.id);
    } finally {
      finalClient.release();
    }

    console.log(`Import job ${job.id} completed.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
