import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const ZOOM_LEVELS = [1, 1.1, 1.25, 1.5, 1.75, 2];
const VIEWPORT = { width: 1440, height: 1100 };
const TEST_STATE_ID = 'hand-overflow-zoom-demo';
const artifactRoot = path.resolve(process.cwd(), 'artifacts', 'hand-zoom');
const screenshotDir = path.join(artifactRoot, 'screenshots');
const videoDir = path.join(artifactRoot, 'videos');

function resolveBaseUrl() {
  const cliBaseUrl = process.argv[2];
  const baseUrl = cliBaseUrl ?? process.env.OPENARENA_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      'Missing base URL. Pass it as the first argument or set OPENARENA_BASE_URL.',
    );
  }

  return baseUrl.replace(/\/$/, '');
}

function assertBoundingBox(box, label) {
  if (!box) {
    throw new Error(`Missing bounding box for ${label}.`);
  }
}

function createPointAssertions(cardBox, ancestorBox) {
  const points = [];

  if (cardBox.top < ancestorBox.top - 1) {
    points.push({
      axis: 'top',
      x: cardBox.left + cardBox.width / 2,
      y: Math.max(cardBox.top + 2, ancestorBox.top - Math.min(2, (ancestorBox.top - cardBox.top) / 2)),
    });
  }

  if (cardBox.left < ancestorBox.left - 1) {
    points.push({
      axis: 'left',
      x: Math.max(cardBox.left + 2, ancestorBox.left - Math.min(2, (ancestorBox.left - cardBox.left) / 2)),
      y: cardBox.top + Math.min(cardBox.height / 2, 24),
    });
  }

  if (cardBox.right > ancestorBox.right + 1) {
    points.push({
      axis: 'right',
      x: Math.min(cardBox.right - 2, ancestorBox.right + Math.min(2, (cardBox.right - ancestorBox.right) / 2)),
      y: cardBox.top + Math.min(cardBox.height / 2, 24),
    });
  }

  return points.filter((point) => point.x >= 0 && point.y >= 0);
}

async function hoverAndVerify(page, handCards, index, zoomLabel) {
  const card = handCards.nth(index);
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(350);

  const handArea = page.locator('.arena-seat__hand-area[data-hidden="false"]').first();
  const handViewport = page.locator('.arena-seat__hand-area[data-hidden="false"] .arena-seat__hand-viewport').first();
  const handScroll = page.locator('.arena-seat__hand-area[data-hidden="false"] .arena-seat__hand-scroll').first();

  const [cardBox, handAreaBox, handViewportBox, handScrollBox] = await Promise.all([
    card.evaluate((node) => node.getBoundingClientRect().toJSON()),
    handArea.evaluate((node) => node.getBoundingClientRect().toJSON()),
    handViewport.evaluate((node) => node.getBoundingClientRect().toJSON()),
    handScroll.evaluate((node) => node.getBoundingClientRect().toJSON()),
  ]);

  assertBoundingBox(cardBox, 'hovered card');
  assertBoundingBox(handAreaBox, '.arena-seat__hand-area');
  assertBoundingBox(handViewportBox, '.arena-seat__hand-viewport');
  assertBoundingBox(handScrollBox, '.arena-seat__hand-scroll');

  const cardIsScaled = await card.evaluate((node) => {
    const scale = Number.parseFloat(getComputedStyle(node).getPropertyValue('--card-scale'));
    return scale > 1;
  });
  if (!cardIsScaled) {
    throw new Error(`Expected hovered card ${index} to scale up at zoom ${zoomLabel}.`);
  }

  const ancestors = [
    { label: '.arena-seat__hand-area', box: handAreaBox },
    { label: '.arena-seat__hand-viewport', box: handViewportBox },
    { label: '.arena-seat__hand-scroll', box: handScrollBox },
  ];
  const overflowStyles = await Promise.all([
    handArea.evaluate((node) => getComputedStyle(node).overflow),
    handViewport.evaluate((node) => getComputedStyle(node).overflow),
    handScroll.evaluate((node) => ({
      overflowX: getComputedStyle(node).overflowX,
      overflowY: getComputedStyle(node).overflowY,
    })),
  ]);

  if (overflowStyles[0] !== 'visible') {
    throw new Error(`Expected .arena-seat__hand-area overflow to stay visible at zoom ${zoomLabel}.`);
  }
  if (overflowStyles[1] !== 'visible') {
    throw new Error(`Expected .arena-seat__hand-viewport overflow to stay visible at zoom ${zoomLabel}.`);
  }
  if (overflowStyles[2].overflowX !== 'auto' && overflowStyles[2].overflowX !== 'scroll') {
    throw new Error(`Expected .arena-seat__hand-scroll to own horizontal scrolling at zoom ${zoomLabel}.`);
  }

  for (const ancestor of ancestors.slice(1)) {
    const points = createPointAssertions(cardBox, ancestor.box);
    if (points.length > 0) {
      throw new Error(
        `Detected ${ancestor.label} clipping on the ${points[0].axis} edge at zoom ${zoomLabel}.`,
      );
    }
  }

  const handCount = await handCards.count();
  const safeLabel = ['first', 'middle', 'last'][index === 0 ? 0 : index === handCount - 1 ? 2 : 1];
  await page.locator('.arena-seat__hand-area[data-hidden="false"] .arena-seat__hand-viewport').first().screenshot({
    path: path.join(screenshotDir, `${zoomLabel}-${safeLabel}-hover.png`),
  });

  return {
    hoveredIndex: index,
    cardBox,
    handAreaBox,
    handViewportBox,
    handScrollBox,
  };
}

