import { renderMissionLog, updateHUD } from './hud.js';
import { ensureOffersForPlanet } from '../systems/contracts.js';
import { marketBuy } from '../systems/economy.js';
import { saveGame } from '../core/save.js';

let marketInit = false;
const costs = { fuel: 100, ammo: 50, repair: 200 };

function initMarket(ui, state) {
  if (marketInit) return;
  ui.dockUI.addEventListener('click', e => {
    const btn = e.target.closest('[data-buy]');
    if (!btn) return;
    const type = btn.dataset.buy;
    marketBuy(state, type);
    updateHUD(ui, state);
    updateBuyButtons(ui, state);
  });
  marketInit = true;
}

function updateBuyButtons(ui, state) {
  ui.dockUI.querySelectorAll('[data-buy]').forEach(btn => {
    const cost = costs[btn.dataset.buy] || 0;
    btn.disabled = state.credits < cost;
  });
}

export function renderDock(ui, state){
  if(!state.docked) return;
  const here = state.docked;
  ensureOffersForPlanet(state, here);
  ui.missionList.innerHTML = here.offers.map(o => `<div class="item">Deliver ${o.qty} to ${o.to} <span class="badge">$${o.reward}</span></div>`).join('');
}

export function dock(state, planet, ui){
  state.docked = planet;
  ui.dockUI.style.display = 'flex';
  renderDock(ui, state);
  initMarket(ui, state);
  updateBuyButtons(ui, state);
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
