export function marketBuy(state, what){
  if(what === 'fuel' && state.credits >= 100){
    state.credits -= 100;
    state.fuel += 50;
  }
  if(what === 'ammo' && state.credits >= 50){
    state.credits -= 50;
    state.ammo += 10;
  }
}

export function upgradeCost(key, level){
  const base = {engine:200, gun:180, hold:150, shield:220, radar:180};
  return Math.floor(base[key] * Math.pow(1.5, level-1));
}

export function buyUpgrade(state, key){
  const s = state.ship;
  const lvl = s[key] || 0;
  const max = 4;
  if(lvl >= max) return false;
  const cost = upgradeCost(key, lvl || 1);
  if(state.credits < cost) return false;
  state.credits -= cost;
  s[key] = lvl + 1;
  return true;
}

export function setHome(state, planet){
  state.home = planet;
}
