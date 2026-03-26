**Summary**
- Move local hand overflow handling to a dedicated viewport and scroll container so hovered hand cards can expand past the rail without being clipped while the hand still scrolls horizontally.
- Add a deterministic `hand-overflow-zoom-demo` dev preset with a wide visible local hand and hidden opponent-hand placeholders so the zoom regression can be reproduced from a known board state.
- Add `npm run verify:hand-zoom`, a Playwright check that loads the preset at 100%, 110%, 125%, 150%, 175%, and 200% zoom, asserts key preset markers are present, and fails if hovered first, middle, or last local hand cards are clipped by the hand viewport.

**Test plan**
1. Start the app with `npm run dev -- --host 127.0.0.1 --port 0` and parse the printed `http://127.0.0.1:<PORT>/` URL from Vite output.
2. Open `http://127.0.0.1:<PORT>/?test-game-state=hand-overflow-zoom-demo`.
3. Verify the preset loaded by confirming all of these are true at once: the current step is precombat main, `Heliod, Sun-Crowned` is in the local command slot, `Command Tower`, `Reliquary Tower`, `Sol Ring`, and `Swiftfoot Boots` are visible on the local battlefield, the local hand shows `Wrath of God`, `Path to Exile`, `Sun Titan`, and two `Serra Angel` copies, and at least one opponent still shows hidden-hand placeholders.
4. Run `OPENARENA_BASE_URL=http://127.0.0.1:<PORT> npm run verify:hand-zoom`.
5. Confirm the script exits successfully after checking zoom levels 100%, 110%, 125%, 150%, 175%, and 200%.
6. For each zoom level, confirm the Playwright run verified all of these conditions: `.arena-board` rendered, the local visible hand contained `Heliod, Sun-Crowned`, `Sun Titan`, `Wrath of God`, and `Path to Exile`, at least one hidden opponent-hand placeholder remained present, and the hovered first, middle, and last local hand cards scaled up without the `.arena-seat__hand-viewport` or `.arena-seat__hand-scroll` clipping their top, left, or right edges.

**Visual evidence**
- `.ironsha/pr-media/hand-zoom/hand-overflow-demo-100pct-full.png`
  Full-page Playwright capture of `hand-overflow-zoom-demo` at 100% zoom. It shows the preset loaded with `Turn 9`, the local `Pass Priority` action, `Heliod, Sun-Crowned`, `Command Tower`, `Reliquary Tower`, `Sol Ring`, `Swiftfoot Boots`, and hidden opponent-hand placeholders.
- `.ironsha/pr-media/hand-zoom/hand-overflow-demo-200pct-last-hover.png`
  Playwright hand-viewport capture at 200% zoom after hovering the rightmost sampled local hand card. The hovered `Wrath of God` card remains fully visible on the right edge instead of being clipped by the hand rail.
- `.ironsha/pr-media/hand-zoom/hand-overflow-demo-verify-run.webm`
  Raw Playwright video recorded from the successful six-zoom verification run against `hand-overflow-zoom-demo`.
- `.ironsha/pr-media/hand-zoom/hand-overflow-demo-bounding-boxes.json`
  Non-visual evidence from the same verification run. It records the card, hand area, hand viewport, and hand scroll bounding boxes for the first, middle, and last sampled hand cards at every zoom level so reviewers can confirm the clipping assertions are backed by geometry, not just screenshots.
