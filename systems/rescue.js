import { CFG, WORLD } from '../core/config.js';

export function calculateTowCost(distance, rescue = CFG.rescue) {
  const safeDistance = Math.max(0, Number.isFinite(distance) ? distance : 0);
  const base = rescue?.towBase ?? 50;
  const per1000 = rescue?.towPer1000 ?? 25;
  return Math.max(0, Math.ceil(base + (safeDistance / 1000) * per1000));
}

export function resolveOutOfFuel(state, dockablePlanet = null) {
  if (!state || !state.ship || state.gameOver) return { status: 'ignored' };
  if (state.docked) return { status: 'docked' };
  if ((state.fuel ?? 0) > 0) {
    state.fuelRescueHandled = false;
    return { status: 'flying' };
  }
  if (dockablePlanet) return { status: 'dockable', planet: dockablePlanet };
  if (state.fuelRescueHandled) return { status: 'handled' };

  const home = state.home;
  if ((state.credits || 0) > 0 && home) {
    const s = state.ship;
    const distance = Math.hypot((s.x || 0) - (home.x || 0), (s.y || 0) - (home.y || 0));
    const fullCost = calculateTowCost(distance);
    const cost = Math.min(Math.floor(state.credits || 0), fullCost);
    state.credits = Math.max(0, (state.credits || 0) - cost);
    state.lastTowCost = cost;
    state.fuel = CFG.rescue?.emergencyFuel ?? 25;
    state.docked = home;
    state.fuelRescueHandled = true;
    s.x = Math.max(s.r || 0, Math.min(WORLD.w - (s.r || 0), home.x || 0));
    s.y = Math.max(s.r || 0, Math.min(WORLD.h - (s.r || 0), home.y || 0));
    s.vx = 0;
    s.vy = 0;
    s.thrust = false;
    s.brake = false;
    s.anchored = false;
    s.centered = false;
    s.centerX = s.x;
    s.centerY = s.y;
    if (state.camera) {
      state.camera.x = Math.max(0, Math.min(WORLD.w - state.camera.w, s.x - state.camera.w / 2));
      state.camera.y = Math.max(0, Math.min(WORLD.h - state.camera.h, s.y - state.camera.h / 2));
    }
    return { status: 'towed', planet: home, cost, fullCost, distance };
  }

  state.fuelRescueHandled = true;
  state.gameOver = true;
  state.gameOverCause = 'fuel';
  state.ship.thrust = false;
  state.ship.brake = false;
  return { status: 'gameOver', cause: 'fuel' };
}
