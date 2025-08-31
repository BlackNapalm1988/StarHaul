import { CFG, WORLD } from '../core/config.js';

const num = (v, path) => {
  if (typeof v !== 'number') throw new Error(`CFG.${path} must be a number`);
};

num(CFG.contracts?.perPlanet, 'contracts.perPlanet');
num(CFG.contracts?.minTime, 'contracts.minTime');
num(CFG.contracts?.maxTime, 'contracts.maxTime');

export function ensureOffersForPlanet(state, planet){
  while(planet.offers.length < CFG.contracts.perPlanet){
    let to;
    do{
      to = state.planets[Math.floor(Math.random()*state.planets.length)];
    } while(!to || to.id === planet.id);
    const dx = to.x - planet.x; const dy = to.y - planet.y;
    const dist = Math.hypot(dx, dy);
    const qty = 3 + Math.floor(Math.random()*10); // 3..12
    const reward = Math.floor(qty * (20 + dist / 35));
    const baseTime = CFG.contracts.minTime + Math.random() * (CFG.contracts.maxTime - CFG.contracts.minTime);
    const timeLeft = Math.floor(baseTime + dist / 2);
    const reqRep = Math.floor((reward / 400)) | 0; // rough gating by reward
    const illegal = Math.random() < CFG.contracts.illegalChance;
    planet.offers.push({
      id: Math.random().toString(36).slice(2),
      from: planet.id,
      to: to.id,
      qty,
      reward,
      timeLeft,
      reqRep,
      illegal
    });
  }
}

// Decrement timers on offers and repopulate
export function refreshOffers(state, dt = 1){
  state.planets.forEach(p => {
    // tick time on offers
    p.offers.forEach(o => { o.timeLeft -= dt; });
    p.offers = p.offers.filter(o => o.timeLeft > 0);
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
  state.missions.push({ id: o.id, from: o.from, to: o.to, qty: o.qty, reward: o.reward, timeLeft: o.timeLeft, illegal: !!o.illegal });
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
      state.missions.splice(i,1);
    }
  }
  if(delivered > 0){
    state.credits += reward;
    if(typeof state.reputation === 'number') state.reputation += delivered;
  }
  return { delivered, reward };
}
