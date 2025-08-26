import { renderMissionLog } from './hud.js';
import { ensureOffersForPlanet } from '../systems/contracts.js';
import { marketBuy } from '../systems/economy.js';
import { saveGame } from '../core/save.js';

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
