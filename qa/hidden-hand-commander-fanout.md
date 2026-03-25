# Hidden Hand Rail

## Purpose
Verify that each hidden opponent seat now renders a single horizontal hand rail with inline commanders and hidden-hand card backs, with no remaining fan layout.

## Preconditions
- The app is running and a new game has just loaded.
- The board is visible with one local visible seat and three hidden opponent seats.
- Each hidden opponent seat has a commander in the command zone.
- No gameplay actions have been taken beyond loading the game.

## Test Steps
1. Load the app and wait for the initial game board to finish rendering.
2. Focus only on the three hidden opponent seats: top-left, top-right, and bottom-left.
3. For each hidden seat, inspect the entire rail from left to right.
4. Confirm that no fan, arc, or detached commander block is present.
5. Verify that the commander is integrated directly into the rail with the rest of the seat's rail items.
6. Verify that the hidden hand is represented by a sequence of card backs in the rail, one per hidden hand card.
7. Move the pointer across hidden placeholders and confirm they do not preview, drag, focus, or reveal card information.
8. Hover any visible rail cards on hidden seats, such as the commander or visible playable exile/graveyard cards, and verify that hover lift remains fully visible.
9. If a hidden seat has a long rail, scroll horizontally and confirm the full rail remains accessible without collisions against zone piles, viewport edges, or the phase bar.

## Expected Results
1. Each hidden opponent seat shows a horizontal hand rail.
2. For each hidden seat:
   - No fan layout is present.
   - No detached commander block is present.
   - The commander is visible inline in the same rail and remains identifiable via its distinct border treatment.
   - The hidden hand is shown only as rail card backs.
   - Hidden placeholders do not reveal names, art, previews, actions, dragging, or focus affordances.
   - Hidden placeholders do not rotate, arc, or hover-lift.
   - Visible rail cards still hover cleanly without clipping.
   - The rail remains horizontally scrollable when it grows long.
3. All three hidden seat positions pass the same expectations despite their different board placement.

## Failure Notes / Evidence To Capture
- Which hidden seat failed: top-left, top-right, or bottom-left.
- Whether a fan still appeared, the commander was detached, the hidden hand count looked wrong, visible rail cards clipped, hidden placeholders acted interactive, or long rails were not scrollable.
- Whether the problem appeared only on hover or also at rest.
- A full-board screenshot plus a close crop of the failing hidden seat.
- The viewport size and browser used for the check.
