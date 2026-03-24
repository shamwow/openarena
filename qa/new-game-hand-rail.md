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
8. For each hidden seat, verify that the commander is visually integrated into the hidden-hand fanout itself rather than merely sitting nearby in the same rail area.
9. Check the commander position within each hidden fanout and verify that it reads as the outer visible card of the fan rather than a card centered over the middle of the fan.
10. Verify that most of the commander sits outside the body of the hidden fan, with only its trailing edge overlapping the hidden cards.
11. Hover each hidden-seat commander card and verify that the hovered card remains fully visible.
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
   - The hidden hand fan is visible.
   - The commander appears as part of the hidden-hand fanout, continuing the same visual card grouping as the hidden hand.
   - The commander does not merely sit nearby in the same rail area.
   - The commander is positioned as the outer visible card of the fanout.
   - The commander follows the fan edge and does not sit centered over the middle of the hidden fan.
   - Most of the commander body sits outside the spread of hidden card backs, with only a narrow trailing overlap into the fan.
   - The commander does not cover the middle of the hidden fan or read like a card laid on top of the spread.
   - There is no visible gap or separation that makes the commander look like a standalone upright card next to the fan.
   - The commander does not appear as a detached command block outside the hand rail.
   - The commander has a distinct border compared with normal hand cards.
   - The visible commander card is not clipped.
   - Hovering the visible commander card does not introduce clipping.

## Failure Notes / Evidence To Capture
- Which seat failed: visible local seat or specific hidden seat position.
- Which specific card was clipped, including whether it was at the left edge, middle, or right edge of the hand.
- Whether the issue appeared at rest or only while hovering the card.
- Whether the issue was clipping, missing commander, detached commander placement, commander not integrated into the hidden-hand fanout, commander too far inward over the fan, commander not positioned as the outer fan card, or missing distinct border.
- A screenshot of the full board, plus a tighter crop of the affected seat if the problem is subtle.
- The viewport size and browser used for the check.
