# StarHaul

StarHaul is a lightweight browser game where you pilot a small cargo ship across a procedurally generated star system. Deliver goods, upgrade your ship and avoid cosmic hazards.

## Running the game

1. Open `index.html` in a modern web browser.
2. The game runs entirely client-side, no build step required.

## Controls

- **←/→ or A/D** – Rotate ship
- **↑ or W** – Thrust
- **Space** – Fire weapon
- **E** – Dock/Undock
- **F** – Warp gate
- **Shift** – Hyperspace jump
- **P** – Pause

## Debug Commands

Enable **Debug mode** from the settings screen to access these commands:

- `~` – Toggle debug overlay (FPS, entity counts, state flags)
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

StarHaul is deployable as a static site on Cloudflare Pages with no build step.

### 1) Create the Pages project

1. Push this repository to GitHub.
2. In Cloudflare, create a new **Pages** project and connect the repo.
3. Use these build settings:
   - Build command: *(leave empty)*
   - Build output directory: `.`
4. Branch mapping:
   - `main` -> Production
   - all other branches -> Preview deployments

This repo includes [`wrangler.toml`](wrangler.toml) with:
- `name = "starhaul"`
- `pages_build_output_dir = "."`
- pinned `compatibility_date`

### 2) Continuous integration gate

GitHub Actions CI is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and runs:
- `npm ci`
- `npm test`

Recommended policy: require CI to pass before merging to `main`.

### 3) Cache + security headers

The root [`_headers`](_headers) file configures:
- short revalidation cache for `index.html`
- long immutable cache for JS/CSS/images
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
