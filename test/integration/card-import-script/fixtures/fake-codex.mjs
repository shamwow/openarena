#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';

function parseArgs(argv) {
  const args = { outputPath: null, prompt: null };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output-last-message') {
      args.outputPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--')) {
      if (arg === '--model' || arg === '--sandbox') {
        index += 1;
      }
      continue;
    }

    if (arg !== 'exec') {
      args.prompt = arg;
    }
  }

  if (!args.outputPath) {
    throw new Error('Missing --output-last-message path.');
  }

  if (!args.prompt) {
    throw new Error('Missing prompt.');
  }

  return args;
}

function extractCardPayload(prompt) {
  const match = prompt.match(/Card payload:\n([\s\S]*?)\n\nRelevant builder implementation:/);
  if (!match) {
    throw new Error('Could not extract card payload from prompt.');
  }
  return JSON.parse(match[1]);
}

function escapeString(value) {
  return JSON.stringify(value ?? '');
}

function buildLogic(card) {
  const lines = [
    `return CardBuilder.create(${escapeString(card.name)})`,
  ];

  if (card.id) {
    lines.push(`  .id(${escapeString(card.id)})`);
  }

  if (card.mana_cost) {
    lines.push(`  .cost(${escapeString(card.mana_cost)})`);
  }

  if (card.type_line) {
    const types = card.type_line.split(/\s+—\s+/)[0].split(/\s+/).filter(Boolean);
    for (const t of types) {
      if (['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land', 'Planeswalker', 'Battle', 'Kindred'].includes(t)) {
        lines.push(`  .types(CardType.${t.toUpperCase()})`);
        break;
      }
    }
    const subtypePart = card.type_line.split(/\s+—\s+/)[1];
    if (subtypePart) {
      const subtypes = subtypePart.split(/\s+/).filter(Boolean).map((s) => escapeString(s)).join(', ');
      lines.push(`  .subtypes(${subtypes})`);
    }
  }

  if (card.power != null && card.toughness != null) {
    lines.push(`  .stats(${card.power}, ${card.toughness})`);
  }

  if (card.loyalty != null) {
    lines.push(`  .loyalty(${card.loyalty})`);
  }

  lines.push('  .build();');
  return lines.join('\n');
}

async function main() {
  const { outputPath, prompt } = parseArgs(process.argv.slice(2));
  const delayMs = Number.parseInt(process.env.FAKE_CODEX_DELAY_MS ?? '0', 10) || 0;

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const card = extractCardPayload(prompt);
  const logic = buildLogic(card);

  await writeFile(outputPath, logic, 'utf8');
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  try {
    if (process.argv.includes('--output-last-message')) {
      const outputIndex = process.argv.indexOf('--output-last-message');
      const outputPath = process.argv[outputIndex + 1];
      if (outputPath) {
        await writeFile(outputPath, '', 'utf8');
      }
    }
  } catch {
    // Ignore cleanup errors when surfacing the failure.
  }

  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
