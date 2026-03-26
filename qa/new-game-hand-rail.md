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
8. Verify that each hidden seat renders a horizontal rail of face-down placeholders inline with the same hand rail used by the visible seat.
9. Verify that the hidden-seat commander is integrated into that same rail rather than floating beside or above it.
10. Hover the hidden-seat commander and confirm it remains fully visible and attached to the rail.
11. Scroll each hidden hand rail horizontally far enough to inspect the full row, then confirm the commander and placeholders stay aligned without clipping.
12. Confirm that the hidden placeholders do not intercept interactions intended for visible cards in the same rail.

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
   - The hidden seat renders a horizontal hand rail, not a detached fan.
   - The concealed hand appears as a row of face-down placeholders in the same flex flow as the visible rail.
   - The hidden placeholders use the same hand-card width and height as normal hand cards.
   - The hidden-seat commander is integrated into that rail and does not float beside or above it.
   - There is no detached fan geometry, rotated spread, or featured overlay.
   - No face-up card information leaks through the hidden placeholders.
   - The hidden placeholders do not intercept hover or click interactions intended for visible cards in the rail.
   - Hovering the hidden commander does not introduce clipping.
   - Scrolling the hidden rail horizontally keeps the commander and placeholders attached to the same row.

## Failure Notes / Evidence To Capture
- Which seat failed: visible local seat or specific hidden seat position.
- Which specific card was clipped, including whether it was at the left edge, middle, or right edge of the hand.
- Whether the issue appeared at rest or only while hovering the card.
- Whether the issue was clipping, missing commander, detached commander placement, commander not integrated into the hidden rail, leaked face-up content, hidden placeholders intercepting interaction, or any residual fan geometry.
- A screenshot of the full board, plus a tighter crop of the affected seat if the problem is subtle.
- The viewport size and browser used for the check.
