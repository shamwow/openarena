import { mkdir, rm } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = process.argv[2] ?? process.env.PORT;

if (!port) {
  throw new Error('Pass the Vite dev-server port as argv[2] or set PORT.');
}

const baseUrl = `http://127.0.0.1:${port}`;
const presetUrl = `${baseUrl}/?test-game-state=hidden-hand-hover-demo`;
const artifactDir = '.ironsha/pr-media';
const videoDir = `${artifactDir}/videos`;
const hiddenNames = ['Counterspell', 'Brainstorm', 'Ponder'];

await mkdir(artifactDir, { recursive: true });
await mkdir(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  recordVideo: {
    dir: videoDir,
    size: { width: 1440, height: 1100 },
  },
});
const page = await context.newPage();
const recordedVideo = page.video();

await page.goto(presetUrl, { waitUntil: 'networkidle' });
await page.locator('.arena-board').waitFor();

const opponentSeat = page.locator('.arena-seat[data-position="bottom-left"]').first();
const opponentHandArea = opponentSeat.locator('.arena-seat__hand-area');
const concealedCards = opponentSeat.locator('.arena-seat__hand-card[data-concealed="true"] .arena-card[data-concealed="true"]');
const visibleRailCard = opponentSeat.locator('.arena-card[title="Talrand, Sky Summoner"]').first();
const previewPane = page.locator('.arena-preview');

await concealedCards.first().waitFor();

if ((await concealedCards.count()) < 3) {
  throw new Error('Expected at least three concealed opponent hand cards.');
}

await visibleRailCard.waitFor();
await page.locator('.arena-card[title="Rhystic Study"]').waitFor();

await page.screenshot({ path: `${artifactDir}/hidden-hand-hover-demo-initial-board.png`, fullPage: true });
await opponentHandArea.screenshot({ path: `${artifactDir}/hidden-hand-hover-demo-opponent-rail-initial.png` });

const firstConcealed = concealedCards.nth(0);
const secondConcealed = concealedCards.nth(1);

await firstConcealed.hover();
await previewPane.waitFor();

await firstConcealed.waitFor({ state: 'visible' });
await page.waitForFunction(
  (selector) => {
    const element = document.querySelector(selector);
    return element?.getAttribute('data-previewed') === 'true';
  },
  '.arena-seat[data-position="bottom-left"] .arena-seat__hand-card[data-concealed="true"] .arena-card[data-concealed="true"]',
);

const firstTitle = await previewPane.locator('.arena-preview__title').textContent();
if (firstTitle !== 'Hidden Card') {
  throw new Error(`Expected concealed preview title to be "Hidden Card", got "${firstTitle}".`);
}

const firstPreviewText = await previewPane.innerText();
if (!firstPreviewText.includes('Card details are hidden until revealed.')) {
  throw new Error('Expected concealed preview copy to mention hidden details.');
}
for (const hiddenName of hiddenNames) {
  if (firstPreviewText.includes(hiddenName)) {
    throw new Error(`Concealed preview leaked hidden card name "${hiddenName}".`);
  }
}

await opponentHandArea.screenshot({ path: `${artifactDir}/hidden-hand-hover-demo-opponent-rail-hover-first.png` });
await previewPane.screenshot({ path: `${artifactDir}/hidden-hand-hover-demo-preview-hidden-card.png` });

await secondConcealed.hover();

const previewedCount = await opponentSeat
  .locator('.arena-seat__hand-card[data-concealed="true"] .arena-card[data-previewed="true"]')
  .count();
if (previewedCount !== 1) {
  throw new Error(`Expected exactly one concealed card to be previewed, found ${previewedCount}.`);
}

const secondPreviewText = await previewPane.innerText();
for (const hiddenName of hiddenNames) {
  if (secondPreviewText.includes(hiddenName)) {
    throw new Error(`Concealed preview leaked hidden card name "${hiddenName}" after second hover.`);
  }
}

await opponentHandArea.screenshot({ path: `${artifactDir}/hidden-hand-hover-demo-opponent-rail-hover-second.png` });

await visibleRailCard.hover();
const visiblePreviewText = await previewPane.innerText();
if (!visiblePreviewText.includes('Talrand, Sky Summoner')) {
  throw new Error('Expected visible rail card preview to show Talrand details.');
}

await previewPane.screenshot({ path: `${artifactDir}/hidden-hand-hover-demo-preview-visible-rail-card.png` });

await firstConcealed.click();
const postClickPreviewText = await previewPane.innerText();
for (const hiddenName of hiddenNames) {
  if (postClickPreviewText.includes(hiddenName)) {
    throw new Error(`Concealed preview leaked hidden card name "${hiddenName}" after click.`);
  }
}

const dragTarget = opponentSeat.locator('.arena-seat__battlefield').first();
const sourceBox = await firstConcealed.boundingBox();
const targetBox = await dragTarget.boundingBox();

if (!sourceBox || !targetBox) {
  throw new Error('Missing geometry for concealed drag attempt.');
}

await page.mouse.move(
  sourceBox.x + sourceBox.width / 2,
  sourceBox.y + sourceBox.height / 2,
);
await page.mouse.down();
await page.mouse.move(
  targetBox.x + targetBox.width / 2,
  targetBox.y + targetBox.height / 2,
  { steps: 10 },
);
await page.mouse.up();

const concealedCardDragged = await page
  .locator('.arena-seat[data-position="bottom-left"] .arena-seat__hand-card[data-concealed="true"] .arena-card[data-dragging="true"]')
  .count();
if (concealedCardDragged !== 0) {
  throw new Error('Concealed opponent hand card should not enter dragging state.');
}

const postDragPreviewText = await previewPane.innerText();
for (const hiddenName of hiddenNames) {
  if (postDragPreviewText.includes(hiddenName)) {
    throw new Error(`Concealed preview leaked hidden card name "${hiddenName}" after drag attempt.`);
  }
}

await context.close();
if (!recordedVideo) {
  throw new Error('Expected Playwright video recording to be available.');
}
const rawVideoPath = await recordedVideo.path();
await recordedVideo.saveAs(`${artifactDir}/hidden-hand-hover-demo-session.webm`);
if (rawVideoPath !== `${artifactDir}/hidden-hand-hover-demo-session.webm`) {
  await rm(rawVideoPath, { force: true });
}
await browser.close();

console.log(`Verified hidden hand hover concealment at ${presetUrl}`);
