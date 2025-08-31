import { CFG } from './config.js';

const images = {};

// Simple seeded RNG for deterministic noise
function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bakeShipTexture(color = '#0f0') {
  const r = CFG.ship.r;
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r * 2, r);
  ctx.lineTo(0, r + r / 2);
  ctx.lineTo(0, r - r / 2);
  ctx.closePath();
  ctx.fill();
  return c;
}

function bakePlanetTexture(opts = {}) {
  // Support HiDPI baking: if opts.dpr provided, bake at r*dpr for crispness
  const dpr = Math.max(1, Math.min(opts.dpr || (window.devicePixelRatio || 1), 2));
  const rCss = Math.max(8, opts.r || 40);
  const r = Math.round(rCss * dpr);
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; try { ctx.imageSmoothingQuality = 'high'; } catch {}

  const hue = typeof opts.hue === 'number' ? Math.floor(opts.hue) : Math.floor(Math.random() * 360);
  const type = (opts.type || '').toString();

  // Base globe gradient with slight terminator
  const grad = ctx.createRadialGradient(r * 0.3, r * 0.3, r * 0.25, r, r, r);
  grad.addColorStop(0, `hsl(${hue},60%,72%)`);
  grad.addColorStop(1, `hsl(${hue},60%,34%)`);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI * 2); ctx.fill();

  // Feature overlays per type
  const g = ctx;
  g.save(); g.translate(r, r);
  const rng = typeof opts.noiseSeed === 'number' ? seededRng(opts.noiseSeed) : Math.random;
  function rrnd(a,b){ return a + (b-a) * rng(); }
  if (type === 'gas') {
    // broad banded ellipses
    const bands = 80 + ((opts.noiseSeed||0) % 60);
    for (let i=0;i<bands;i++){
      const yy = (i/(bands-1)) * 2 - 1; // -1..1
      const rad = r * Math.sqrt(Math.max(0, 1 - yy*yy));
      const alpha = 0.06 + 0.08 * Math.sin(i*0.15 + (opts.noiseSeed||0)%10);
      g.globalAlpha = alpha;
      g.fillStyle = `hsla(${Math.floor(hue + (i%2? 6:-6))}, 60%, ${52 + (i%2?-5:5)}%, 1)`;
      g.beginPath(); g.ellipse(0, yy * r * 0.8, rad*1.1, r*0.08, 0, 0, Math.PI*2); g.fill();
    }
  } else {
    // island/land patches
    const blobs = (type === 'lava') ? 220 : (type === 'industrial') ? 200 : (type === 'ocean' || type === 'ice') ? 240 : 260;
    for (let i=0;i<blobs;i++){
      const ang = rrnd(0, Math.PI*2);
      const rr2 = r * Math.sqrt(Math.max(0, rng()));
      const x = Math.cos(ang) * rr2, y = Math.sin(ang) * rr2;
      const rad = (type === 'gas') ? rrnd(6, r*0.22) : rrnd(4, r*0.18);
      g.globalAlpha = (type === 'ocean' || type === 'ice') ? rrnd(0.06,0.16) : rrnd(0.08,0.2);
      let hue2 = hue, sat = 60, bri = 50;
      if (type === 'lava') { hue2 = 18 + ((opts.noiseSeed||0)%12); sat = 85; bri = 55; }
      if (type === 'industrial') { hue2 = 210 + ((opts.noiseSeed||0)%14); sat = 12; bri = 50; }
      g.fillStyle = `hsl(${Math.floor(hue2 + rrnd(-6,6))}, ${sat}%, ${bri + rrnd(-8,8)}%)`;
      if (type === 'gas'){
        g.save(); g.translate(x,y); g.rotate(rrnd(-0.25,0.25));
        g.beginPath(); g.ellipse(0,0,rad*1.8,rad*0.6,0,0,Math.PI*2); g.fill(); g.restore();
      } else {
        g.beginPath(); g.arc(x,y,rad,0,Math.PI*2); g.fill();
      }
    }
  }
  // Extras
  if (type === 'lava'){
    for(let L=0;L<80;L++){
      const a = rrnd(0, Math.PI*2); const r2 = r * rrnd(0.3, 0.95);
      const x = Math.cos(a)*r2, y = Math.sin(a)*r2;
      g.strokeStyle = 'rgba(255,120,20,.7)'; g.lineWidth = rrnd(1.0,2.4);
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+rrnd(-12,12), y+rrnd(-12,12)); g.stroke();
    }
  }
  // Terminator/lighting
  const Ld = { x: 0.8, y: -0.6 };
  const term = g.createRadialGradient(Ld.x*r*0.6, Ld.y*r*0.6, r*0.6, 0,0, r*1.1);
  term.addColorStop(0.0, 'rgba(0,0,0,0)'); term.addColorStop(0.55,'rgba(0,0,0,0)'); term.addColorStop(1.0, 'rgba(0,0,0,0.55)');
  g.globalCompositeOperation = 'multiply'; g.fillStyle = term; g.beginPath(); g.arc(0,0,r,0,Math.PI*2); g.fill(); g.globalCompositeOperation = 'source-over';
  // City lights for industrial/ocean night side
  if (type === 'industrial' || type === 'ocean'){
    g.save(); g.rotate(Math.atan2(-Ld.y, -Ld.x)); g.translate(-r*0.25, 0);
    for(let nl=0; nl<200; nl++){
      const aa = rrnd(0, Math.PI*2), rr2 = r*Math.sqrt(rng()); const xx = Math.cos(aa)*rr2, yy = Math.sin(aa)*rr2; if (xx>0) continue;
      g.fillStyle = (rng()<0.3) ? 'rgba(255,220,180,.85)' : 'rgba(255,200,140,.55)'; g.fillRect(xx,yy,1,1);
    }
    g.restore();
  }
  // Atmosphere glow
  const atm = g.createRadialGradient(0,0,r*0.9, 0,0, r+Math.max(10, r*0.2));
  atm.addColorStop(0, 'rgba(109,242,214,0)'); atm.addColorStop(1, 'rgba(109,242,214,0.22)');
  g.fillStyle = atm; g.beginPath(); g.arc(0,0, r+Math.max(10, r*0.2), 0, Math.PI*2); g.fill();
  g.restore();
  return c;
}

