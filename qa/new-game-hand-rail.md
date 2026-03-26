# New Game Hand Rail

## Purpose
Verify that a fresh game renders one unified hand rail for every seat, with visible local cards, concealed opponent card backs, inline commanders, and no residual fan treatment.

## Environment Setup
1. From the repo root, install dependencies if they are not already installed:
   ```bash
   npm install
   ```
2. Start the app on a fixed local host:
   ```bash
   npm run dev -- --host 127.0.0.1
   ```
3. In a second terminal, install the transient Playwright runtime used by this QA flow:
   ```bash
   npm install --no-save playwright
   npx playwright install chromium
   ```
4. Create the artifact directory if it does not already exist:
   ```bash
   mkdir -p qa/artifacts/playwright-videos
   ```

## Deterministic Product State
The app auto-loads a fresh game on first render. For repeatable QA, always reset through the in-product controls instead of relying on the initial mount state.

1. Open `http://127.0.0.1:5173/`.
2. Wait for the board to render.
3. Click the settings icon button with accessible name `Open settings`.
4. Click `New Game`.
5. Wait for the board to finish re-rendering.

This reset state is the required baseline for the checks below:
- 4 seats are visible.
- 1 local seat shows visible hand cards.
- 3 opponent seats show hidden hands.
- Opponent commanders are visible in the same rail as their hidden hand slots.

## Playwright Validation
Run the checked-in Playwright helper:

```bash
node qa/hand-rail-playwright-check.mjs
```

The script performs the deterministic reset above, then records:
- Desktop viewport: `1440x900`
- Narrow viewport: `700x1180`

The script writes artifacts to `qa/artifacts/playwright-videos/`:
- `desktop.png`
- `narrow.png`
- one `.webm` video per viewport run

Retain both `.webm` files as review evidence.

## Expected On-Screen Results
After `New Game` completes:
- All 4 seats show a hand rail container.
- The local seat shows visible hand cards in a straight horizontal rail.
- Each hidden opponent seat shows concealed card backs occupying normal rail slots, not a curved fan.
- Opponent commanders appear inline in the same rail as the hidden hand slots.
- No detached featured commander card is rendered.
- No hidden-hand count badge or fan arc is rendered.

During interaction:
- Hovering a local visible hand card lifts or scales only that visible card.
- The visible-card hover does not clip against the rail boundary.
- Moving the pointer away clears the preview.
- Hovering a hidden opponent card back leaves the screen visually unchanged.
- Clicking a hidden opponent card back does not open a preview or trigger an action.

Overflow behavior:
- In the narrow viewport, the local hand rail overflows horizontally.
- Horizontal scrolling moves the rail instead of shrinking cards to unusable widths.
- Concealed card backs and visible cards stay aligned in the same slot geometry while scrolled.

## Manual Review Notes
While reviewing the captured video, explicitly confirm:
- Opponent hand areas read as straight rails, not fans.
- Hidden card backs use the same overall card footprint as visible hand cards.
- Commanders are inline before the concealed hand slots rather than featured beside them.
- Hidden placeholders remain inert.

## Coverage Limit
The current app exposes a deterministic fresh-game state, but it does not expose a deterministic fixture, URL parameter, or debug control for a hidden opponent with playable `EXILE` or `GRAVEYARD` cards already in the rail. This QA flow therefore fully covers the guaranteed fresh-game cases and the unified-rail interaction model, but it does not claim deterministic coverage for off-hand rail integration beyond the code-path review.

## Failure Evidence To Capture
- The failing viewport: desktop or narrow.
- The failing seat position.
- Whether the regression affected local visible cards, hidden placeholders, commander ordering, overflow, or hover behavior.
- The exact artifact paths from `qa/artifacts/playwright-videos/`.
