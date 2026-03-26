/**
 * Playwright script to capture video evidence of hand-card hover behavior
 * at all three responsive breakpoints.
 *
 * Usage: DEV_PORT=5174 npx tsx e2e/capture-hand-hover-evidence.ts
 */
import { chromium, type Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.resolve(__dirname, '../.ironsha/pr-media');
const DEV_PORT = process.env.DEV_PORT ?? '5173';
const BASE_URL = `http://localhost:${DEV_PORT}/?test-game-state=hand-overflow-test`;

interface Breakpoint {
  name: string;
  width: number;
  height: number;
}

const BREAKPOINTS: Breakpoint[] = [
  { name: 'default-wide', width: 1920, height: 1080 },
  { name: 'medium-1600', width: 1600, height: 900 },
  { name: 'small-1200', width: 1200, height: 800 },
];

async function waitForApp(page: Page) {
  await page.waitForSelector('.arena-seat__hand-card', { timeout: 15000 });
  // Let initial render and animations settle
  await page.waitForTimeout(800);
}

async function captureBreakpoint(bp: Breakpoint) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: bp.width, height: bp.height },
    recordVideo: {
      dir: path.join(MEDIA_DIR, 'raw'),
      size: { width: bp.width, height: bp.height },
    },
  });

  const page = await context.newPage();
  await page.goto(BASE_URL);
  await waitForApp(page);

  // Take a screenshot of the initial state (no hover)
  await page.screenshot({
    path: path.join(MEDIA_DIR, `hand-hover-${bp.name}-initial.png`),
    fullPage: false,
  });

  // Get all visible hand cards (player 1 / bottom-right seat)
  const handCards = page.locator('.arena-seat__hand-card:not([data-hidden-placeholder="true"])');
  const cardCount = await handCards.count();
  console.log(`  ${bp.name}: found ${cardCount} visible hand cards`);

  // Hover the middle card to demonstrate lift + no clipping
  const middleIndex = Math.floor(cardCount / 2);
  const targetCard = handCards.nth(middleIndex);
  await targetCard.hover({ force: true });
  await page.waitForTimeout(600); // let transition complete

  // Screenshot with hovered card
  await page.screenshot({
    path: path.join(MEDIA_DIR, `hand-hover-${bp.name}-hovered.png`),
    fullPage: false,
  });

  // Verify no scrollbar on body or game board
  const scrollbarCheck = await page.evaluate(() => {
    const body = document.body;
    const board = document.querySelector('.arena-board');
    return {
      bodyScrollbar: body.scrollHeight > body.clientHeight,
      boardScrollbar: board ? board.scrollHeight > board.clientHeight : null,
    };
  });
  console.log(`  ${bp.name}: scrollbar check:`, scrollbarCheck);

  // Hover first card
  await handCards.first().hover({ force: true });
  await page.waitForTimeout(600);

  // Hover last card
  await handCards.last().hover({ force: true });
  await page.waitForTimeout(600);

  // Move mouse away to reset
  await page.mouse.move(bp.width / 2, bp.height / 2);
  await page.waitForTimeout(400);

  // Close context to finalize video
  await context.close();
  await browser.close();

  // Move and rename the recorded video
  const rawDir = path.join(MEDIA_DIR, 'raw');
  const videoFiles = fs.readdirSync(rawDir).filter(f => f.endsWith('.webm'));
  if (videoFiles.length > 0) {
    const latest = videoFiles
      .map(f => ({ name: f, time: fs.statSync(path.join(rawDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time)[0];
    const dest = path.join(MEDIA_DIR, `hand-hover-${bp.name}.webm`);
    fs.renameSync(path.join(rawDir, latest.name), dest);
    console.log(`  ${bp.name}: video saved`);
  }

  return scrollbarCheck;
}

async function main() {
  fs.mkdirSync(path.join(MEDIA_DIR, 'raw'), { recursive: true });

  console.log(`Capturing hand-hover evidence at all breakpoints (port ${DEV_PORT})...\n`);
  const results: Record<string, { bodyScrollbar: boolean; boardScrollbar: boolean | null }> = {};

  for (const bp of BREAKPOINTS) {
    console.log(`Breakpoint: ${bp.name} (${bp.width}x${bp.height})`);
    results[bp.name] = await captureBreakpoint(bp);
    console.log();
  }

  // Clean up raw dir
  const rawDir = path.join(MEDIA_DIR, 'raw');
  const remaining = fs.readdirSync(rawDir);
  for (const f of remaining) fs.unlinkSync(path.join(rawDir, f));
  fs.rmdirSync(rawDir);

  // Print summary
  console.log('=== Evidence Summary ===');
  for (const bp of BREAKPOINTS) {
    const r = results[bp.name];
    const scrollOk = !r.bodyScrollbar && !r.boardScrollbar;
    console.log(`  ${bp.name}: scrollbar=${scrollOk ? 'NONE' : 'PRESENT'}`);
  }

  console.log('\nArtifacts in', MEDIA_DIR + ':');
  for (const f of fs.readdirSync(MEDIA_DIR).sort()) {
    console.log(`  ${f}`);
  }
}

main().catch((err) => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