function bakeStarTexture() {
  const r = 60;
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.5, '#ffd700');
  grad.addColorStop(1, '#ff8c00');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  // subtle noise
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() * 20) - 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Make a rocky, irregular asteroid sprite. Options:
// - r: radius
// - seed: deterministic shape
// - hue/sat/bri: optional color tuning
function bakeAsteroidTexture(opts = {}){
  const r = Math.max(6, opts.r || 20);
  const seed = (opts.seed >>> 0) || Math.floor(Math.random() * 0xffffffff);
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  // Small seeded RNG for reproducible jagged shape
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const points = 18 + (seed % 7); // 18..24 verts
  const rough = 0.22 + (seed % 17) * 0.01; // 0.22..0.38 radial variance
  const cx = r, cy = r;
  // Build irregular polygon path
  ctx.beginPath();
  for(let i=0;i<points;i++){
    const t = (i / points) * Math.PI * 2;
    const k = 1 - rough + rnd() * rough * 2; // 1 +/- rough
    const rr = r * k;
    const x = cx + Math.cos(t) * rr;
    const y = cy + Math.sin(t) * rr;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  // Fill with rocky gradient
  const hue = typeof opts.hue === 'number' ? opts.hue : 26 + (seed % 24); // warm gray range
  const sat = typeof opts.sat === 'number' ? opts.sat : 8 + (seed % 8);
  const bri = typeof opts.bri === 'number' ? opts.bri : 38 + (seed % 16);
  const grad = ctx.createRadialGradient(cx - r*0.25, cy - r*0.25, r*0.2, cx, cy, r);
  grad.addColorStop(0, `hsl(${hue}, ${sat}%, ${Math.max(0,bri+18)}%)`);
  grad.addColorStop(1, `hsl(${hue}, ${sat}%, ${Math.max(0,bri-10)}%)`);
  ctx.fillStyle = grad;
  ctx.fill();
  // Crack/noise overlay
  const img = ctx.getImageData(0,0,c.width,c.height);
  for(let i=0;i<img.data.length;i+=4){
    // random diffuse noise within alpha
    const a = img.data[i+3]; if(a===0) continue;
    const n = (rnd()*20 - 10);
    img.data[i]   = Math.max(0, Math.min(255, img.data[i]   + n));
    img.data[i+1] = Math.max(0, Math.min(255, img.data[i+1] + n));
    img.data[i+2] = Math.max(0, Math.min(255, img.data[i+2] + n));
  }
  ctx.putImageData(img,0,0);
  // Edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = Math.max(1, r*0.05);
  ctx.stroke();
  return c;
}

const imageSources = {
  startScreen: 'StarHauler_Startscreen.png',
  ship: () => bakeShipTexture('#0f0'),
  traderShip: () => bakeShipTexture('#09f'),
  pirateShip: () => bakeShipTexture('#f44'),
  planet: bakePlanetTexture,
  star: bakeStarTexture,
  asteroid: () => bakeAsteroidTexture({ r: 20 })
};

function loadImage(key, src, onProgress) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      images[key] = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  }).then(res => {
    if (onProgress) onProgress();
    return res;
  });
}

