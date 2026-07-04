import { CFG } from './config.js';

const images = {};

const spriteSheets = {
  player: {
    areas: {
      Left_Main_Engine: { x: 30, y: 205, purpose: 'engine' },
      Right_Main_Engine: { x: 215, y: 205, purpose: 'engine' },
      Left_Main_Engine_Brake: { x: 30, y: 115, purpose: 'engine' },
      Right_Main_Engine_Brake: { x: 215, y: 115, purpose: 'engine' },
      Cargo_Hold_Door: { x: 123, y: 235, purpose: 'cargo', stub: true },
      Main_Gun: { x: 120, y: 0, purpose: 'weapon' },
      Left_Cannon: { x: 45, y: 47, purpose: 'weapon', stub: true },
      Right_Cannon: { x: 199, y: 45, purpose: 'weapon', stub: true }
    },
    idle: {
      imageKey: 'playerIdleSprites',
      src: 'assets/ships/player_idle_sprites.png',
      frameWidth: 256,
      frameHeight: 256,
      frames: 8,
      renderScale: 5,
      fixedFrame: 0,
      fixedFrameAngle: -Math.PI / 2,
      rotateWithShip: true,
      directions: ['north', 'northEast', 'east', 'southEast', 'south', 'southWest', 'west', 'northWest']
    }
  }
};

