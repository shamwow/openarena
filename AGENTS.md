# AGENTS.md

This repo is a Vite + React app. Use this file as the default playbook when an agent needs to run the app in a browser with Playwright, interact with the UI, and capture screenshots or video.

## Start the app

From the repo root:

```bash
npm run dev -- --host 127.0.0.1 --port 0
```

Port `0` tells the OS to assign a random unused port, avoiding collisions when
multiple agents or dev servers run concurrently.

Use `127.0.0.1`, not `localhost`, to avoid host resolution differences in automation.

Wait for Vite to print its local URL, then **parse the actual port from the output**.
Vite logs a line like:

```text
  ➜  Local:   http://127.0.0.1:56789/
```

Extract the port from that line (e.g. with a regex like `Local:\s+http://[\d.]+:(\d+)`)
and use it for all subsequent requests and Playwright navigation.

## Unit tests

This repo does not currently have a unit test runner configured. There is no `test`
or `test:unit` script in `package.json`, and no Vitest or Jest setup checked in.

If unit tests are added later, prefer exposing them through a dedicated script in
`package.json`, for example:

```json
{
  "scripts": {
    "test:unit": "vitest run"
  }
}
```

Then run unit tests from the repo root with:

```bash
npm run test:unit
```

## Open the app with Playwright

Minimal example:

```ts
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();

await page.goto('http://127.0.0.1:<PORT>', { waitUntil: 'networkidle' });
await page.locator('.arena-board').waitFor();
```

Use a desktop-sized viewport. The board is dense and easier to inspect around `1440x1100` or larger.

## Test game states

Use the dev-only query param `test-game-state` to boot the app from a checked-in preset:

```text
http://127.0.0.1:<PORT>/?test-game-state=<id>
```

Registry and builder locations:

- `src/testing/testGameStates.ts`
- `src/testing/testGameStateBuilder.ts`

Authoring workflow:

1. Add a unique registry entry in `src/testing/testGameStates.ts`.
2. Build the state with `TestGameStateBuilder` helpers from `src/testing/testGameStateBuilder.ts`.
3. Start the dev server with `npm run dev -- --host 127.0.0.1 --port 0`.
4. Open `http://127.0.0.1:<PORT>/?test-game-state=<id>` in the browser or Playwright.

Behavior notes:

- `test-game-state` is ignored outside dev mode.
- If the id is missing or empty, the app boots the normal game.
- If the id is unknown, the app falls back to the normal game and emits a browser-console warning with the available ids.
- While the query param is present, clicking `New Game` rebuilds and reloads the same preset deterministically.

Current durable preset for integration checks:

- `priority-reset-demo`
  - Starts on turn 7 in precombat main with `Pass Priority` visible.
  - Distinctive visible markers include `Talrand, Sky Summoner`, `Rhystic Study`, `Blood Artist`, `Swiftfoot Boots`, `Command Tower`, and `Sol Ring`.
  - Passing priority should advance the board to a later step instead of doing nothing.

How to verify a preset loaded:

- Assert the expected unique cards are visible in the authored zones.
- Assert the current phase/step marker is correct.
- Assert the action state is correct, for example `Pass Priority` is present when the preset is meant to be interactive.
- For UI verification work, record a Playwright video in addition to screenshots.

## Recommended waits

Do not use blind sleeps unless the UI is animating and there is no stable state to wait on. Prefer:

```ts
await page.locator('.arena-board').waitFor();
await page.getByRole('button', { name: 'Pass Priority' }).waitFor();
await page.getByRole('button', { name: 'Open settings' }).waitFor();
```

For a new game reset:

```ts
await page.getByRole('button', { name: 'Open settings' }).click();
await page.getByRole('button', { name: 'New Game' }).click();
await page.locator('.arena-board').waitFor();
```

## Screenshots

Full page:

```ts
await page.screenshot({
  path: 'artifacts/openarena-full.png',
  fullPage: true,
});
```

Board only:

```ts
await page.locator('.arena-board').screenshot({
  path: 'artifacts/openarena-board.png',
});
```

Specific UI regions:

```ts
await page.locator('.arena-phase-bar').screenshot({
  path: 'artifacts/phase-bar.png',
});
```

## Video recording

Record the whole browser session from the context:

```ts
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  recordVideo: {
    dir: 'artifacts/videos',
    size: { width: 1440, height: 1100 },
  },
});
```

Close the context to flush the video file:

```ts
await context.close();
await browser.close();
```

If you forget to close the context, the video may not be written completely.

## Playwright verification script

Concrete verification target: `priority-reset-demo`

