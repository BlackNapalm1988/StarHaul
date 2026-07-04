import { updateHUD } from './hud.js';
import { CFG } from '../core/config.js';
import {
  ensureOffersForPlanet,
  acceptOffer,
  deliverMissionsAt,
  formatContractDetails,
  formatContractTitle,
  visibleOffersForState
} from '../systems/contracts.js';
import { marketBuy, setHome, upgradeCost, buyUpgrade, MAX_LEVEL } from '../systems/economy.js';
import { saveGame } from '../core/save.js';

let marketInit = false;
let activeState = null;
const costs = { fuel: 100, ammo: 50, repair: 200 };
const dockingScreens = {
  gas: 'gas.png',
  ice: 'ice.png',
  industrial: 'industrial.png',
  lava: 'lava.png',
  ocean: 'water.png',
  rocky: 'rocky.png',
  water: 'water.png'
};

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

export function getDockingScreenForPlanet(planet) {
  const type = String(planet?.type || 'rocky').toLowerCase();
  const file = dockingScreens[type] || dockingScreens.rocky;
  return `assets/backgrounds/planet_docking_screens/${file}`;
}

const marketProfiles = {
  gas: { symbol: 'VOL', commodity: 'volatiles', base: 42, bias: -8, note: 'storm harvesters are dumping cheap volatiles into cold storage' },
  ice: { symbol: 'CRYO', commodity: 'cryo-water', base: 26, bias: -4, note: 'melt rights are being contested by refinery unions' },
  industrial: { symbol: 'PART', commodity: 'machine parts', base: 64, bias: 8, note: 'dockyards are buying parts above posted ration limits' },
  lava: { symbol: 'CER', commodity: 'ceramic plate', base: 58, bias: 10, note: 'heat shielding demand is climbing after flare damage reports' },
  ocean: { symbol: 'AQUA', commodity: 'water culture', base: 34, bias: -2, note: 'algae contracts are moving under sealed civic bid' },
  rocky: { symbol: 'ORE', commodity: 'survey ore', base: 38, bias: 2, note: 'claim jumpers are bidding up low-grade ore futures' },
  water: { symbol: 'AQUA', commodity: 'water culture', base: 34, bias: -2, note: 'algae contracts are moving under sealed civic bid' }
};

const electionLines = [
  'port authority bloc leads the ration council by two precincts',
  'security guild demands emergency tariff powers before sundown',
  'dockworkers union rejects another automated customs audit',
  'church-bank candidates promise fuel relief and stricter exit visas'
];

