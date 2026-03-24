# OpenArena

A browser-based multiplayer card game built with React, TypeScript, and Vite. The game features a full rules engine supporting zones, combat, mana, stack resolution, continuous effects, and turn management.

## Getting Started

```bash
npm install
npm run dev          # Start dev server
```

## Scripts

| Command            | Description                          |
|--------------------|--------------------------------------|
| `npm run dev`      | Vite dev server with HMR             |
| `npm run build`    | TypeScript check + Vite build        |
| `npm run lint`     | ESLint                               |
| `npm run preview`  | Preview production build             |

## Project Structure

```
src/
  engine/     Game engine — state, turns, zones, combat, mana, stack, events
  cards/      Card definitions, builder, registry, starter set
  ui/         React components, hooks, and utilities
qa/           Manual QA test scripts
```

## QA

Manual QA tests are in `qa/`. See [AGENTS.md](AGENTS.md) for details.
