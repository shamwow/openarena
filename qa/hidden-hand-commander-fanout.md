# Hidden Hand Rail Regression

## Purpose
Verify that a freshly loaded game keeps each hidden opponent seat in a straight rail layout with hidden card backs and a readable commander at the rail edge.

## Preconditions
- The app is running and a new game has just loaded.
- The board is visible with one local visible seat and three hidden opponent seats.
- Each hidden opponent seat has a commander in the command zone.
- No gameplay actions have been taken beyond loading the game.

## Test Steps
1. Load the app and wait for the initial game board to finish rendering.
2. Focus on the three hidden opponent seats.
3. For each hidden seat, inspect the relationship between the hidden back tiles and the commander card.
4. Verify that the back tiles form a straight rail and do not arc, fan, or rotate.
5. Verify that the commander is attached to the same rail container rather than sitting in a detached block or overlay.
6. Verify that the commander occupies the edge of the rail and remains readable when the rail is crowded.
7. Hover the commander and several hidden back tiles to confirm that only the commander responds like a normal rail card.
8. Scroll the rail horizontally if needed and confirm that the commander stays visible and the hidden backs remain aligned.

## Expected Results
1. Each hidden opponent seat shows a straight hidden-hand rail and a visible commander.
2. For each hidden seat:
   - The commander is visually part of the rail layout.
   - The commander does not appear as an isolated upright card beside the rail.
   - The commander does not sit centered over a fan or arc of hidden cards.
   - The hidden back tiles stay flat, aligned, and unrotated.
   - The commander remains readable at the rail edge, with no detached overlay block.
   - The commander remains identifiable via its distinct border.
   - The commander is not clipped at rest.
   - Hovering the commander does not introduce clipping.
   - Hovering hidden back tiles does not reveal preview chrome, drag handles, or focus states.
   - There is no clipping while hovering or horizontally scrolling the rail.

## Failure Notes / Evidence To Capture
- Which hidden seat failed: top-left, top-right, or bottom-left.
- Whether the commander was detached from the rail, centered over the back tiles, buried behind the backs, missing entirely, or clipped.
- Whether hidden back tiles showed preview chrome, drag affordances, or focus states.
- Whether the problem appeared only on hover or also at rest.
- A full-board screenshot plus a close crop of the failing hidden seat.
- The viewport size and browser used for the check.
