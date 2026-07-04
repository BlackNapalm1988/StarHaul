# StarHaul

StarHaul is a lightweight browser game where you pilot a small cargo ship across a procedurally generated star system. Deliver goods, upgrade your ship and avoid cosmic hazards.

## Running the game

StarHaul uses browser ES modules, so Safari should load it from a local web server instead of opening `index.html` directly with a `file://` URL.

1. In this folder, run `npm start`.
2. Open `http://localhost:8000/` in Safari or another modern browser.

The game runs entirely client-side, no build step required.

## Testing and build

- `npm test` runs the Node test suite from `tests/`.
- `npm run build` refreshes `dist/` for static hosting.
- `dist/`, `node_modules/`, and OS cache files are generated locally and should not be edited or committed.

## Playtest reports

Run `npm start` and open `http://localhost:8000/`. During playtesting, press `Cmd+\`` on macOS or `Ctrl+\`` on other keyboards to open the report panel. Reports submitted through the local server append to `reports/playtest-reports.jsonl`.

## Project layout

See [docs/structure.md](docs/structure.md) for the current folder map and cleanup rules.

## Controls

- **←/→ or A/D** – Rotate ship
- **↑ or W** – Thrust
- **Space** – Fire weapon
- **E** – Dock/Undock
- **Shift** – Hyperspace jump
- **P** – Pause

## Debug Commands

Press `` ` `` during playtesting to open the debug menu. The menu includes toggles for:

- Invincible
- Gravity Arrows
- God Mode
- Entity Naming
- Bounding Boxes
- FPS

When Invincible or God Mode is enabled, these commands are available:

- `Ctrl+1` – Refill fuel
- `Ctrl+2` – Add cargo
- `Ctrl+3` – Spawn a nearby hazard

## Credits

Created by the original StarHaul developers. This repository contains modifications for readability and documentation.

## Required DOM Elements

The in-game map UI requires the following elements to be present in `index.html`:

- `#mini`: canvas for the mini map (e.g., within the radar UI)
- `#bigmap`: canvas for the full-screen map inside the overlay
- `#mapOverlay`: overlay container that shows the full-screen map

Optional:

- `#mapCloseBtn`: button to close the full-screen map overlay

If any required element is missing, the map initialization logs a console warning and skips setup.

## Cloudflare Pages Deployment

StarHaul is deployable as a static site on Cloudflare Pages. The build step copies only the runtime assets into `dist` so tests, dependencies, and archival source files are not published.

### 1) Create the Pages project

1. Push this repository to GitHub.
2. In Cloudflare, create a new **Pages** project and connect the repo.
3. Use these build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Branch mapping:
   - `main` -> Production
   - all other branches -> Preview deployments

This repo includes [`wrangler.toml`](wrangler.toml) with:
- `name = "starhaul"`
- `pages_build_output_dir = "dist"`
- pinned `compatibility_date`

### 2) Continuous integration gate

GitHub Actions CI is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and runs:
- `npm ci`
- `npm test`

Recommended policy: require CI to pass before merging to `main`.

### 3) Cache + security headers

The root [`_headers`](_headers) file configures:
- short revalidation cache for `index.html`, JS modules, and CSS
- one-day cache for browser-loaded assets
- common security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`)

### 4) Release smoke test checklist

After each preview or production deploy:
- Load game and verify start screen renders
- Start new game and verify controls (`W/A/D`, `Space`, `E`, `F`, `Shift`, `P`)
- Open dock UI and confirm market/contract interactions
- Open/close full map overlay
- Confirm save/load path still works in browser local storage

### 5) Rollback runbook

If production breaks:
1. Open Cloudflare Pages project -> **Deployments**.
2. Select the last known good production deployment.
3. Redeploy/promote it.
4. Re-run smoke tests above.