function getDevicePixelRatio() {
  return typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
    ? window.devicePixelRatio
    : 1;
}

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
  const dpr = Math.max(1, Math.min(opts.dpr || getDevicePixelRatio(), 2));
  const rCss = Math.max(8, opts.r || 40);
  const r = Math.round(rCss * dpr);
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; try { ctx.imageSmoothingQuality = 'high'; } catch {}

  const seed = typeof opts.noiseSeed === 'number' ? (opts.noiseSeed >>> 0) : Math.floor(Math.random() * 0xffffffff);
  const rng = seededRng(seed);
  const hue = typeof opts.hue === 'number' ? Math.floor(opts.hue) : Math.floor(rng() * 360);
  const type = (opts.type || 'rocky').toString().toLowerCase();
  const g = ctx;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rrnd = (a, b) => a + (b - a) * rng();
  const hsl = (h, s, l, a = 1) => `hsla(${Math.round((h % 360 + 360) % 360)},${Math.round(s)}%,${Math.round(l)}%,${a})`;
  const sphere = () => { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); };
  const fillEllipse = (x, y, rx, ry, rot, color, alpha = 1) => {
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const palette = {
    gas: { base: hue, sat: 58, light: 48, atmosphere: 'rgba(255,204,128,0.28)' },
    ocean: { base: hue, sat: 62, light: 39, atmosphere: 'rgba(109,242,214,0.3)' },
    water: { base: hue, sat: 62, light: 39, atmosphere: 'rgba(109,242,214,0.3)' },
    ice: { base: 205 + (hue % 20), sat: 46, light: 66, atmosphere: 'rgba(190,230,255,0.34)' },
    lava: { base: 16 + (hue % 16), sat: 58, light: 26, atmosphere: 'rgba(255,128,64,0.24)' },
    industrial: { base: 210 + (hue % 18), sat: 18, light: 38, atmosphere: 'rgba(170,210,230,0.24)' },
    rocky: { base: hue, sat: 38, light: 38, atmosphere: 'rgba(210,190,150,0.18)' }
  }[type] || { base: hue, sat: 40, light: 40, atmosphere: 'rgba(180,220,255,0.2)' };

  g.save();
  g.translate(r, r);
  sphere();
  g.clip();

  const base = g.createRadialGradient(-r * 0.42, -r * 0.44, r * 0.08, 0, 0, r * 1.06);
  base.addColorStop(0, hsl(palette.base + 3, palette.sat + 8, clamp(palette.light + 28, 18, 88)));
  base.addColorStop(0.52, hsl(palette.base, palette.sat, palette.light));
  base.addColorStop(1, hsl(palette.base - 6, Math.max(8, palette.sat - 10), clamp(palette.light - 24, 5, 54)));
  g.fillStyle = base;
  g.fillRect(-r, -r, r * 2, r * 2);

  if(type === 'gas'){
    const bands = 34 + (seed % 10);
    for(let i = 0; i < bands; i++){
      const n = i / Math.max(1, bands - 1);
      const y = -r * 0.92 + n * r * 1.84;
      const latitude = y / r;
      const width = r * Math.sqrt(Math.max(0, 1 - latitude * latitude));
      const wave = Math.sin(i * 0.9 + seed * 0.001) * r * 0.018;
      const light = palette.light + Math.sin(i * 0.74 + seed * 0.003) * 10;
      fillEllipse(wave, y, width * 1.08, r * rrnd(0.025, 0.07), rrnd(-0.025, 0.025), hsl(palette.base + rrnd(-14, 16), palette.sat + rrnd(-8, 8), clamp(light, 22, 78)), rrnd(0.22, 0.5));
    }
    for(let i = 0; i < 130; i++){
      const y = rrnd(-r * 0.72, r * 0.72);
      const x = rrnd(-r * 0.82, r * 0.82);
      if(x * x + y * y > r * r) continue;
      const width = rrnd(r * 0.08, r * 0.28) * Math.sqrt(Math.max(0.18, 1 - (y / r) * (y / r)));
      fillEllipse(x, y, width, rrnd(r * 0.006, r * 0.018), rrnd(-0.08, 0.08), hsl(palette.base + rrnd(-22, 24), palette.sat + rrnd(-6, 12), clamp(palette.light + rrnd(-18, 20), 18, 76)), rrnd(0.16, 0.34));
    }
    const stormCount = 1 + (seed % 2);
    for(let i = 0; i < stormCount; i++){
      const x = rrnd(-r * 0.42, r * 0.44);
      const y = rrnd(-r * 0.35, r * 0.38);
      const sr = rrnd(r * 0.12, r * 0.22);
      fillEllipse(x, y, sr * 1.7, sr * 0.72, rrnd(-0.3, 0.3), hsl(palette.base + 22, palette.sat + 10, clamp(palette.light + 18, 36, 82)), 0.42);
      fillEllipse(x - sr * 0.16, y, sr * 0.98, sr * 0.42, rrnd(-0.3, 0.3), hsl(palette.base - 12, palette.sat, clamp(palette.light - 9, 16, 66)), 0.5);
      fillEllipse(x - sr * 0.08, y - sr * 0.03, sr * 0.42, sr * 0.18, 0, 'rgba(255,245,220,0.42)', 1);
    }
  } else {
    const terrainCount = type === 'lava' ? 230 : type === 'industrial' ? 210 : type === 'ice' ? 250 : type === 'ocean' || type === 'water' ? 210 : 270;
    for(let i = 0; i < terrainCount; i++){
      const a = rrnd(0, Math.PI * 2);
      const d = r * Math.sqrt(rng()) * 0.95;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      const latScale = Math.sqrt(Math.max(0.2, 1 - (y / r) * (y / r)));
      const rad = rrnd(r * 0.018, r * 0.095);
      let color = hsl(palette.base + rrnd(-10, 12), palette.sat + rrnd(-8, 10), palette.light + rrnd(-10, 10));
      let alpha = rrnd(0.09, 0.24);
      if(type === 'ocean' || type === 'water'){
        const landHue = rrnd(80, 118);
        color = rng() < 0.28 ? hsl(38, 38, 51, 1) : hsl(landHue, rrnd(30, 46), rrnd(31, 48), 1);
        alpha = rrnd(0.35, 0.58);
      } else if(type === 'ice'){
        color = rng() < 0.7 ? hsl(202 + rrnd(-8, 8), rrnd(22, 42), rrnd(72, 90), 1) : hsl(220, 18, rrnd(48, 62), 1);
        alpha = rrnd(0.22, 0.48);
      } else if(type === 'lava'){
        color = rng() < 0.25 ? hsl(24, 86, rrnd(44, 61), 1) : hsl(18 + rrnd(-8, 8), rrnd(18, 34), rrnd(14, 30), 1);
        alpha = rng() < 0.25 ? rrnd(0.24, 0.48) : rrnd(0.16, 0.34);
      } else if(type === 'industrial'){
        color = rng() < 0.5 ? hsl(210 + rrnd(-8, 8), rrnd(7, 18), rrnd(33, 52), 1) : hsl(72, rrnd(12, 24), rrnd(30, 42), 1);
        alpha = rrnd(0.18, 0.36);
      }
      fillEllipse(x, y, rad * rrnd(1.0, 2.4) * latScale, rad * rrnd(0.45, 1.2), rrnd(0, Math.PI), color, alpha);
    }

    if(type === 'rocky' || type === 'industrial' || type === 'ice'){
      const craters = type === 'ice' ? 18 : 26;
      for(let i = 0; i < craters; i++){
        const a = rrnd(0, Math.PI * 2);
        const d = r * Math.sqrt(rng()) * 0.74;
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        const cr = rrnd(r * 0.025, r * 0.085);
        fillEllipse(x, y, cr * 1.25, cr * 0.86, rrnd(0, Math.PI), 'rgba(0,0,0,0.2)', rrnd(0.38, 0.62));
        fillEllipse(x - cr * 0.18, y - cr * 0.16, cr * 0.94, cr * 0.44, rrnd(0, Math.PI), 'rgba(255,255,255,0.14)', rrnd(0.45, 0.75));
      }
    }

    if(type === 'lava'){
      for(let i = 0; i < 34; i++){
        let a = rrnd(0, Math.PI * 2);
        let d = r * rrnd(0.18, 0.82);
        let x = Math.cos(a) * d;
        let y = Math.sin(a) * d;
        g.beginPath();
        g.moveTo(x, y);
        const steps = 3 + Math.floor(rng() * 4);
        for(let j = 0; j < steps; j++){
          a += rrnd(-0.75, 0.75);
          const len = rrnd(r * 0.045, r * 0.13);
          x += Math.cos(a) * len;
          y += Math.sin(a) * len;
          g.lineTo(x, y);
        }
        g.strokeStyle = 'rgba(255,74,18,0.36)';
        g.lineWidth = rrnd(r * 0.018, r * 0.035);
        g.lineCap = 'round';
        g.stroke();
        g.strokeStyle = 'rgba(255,212,88,0.68)';
        g.lineWidth = rrnd(r * 0.004, r * 0.012);
        g.stroke();
      }
    }

    if(type === 'ice'){
      for(let i = 0; i < 32; i++){
        const y = rrnd(-r * 0.88, r * 0.88);
        const width = r * Math.sqrt(Math.max(0, 1 - (y / r) * (y / r)));
        g.strokeStyle = `rgba(90,150,190,${rrnd(0.16, 0.3)})`;
        g.lineWidth = rrnd(0.8, Math.max(1.2, r * 0.006));
        g.beginPath();
        g.moveTo(rrnd(-width, width) * 0.75, y);
        g.lineTo(rrnd(-width, width) * 0.75, y + rrnd(-r * 0.08, r * 0.08));
        g.stroke();
      }
    }

    if(type === 'ocean' || type === 'water' || type === 'ice'){
      const clouds = type === 'ice' ? 90 : 115;
      for(let i = 0; i < clouds; i++){
        const y = rrnd(-r * 0.78, r * 0.78);
        const width = r * Math.sqrt(Math.max(0, 1 - (y / r) * (y / r)));
        fillEllipse(rrnd(-width, width), y, rrnd(r * 0.05, r * 0.18), rrnd(r * 0.006, r * 0.022), rrnd(-0.18, 0.18), 'rgba(255,255,255,0.55)', rrnd(0.12, 0.34));
      }
    }

    if(type === 'industrial'){
      for(let i = 0; i < 200; i++){
        const a = rrnd(0, Math.PI * 2);
        const d = r * Math.sqrt(rng()) * 0.82;
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        if(x > r * 0.18) continue;
        g.fillStyle = rng() < 0.22 ? 'rgba(255,238,176,0.9)' : 'rgba(255,172,92,0.62)';
        const size = rrnd(0.8, Math.max(1.1, r * 0.008));
        g.fillRect(x, y, size, size);
        if(rng() < 0.22){
          g.globalAlpha = 0.28;
          g.fillRect(x + size * 1.5, y, size * 2.5, size * 0.8);
          g.globalAlpha = 1;
        }
      }
    }
  }

  const speckles = Math.min(1700, Math.floor(r * 5.5));
  for(let i = 0; i < speckles; i++){
    const a = rrnd(0, Math.PI * 2);
    const d = r * Math.sqrt(rng());
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    const alpha = type === 'gas' ? rrnd(0.025, 0.07) : rrnd(0.035, 0.12);
    g.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    g.fillRect(x, y, 1, 1);
  }

  const highlight = g.createRadialGradient(-r * 0.48, -r * 0.5, r * 0.05, -r * 0.16, -r * 0.18, r * 0.9);
  highlight.addColorStop(0, 'rgba(255,255,255,0.22)');
  highlight.addColorStop(0.36, 'rgba(255,255,255,0.08)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = highlight;
  sphere();
  g.fill();

  const term = g.createRadialGradient(-r * 0.48, -r * 0.48, r * 0.48, r * 0.18, r * 0.2, r * 1.24);
  term.addColorStop(0, 'rgba(0,0,0,0)');
  term.addColorStop(0.54, 'rgba(0,0,0,0.08)');
  term.addColorStop(1, 'rgba(0,0,0,0.7)');
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = term;
  sphere();
  g.fill();
  g.globalCompositeOperation = 'source-over';

  g.restore();

  g.save();
  g.translate(r, r);
  const rim = g.createRadialGradient(0, 0, r * 0.84, 0, 0, r * 1.08);
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(0.72, 'rgba(255,255,255,0)');
  rim.addColorStop(1, palette.atmosphere);
  g.fillStyle = rim;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = Math.max(1, r * 0.012);
  g.beginPath();
  g.arc(0, 0, r - g.lineWidth * 0.5, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  return c;
}

function bakeStarTexture(opts = {}) {
  const r = Math.max(48, opts.r || 96);
  const hue = typeof opts.hue === 'number' ? opts.hue : 210;
  const seed = (opts.seed >>> 0) || 1;
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const hsl = (h, sat, light, alpha = 1) => `hsla(${Math.round((h % 360 + 360) % 360)},${Math.round(sat)}%,${Math.round(light)}%,${alpha})`;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const cx = r, cy = r;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
  ctx.clip();

  const body = ctx.createRadialGradient(cx - r * 0.34, cy - r * 0.38, r * 0.05, cx, cy, r);
  body.addColorStop(0, hsl(hue + 12, 100, 96));
  body.addColorStop(0.18, hsl(hue + 8, 96, 78));
  body.addColorStop(0.58, hsl(hue, 90, 56));
  body.addColorStop(1, hsl(hue - 12, 86, 32));
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.globalCompositeOperation = 'screen';
  for(let i = 0; i < 120; i++){
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r * 0.72;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const cellR = r * (0.035 + rnd() * 0.12);
    const g = ctx.createRadialGradient(x, y, 0, x, y, cellR);
    g.addColorStop(0, hsl(hue + rnd() * 26 - 10, 100, 82 + rnd() * 12, 0.42));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, cellR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'multiply';
  for(let i = 0; i < 8; i++){
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r * 0.62;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const spotR = r * (0.01 + rnd() * 0.032);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    ctx.scale(1.2 + rnd() * 1.2, 0.65 + rnd() * 0.42);
    const spot = ctx.createRadialGradient(0, 0, spotR * 0.1, 0, 0, spotR);
    spot.addColorStop(0, `rgba(78,24,12,${0.07 + rnd() * 0.08})`);
    spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(0, 0, spotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  for(let i = 0; i < 24; i++){
    const a = rnd() * Math.PI * 2;
    const d = r * (0.18 + rnd() * 0.58);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const len = r * (0.05 + rnd() * 0.18);
    const tangent = a + Math.PI * 0.5 + (rnd() - 0.5) * 0.7;
    ctx.strokeStyle = hsl(hue + 18, 100, 88, 0.22 + rnd() * 0.18);
    ctx.lineWidth = Math.max(0.7, r * (0.008 + rnd() * 0.014));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + Math.cos(tangent) * len * 0.45,
      y + Math.sin(tangent) * len * 0.45,
      x + Math.cos(tangent + 0.5) * len * 0.75,
      y + Math.sin(tangent + 0.5) * len * 0.75,
      x + Math.cos(tangent + 0.2) * len,
      y + Math.sin(tangent + 0.2) * len
    );
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'source-over';
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for(let y = 0; y < c.height; y++){
    for(let x = 0; x < c.width; x++){
      const i = (y * c.width + x) * 4;
      const a = img.data[i + 3];
      if(a === 0) continue;
      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const limb = Math.max(0, (dist - 0.58) / 0.4);
      const convection = (Math.sin((nx * 22 + seed * 0.0007)) + Math.sin((ny * 28 - seed * 0.0005))) * 4;
      const grain = rnd() * 18 - 9;
      const delta = convection + grain - limb * 38;
      img.data[i] = clamp(img.data[i] + delta, 0, 255);
      img.data[i + 1] = clamp(img.data[i + 1] + delta * 0.88, 0, 255);
      img.data[i + 2] = clamp(img.data[i + 2] + delta * 0.65, 0, 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  ctx.restore();

  ctx.strokeStyle = hsl(hue + 12, 100, 88, 0.1);
  ctx.lineWidth = Math.max(1, r * 0.012);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.955, 0, Math.PI * 2);
  ctx.stroke();

  return c;
}

// Make a rocky, irregular asteroid sprite. Options:
// - r: radius
// - seed: deterministic shape
// - hue/sat/bri: optional color tuning
function bakeAsteroidTexture(opts = {}){
  const r = Math.max(8, opts.r || 20);
  const seed = (opts.seed >>> 0) || Math.floor(Math.random() * 0xffffffff);
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(r * 2);
  const ctx = c.getContext('2d');
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const cx = r, cy = r;
  const pointCount = 24 + (seed % 10);
  const baseR = r * (0.78 + rnd() * 0.07);
  const rough = 0.12 + rnd() * 0.08;
  const phaseA = rnd() * Math.PI * 2;
  const phaseB = rnd() * Math.PI * 2;
  const points = [];
  for(let i=0;i<pointCount;i++){
    const t = (i / pointCount) * Math.PI * 2;
    const ridges = Math.sin(t * 3 + phaseA) * 0.055 + Math.sin(t * 7 + phaseB) * 0.03;
    const chipped = (rnd() - 0.5) * rough;
    const rr = Math.max(r * 0.58, Math.min(r * 0.96, baseR * (1 + ridges + chipped)));
    points.push({ x: cx + Math.cos(t) * rr, y: cy + Math.sin(t) * rr, t });
  }
  const traceShape = () => {
    ctx.beginPath();
    for(let i=0;i<points.length;i++){
      const p = points[i];
      if(i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  };

  const hue = typeof opts.hue === 'number' ? opts.hue : 26 + (seed % 24); // warm gray range
  const sat = typeof opts.sat === 'number' ? opts.sat : 10 + (seed % 10);
  const bri = typeof opts.bri === 'number' ? opts.bri : 34 + (seed % 14);

  ctx.save();
  traceShape();
  ctx.clip();

  const body = ctx.createLinearGradient(cx - r * 0.72, cy - r * 0.82, cx + r * 0.82, cy + r * 0.9);
  body.addColorStop(0, `hsl(${hue}, ${sat + 4}%, ${Math.min(78, bri + 24)}%)`);
  body.addColorStop(0.48, `hsl(${hue}, ${sat}%, ${bri}%)`);
  body.addColorStop(1, `hsl(${hue + 4}, ${Math.max(6, sat - 3)}%, ${Math.max(8, bri - 22)}%)`);
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, c.width, c.height);

  for(let i=0;i<points.length;i+=2){
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const midX = (p0.x + p1.x) * 0.5;
    const midY = (p0.y + p1.y) * 0.5;
    const shade = ((cx - midX) * 0.65 + (cy - midY)) / (r * 1.65);
    const innerX = cx + (midX - cx) * (0.24 + rnd() * 0.18);
    const innerY = cy + (midY - cy) * (0.24 + rnd() * 0.18);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(innerX, innerY);
    ctx.closePath();
    if(shade > 0){
      ctx.fillStyle = `rgba(255,244,220,${0.035 + Math.min(0.13, shade * 0.14)})`;
    } else {
      ctx.fillStyle = `rgba(0,0,0,${0.045 + Math.min(0.18, -shade * 0.2)})`;
    }
    ctx.fill();
  }

  const craterCount = Math.max(3, Math.min(9, Math.floor(r / 7) + 3));
  for(let i=0;i<craterCount;i++){
    const ang = rnd() * Math.PI * 2;
    const dist = Math.sqrt(rnd()) * r * 0.58;
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    const cr = r * (0.075 + rnd() * 0.12);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    ctx.scale(1, 0.52 + rnd() * 0.34);
    const pit = ctx.createRadialGradient(-cr * 0.18, -cr * 0.18, cr * 0.1, 0, 0, cr);
    pit.addColorStop(0, `hsla(${hue}, ${sat}%, ${Math.max(6, bri - 30)}%, 0.64)`);
    pit.addColorStop(0.65, `hsla(${hue}, ${sat}%, ${Math.max(8, bri - 22)}%, 0.42)`);
    pit.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pit;
    ctx.beginPath();
    ctx.arc(0, 0, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(0.7, r * 0.018);
    ctx.strokeStyle = 'rgba(255,245,220,0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, cr * 0.9, Math.PI * 1.08, Math.PI * 1.72);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, cr * 0.95, -0.1, Math.PI * 0.86);
    ctx.stroke();
    ctx.restore();
  }

  const crackCount = 3 + (seed % 4);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for(let i=0;i<crackCount;i++){
    const startA = rnd() * Math.PI * 2;
    let x = cx + Math.cos(startA) * r * (0.12 + rnd() * 0.38);
    let y = cy + Math.sin(startA) * r * (0.12 + rnd() * 0.38);
    let dir = startA + (rnd() - 0.5) * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segments = 2 + Math.floor(rnd() * 3);
    for(let j=0;j<segments;j++){
      dir += (rnd() - 0.5) * 0.85;
      const len = r * (0.09 + rnd() * 0.11);
      x += Math.cos(dir) * len;
      y += Math.sin(dir) * len;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(20,16,14,${0.22 + rnd() * 0.2})`;
    ctx.lineWidth = Math.max(0.65, r * (0.014 + rnd() * 0.014));
    ctx.stroke();
  }

  const img = ctx.getImageData(0,0,c.width,c.height);
  for(let y=0;y<c.height;y++){
    for(let x=0;x<c.width;x++){
      const i = (y * c.width + x) * 4;
      const a = img.data[i+3];
      if(a === 0) continue;
      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const rim = Math.max(0, (dist - 0.66) / 0.34);
      const light = (-nx * 0.66 - ny) * 18;
      const grit = rnd() * 26 - 13;
      const fleck = rnd() < 0.018 ? -(10 + rnd() * 26) : (rnd() < 0.012 ? 8 + rnd() * 20 : 0);
      const delta = light - rim * 38 + grit + fleck;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + delta));
      img.data[i+1] = Math.max(0, Math.min(255, img.data[i+1] + delta));
      img.data[i+2] = Math.max(0, Math.min(255, img.data[i+2] + delta));
    }
  }
  ctx.putImageData(img,0,0);

  ctx.restore();

  ctx.save();
  ctx.translate(r * 0.03, r * 0.04);
  traceShape();
  ctx.strokeStyle = 'rgba(0,0,0,0.36)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
  ctx.restore();

  traceShape();
  ctx.strokeStyle = 'rgba(255,248,230,0.12)';
  ctx.lineWidth = Math.max(0.7, r * 0.028);
  ctx.stroke();
  return c;
}

const planetSpriteAliases = {
  water: 'ocean',
  water_world: 'ocean',
  oceanic: 'ocean',
  ice_world: 'ice',
  lava_world: 'lava',
  volcanic: 'lava',
  gas_world: 'gas',
  gas_giant: 'gas',
  industrial_world: 'industrial',
  urban_industrial: 'industrial',
  rocky_world: 'rocky',
  terrestrial_barren: 'rocky',
  desert_world: 'rocky',
  arid_terrestrial: 'rocky'
};

const planetSpriteSources = {
  gas: 'assets/planets/gas_planet.png',
  ice: 'assets/planets/ice_planet.png',
  industrial: 'assets/planets/industrial_planet.png',
  lava: 'assets/planets/lava_planet.png',
  rocky: 'assets/planets/rocky_planet.png',
  ocean: 'assets/planets/water_planet.png'
};

const starSpriteAliases = {
  blue_star: 'blue',
  yellow_star: 'yellow',
  white_star: 'white',
  red_star: 'red'
};

const starSpriteSources = {
  blue: 'assets/stars/blue_star.png',
  yellow: 'assets/stars/yellow_star.png',
  white: 'assets/stars/white_star.png',
  red: 'assets/stars/red_star.png'
};

const imageSources = {
  startScreen: 'assets/backgrounds/StarHauler_Startscreen.png',
  playerIdleSprites: spriteSheets.player.idle.src,
  ship: () => bakeShipTexture('#0f0'),
  traderShip: () => bakeShipTexture('#09f'),
  pirateShip: 'assets/ships/pirate_ship1.png',
  blackhole: 'assets/blackholes/6c1285f805b9f3fc63718b68f52b2454c5824cbcedf21fb8a291406c636a214a.png',
  planet: bakePlanetTexture,
  star: () => bakeStarTexture({ hue: 210, seed: 1 }),
  asteroid: () => bakeAsteroidTexture({ r: 20 })
};

const optionalImageSources = Object.fromEntries(
  [
    ...Object.entries(planetSpriteSources).map(([type, src]) => [`planetSprite:${type}`, src]),
    ...Object.entries(starSpriteSources).map(([type, src]) => [`starSprite:${type}`, src])
  ]
);

function loadImage(key, src, onProgress, options = {}) {
  const optional = options.optional === true;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      images[key] = img;
      if (onProgress) onProgress();
      resolve(img);
    };
    img.onerror = () => {
      if (optional) {
        if (onProgress) onProgress();
        resolve(null);
        return;
      }
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
}

export async function loadAll(progressCallback) {
  const requiredEntries = Object.entries(imageSources);
  const optionalEntries = Object.entries(optionalImageSources);
  let loaded = 0;
  const total = requiredEntries.length + optionalEntries.length;
  const update = () => {
    loaded++;
    if (progressCallback) progressCallback(loaded / total);
  };
  const promises = requiredEntries.map(([key, src]) => {
    if (typeof src === 'string') {
      return loadImage(key, src, update);
    }
    const img = src();
    images[key] = img;
    update();
    return Promise.resolve(img);
  }).concat(optionalEntries.map(([key, src]) => loadImage(key, src, update, { optional: true })));
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

export function getSpriteSheet(entity, stateName = 'idle') {
  return spriteSheets?.[entity]?.[stateName] || null;
}

export function getSpriteArea(entity, areaName) {
  return spriteSheets?.[entity]?.areas?.[areaName] || null;
}

export function getDirectionalFrameIndex(angle = 0, sheet = spriteSheets.player.idle) {
  const frameCount = sheet?.frames || 8;
  const step = (Math.PI * 2) / frameCount;
  const northAligned = angle + Math.PI / 2;
  return ((Math.round(northAligned / step) % frameCount) + frameCount) % frameCount;
}

export function getDirectionalFrameAngle(frame = 0, sheet = spriteSheets.player.idle) {
  const frameCount = sheet?.frames || 8;
  const step = (Math.PI * 2) / frameCount;
  return -Math.PI / 2 + frame * step;
}

// Build a cache key for planet textures
function planetKey(opts = {}) {
  const r = opts.r || 40;
  const hue = typeof opts.hue === 'number' ? Math.floor(opts.hue) : 'rand';
  const seed = typeof opts.noiseSeed === 'number' ? (opts.noiseSeed >>> 0) : 'rand';
  const type = (opts.type || 'any').toString();
  const dpr = Math.max(1, Math.min(opts.dpr || getDevicePixelRatio(), 2));
  return `planet:h${hue}:s${seed}:r${r}:t${type}:d${dpr}`;
}

function canonicalPlanetType(type) {
  const raw = String(type || '').toLowerCase();
  return planetSpriteAliases[raw] || raw;
}

function planetSpriteKey(opts = {}) {
  const type = canonicalPlanetType(opts.type);
  const r = opts.r || 40;
  const dpr = Math.max(1, Math.min(opts.dpr || getDevicePixelRatio(), 2));
  return `planetSpriteTexture:${type}:r${r}:d${dpr}`;
}

const planetSpriteCropCache = new WeakMap();

function planetSpriteCrop(img) {
  if (planetSpriteCropCache.has(img)) return planetSpriteCropCache.get(img);
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const fallback = {
    sx: Math.max(0, (iw - Math.min(iw, ih)) * 0.5),
    sy: Math.max(0, (ih - Math.min(iw, ih)) * 0.5),
    crop: Math.min(iw, ih)
  };

  try {
    const probe = document.createElement('canvas');
    probe.width = iw;
    probe.height = ih;
    const pctx = probe.getContext('2d');
    pctx.drawImage(img, 0, 0);
    const data = pctx.getImageData(0, 0, iw, ih).data;
    let minX = iw;
    let minY = ih;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < ih; y++) {
      for (let x = 0; x < iw; x++) {
        if (data[(y * iw + x) * 4 + 3] <= 8) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) {
      planetSpriteCropCache.set(img, fallback);
      return fallback;
    }
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const crop = Math.min(Math.max(boxW, boxH), iw, ih);
    let sx = minX - (crop - boxW) * 0.5;
    let sy = minY - (crop - boxH) * 0.5;
    sx = Math.max(0, Math.min(iw - crop, sx));
    sy = Math.max(0, Math.min(ih - crop, sy));
    const result = { sx, sy, crop };
    planetSpriteCropCache.set(img, result);
    return result;
  } catch {
    planetSpriteCropCache.set(img, fallback);
    return fallback;
  }
}

function bakePlanetSpriteTexture(img, opts = {}) {
  const dpr = Math.max(1, Math.min(opts.dpr || getDevicePixelRatio(), 2));
  const rCss = Math.max(8, opts.r || 40);
  const size = Math.max(16, Math.round(rCss * 2 * dpr));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  try { ctx.imageSmoothingQuality = 'high'; } catch {}

  const { sx, sy, crop } = planetSpriteCrop(img);

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, sx, sy, crop, crop, 0, 0, size, size);
  ctx.restore();

  const shade = ctx.createRadialGradient(size * 0.32, size * 0.28, size * 0.08, size * 0.55, size * 0.55, size * 0.62);
  shade.addColorStop(0, 'rgba(255,255,255,0.08)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return c;
}

function getPlanetSpriteTexture(opts = {}) {
  const type = canonicalPlanetType(opts.type);
  if (!type || !planetSpriteSources[type]) return null;
  const img = images[`planetSprite:${type}`];
  if (!img) return null;
  const key = planetSpriteKey({ ...opts, type });
  if (!images[key]) {
    images[key] = bakePlanetSpriteTexture(img, { ...opts, type });
  }
  return images[key];
}

function bakeStarSpriteTexture(img, opts = {}) {
  const dpr = Math.max(1, Math.min(opts.dpr || 1, 2));
  const rCss = Math.max(48, opts.r || 96);
  const size = Math.max(16, Math.round(rCss * 2 * dpr));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  try { ctx.imageSmoothingQuality = 'high'; } catch {}

  const { sx, sy, crop } = planetSpriteCrop(img);
  ctx.drawImage(img, sx, sy, crop, crop, 0, 0, size, size);
  return c;
}

// Get (and cache) a planet texture for provided params
export function getPlanetTexture(opts = {}) {
  const spriteTexture = getPlanetSpriteTexture(opts);
  if (spriteTexture) return spriteTexture;
  // If no options specified, reuse the default baked 'planet' image
  const hasOpts = typeof opts.hue === 'number' || typeof opts.noiseSeed === 'number' || typeof opts.r === 'number' || typeof opts.type === 'string';
  if (!hasOpts) return images['planet'];
  const key = planetKey(opts);
  if (!images[key]) {
    images[key] = bakePlanetTexture(opts);
  }
  return images[key];
}

const STAR_CACHE_MAX = 128;
const starLRU = [];

function canonicalStarType(type) {
  const raw = String(type || '').toLowerCase();
  return starSpriteAliases[raw] || raw;
}

function starTypeForHue(hue = 210) {
  const h = ((hue % 360) + 360) % 360;
  if (h >= 185 && h <= 255) return 'blue';
  if (h >= 150 && h < 185) return 'white';
  if (h >= 28 && h < 150) return 'yellow';
  return 'red';
}

function starKey(opts = {}){
  const hue = typeof opts.hue === 'number' ? Math.round(opts.hue / 6) * 6 : 210;
  const seed = typeof opts.seed === 'number' ? ((opts.seed >>> 0) & 0x3FF) : 1;
  const spriteType = canonicalStarType(opts.type || starTypeForHue(hue));
  return starSpriteSources[spriteType] ? `starSpriteTexture:${spriteType}` : `star:h${hue}:s${seed}`;
}

function evictStarIfNeeded(){
  while(starLRU.length > STAR_CACHE_MAX){
    const oldKey = starLRU.shift();
    if(oldKey && images[oldKey]) delete images[oldKey];
  }
}

export function getStarTexture(opts = {}){
  const key = starKey(opts);
  if(!images[key]){
    const hue = typeof opts.hue === 'number' ? Math.round(opts.hue / 6) * 6 : 210;
    const seed = typeof opts.seed === 'number' ? ((opts.seed >>> 0) & 0x3FF) : 1;
    const spriteType = canonicalStarType(opts.type || starTypeForHue(hue));
    const sprite = images[`starSprite:${spriteType}`];
    images[key] = sprite ? bakeStarSpriteTexture(sprite) : bakeStarTexture({ hue, seed });
    starLRU.push(key);
    evictStarIfNeeded();
  } else {
    const idx = starLRU.indexOf(key);
    if(idx !== -1) starLRU.splice(idx, 1);
    starLRU.push(key);
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
