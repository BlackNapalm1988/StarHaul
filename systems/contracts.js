import { CFG } from '../core/config.js';
import { getSupply } from './economy.js';

const num = (v, path) => {
  if (typeof v !== 'number') throw new Error(`CFG.${path} must be a number`);
};

num(CFG.contracts?.perPlanet, 'contracts.perPlanet');
num(CFG.contracts?.minTime, 'contracts.minTime');
num(CFG.contracts?.maxTime, 'contracts.maxTime');

const defaultCargo = 'Cargo Crates';
const generalCargo = [
  'Fuel Rods',
  'Medical Crates',
  'Navigation Relays',
  'Hull Plates',
  'Ration Packs',
  'Cryo Pods'
];
const illegalCargo = [
  'Black-Market AI Cores',
  'Unmarked Weapons',
  'Stolen Nav Chips',
  'Smuggled Stims'
];
const cargoByDestinationType = {
  gas: ['Pressure Seals', 'Helium-3 Canisters', 'Storm Probes'],
  ice: ['Thermal Coils', 'Fusion Heaters', 'Hydroponic Nutrients'],
  industrial: ['Fuel Rods', 'Servo Assemblies', 'Reactor Coolant'],
  lava: ['Heat Shields', 'Mag-Drill Parts', 'Ceramic Plating'],
  ocean: ['Water Purifiers', 'Algae Cultures', 'Dock Pumps'],
  rocky: ['Survey Beacons', 'Ore Scanners', 'Habitat Panels'],
  water: ['Water Purifiers', 'Algae Cultures', 'Dock Pumps']
};

const pick = items => items[Math.floor(Math.random() * items.length)] || defaultCargo;

function cargoForRoute(to, illegal){
  if(illegal) return pick(illegalCargo);
  const destinationType = String(to?.type || '').toLowerCase();
  return pick(cargoByDestinationType[destinationType] || generalCargo);
}

export function planetNameById(state, id){
  const planet = state?.planets?.find(p => p.id === id);
  if(planet?.name) return planet.name;
  return id == null ? 'Unknown Planet' : `Planet ${id}`;
}

export function contractCargoName(contract){
  return contract?.cargoName || contract?.cargo || defaultCargo;
}

export function formatContractTitle(state, contract){
  return `${contractCargoName(contract)} to ${planetNameById(state, contract?.to)}`;
}

export function formatContractDetails(state, contract){
  const qty = Number.isFinite(contract?.qty) ? contract.qty : 0;
  const unit = qty === 1 ? 'unit' : 'units';
  return `${qty} ${unit} from ${planetNameById(state, contract?.from)}`;
}

export function isOfferVisibleForState(state, offer){
  return (state?.reputation || 0) >= (offer?.reqRep || 0);
}

export function visibleOffersForState(state, offers = []){
  return offers.filter(o => isOfferVisibleForState(state, o));
}

function ensureAtLeastOneVisibleOffer(state, planet){
  if(!planet.offers.length || visibleOffersForState(state, planet.offers).length) return;
  const easiest = planet.offers.reduce((best, offer) => {
    if(!best) return offer;
    if((offer.reqRep || 0) !== (best.reqRep || 0)) return (offer.reqRep || 0) < (best.reqRep || 0) ? offer : best;
    return (offer.reward || 0) < (best.reward || 0) ? offer : best;
  }, null);
  if(easiest) easiest.reqRep = state?.reputation || 0;
}

export function ensureOffersForPlanet(state, planet){
  if(!planet.offers) planet.offers = [];
  while(planet.offers.length < CFG.contracts.perPlanet){
    let to;
    do{
      to = state.planets[Math.floor(Math.random()*state.planets.length)];
    } while(!to || to.id === planet.id);
    const fromX = Number.isFinite(planet.x) ? planet.x : 0;
    const fromY = Number.isFinite(planet.y) ? planet.y : 0;
    const toX = Number.isFinite(to.x) ? to.x : 0;
    const toY = Number.isFinite(to.y) ? to.y : 0;
    const dx = toX - fromX; const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);
    const qty = 3 + Math.floor(Math.random()*10); // 3..12
    const reward = Math.floor(qty * (20 + dist / 35));
    const baseTime = CFG.contracts.minTime + Math.random() * (CFG.contracts.maxTime - CFG.contracts.minTime);
    const timeLeft = Math.floor(baseTime + dist / 2);
    const reqRep = Math.floor((reward / 400)) | 0; // rough gating by reward
    const illegal = Math.random() < CFG.contracts.illegalChance;
    const cargoName = cargoForRoute(to, illegal);
    planet.offers.push({
      id: Math.random().toString(36).slice(2),
      from: planet.id,
      to: to.id,
      qty,
      cargoName,
      reward,
      timeLeft,
      reqRep,
      illegal
    });
  }
  ensureAtLeastOneVisibleOffer(state, planet);
}

// Decrement timers on offers and repopulate
export function refreshOffers(state, dt = 1){
  state.planets.forEach(p => {
    // Tick time on offers in place; offers rarely expire on any given tick,
    // so avoid reallocating the array (via .filter()) every call.
    for(let i = p.offers.length - 1; i >= 0; i--){
      const o = p.offers[i];
      o.timeLeft -= dt;
      if(o.timeLeft <= 0) p.offers.splice(i, 1);
    }
    ensureOffersForPlanet(state, p);
  });
}

// Accept an offer at a planet if there is cargo space
export function acceptOffer(state, planet, offerId){
  if(!planet || !planet.offers) return false;
  const idx = planet.offers.findIndex(o => o.id === offerId);
  if(idx === -1) return false;
  const o = planet.offers[idx];
  if(state.cargo + o.qty > state.cargoMax) return false;
  if ((state.reputation || 0) < (o.reqRep || 0)) return false;
  // load cargo and move to active missions
  state.cargo += o.qty;
  state.missions.push({ id: o.id, from: o.from, to: o.to, qty: o.qty, cargoName: contractCargoName(o), reward: o.reward, timeLeft: o.timeLeft, illegal: !!o.illegal });
  planet.offers.splice(idx,1);
  return true;
}

// Decrement mission timers and drop failed ones (freeing cargo)
export function tickMissions(state, dt = 1){
  if(!state.missions) return;
  for(let i = state.missions.length - 1; i >= 0; i--){
    const m = state.missions[i];
    m.timeLeft -= dt;
    if(m.timeLeft <= 0){
      // mission failed: free cargo, optional rep penalty
      state.cargo = Math.max(0, state.cargo - m.qty);
      if(typeof state.reputation === 'number') state.reputation = Math.max(0, state.reputation - 1);
      state.missions.splice(i,1);
    }
  }
}

// Complete deliveries for missions whose destination matches the current planet
export function deliverMissionsAt(state, planet){
  if(!planet || !state.missions || !state.missions.length) return { delivered: 0, reward: 0 };
  let delivered = 0;
  let reward = 0;
  for(let i = state.missions.length - 1; i >= 0; i--){
    const m = state.missions[i];
    if(m.to === planet.id){
      delivered++;
      reward += m.reward;
      state.cargo = Math.max(0, state.cargo - m.qty);
      if (!planet.supply) planet.supply = {};
      const cargoKey = m.cargoName || 'cargo';
      planet.supply[cargoKey] = Math.min(100, getSupply(planet, cargoKey) + m.qty * CFG.economy.supplyShiftDeliver);
      state.missions.splice(i,1);
    }
  }
  if(delivered > 0){
    state.credits += reward;
    if(typeof state.reputation === 'number') state.reputation += delivered;
  }
  return { delivered, reward };
}
