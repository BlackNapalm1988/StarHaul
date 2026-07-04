# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

StarHaul is a browser game (2D top-down space cargo hauler) built with vanilla JS ES modules — no framework, no bundler, no build step for development. It runs directly in the browser via `<script type="module">`.

## Commands

- `npm start` — runs `scripts/playtest-server.js`, a zero-dependency Node HTTP server that serves the static game at `http://localhost:8000/` and accepts `POST /playtest-report` (appends JSON Lines to `reports/playtest-reports.jsonl`). ES modules require a real server — do not open `index.html` via `file://` (breaks in Safari and generally).
- `npm test` — runs the full suite with Node's built-in test runner (`node --test`), discovering `tests/**/*.test.js`.
- Run a single test file: `node --test tests/systems/contracts.test.js`
- `npm run build` — runs `scripts/build-static.js`, which copies only deployable runtime files into `dist/` (see `runtimeEntries` in that script for the exact allowlist). It skips `.DS_Store`, `*.test.js`, and `*.pxd` editor files. `dist/` is generated and gitignored — never hand-edit it.
- CI (`.github/workflows/ci.yml`) runs `npm ci` + `npm test` on PRs/pushes to `main`.

## Architecture

**Module layout** (see `docs/structure.md` for the authoritative map):
- `main.js` — app entry point / controller. Wires up all DOM UI elements, the start/pause/game-over/settings screens, input callbacks, and the debug menu. Owns the single mutable `state` object and the render/update loop callbacks passed to `core/loop.js`.
- `core/` — engine plumbing: `config.js` (all tunable constants — `CFG`, `WORLD`, `GRAVITY`, `SPACING`), `loop.js` (fixed-timestep game loop via `requestAnimationFrame`, decoupled update/draw), `input.js`, `assets.js` (image/spritesheet loading and directional sprite-frame lookup), `save.js` (localStorage save/load), `pool.js` (object pooling for bullets/particles).
- `entities/` — factory functions for stateful actors: `player.js` (`newShip`), `npc.js` (`makePirate`, `makeHunter`, `makePatrol`, `makePirateBase`).
- `systems/` — gameplay logic that operates on `state`: `contracts.js` (mission/offer generation, accept/deliver/expire), `economy.js`, `rescue.js` (out-of-fuel tow/rescue flow).
- `world/` — `gen.js` (procedural galaxy generation — seeded PRNG via `seedRandom`, planet naming, spawning) and `world.js` (the big one: per-tick physics/AI/collision update plus canvas drawing — gravity wells, pirates, asteroids, VFX particles).
- `ui/` — DOM/canvas UI modules: `hud.js`, `dock.js` (docked-at-planet market/mission UI), `map.js` (mini-map + full overlay), `debug.js` (playtest debug menu), `music.js`, `report.js` (in-browser playtest bug/feature reporter), `toast.js`.
- `bg.js` — starfield background rendering, loaded separately from `main.js`.

**Central state object**: a single plain object (built by `world/gen.js`'s `reset()`) threaded through nearly every function — `ship`, `planets`, `bullets`, `particles`, `pirates`, `asteroids`, `traders`, `camera`, `credits`, `fuel`, `cargo`, `missions`, `reputation`, `docked`, `home`, `gameOver`/`gameOverCause`, plus debug flags (`godMode`, `invincible`, `debugGravity`, etc.). Most `systems/`/`world/` functions take `state` as their first argument and mutate it directly rather than returning new state.

**Config-driven tuning**: gameplay numbers (ship physics, spawn rates, combat, gravity) live in `core/config.js` as `CFG` and `GRAVITY`, not scattered through logic. Both are validated at module-load time by an IIFE that throws if any expected field isn't a number — when adding a new tunable, add both the field and its `num(...)` assertion.

**Game loop**: `core/loop.js` runs a fixed 60Hz update step with an accumulator (decoupled from draw calls), started via `start(update, draw)` from `main.js` and controlled with `pause()`/`resume()`.

**Procedural generation is seeded**: `world/gen.js` uses a local LCG (`seedRandom`/`rand`) rather than `Math.random` so a given seed reproduces the same galaxy; saved games persist the seed (`core/save.js`) and replay world state on top of it.

**Testing conventions**: tests are plain `node:test` + `node:assert/strict`, live under `tests/<mirror-of-source-folder>/`, and mostly construct a minimal fake `state` object by hand (see any test in `tests/systems/` or `tests/world/`) rather than using the real `reset()` — when adding tests, follow that pattern of building the smallest state shape the function under test needs.

## Deployment

Static hosting on Cloudflare Pages: build command `npm run build`, output dir `dist`, config in `wrangler.toml`. Cache/security headers are defined in `_headers` at the repo root (also copied into `dist/`). `main` branch deploys to Production; other branches get Preview deployments. See the README's "Cloudflare Pages Deployment" section for the release smoke-test checklist and rollback runbook before treating a deploy-related change as done.
