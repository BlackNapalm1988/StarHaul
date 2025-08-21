// Basic entity definitions and helpers extracted from the original inline script.

export const WORLD = { w: 10400, h: 7800 };

export const CFG = {
  ship: { r: 20, accel: 0.11, friction: 0.993, maxSpeed: 6.2, turn: 0.08, invuln: 120, blink: 7, hullMax: 100 },
  bullets: { max: 7, speed: 9.5, life: 110, cool: 9 },
  economy: { startCredits: 200, fuelStart: 140, fuelUse: 0.055, ammoStart: 24, cargoMax: 20 },
  asteroid: { count: 90, speed: [.22, .85], sizes: [24, 16, 10], jag: .35, verts: [8, 14] },
  pirates: { spawnEvery: 300, bulletSpeed: 6.5, fireEvery: 120, aggro: 380, speed: 2.1, hp: 7, boardRange: 22, boardTime: 90, steal: { credits: [60, 160], cargo: [3, 10] }, repPenalty: 1 },
  blackholes: 3, planets: 12, stars: 7,
  safety: { fromBH: 520, fromPlanet: 320, fromStar: 440 },
  contracts: { perPlanet: 3, refreshEvery: 1800, minTime: 3200, maxTime: 5200, illegalChance: 0.2 },
  gates: 4,
  towing: { base: 25, perUnit: 0.02 },
  supernova: { minLife: 4800, maxLife: 9600, warnWindow: 900, yield: [16, 32], kick: [1.4, 2.8], shockParticles: 80 },
  hazards: { nebulae: 6 },
  mines: { radius: 34, damage: 40, count: 12 },
  radiation: { count: 3, damage: 1 },
  rifts: { count: 2, pull: 0.15, drift: 0.3 },
  pirateBase: { count: 1, r: 40, hp: 60, spawnEvery: 400, bounty: 200, fireEvery: 180 },
  hunters: { thresholds: [5, 10], speed: 3, bulletSpeed: 8.5, fireEvery: 100 },
  patrols: { count: 2, scanRadius: 260, cone: 0.8, fine: 100 },
  contraband: { repPenalty: 2 },
  meteors: { spawnEvery: [1800, 3200], duration: [180, 300], rate: 15 },
  comets: { spawnEvery: [600, 1200], speed: [4, 7], damage: 30 },
  solarFlare: { min: 800, max: 1600, damage: 15, stun: 90, radius: 260 },
  nebulaStar: { blue: 0.00005, purple: 0.00008, green: 0.00003 },
  background: { galaxies: 6, superflash: 0.00002 },
  ui: { starWarnRadius: 900 }
};

export function rand(a, b) { return Math.random() * (b - a) + a; }
export function irand(a, b) { return Math.floor(rand(a, b)); }
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function newShip() {
  return {
    x: WORLD.w / 2, y: WORLD.h / 2, vx: 0, vy: 0, a: -Math.PI / 2,
    turn: 0, thrust: false, r: CFG.ship.r,
    inv: CFG.ship.invuln, blink: 0, justSpawned: true,
    lives: 3, hull: CFG.ship.hullMax, hullMax: CFG.ship.hullMax, canShoot: true, cool: 0,
    engine: 1, hold: 0, shield: 0, gun: 1, trail: [],
    centerX: 0, centerY: 0, centered: false, flare: 0
  };
}

export function bakeAsteroidTexture(r, offs) {
  const dim = Math.ceil((r + 2) * 2);
  const c = document.createElement('canvas');
  c.width = c.height = dim;
  const g = c.getContext('2d');
  g.translate(dim / 2, dim / 2);
  g.beginPath();
  for (let i = 0; i < offs.length; i++) {
    const ang = (Math.PI * 2) * (i / offs.length);
    const rr = r * offs[i];
    const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  const fill = g.createLinearGradient(-r, -r, r, r);
  fill.addColorStop(0, '#1e2636');
  fill.addColorStop(1, '#2b354a');
  g.fillStyle = fill;
  g.strokeStyle = '#aab6c8';
  g.lineWidth = 2;
  g.fill();
  g.stroke();
  for (let k = 0; k < irand(2, 5); k++) {
    const ca = rand(0, Math.PI * 2), cr = rand(r * 0.1, r * 0.35);
    const cx = Math.cos(ca) * rand(0, r * 0.6);
    const cy = Math.sin(ca) * rand(0, r * 0.6);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.beginPath();
    g.arc(cx, cy, cr, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function makeAsteroid(x, y, r) {
  const n = irand(CFG.asteroid.verts[0], CFG.asteroid.verts[1]);
  const offs = Array.from({ length: n }, () => rand(1 - CFG.asteroid.jag, 1 + CFG.asteroid.jag));
  const vel = rand(CFG.asteroid.speed[0], CFG.asteroid.speed[1]);
  const va = rand(0, Math.PI * 2);
  const tex = bakeAsteroidTexture(r, offs);
  return { x, y, r, vx: Math.cos(va) * vel, vy: Math.sin(va) * vel, a: rand(0, Math.PI * 2), spin: rand(-.008, .008), offs, layer: Math.random(), tex };
}

export function bakePlanetTexture(p) {
  const sz = Math.ceil((p.r + 14) * 2);
  const c = document.createElement('canvas');
  c.width = c.height = sz;
  const g = c.getContext('2d');
  // Simplified planet baking used for modularisation.
  g.fillStyle = '#888';
  g.beginPath();
  g.arc(sz / 2, sz / 2, p.r, 0, Math.PI * 2);
  g.fill();
  return { planet: c, rings: null };
}

export function makePlanet(i) {
  const types = ['rocky', 'ocean', 'ice', 'lava', 'gas', 'industrial'];
  const type = types[i % types.length];
  const r = irand(28, 80);
  const x = rand(200, WORLD.w - 200);
  const y = rand(200, WORLD.h - 200);
  const p = { id: i, x, y, r, type, rot: rand(0, Math.PI * 2), rotSpeed: rand(-0.0012, 0.0012), hasRings: (Math.random() < 0.25) && r > 40, name: 'P-' + i, stock: { fuel: irand(200, 600), ammo: irand(50, 150) }, prices: { fuel: 2, ammo: 5, repair: 20 }, offers: [], layer: 0.5 };
  const tex = bakePlanetTexture(p);
  p.tex = tex.planet;
  p.ringsTex = tex.rings;
  return p;
}

export function makeStar(x = rand(200, WORLD.w - 200), y = rand(200, WORLD.h - 200)) {
  const r = irand(36, 88);
  const life = irand(CFG.supernova.minLife, CFG.supernova.maxLife);
  const tex = bakePlanetTexture({ r, type: 'star' }).planet;
  return { x, y, baseR: r, r, life, maxLife: life, hue: 210, unstableAt: life - CFG.supernova.warnWindow, phase: 'stable', pulse: 0, warned: false, flare: irand(CFG.solarFlare.min, CFG.solarFlare.max), tex, form: 1 };
}
