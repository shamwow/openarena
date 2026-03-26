# Hidden Hand Commander Rail

## Purpose
Verify that, in a freshly loaded game, each hidden opponent seat renders its commander as part of the hidden hand rail rather than as a separate card placed beside it.

## Preconditions
- The app is running and a new game has just loaded.
- The board is visible with one local visible seat and three hidden opponent seats.
- Each hidden opponent seat has a commander in the command zone.
- No gameplay actions have been taken beyond loading the game.

## Test Steps
1. Load the app and wait for the initial game board to finish rendering.
2. Focus only on the three hidden opponent seats.
3. For each hidden seat, inspect the relationship between the hidden hand rail and the commander card.
4. Check whether the commander visually continues the rail of hidden placeholders rather than standing alone beside it.
5. Verify that the commander sits inline with the rail and does not float above, below, or outside the row.
6. Hover the commander on each hidden seat and verify that the hovered state remains fully visible and attached to the rail.
7. Scroll the hidden rail horizontally and confirm that the commander stays coupled to the same row as the placeholders.
8. Compare the commander against the local visible-seat commander only for border treatment, not for layout.

## Expected Results
1. Each hidden opponent seat shows a hidden hand rail and a visible commander.
2. For each hidden seat:
   - The commander is visually part of the hidden rail.
   - The commander continues the same card grouping as the hidden placeholders instead of appearing as an isolated upright card.
   - The commander stays inline with the row and is not centered over or separated from it.
   - There is no detached gap between the rail and the commander that makes them read as separate UI groups.
   - The commander remains identifiable via its distinct border.
   - The commander is not clipped at rest.
   - Hovering the commander does not introduce clipping.

## Failure Notes / Evidence To Capture
- Which hidden seat failed: top-left, top-right, or bottom-left.
- Whether the commander was detached from the rail, upright beside the rail, centered over the placeholders instead of inline, floating above or below the row, missing entirely, or clipped.
- Whether the problem appeared only on hover or also at rest.
- A full-board screenshot plus a close crop of the failing hidden seat.
- The viewport size and browser used for the check.
