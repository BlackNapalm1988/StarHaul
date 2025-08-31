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
