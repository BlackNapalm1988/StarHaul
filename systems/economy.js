const MAX_LEVEL = 4;

import { CFG } from '../core/config.js';

export function marketBuy(state, what){
  if(what === 'fuel' && state.credits >= 100){
    state.credits -= 100;
    state.fuel += 50;
  }
  if(what === 'ammo' && state.credits >= 50){
    state.credits -= 50;
    state.ammo += 10;
  }
  if(what === 'repair' && state.credits >= 200){
    if (!state.ship) return;
    const per = CFG.economy.repairPerHull;
    const missing = Math.max(0, state.ship.hullMax - state.ship.hull);
    if (missing <= 0) return;
    const amount = Math.min(10, missing);
    const cost = amount * per;
    if (state.credits < cost) return;
    state.credits -= cost;
    state.ship.hull = Math.min(state.ship.hullMax, state.ship.hull + amount);
  }
}

export function upgradeCost(key, level){
  const base = {engine:200, gun:180, hold:150, shield:220, radar:180};
  return Math.floor(base[key] * Math.pow(1.5, level-1));
}

export function buyUpgrade(state, key){
  const s = state.ship;
  const cur = s[key] || 0;
  const lvl = Math.max(1, cur); // treat 0 as level 1 for cost scaling
  if (cur >= MAX_LEVEL) return; // already at cap
  const cost = upgradeCost(key, lvl);
  if(state.credits < cost) return;
  state.credits -= cost;
  s[key] = cur + 1;
  // Immediate effects
  if (key === 'hold') {
    const holdLvl = s.hold || 0;
    state.cargoMax = (state.cargoMax ?? 50);
    // base from CFG.economy.cargoMax is set at reset; add +20 per hold level
    const baseMax = state._baseCargoMax || state.cargoMax;
    state._baseCargoMax = baseMax;
    state.cargoMax = baseMax + (holdLvl * 20);
  } else if (key === 'shield') {
    const shieldLvl = s.shield || 0;
    // increase hullMax by +20 per shield level
    const baseHull = state._baseHullMax || s.hullMax;
    state._baseHullMax = baseHull;
    s.hullMax = baseHull + (shieldLvl * 20);
    s.hull = Math.min(s.hullMax, s.hull + 20);
  }
}

export { MAX_LEVEL };

export function setHome(state, planet){
  state.home = planet;
}
