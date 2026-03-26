# New Game Hand Rail

## Purpose
Verify that a freshly loaded game displays the hand rail correctly for both the visible local seat and the hidden opponent seats.

## Preconditions
- The app is running and a new game has just loaded.
- The board is visible with one local visible seat and three hidden opponent seats.
- No gameplay actions have been taken beyond loading the game.

## Test Steps
1. Load the app and wait for the initial game board to finish rendering.
2. Confirm the new game state is present on screen, including all four player seats and the opening board layout.
3. Inspect the local visible seat hand rail from left to right.
4. Check the leftmost, middle, and rightmost visible-seat hand cards for clipping at the top, bottom, left, and right edges.
5. Hover the leftmost, middle, and rightmost visible-seat hand cards and verify that the hovered card remains fully visible.
6. If the visible-seat hand rail scrolls horizontally, scroll it far enough to inspect every card in the hand, then re-check the newly revealed cards for clipping.
7. Inspect each hidden opponent seat hand rail one seat at a time.
8. For each hidden seat, verify that the rail is a straight row of hidden card backs with the commander card attached in the same rail container.
9. Check that the commander sits on the edge of the hidden rail rather than in a detached block or a centered overlay.
10. Verify that the hidden backs do not form an arc, fan, or rotated spread.
11. Hover the commander and nearby hidden back tiles and verify that the commander remains fully visible while the back tiles stay presentational only.
12. Compare the commander card treatment against normal hand cards for both visible and hidden seats.

## Expected Results
1. A new game loads successfully and the board is visible without missing seat panels or missing card rails.
2. For the visible local seat:
   - The entire hand is checked, not just the commander or the first visible cards.
   - No visible-seat hand card is clipped at the top, bottom, left, or right edge.
   - No visible-seat hand card is partially cut off by the rail boundary, zone piles, phase bar, or viewport edge.
   - Hovering any checked visible-seat card does not introduce clipping at the top, bottom, left, or right edge.
   - If the rail is horizontally scrollable, every card remains fully visible when scrolled into view.
   - The commander appears in the same hand rail as the other cards.
   - The commander does not appear as a detached command block outside the hand rail.
   - The commander has a distinct border compared with normal hand cards.
3. For each hidden opponent seat:
   - The hidden hand is rendered as a straight rail of hidden card backs plus the commander card.
   - The hidden cards do not fan out, arc, or rotate.
   - The commander is attached to the same rail container and does not appear as a detached command block.
   - The commander remains readable at the edge of the rail.
   - Hidden back tiles do not show preview chrome, drag handles, focus states, or click behavior.
   - Hovering hidden back tiles does not lift them or reveal any extra card UI.
   - The commander remains visible while hovering and while the rail is horizontally scrolled.
   - There is no visible gap or separation that makes the commander look like a standalone upright card next to the rail.
   - If a count cue is present, it is attached to the rail container rather than rendered as a detached overlay.

## Failure Notes / Evidence To Capture
- Which seat failed: visible local seat or specific hidden seat position.
- Which specific card was clipped, including whether it was at the left edge, middle, or right edge of the hand.
- Whether the issue appeared at rest or only while hovering the card.
- Whether the issue was clipping, missing commander, detached commander placement, hidden cards fanning out, hidden back tiles showing preview chrome, hidden cards gaining focus or drag affordances, or missing distinct border.
- A screenshot of the full board, plus a tighter crop of the affected seat if the problem is subtle.
- The viewport size and browser used for the check.