async function main() {
  const baseUrl = resolveBaseUrl();
  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: videoDir,
      size: VIEWPORT,
    },
  });
  const page = await context.newPage();

  const url = `${baseUrl}/?test-game-state=${TEST_STATE_ID}`;
  const results = [];

  try {
    for (const zoom of ZOOM_LEVELS) {
      const zoomLabel = `${Math.round(zoom * 100)}pct`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.locator('.arena-board').waitFor();
      await page.locator('.arena-seat__hand-area[data-hidden="false"] .arena-seat__hand-viewport').waitFor();

      // Chromium does not expose browser chrome zoom to Playwright, so the regression
      // check uses the page-level `zoom` CSS property on the root element to reproduce
      // the same effective layout and clipping behavior inside the document.
      await page.evaluate((value) => {
        document.documentElement.style.zoom = String(value);
      }, zoom);
      await page.locator('.arena-board').waitFor();

      const handCards = page
        .locator('.arena-seat__hand-area[data-hidden="false"]')
        .first()
        .locator('.arena-seat__hand-card:not([data-hidden-placeholder="true"]) .arena-card[title]');
      const handCount = await handCards.count();
      if (handCount < 3) {
        throw new Error(`Expected at least 3 visible hand cards, found ${handCount}.`);
      }

      const hiddenPlaceholderCount = await page
        .locator('.arena-seat__hand-area[data-hidden="true"] .arena-seat__hand-card[data-hidden-placeholder="true"]')
        .count();
      if (hiddenPlaceholderCount === 0) {
        throw new Error('Expected at least one hidden-hand placeholder in the preset.');
      }

      for (const expectedCard of [
        'Heliod, Sun-Crowned',
        'Sun Titan',
        'Wrath of God',
        'Path to Exile',
      ]) {
        const visible = await page
          .locator(`.arena-seat__hand-area[data-hidden="false"] .arena-card[title="${expectedCard}"]`)
          .count();
        if (visible === 0) {
          throw new Error(`Preset marker "${expectedCard}" was not visible in the local hand rail.`);
        }
      }

      await page.screenshot({
        path: path.join(screenshotDir, `${zoomLabel}-full.png`),
        fullPage: true,
      });

      const indexes = [0, Math.floor((handCount - 1) / 2), handCount - 1];
      for (const index of indexes) {
        results.push(await hoverAndVerify(page, handCards, index, zoomLabel));
      }
    }

    await fs.writeFile(
      path.join(artifactRoot, 'bounding-boxes.json'),
      `${JSON.stringify(results, null, 2)}\n`,
      'utf8',
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
