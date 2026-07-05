# StarHaul Roadmap

## Bug Fixes

- [x] Remove the duplicate `Press E to Dock` overlay that covered planet names near docking range.
- [x] Add an out-of-fuel recovery flow.
- [x] Tow the player back to their home planet when fuel is empty and they have credits.
- [x] Make towing cost scale by distance from the ship to the home planet.
- [x] Trigger Game Over when fuel is empty, the player is not dockable, and the player has no credits.
- [x] Tune pirate movement so pirates strafe/orbit near the player instead of intentionally ramming straight into the ship.
- [ ] Manual playtest: verify the out-of-fuel tow and no-money Game Over flows feel good in the browser.
- [ ] Manual playtest: verify pirate standoff movement feels smart without becoming too easy.

## UI Improvements

- [x] Move debug-only settings into the refreshed debug menu.
- [x] Restyle the Pause screen to match the gritty green/black serial-terminal theme used by other menus.
- [x] Add a placeholder image to the Pause screen.
- [x] Add Pause menu options for `Settings`, `Save`, `Quit`, and `Restart`.
- [x] Restyle the Game Over screen to match the gritty green/black serial-terminal theme.
- [x] Add a placeholder image to the Game Over screen.
- [x] Add Game Over messages that reflect the cause of the end-game event.
- [ ] Manual UI pass: verify Pause and Game Over layout on desktop and mobile viewports.
- [ ] Manual copy pass: adjust final Game Over wording after seeing the messages in context.

## Cleanup / Follow-Up

- [x] Move this checklist into `docs/` so the repository root stays focused on runtime entry points.
- [x] Prevent `npm test` from discovering copied tests under `dist/` after running `npm run build`.
- [x] Add local playtest reporting with Bug and Feature Request capture.
