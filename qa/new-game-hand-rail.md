# New Game Hand Rail

## Purpose
Verify that a freshly loaded game displays one shared horizontal hand-rail pattern for both the visible local seat and the hidden opponent seats.

## Preconditions
- The app is running and a new game has just loaded.
- The board is visible with one local visible seat and three hidden opponent seats.
- No gameplay actions have been taken beyond loading the game.

## Test Steps
1. Load the app and wait for the initial game board to finish rendering.
2. Confirm the new game state is present on screen, including all four player seats and the opening board layout.
3. Inspect the local visible seat hand rail from left to right.
4. Check the leftmost, middle, and rightmost visible-seat rail cards for clipping at the top, bottom, left, and right edges.
5. Hover the leftmost, middle, and rightmost visible-seat rail cards and verify that the hovered card remains fully visible.
6. If the visible-seat rail scrolls horizontally, scroll it far enough to inspect every card in the hand, then re-check the newly revealed cards for clipping.
7. Inspect each hidden opponent seat rail one seat at a time.
8. Verify that each hidden seat uses the same horizontal rail pattern as the local seat rather than a fan or detached card group.
9. For each hidden seat, confirm that every hidden hand card is represented by a card back in the rail and that any commander appears inline in the same rail.
10. Where a hidden seat has playable exile or graveyard cards, confirm that they appear visibly after the hidden hand segment in the same rail and retain their zone-specific styling.
11. Move the pointer across hidden placeholders and confirm they do not preview, drag, focus, or reveal card information.
12. Hover each visible rail card on hidden seats, such as a commander or playable exile/graveyard card, and verify that hover lift remains fully visible without clipping adjacent cards.
13. For long hidden rails, scroll horizontally and verify the full rail remains accessible.

## Expected Results
1. A new game loads successfully and the board is visible without missing seat panels or missing card rails.
2. For the visible local seat:
   - The entire hand is checked, not just the commander or the first visible cards.
   - No visible-seat rail card is clipped at the top, bottom, left, or right edge.
   - No visible-seat rail card is partially cut off by the rail boundary, zone piles, phase bar, or viewport edge.
   - Hovering any checked visible-seat card does not introduce clipping at the top, bottom, left, or right edge.
   - If the rail is horizontally scrollable, every card remains fully visible when scrolled into view.
   - The commander appears in the same rail as the other cards.
   - The commander remains visually distinct from normal hand cards via its existing command styling.
3. For each hidden opponent seat:
   - The seat renders a horizontal hand rail, not a fan or spread.
   - The hand segment appears as a sequence of non-interactive card backs, one per hidden hand card.
   - The commander appears inline in the same rail rather than as a detached block.
   - Any visible playable exile or graveyard cards appear inline after the hand segment and retain their zone-specific border treatment.
   - Hidden placeholders do not reveal names, art, previews, click actions, drag affordances, or focus treatment.
   - Hidden placeholders do not appear to lift or enlarge on hover.
   - Visible rail cards on hidden seats still hover cleanly without clipping.
   - Long rails remain horizontally scrollable.
   - The hidden seat retains a clear hand-count affordance, such as the rail or hand area title.
   - Visible and hidden seats read as the same rail pattern, differing only in whether the hand segment shows real cards or card backs.

## Failure Notes / Evidence To Capture
- Which seat failed: visible local seat or specific hidden seat position.
- Which specific rail item was clipped or behaved incorrectly, including whether it was at the left edge, middle, or right edge of the rail.
- Whether the issue appeared at rest, while hovering a visible card, or while horizontally scrolling.
- Whether the issue was a hidden fan still rendering, commander detached from the rail, incorrect card-back count, missing zone styling, interaction leakage on hidden placeholders, missing hand-count affordance, or clipping.
- A screenshot of the full board, plus a tighter crop of the affected seat if the problem is subtle.
- The viewport size and browser used for the check.
