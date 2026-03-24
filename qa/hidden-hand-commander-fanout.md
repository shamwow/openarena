# Hidden Hand Commander Fanout

## Purpose
Verify that, in a freshly loaded game, each hidden opponent seat renders its commander as part of the hidden-hand fanout rather than as a separate card placed beside the fan.

## Preconditions
- The app is running and a new game has just loaded.
- The board is visible with one local visible seat and three hidden opponent seats.
- Each hidden opponent seat has a commander in the command zone.
- No gameplay actions have been taken beyond loading the game.

## Test Steps
1. Load the app and wait for the initial game board to finish rendering.
2. Focus only on the three hidden opponent seats.
3. For each hidden seat, inspect the relationship between the hidden-hand fan and the commander card.
4. Check whether the commander visually continues the fanout of hidden cards rather than standing alone beside it.
5. Verify that the commander occupies the outer visible edge of the fanout rather than sitting centered over the middle of the fan.
6. Verify that most of the commander sits outside the spread of hidden card backs, with only a trailing slice overlapping the fan.
7. Hover the commander on each hidden seat and verify that the hovered state remains fully visible.
8. Compare the commander against the local visible-seat commander only for border treatment, not for layout.

## Expected Results
1. Each hidden opponent seat shows a hidden-hand fan and a visible commander.
2. For each hidden seat:
   - The commander is visually part of the hidden-hand fanout.
   - The commander continues the same card grouping as the hidden hand instead of appearing as an isolated upright card.
   - The commander is positioned as the outer visible card of the fan.
   - The commander follows the fan arc and is not centered over the middle of the hidden cards.
   - Most of the commander body sits outside the hidden fan, with only a narrow trailing overlap into the spread.
   - The commander does not cover the middle of the fan or read like it has been placed on top of the fan.
   - There is no detached gap between the fan and the commander that makes them read as separate UI groups.
   - The commander remains identifiable via its distinct border.
   - The commander is not clipped at rest.
   - Hovering the commander does not introduce clipping.

## Failure Notes / Evidence To Capture
- Which hidden seat failed: top-left, top-right, or bottom-left.
- Whether the commander was detached from the fan, upright beside the fan, centered over the fan instead of on the outer edge, too far inward over the fan, missing entirely, or clipped.
- Whether the problem appeared only on hover or also at rest.
- A full-board screenshot plus a close crop of the failing hidden seat.
- The viewport size and browser used for the check.