function hashText(value){
  let h = 2166136261;
  const text = String(value || '');
  for(let i = 0; i < text.length; i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function planetLabel(planet){
  return planet?.name || (planet?.id == null ? 'UNKNOWN' : `PLANET-${planet.id}`);
}

function planetProfile(planet){
  const type = String(planet?.type || 'rocky').toLowerCase();
  return marketProfiles[type] || marketProfiles.rocky;
}

export function quoteForPlanet(planet, state = {}){
  const profile = planetProfile(planet);
  const seed = hashText(`${planetLabel(planet)}:${planet?.type || 'rocky'}:${planet?.texSeed || planet?.id || 0}`);
  const rep = state?.reputation || 0;
  const drift = ((seed % 29) - 14) + Math.floor(rep * 0.7);
  const price = Math.max(6, profile.base + profile.bias + drift);
  const delta = ((seed >>> 8) % 13) - 6 + Math.min(4, Math.floor(rep / 2));
  return {
    planet: planetLabel(planet),
    symbol: profile.symbol,
    commodity: profile.commodity,
    price,
    delta,
    trend: delta >= 0 ? 'UP' : 'DN',
    note: profile.note
  };
}

function nearestPlanetTo(state, entity){
  if(!entity || !Array.isArray(state?.planets) || !state.planets.length) return null;
  let best = null;
  let bestD = Infinity;
  for(const p of state.planets){
    const dx = (p.x || 0) - (entity.x || 0);
    const dy = (p.y || 0) - (entity.y || 0);
    const d = dx * dx + dy * dy;
    if(d < bestD){
      best = p;
      bestD = d;
    }
  }
  return best;
}

function bestVisibleOffer(state, planet){
  const offers = visibleOffersForState(state, planet?.offers || []);
  return offers.reduce((best, offer) => !best || (offer.reward || 0) > (best.reward || 0) ? offer : best, null);
}

export function buildDockIntel(state = {}, planet = state?.docked){
  const here = planet || {};
  const planets = Array.isArray(state.planets) ? state.planets : [];
  const quotes = (planets.length ? planets : [here]).filter(Boolean).map(p => quoteForPlanet(p, state));
  const localQuote = quoteForPlanet(here, state);
  const quoteLeader = quotes.reduce((best, quote) => !best || Math.abs(quote.delta) > Math.abs(best.delta) ? quote : best, null) || localQuote;
  const electionPlanet = planets.length ? planets[hashText(planetLabel(here)) % planets.length] : here;
  const pirate = Array.isArray(state.pirates) && state.pirates.length ? state.pirates[hashText(`${planetLabel(here)}:pirate`) % state.pirates.length] : null;
  const piratePlanet = nearestPlanetTo(state, pirate) || here;
  const offer = bestVisibleOffer(state, here);
  const offerDest = offer ? planets.find(p => p.id === offer.to) : null;
  const electionLine = electionLines[hashText(`${planetLabel(electionPlanet)}:vote`) % electionLines.length];
  const pirateCount = Array.isArray(state.pirates) ? state.pirates.length : 0;
  const traffic = `${pirateCount} hostile tags / ${state.missions?.length || 0} active contracts / rep ${state.reputation || 0}`;

  const news = [
    `LOCAL ${planetLabel(here)}: ${localQuote.note}`,
    `ELECTION ${planetLabel(electionPlanet)}: ${electionLine}`,
    pirateCount
      ? `PIRATE WATCH: ${pirateCount} raider signatures last plotted near ${planetLabel(piratePlanet)}`
      : `PIRATE WATCH: no confirmed raider signatures, which means the expensive scanners are either working or lying`,
    `PRICEWIRE: ${quoteLeader.planet} ${quoteLeader.symbol} ${quoteLeader.trend} ${Math.abs(quoteLeader.delta)} at ${quoteLeader.price} credits`,
    offer && offerDest
      ? `ROUTE HEAT: ${offer.cargoName || 'cargo'} demand points toward ${planetLabel(offerDest)} for ${offer.reward} credits`
      : `ROUTE HEAT: dispatch clerks report thin boards; reputation gates remain locked`
  ];

  const market = quotes
    .slice()
    .sort((a, b) => a.planet.localeCompare(b.planet))
    .map(q => `${q.planet} ${q.symbol} ${q.price} ${q.trend}${Math.abs(q.delta)}`);

  return {
    status: `LINK ${planetLabel(here)} // ${String(here.type || 'rocky').toUpperCase()} DOCK // CREDIT ${Math.floor(state.credits || 0)}`,
    local: `${localQuote.symbol} ${localQuote.price} ${localQuote.trend}${Math.abs(localQuote.delta)} // ${localQuote.commodity}`,
    traffic,
    news,
    market
  };
}

function setDockedMode(on){
  if(typeof document === 'undefined') return;
  document.body?.classList.toggle('is-docked', !!on);
}

function renderTicker(el, lines){
  if(!el) return;
  const segments = (lines && lines.length ? lines : ['NO SIGNAL']).map(line => `<span>${escapeHtml(line)}</span>`).join('');
  el.innerHTML = `${segments}${segments}`;
}

function renderDockIntel(ui, state, planet){
  const intel = buildDockIntel(state, planet);
  const status = ui.dockStatusLine || document.getElementById('dockStatusLine');
  const local = ui.dockLocalReadout || document.getElementById('dockLocalReadout');
  const traffic = ui.dockTrafficReadout || document.getElementById('dockTrafficReadout');
  const newsTicker = ui.dockNewsTicker || document.getElementById('dockNewsTicker');
  const marketTicker = ui.dockMarketTicker || document.getElementById('dockMarketTicker');
  if(status) status.textContent = intel.status;
  if(local) local.textContent = intel.local;
  if(traffic) traffic.textContent = intel.traffic;
  renderTicker(newsTicker, intel.news);
  renderTicker(marketTicker, intel.market);
}

function updateDockBackdrop(ui, planet) {
  const backdrop = ui.dockBackdrop || document.getElementById('dockBackdrop');
  const image = ui.dockBackdropImage || document.getElementById('dockBackdropImage');
  if (!backdrop || !image || !planet) return;
  image.src = getDockingScreenForPlanet(planet);
  image.alt = planet.name ? `${planet.name} docking view` : 'Planet docking view';
  backdrop.dataset.planetType = String(planet.type || 'rocky').toLowerCase();
  backdrop.classList.remove('hidden');
}

function hideDockBackdrop(ui) {
  const backdrop = ui.dockBackdrop || document.getElementById('dockBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

function initMarket(ui) {
  if (marketInit) return;
  if (!ui?.dockUI) return;
  ui.dockUI.addEventListener('click', e => {
    const state = activeState;
    if (!state) return;
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
    if (h) h.textContent = `Station Market // ${here.name || 'Planet'}`;
  }
  const missions = document.getElementById('missions');
  if (missions) {
    const h = missions.querySelector('h3');
    if (h) h.textContent = `Contracts // ${here.name || 'Planet'}`;
  }
  ensureOffersForPlanet(state, here);
  renderDockIntel(ui, state, here);
  const visibleOffers = visibleOffersForState(state, here.offers);
  ui.missionList.innerHTML = visibleOffers.map(o => {
    const capFull = (state.cargo + o.qty > state.cargoMax);
    const disabled = capFull ? 'disabled' : '';
    const time = Math.max(0, Math.floor(o.timeLeft || 0));
    const badges = [
      `<span class="badge">${time}s</span>`,
      `<span class="badge">$${o.reward}</span>`,
      o.illegal ? `<span class="badge" style="background:rgba(255,0,0,.15);color:#f99">Illegal</span>` : '',
      capFull ? `<span class="badge" style="background:rgba(255,107,107,.15);color:#ffb3b3">Hold full</span>` : ''
    ].filter(Boolean).join(' ');
    return `
      <div class="item" data-offer="${o.id}">
        <span class="contract-copy">
          <span class="contract-title">${escapeHtml(formatContractTitle(state, o))}</span>
          <span class="contract-route">${escapeHtml(formatContractDetails(state, o))}</span>
        </span>
        <span class="contract-actions">
          ${badges}
          <button class="btn" data-accept="${o.id}" ${disabled}>Accept</button>
        </span>
      </div>
    `;
  }).join('') || '<div class="item muted">No eligible contracts on this board. Build reputation and check back.</div>';
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
  activeState = state;
  state.docked = planet;
  initMarket(ui);
  setDockedMode(true);
  updateDockBackdrop(ui, planet);
  ui.dockUI.style.display = 'flex';
  // complete any deliveries for this planet
  deliverMissionsAt(state, planet);
  renderDock(ui, state);
  updateBuyButtons(ui, state);
  updateHUD(ui, state);
  saveGame(state);
}

export function undock(state, ui){
  activeState = state;
  state.docked = null;
  setDockedMode(false);
  ui.dockUI.style.display = 'none';
  hideDockBackdrop(ui);
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
