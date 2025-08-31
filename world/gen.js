import { newShip } from '../entities/player.js';
import { makePirate, makeHunter, makePatrol, makePirateBase } from '../entities/npc.js';
import { createPool } from '../core/pool.js';
import { WORLD, CFG, SPACING } from '../core/config.js';
import { getPlanetTexture } from '../core/assets.js';

let rand = Math.random;

function seedRandom(seed) {
  let s = seed >>> 0;
  rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function genPlanetName(id){
  // Legacy naming schema: fixed list + numeric suffix starting at 100
  const legacy = [
    'Eden','Kovax','Aria','Tarsis','Veld','Khepri','Nysa','Osiris','Ixia','Carina','Prax','Rhea'
  ];
  if (typeof id === 'number'){
    const base = legacy[id % legacy.length];
    const serial = 100 + (id|0);
    return `${base}-${serial}`;
  }
  // Fallback (unused for planets) – keep old generator
  const syll = ['ar','en','ia','or','un','ta','bel','cer','dra','eon','for','gan','hel','ion','jor','kan','lor','mir','nor','oth','pra','qui','ros','sin','tur','vor','wyn','xer','yra','zen'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pick = () => syll[(rand()*syll.length)|0];
  const parts = 2 + ((rand()*3)|0);
  let name = '';
  for(let i=0;i<parts;i++) name += pick();
  return cap(name);
}

const num = (v, path) => {
  if (typeof v !== 'number') throw new Error(`CFG.${path} must be a number`);
};

num(CFG.economy?.startCredits, 'economy.startCredits');
num(CFG.economy?.fuelStart, 'economy.fuelStart');
num(CFG.economy?.ammoStart, 'economy.ammoStart');
num(CFG.economy?.cargoMax, 'economy.cargoMax');
num(CFG.planets, 'planets');
num(CFG.blackholes, 'blackholes');
num(CFG.stars, 'stars');

export function makePlanet(id){
  // Legacy-inspired planet types and visuals
  const x = rand()*WORLD.w;
  const y = rand()*WORLD.h;
  const types = ['rocky','ocean','ice','lava','gas','industrial'];
  const weights = [0.26, 0.22, 0.18, 0.10, 0.16, 0.08];
  let pick = rand(); let acc = 0; let type = 'rocky';
  for (let i=0;i<types.length;i++){ acc += weights[i]; if(pick <= acc){ type = types[i]; break; } }
  // Radius bands x2.5 for better presence (ensure stars remain largest below)
  let r = 50 * 2.5;
  if (type === 'gas') r = (80 + rand()*30) * 2.5;            // 200..275
  else if (type === 'ocean') r = (58 + rand()*20) * 2.5;     // 145..195
  else if (type === 'ice') r = (48 + rand()*22) * 2.5;       // 120..175
  else if (type === 'lava') r = (54 + rand()*20) * 2.5;      // 135..185
  else if (type === 'industrial') r = (56 + rand()*20) * 2.5; // 140..190
  else if (type === 'rocky') r = (46 + rand()*20) * 2.5;     // 115..165

  // Hue guidance per type
  let hue;
  if (type === 'gas') hue = 30 + rand()*40;          // warm bands
  else if (type === 'ocean') hue = 180 + rand()*40;   // blue-teal
  else if (type === 'ice') hue = 200 + rand()*30;     // icy blue
  else if (type === 'lava') hue = 18 + rand()*20;     // warm/orange
  else if (type === 'industrial') hue = 210 + rand()*20;// cool gray-blue
  else hue = 40 + rand()*40;                          // rocky ochre/earthy

  const texSeed = (rand()*0xFFFFFFFF)>>>0;
  const spin = 0.002 + rand()*0.006; // rad per tick (for overlays/rings)
  const hasRings = (type === 'gas') ? (rand() < 0.5) : (rand() < 0.1);
  const ringTilt = rand()*Math.PI;
  const ringInner = r * (1.25 + rand()*0.15);
  const ringOuter = ringInner + r * (0.45 + rand()*0.35);
  const name = genPlanetName(id);
  return { id, x, y, r, hue, texSeed, type, spin, rings: hasRings ? { tilt: ringTilt, inner: ringInner, outer: ringOuter } : null, offers: [], kind:'planet', name };
}

export function makeBlackHole(){
  return { x: rand()*WORLD.w, y: rand()*WORLD.h, r: 80, kind:'blackhole' };
}

export function makeStar(){
  // Legacy-inspired sizing scaled up so stars remain largest vs enlarged planets
  // baseR in ~301..483 range (grows up to ~1.4x as it ages)
  const baseR = (86 + rand()*52) * 3.5;
  const r = baseR;
  // Stars age and eventually go supernova
  const supernovaAt = 2400 + rand()*2400; // ~40-80s at 60fps
  const flareTimer = 600 + rand()*900;    // next flare 10-25s
  const name = `Star-${Math.floor(rand()*36**2).toString(36).toUpperCase()}${Math.floor(rand()*36**2).toString(36).toUpperCase()}`;
  // Hue starts at 210 and shifts warmer as it ages (mirrors legacy)
  const hue = 210;
  return { x: rand()*WORLD.w, y: rand()*WORLD.h, r, baseR, hue, age: 0, supernovaAt, flareTimer, kind:'star', name, phase: 'stable', pulse: 0, warned: false };
}

export function makeGate(){
  // Gate entity used as a landmark; mechanics handled elsewhere
  return { x: rand()*WORLD.w, y: rand()*WORLD.h, r: 28, kind:'gate' };
}

export function makeAsteroid(){
  const ang = rand()*Math.PI*2;
  const speed = 0.2 + rand()*0.8;
  const r = 8 + rand()*36; // wider size range
  const spin = (rand()-0.5) * 0.02; // slow rotation
  return {
    x: rand()*WORLD.w,
    y: rand()*WORLD.h,
    vx: Math.cos(ang)*speed,
    vy: Math.sin(ang)*speed,
    r,
    a: rand()*Math.PI*2,
    av: spin,
    seed: (rand()*0xffffffff)>>>0
  };
}

export function makeTrader(){
  const side = Math.floor(rand()*4);
  // spawn just inside the world bounds to avoid immediate culling
  const m = 10;
  const pos = [
    {x:m, y: rand()*WORLD.h},
    {x:WORLD.w - m, y: rand()*WORLD.h},
    {x:rand()*WORLD.w, y:m},
    {x:rand()*WORLD.w, y:WORLD.h - m}
  ][side];
  const ang = rand()*Math.PI*2;
  const speed = 0.5 + rand();
  return {
    x: pos.x,
    y: pos.y,
    vx: Math.cos(ang)*speed,
    vy: Math.sin(ang)*speed,
    a: ang,
    r: 16,
    kind:'trader'
  };
}

export function spawnAsteroid(state){
  const a = makeAsteroid();
  state.asteroids.push(a);
  return a;
}

export function spawnTrader(state){
  const t = makeTrader();
  if(!state.traders) state.traders = [];
  state.traders.push(t);
  return t;
}

export function reset(seed = Math.random()){
  seedRandom(seed);
  const state = {
    seed,
    ship: newShip(),
    credits: CFG.economy.startCredits,
    fuel: CFG.economy.fuelStart,
    ammo: CFG.economy.ammoStart,
    cargo: 0,
    cargoMax: CFG.economy.cargoMax,
    reputation: 0,
    discovered: [],
    tracked: null,
    bullets: [],
    particles: [],
    bulletPool: createPool(() => ({x:0, y:0, vx:0, vy:0, r:2, life:0})),
    particlePool: createPool(() => ({x:0, y:0, vx:0, vy:0, r:1, life:0})),
    asteroids: [],
    planets: [],
    blackholes: [],
    pirates: [],
    hunters: [],
    patrols: [],
    pirateBases: [],
    traders: [],
    gates: [],
    missions: [],
    stars: []
  };
  // Global occupancy to avoid overlaps across all entities
  const occupied = [];
  const occRadius = (e) => (e && e.rings && typeof e.rings.outer === 'number') ? e.rings.outer : Math.max(1, e.r || 1);
  const pairPad = (k1, k2) => {
    const a = (SPACING?.[k1]?.[k2]);
    const b = (SPACING?.[k2]?.[k1]);
    return (typeof a === 'number') ? a : (typeof b === 'number') ? b : (SPACING?.default || 6);
  };
  const overlapsAny = (x, y, r, kind='other') => {
    for (const o of occupied){
      const dx = x - o.x; const dy = y - o.y;
      const pad = pairPad(kind, o.kind || 'other');
      const rr = r + o.r + pad;
      if (dx*dx + dy*dy < rr*rr) return true;
    }
    return false;
  };
  const addOcc = (e) => occupied.push({ x: e.x, y: e.y, r: occRadius(e), kind: e.kind || 'other' });

  // Reserve ship spawn area
  addOcc({ x: WORLD.w/2, y: WORLD.h/2, r: (CFG.ship?.r||16) * 3 });

  // Stars
  for(let i=0;i<CFG.stars;i++){
    let st = makeStar(); let tries = 0; let r = occRadius(st);
    while (tries < 120 && overlapsAny(st.x, st.y, r, st.kind)) { st.x = rand()*WORLD.w; st.y = rand()*WORLD.h; tries++; }
    state.stars.push(st); addOcc(st);
  }

  // Black holes
  for(let i=0;i<CFG.blackholes;i++){
    const b = makeBlackHole(); let tries = 0; let r = occRadius(b);
    while (tries < 120 && overlapsAny(b.x, b.y, r, b.kind)) { b.x = rand()*WORLD.w; b.y = rand()*WORLD.h; tries++; }
    state.blackholes.push(b); addOcc(b);
  }

  // Planets
  for(let i=0;i<CFG.planets;i++){
    const p = makePlanet(i); let tries = 0; let r = occRadius(p);
    while (tries < 160 && overlapsAny(p.x, p.y, r, p.kind)) { p.x = rand()*WORLD.w; p.y = rand()*WORLD.h; tries++; }
    state.planets.push(p); addOcc(p);
  }

  // Pirate base
  {
    const base = makePirateBase(rand); base.kind = 'base'; let tries = 0; let r = occRadius(base);
    while (tries < 160 && overlapsAny(base.x, base.y, r, base.kind)) { base.x = rand()*WORLD.w; base.y = rand()*WORLD.h; tries++; }
    state.pirateBases.push(base); addOcc(base);
  }

  // Asteroids (raise initial count to match larger WORLD density)
  for(let i=0;i<90;i++){
    const a = makeAsteroid(); a.kind = 'asteroid'; let tries = 0; let r = occRadius(a);
    while (tries < 80 && overlapsAny(a.x, a.y, r, a.kind)) { a.x = rand()*WORLD.w; a.y = rand()*WORLD.h; tries++; }
    state.asteroids.push(a); addOcc(a);
  }

  // Traders
  for(let i=0;i<2;i++){
    let t = makeTrader(); let tries = 0; let r = occRadius(t);
    while (tries < 80 && overlapsAny(t.x, t.y, r, t.kind||'trader')) { t = makeTrader(); r = occRadius(t); tries++; }
    state.traders.push(t); addOcc(t);
  }

  // Pirates / hunters / patrols
  for(let i=0;i<8;i++){
    let p = makePirate(rand); p.kind='pirate'; let tries = 0; let r = occRadius(p);
    while (tries < 80 && overlapsAny(p.x, p.y, r, p.kind)) { p = makePirate(rand); p.kind='pirate'; r = occRadius(p); tries++; }
    state.pirates.push(p); addOcc(p);
  }
  for(let i=0;i<2;i++){
    let h = makeHunter(rand); h.kind='hunter'; let tries = 0; let r = occRadius(h);
    while (tries < 80 && overlapsAny(h.x, h.y, r, h.kind)) { h = makeHunter(rand); h.kind='hunter'; r = occRadius(h); tries++; }
    state.hunters.push(h); addOcc(h);
  }
  for(let i=0;i<3;i++){
    let p = makePatrol(rand); p.kind='patrol'; let tries = 0; let r = occRadius(p);
    while (tries < 80 && overlapsAny(p.x, p.y, r, p.kind)) { p = makePatrol(rand); p.kind='patrol'; r = occRadius(p); tries++; }
    state.patrols.push(p); addOcc(p);
  }

  // Gates with paired links (0↔1, 2↔3, ...; last unpaired links to previous)
  if (CFG.gates > 0){
    const temp = [];
    for(let i=0;i<CFG.gates;i++){
      const g = makeGate(); g.id = i; let tries = 0; let r = occRadius(g);
      while (tries < 160 && overlapsAny(g.x, g.y, r, g.kind||'gate')) { g.x = rand()*WORLD.w; g.y = rand()*WORLD.h; tries++; }
      temp.push(g);
    }
    // link pairs
    for (let i=0;i<temp.length;i+=2){
      if (i+1 < temp.length){ temp[i].link = temp[i+1].id; temp[i+1].link = temp[i].id; }
      else if (i > 0) { temp[i].link = temp[i-1].id; temp[i-1].link = temp[i].id; }
    }
    // commit
    for (const g of temp){ state.gates.push(g); addOcc(g); }
  }
  // Choose a safe home planet and spawn ship docked there
  if (state.planets.length) {
    const clearance = (pl) => {
      let min = Infinity;
      for (const st of state.stars){
        const dx = pl.x - st.x, dy = pl.y - st.y;
        const d = Math.max(0, Math.hypot(dx, dy) - (pl.r + st.r));
        if (d < min) min = d;
      }
      return min;
    };
    const SAFE = 160; // require at least 160px clearance from nearest star
    // prefer planets that satisfy clearance, choose the one closest to center among safe ones
    const cx = WORLD.w/2, cy = WORLD.h/2;
    const safe = state.planets.filter(p => clearance(p) >= SAFE);
    const pickFrom = safe.length ? safe : state.planets;
    let best = null, bd = Infinity;
    for (const p of pickFrom){
      const dx = p.x - cx, dy = p.y - cy; const d2 = dx*dx + dy*dy;
      if (d2 < bd) { bd = d2; best = p; }
    }
    if (best) {
      state.home = best;
      state.docked = best;
      state.ship.x = best.x; state.ship.y = best.y;
      state.ship.vx = 0; state.ship.vy = 0;
      state.ship.centered = false;
      state.ship.centerX = state.ship.x; state.ship.centerY = state.ship.y;
    }
  }
  return state;
}
