# Hidden Hand Commander Fanout

## Purpose
Verify the hidden-opponent rail composition after fan removal: visible commander inline with concealed hand slots, no fan styling, and no interaction on hidden placeholders.

## Exact Setup
1. Start the app:
   ```bash
   npm run dev -- --host 127.0.0.1
   ```
2. In another terminal, prepare Playwright:
   ```bash
   npm install --no-save playwright
   npx playwright install chromium
   mkdir -p qa/artifacts/playwright-videos
   ```
3. Open `http://127.0.0.1:5173/`.
4. Click the settings button named `Open settings`.
5. Click `New Game`.

This fresh-game reset is the focused hidden-opponent scenario used by this doc. It guarantees:
- hidden opponent hand cards
- a visible commander in each hidden opponent rail
- no user interaction history that could affect hover state

## Playwright Procedure
Run:

```bash
node qa/hand-rail-playwright-check.mjs
```

Use the generated desktop and narrow `.webm` files in `qa/artifacts/playwright-videos/` as the required review evidence.

## Focused Hidden-Opponent Checks
For each hidden opponent seat, verify on screen:
- The hand area is one straight horizontal rail.
- The first visible rail card is the commander.
- Concealed hand slots appear inline after the commander as normal rail items.
- No curved fan, featured-card wrapper, detached command block, or count badge is visible.
- The hidden hand count is still exposed textually through the rail container tooltip or accessible label.

Interaction checks:
- Move the pointer across a hidden card back.
- Confirm the hidden placeholder does not lift, scale, animate, preview, focus, or show a pointer-like affordance.
- Click the hidden placeholder.
- Confirm no preview panel, dialog, or action appears.

## Ordering Expectation
The required hidden-opponent rail order is:
1. `COMMAND`
2. concealed `HAND` slots
3. playable `EXILE` cards, if a deterministic scenario becomes available
4. playable `GRAVEYARD` cards, if a deterministic scenario becomes available

In the current deterministic fresh-game setup, only the `COMMAND` + concealed `HAND` portion is guaranteed to appear.

## Residual Fan Regressions That Fail This Check
- Any curved or staggered hidden-hand arc.
- Any commander rendered outside the shared rail.
- Any separate featured commander wrapper.
- Any hidden-hand badge replacing the inline concealed slots.
- Any hover motion or preview behavior on concealed placeholders.

## Coverage Limit
The repo does not currently provide a deterministic hidden-opponent state with playable off-hand `EXILE` or `GRAVEYARD` cards reachable from `New Game`. If that fixture is added later, extend `qa/hand-rail-playwright-check.mjs` with an assertion that those visible off-hand cards render after the concealed hand slots in the same rail.

## Failure Evidence To Capture
- Hidden seat position.
- Whether the issue is ordering, concealment, residual fan styling, or unintended interaction.
- The matching `.webm` artifact path from `qa/artifacts/playwright-videos/`.
