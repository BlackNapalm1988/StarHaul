import { renderMissionLog, updateHUD } from './hud.js';
import { CFG } from '../core/config.js';
import { ensureOffersForPlanet, acceptOffer, deliverMissionsAt } from '../systems/contracts.js';
import { marketBuy, setHome, upgradeCost, buyUpgrade, MAX_LEVEL } from '../systems/economy.js';
import { saveGame } from '../core/save.js';

let marketInit = false;
const costs = { fuel: 100, ammo: 50, repair: 200 };

function initMarket(ui, state) {
  if (marketInit) return;
  ui.dockUI.addEventListener('click', e => {
    const buyBtn = e.target.closest('[data-buy]');
    if (buyBtn) {
      const type = buyBtn.dataset.buy;
      marketBuy(state, type);
      updateHUD(ui, state);
      updateBuyButtons(ui, state);
      return;
    }
    const upBtn = e.target.closest('[data-upgrade]');
    if (upBtn) {
      const key = upBtn.dataset.upgrade;
      buyUpgrade(state, key);
      renderDock(ui, state);
      updateBuyButtons(ui, state);
      updateHUD(ui, state);
      return;
    }
    const acceptBtn = e.target.closest('[data-accept]');
    if (acceptBtn) {
      const id = acceptBtn.dataset.accept;
      if (acceptOffer(state, state.docked, id)) {
        renderDock(ui, state);
        updateHUD(ui, state);
      }
      return;
    }
    if (e.target && e.target.id === 'undockBtn') {
      undock(state, ui);
      return;
    }
    if (e.target && e.target.id === 'setHomeBtn') {
      if (state.docked) setHome(state, state.docked);
      return;
    }
  });
  marketInit = true;
}

function updateBuyButtons(ui, state) {
  ui.dockUI.querySelectorAll('[data-buy]').forEach(btn => {
    const kind = btn.dataset.buy;
    let cost = costs[kind] || 0;
    if (kind === 'repair') {
      const per = CFG.economy.repairPerHull; // from config
      const missing = Math.max(0, state.ship.hullMax - state.ship.hull);
      const amount = Math.min(10, missing);
      cost = amount * per;
      btn.textContent = amount > 0 ? `Repair ${amount} ($${cost})` : 'Repair 0';
      btn.disabled = (amount <= 0) || state.credits < cost;
      return;
    }
    btn.disabled = state.credits < cost;
  });
  if (ui.upgrades) {
    ui.upgrades.querySelectorAll('[data-upgrade]').forEach(btn => {
      const key = btn.dataset.upgrade;
      const lvl = state.ship[key] || 0;
      const cost = upgradeCost(key, Math.max(1, lvl));
      btn.disabled = (lvl >= MAX_LEVEL) || (state.credits < cost);
    });
  }
}

export function renderDock(ui, state){
  if(!state.docked) return;
  const here = state.docked;
  // Update headers with planet name if available
  const market = document.getElementById('market');
  if (market) {
    const h = market.querySelector('h3');
    if (h) h.textContent = `Station Market — ${here.name || 'Planet'}`;
  }
  const missions = document.getElementById('missions');
  if (missions) {
    const h = missions.querySelector('h3');
    if (h) h.textContent = `Contracts — ${here.name || 'Planet'}`;
  }
  ensureOffersForPlanet(state, here);
  ui.missionList.innerHTML = here.offers.map(o => {
    const capFull = (state.cargo + o.qty > state.cargoMax);
    const repLock = ((state.reputation || 0) < (o.reqRep || 0));
    const disabled = (capFull || repLock) ? 'disabled' : '';
    const badges = [
      `<span class="badge">$${o.reward}</span>`,
      o.illegal ? `<span class="badge" style="background:rgba(255,0,0,.15);color:#f99">Illegal</span>` : '',
      repLock ? `<span class="badge" style="background:rgba(255,107,107,.15);color:#ffb3b3">Rep ${o.reqRep} req.</span>` : ''
    ].filter(Boolean).join(' ');
    return `
      <div class="item" data-offer="${o.id}">
        <span>Deliver ${o.qty} to ${o.to}</span>
        <span>
          ${badges}
          <button class="btn" data-accept="${o.id}" ${disabled}>Accept</button>
        </span>
      </div>
    `;
  }).join('');
  // upgrades list
  if (ui.upgrades) {
    const keys = [
      { key:'engine', label:'Engine' },
      { key:'gun', label:'Gun' },
      { key:'hold', label:'Cargo Hold' },
      { key:'shield', label:'Shield' },
      { key:'radar', label:'Radar' },
    ];
    ui.upgrades.innerHTML = keys.map(k => {
      const lvl = state.ship[k.key] || 0;
      const cost = (lvl >= MAX_LEVEL) ? '-' : upgradeCost(k.key, Math.max(1, lvl));
      const disabled = (lvl >= MAX_LEVEL) ? 'disabled' : '';
      return `<div class="item"><span>${k.label} Lv ${lvl}/${MAX_LEVEL}</span><span><span class="badge">$${cost}</span> <button class="btn" data-upgrade="${k.key}" ${disabled}>Buy</button></span></div>`;
    }).join('');
  }
}

export function dock(state, planet, ui){
  state.docked = planet;
  ui.dockUI.style.display = 'flex';
  // complete any deliveries for this planet
  deliverMissionsAt(state, planet);
  renderDock(ui, state);
  initMarket(ui, state);
  updateBuyButtons(ui, state);
  updateHUD(ui, state);
  saveGame(state);
}

export function undock(state, ui){
  state.docked = null;
  ui.dockUI.style.display = 'none';
  // Anchor the ship at its current position until thrust is applied
  if (state && state.ship) {
    state.ship.anchored = true;
    state.ship.vx = 0; state.ship.vy = 0;
  }
}

export function dockToggle(state, ui, planet){
  if(state.docked) undock(state, ui);
  else if(planet) dock(state, planet, ui);
}

export { marketBuy };
