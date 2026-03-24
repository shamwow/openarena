# Agents

## Build

```bash
npm install
npm run build        # TypeScript check + Vite production build
```

## Lint

```bash
npm run lint         # ESLint
```

## Dev

Start the dev server (long-running, not a build/test step): `npm run dev`

## QA

Manual QA test scripts live in `qa/`. Each file describes preconditions, steps, and expected results for a specific visual/functional check. Run these by hand against the running app.

- `qa/new-game-hand-rail.md` — Verify hand rail rendering for visible and hidden seats on game load.
- `qa/hidden-hand-commander-fanout.md` — Verify commander integration into the hidden-hand fanout.

## Project Structure

- `src/engine/` — Game engine: state, turns, zones, combat, mana, stack, events, continuous effects.
- `src/cards/` — Card definitions, builder, registry, and starter set.
- `src/ui/` — React components, hooks, and utilities for the game board UI.
- `qa/` — Manual QA test scripts.
