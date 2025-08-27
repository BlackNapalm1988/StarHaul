import { updateHUD } from './hud.js';
import { ensureOffersForPlanet } from '../systems/contracts.js';
import { marketBuy, buyUpgrade, upgradeCost } from '../systems/economy.js';
import { saveGame } from '../core/save.js';

export function renderUpgrades(ui, state){
  const keys = ['engine','gun','hold','shield','radar'];
  const ship = state.ship;
  const max = 4;
  ui.upgrades.innerHTML = keys.map(k => {
    const lvl = ship[k] || 0;
    const cost = lvl >= max ? 'MAX' : `$${upgradeCost(k, lvl || 1)}`;
    const label = k.charAt(0).toUpperCase() + k.slice(1);
    return `<div class="item" data-upgrade="${k}">${label} Lv ${lvl} <span class="badge">${cost}</span></div>`;
  }).join('');
  ui.upgrades.querySelectorAll('[data-upgrade]').forEach(el => {
    const key = el.dataset.upgrade;
    el.addEventListener('click', () => {
      buyUpgrade(state, key);
      updateHUD(ui, state);
      renderUpgrades(ui, state);
    });
  });
}

export function renderDock(ui, state){
  if(!state.docked) return;
  const here = state.docked;
  ensureOffersForPlanet(state, here);
  ui.missionList.innerHTML = here.offers.map(o => `<div class="item">Deliver ${o.qty} to ${o.to} <span class="badge">$${o.reward}</span></div>`).join('');
  renderUpgrades(ui, state);
}

export function dock(state, planet, ui){
  state.docked = planet;
  ui.dockUI.style.display = 'flex';
  renderDock(ui, state);
  saveGame(state);
}

export function undock(state, ui){
  state.docked = null;
  ui.dockUI.style.display = 'none';
}

export function dockToggle(state, ui, planet){
  if(state.docked) undock(state, ui);
  else if(planet) dock(state, planet, ui);
}

export { marketBuy };