```ts
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  recordVideo: {
    dir: 'artifacts/videos',
    size: { width: 1440, height: 1100 },
  },
});
const page = await context.newPage();

await page.goto('http://127.0.0.1:<PORT>/?test-game-state=priority-reset-demo', {
  waitUntil: 'networkidle',
});
await page.locator('.arena-board').waitFor();
await page.getByRole('button', { name: 'Pass Priority' }).waitFor();

await expect(page.locator('.arena-card[title="Talrand, Sky Summoner"]')).toBeVisible();
await expect(page.locator('.arena-card[title="Rhystic Study"]')).toBeVisible();
await expect(page.locator('.arena-card[title="Blood Artist"]')).toBeVisible();
await expect(page.locator('.arena-card[title="Swiftfoot Boots"]')).toBeVisible();
await expect(page.locator('.arena-phase-step[data-current="true"]')).toHaveAttribute('title', 'Main 1');

await page.screenshot({ path: 'artifacts/priority-reset-demo-initial.png', fullPage: true });
await page.locator('.arena-board').screenshot({ path: 'artifacts/priority-reset-demo-board-initial.png' });

await page.getByRole('button', { name: 'Pass Priority' }).click();
await expect(page.locator('.arena-phase-step[data-current="true"]')).toHaveAttribute('title', 'Main 2');

await page.getByRole('button', { name: 'Open settings' }).click();
await page.getByRole('button', { name: 'New Game' }).click();
await page.locator('.arena-board').waitFor();
await page.getByRole('button', { name: 'Pass Priority' }).waitFor();
await expect(page.locator('.arena-phase-step[data-current="true"]')).toHaveAttribute('title', 'Main 1');
await expect(page.locator('.arena-card[title="Talrand, Sky Summoner"]')).toBeVisible();

await page.screenshot({ path: 'artifacts/priority-reset-demo-after-reset.png', fullPage: true });

await context.close();
await browser.close();
```

## Useful interaction targets in this app

Prefer accessible selectors first, then stable text, then CSS selectors.

Stable controls:

- `page.getByRole('button', { name: 'Pass Priority' })`
- `page.getByRole('button', { name: 'Open settings' })`
- `page.getByRole('button', { name: 'New Game' })`
- `page.getByRole('button', { name: 'Show Log' })`
- `page.getByRole('button', { name: 'Hide Log' })`
- `page.getByRole('button', { name: 'Yes' })`
- `page.getByRole('button', { name: 'No' })`
- `page.getByRole('button', { name: 'Confirm' })`
- `page.getByRole('button', { name: 'Clear' })`

Stable panels:

- `.arena-board`
- `.arena-phase-bar`
- `.arena-stack`
- `.arena-stack-panel`
- `.arena-choice-modal`
- `.arena-settings-modal`

Zone piles:

- `[data-zone="EXILE"]`
- `[data-zone="GRAVEYARD"]`
- `[data-zone="LIBRARY"]`

Cards:

- Every card root uses `.arena-card`
- Cards expose their name via the `title` attribute
- Card art images use `img[alt="<card name>"]`

Examples:

```ts
await page.locator('.arena-card[title="Sol Ring"]').click();
await page.locator('img[alt="Command Tower"]').click();
```

## How to interact with the app

The board is a four-player tabletop layout. Interaction is mostly card clicks, drag/drop, and a few HUD buttons.

Common flows:

1. Preview a card by hovering it.

```ts
await page.locator('.arena-card[title="Sol Ring"]').hover();
```

2. Activate the primary action on a card by clicking it.

```ts
await page.locator('.arena-card[title="Command Tower"]').click();
```

3. Pass when no other action is needed.

```ts
await page.getByRole('button', { name: 'Pass Priority' }).click();
```

4. Open graveyard or exile dialogs by clicking zone piles.

```ts
await page.locator('[data-zone="GRAVEYARD"]').click();
await page.getByRole('dialog').waitFor();
```

5. Resolve modal choices by clicking visible choice buttons.

```ts
await page.locator('.arena-choice-modal').waitFor();
await page.getByRole('button', { name: 'Yes' }).click();
```

## Drag and drop

Some actions are drag-driven. Use Playwright mouse drag when click activation is not enough.

Example pattern:

```ts
const source = page.locator('.arena-card[title="Forest"]').first();
const target = page.locator('.arena-seat__battlefield').nth(0);

await source.dragTo(target);
```

If `dragTo` is unreliable, fall back to mouse events:

```ts
const sourceBox = await source.boundingBox();
const targetBox = await target.boundingBox();

if (!sourceBox || !targetBox) throw new Error('Missing drag geometry');

await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
await page.mouse.down();
await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
await page.mouse.up();
```

## Logging and debugging

Useful checks while driving the UI:

```ts
console.log(await page.locator('.arena-phase-bar').innerText());
console.log(await page.locator('.arena-stack-panel').allTextContents());
console.log(await page.locator('.arena-choice-modal').allTextContents());
```

If the board looks idle, inspect whether:

- `Pass Priority` is visible
- a `.arena-choice-modal` is open
- the settings modal is covering the board
- a zone dialog is open

## Practical script template

```ts
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  recordVideo: { dir: 'artifacts/videos', size: { width: 1440, height: 1100 } },
});

const page = await context.newPage();

await page.goto('http://127.0.0.1:<PORT>', { waitUntil: 'networkidle' });
await page.locator('.arena-board').waitFor();

await page.screenshot({ path: 'artifacts/initial-board.png', fullPage: true });

if (await page.getByRole('button', { name: 'Pass Priority' }).isVisible()) {
  await page.getByRole('button', { name: 'Pass Priority' }).click();
}

await page.getByRole('button', { name: 'Open settings' }).click();
await page.getByRole('button', { name: 'Show Log' }).click();
await page.screenshot({ path: 'artifacts/board-with-log.png', fullPage: true });

await context.close();
await browser.close();
```

## Notes for agents

- Keep the Vite server running in a separate terminal while Playwright runs.
- Prefer deterministic selectors based on role, button text, `title`, `alt`, or `data-zone`.
- Capture a screenshot before and after any substantial interaction sequence.
- For interactive UI verification, record video and close the Playwright context so the file is written.
- Close the Playwright context at the end so recorded video is saved.
