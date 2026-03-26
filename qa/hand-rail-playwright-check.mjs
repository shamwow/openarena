import { chromium } from 'playwright';
import { rename } from 'node:fs/promises';

const BASE_URL = 'http://127.0.0.1:5173/';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForCount(page, selector, expected) {
  for (let index = 0; index < 20; index += 1) {
    const count = await page.locator(selector).count();
    if (count === expected) {
      return;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(`Expected ${selector} count ${expected}`);
}

async function verify(browser, name, viewport, options = {}) {
  const { scenario = null } = options;
  const context = await browser.newContext({
    viewport,
    recordVideo: {
      dir: 'qa/artifacts/playwright-videos',
      size: viewport,
    },
  });
  const page = await context.newPage();
  const video = page.video();

  const url = scenario ? `${BASE_URL}?qaScenario=${scenario}` : BASE_URL;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);

  assert((await page.locator('.arena-seat').count()) === 4, `${name}: expected 4 seats`);
  assert(
    (await page.locator('.arena-seat__hand-area[data-hidden="false"]').count()) === 1,
    `${name}: expected 1 visible hand area`,
  );
  assert(
    (await page.locator('.arena-seat__hand-area[data-hidden="true"]').count()) === 3,
    `${name}: expected 3 hidden hand areas`,
  );
  assert(
    (await page.locator('.arena-hidden-hand-fan').count()) === 0,
    `${name}: fan markup still present`,
  );
  assert(
    (await page.locator('.arena-hidden-hand-fan__featured').count()) === 0,
    `${name}: featured fan wrapper still present`,
  );
  assert(
    (await page.locator('.arena-seat__hand-card[data-hidden-placeholder="true"]').count()) > 0,
    `${name}: expected hidden placeholders`,
  );

  const hiddenTitles = await page
    .locator('.arena-seat__hand-area[data-hidden="true"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        title: node.getAttribute('title'),
        label: node.getAttribute('aria-label'),
      })),
    );
  for (const [index, hidden] of hiddenTitles.entries()) {
    assert(
      /cards in hand/.test(hidden.title ?? ''),
      `${name}: hidden hand ${index} missing title count`,
    );
    assert(
      /has \d+ cards in hand/.test(hidden.label ?? ''),
      `${name}: hidden hand ${index} missing aria-label count`,
    );
  }

  const hiddenRail = page
    .locator('.arena-seat:has(.arena-seat__hand-area[data-hidden="true"]) .arena-seat__hand-cards')
    .first();
  const hiddenStructure = await hiddenRail.evaluate((node) =>
    Array.from(node.children)
      .slice(0, 5)
      .map((item) => ({
        hasVisibleCard: item.querySelector('.arena-card:not(.arena-card-back)') !== null,
        hasBack: item.querySelector('.arena-card-back') !== null,
      })),
  );
  assert(
    hiddenStructure[0]?.hasVisibleCard === true,
    `${name}: hidden rail should start with visible commander card`,
  );
  assert(
    hiddenStructure.some((item) => item.hasBack),
    `${name}: hidden rail missing concealed hand slots`,
  );

  const localVisibleCard = page
    .locator('.arena-seat__hand-area[data-hidden="false"] .arena-seat__hand-card .arena-card')
    .first();
  const visibleBefore = await localVisibleCard.boundingBox();
  assert(visibleBefore, `${name}: local visible card missing bounding box before hover`);
  await localVisibleCard.hover();
  await page.waitForTimeout(250);
  const visibleAfter = await localVisibleCard.boundingBox();
  assert(visibleAfter, `${name}: local visible card missing bounding box after hover`);
  await waitForCount(page, '.arena-preview', 1);
  if (name !== 'narrow') {
    assert(
      visibleAfter.y < visibleBefore.y || visibleAfter.height > visibleBefore.height,
      `${name}: visible card did not lift or scale on hover`,
    );
  }

  await page.mouse.move(8, 8);
  await page.waitForTimeout(250);
  await waitForCount(page, '.arena-preview', 0);

  const hiddenPlaceholder = page
    .locator('.arena-seat__hand-area[data-hidden="true"] .arena-seat__hand-card[data-hidden-placeholder="true"]')
    .first();
  const hiddenBefore = await hiddenPlaceholder.locator('.arena-card-back').boundingBox();
  assert(hiddenBefore, `${name}: hidden placeholder missing bounding box before hover`);
  await page.mouse.move(
    hiddenBefore.x + (hiddenBefore.width / 2),
    hiddenBefore.y + (hiddenBefore.height / 2),
  );
  await page.waitForTimeout(250);
  const hiddenAfter = await hiddenPlaceholder.locator('.arena-card-back').boundingBox();
  assert(hiddenAfter, `${name}: hidden placeholder missing bounding box after hover`);
  assert(
    Math.abs(hiddenAfter.y - hiddenBefore.y) < 0.5,
    `${name}: hidden placeholder moved on hover`,
  );
  assert(
    Math.abs(hiddenAfter.height - hiddenBefore.height) < 0.5,
    `${name}: hidden placeholder scaled on hover`,
  );
  await waitForCount(page, '.arena-preview', 0);
  await hiddenPlaceholder.click({ force: true });
  await page.waitForTimeout(150);
  await waitForCount(page, '.arena-preview', 0);

  const handScroll = page.locator(
    '.arena-seat__hand-area[data-hidden="false"] .arena-seat__hand-scroll',
  );
  const overflowMetrics = await handScroll.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  if (name === 'narrow') {
    assert(
      overflowMetrics.scrollWidth > overflowMetrics.clientWidth,
      `${name}: expected horizontal overflow in narrow viewport`,
    );
    await handScroll.evaluate((node) => {
      node.scrollLeft = Math.min(180, node.scrollWidth - node.clientWidth);
    });
    const scrollLeft = await handScroll.evaluate((node) => node.scrollLeft);
    assert(scrollLeft > 0, `${name}: hand rail did not scroll horizontally`);
  }

  if (scenario === 'local-offhand-rail') {
    const localRailZones = await page
      .locator('.arena-seat__hand-area[data-hidden="false"] .arena-card[data-variant="hand"]')
      .evaluateAll((nodes) => nodes.map((node) => ({
        sourceZone: node.getAttribute('data-source-zone'),
        hasAction: node.getAttribute('data-has-action'),
      })));
    const sourceZones = localRailZones.map((item) => item.sourceZone);
    const firstExileIndex = sourceZones.indexOf('EXILE');
    const firstGraveyardIndex = sourceZones.indexOf('GRAVEYARD');
    const lastHandIndex = sourceZones.lastIndexOf('HAND');

    assert(firstExileIndex > lastHandIndex, `${name}: exile card should render after visible hand cards`);
    assert(
      firstGraveyardIndex > firstExileIndex,
      `${name}: graveyard card should render after exile cards`,
    );
    assert(
      localRailZones[firstExileIndex]?.hasAction === 'true',
      `${name}: exile rail card should be actionable`,
    );
    assert(
      localRailZones[firstGraveyardIndex]?.hasAction === 'true',
      `${name}: graveyard rail card should be actionable`,
    );

    const exileCard = page
      .locator('.arena-seat__hand-area[data-hidden="false"] .arena-card[data-source-zone="EXILE"]')
      .first();
    await exileCard.hover();
    await page.waitForTimeout(200);
    await waitForCount(page, '.arena-preview', 1);
    await page.mouse.move(8, 8);
    await page.waitForTimeout(200);
    await waitForCount(page, '.arena-preview', 0);
  }

  await page.screenshot({
    path: `qa/artifacts/playwright-videos/${name}.png`,
    fullPage: true,
  });
  await context.close();
  const recordedVideoPath = await video.path();
  const videoPath = `qa/artifacts/playwright-videos/${name}.webm`;
  await rename(recordedVideoPath, videoPath);
  console.log(`${name}: ok`);
  console.log(`${name}: screenshot=qa/artifacts/playwright-videos/${name}.png`);
  console.log(`${name}: video=${videoPath}`);
}

const browser = await chromium.launch({ headless: true });

try {
  await verify(browser, 'desktop', { width: 1440, height: 900 });
  await verify(browser, 'narrow', { width: 700, height: 1180 });
  await verify(browser, 'offhand-desktop', { width: 1440, height: 900 }, { scenario: 'local-offhand-rail' });
} finally {
  await browser.close();
}