export async function loadAll(progressCallback) {
  const keys = Object.keys(imageSources);
  let loaded = 0;
  const total = keys.length;
  const update = () => {
    loaded++;
    if (progressCallback) progressCallback(loaded / total);
  };
  const promises = keys.map(key => {
    const src = imageSources[key];
    if (typeof src === 'string') {
      return loadImage(key, src, update);
    }
    const img = src();
    images[key] = img;
    update();
    return Promise.resolve(img);
  });
  try {
    await Promise.all(promises);
  } catch (err) {
    throw new Error(`Failed to load assets: ${err.message || err}`);
  }
  return images;
}

export function getImage(key) {
  return images[key];
}

// Build a cache key for planet textures
function planetKey(opts = {}) {
  const r = opts.r || 40;
  const hue = typeof opts.hue === 'number' ? Math.floor(opts.hue) : 'rand';
  const seed = typeof opts.noiseSeed === 'number' ? (opts.noiseSeed >>> 0) : 'rand';
  const type = (opts.type || 'any').toString();
  const dpr = Math.max(1, Math.min(opts.dpr || (window.devicePixelRatio || 1), 2));
  return `planet:h${hue}:s${seed}:r${r}:t${type}:d${dpr}`;
}

// Get (and cache) a planet texture for provided params
export function getPlanetTexture(opts = {}) {
  // If no options specified, reuse the default baked 'planet' image
  const hasOpts = typeof opts.hue === 'number' || typeof opts.noiseSeed === 'number' || typeof opts.r === 'number';
  if (!hasOpts) return images['planet'];
  const key = planetKey(opts);
  if (!images[key]) {
    images[key] = bakePlanetTexture(opts);
  }
  return images[key];
}

// Simple LRU for asteroid textures to cap memory
const ASTEROID_CACHE_MAX = 256;
const asteroidLRU = [];

// Cache key for asteroid texture variants (quantized)
function asteroidKey(opts = {}){
  // Quantize radius to even integers to reduce variants
  const rr = Math.max(6, Math.round((opts.r || 20) / 2) * 2);
  // Reduce seed space to 1024 variants
  const seed = typeof opts.seed === 'number' ? ((opts.seed >>> 0) & 0x3FF) : 0;
  return `ast:s${seed}:r${rr}`;
}

function evictIfNeeded(){
  while (asteroidLRU.length > ASTEROID_CACHE_MAX){
    const oldKey = asteroidLRU.shift();
    if (oldKey && images[oldKey]) delete images[oldKey];
  }
}

// Get (and cache) asteroid texture per seed/radius (quantized, LRU-capped)
export function getAsteroidTexture(opts = {}){
  const key = asteroidKey(opts);
  if (!images[key]){
    // Bake with quantized inputs
    const r = Math.max(6, Math.round((opts.r || 20) / 2) * 2);
    const seed = typeof opts.seed === 'number' ? ((opts.seed >>> 0) & 0x3FF) : 0;
    images[key] = bakeAsteroidTexture({ r, seed });
    asteroidLRU.push(key);
    evictIfNeeded();
  } else {
    // refresh LRU position
    const idx = asteroidLRU.indexOf(key);
    if (idx !== -1){ asteroidLRU.splice(idx,1); }
    asteroidLRU.push(key);
  }
  return images[key];
}
