// Procedural parallax starfield with nebulas, galaxies, and flickering stars
// Renders to #bg and runs independently of the game loop

const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d', { alpha: true });
ctx.imageSmoothingEnabled = true;
try { ctx.imageSmoothingQuality = 'high'; } catch {}

// Scene configuration
const CONFIG = {
  starLayers: [
    { count: 120, speed: 2, size: [0.7, 1.2], flicker: [0.08, 0.18], color: [220, 235, 255] }, // far
    { count: 240, speed: 6, size: [0.9, 1.6], flicker: [0.10, 0.22], color: [210, 230, 255] }, // mid
    { count: 420, speed: 12, size: [1.0, 2.2], flicker: [0.12, 0.26], color: [200, 225, 255] }, // near
  ],
  nebulas: 3,
  galaxies: 2,
  driftDir: { x: 0.035, y: 0.01 }, // base drift direction (normalized-ish)
  mouseParallax: 22,               // px influence from pointer
  wrapPadding: 24,                 // px padding for wrap around
  bgColor: '#05070e',
};

const state = {
  w: 0,
  h: 0,
  t0: performance.now(),
  pointer: { x: 0, y: 0, tx: 0, ty: 0 },
  stars: [],
  nebulaSprites: [],
  galaxySprites: [],
};

function rand(min, max) { return min + Math.random() * (max - min); }
function choose(arr) { return arr[(Math.random() * arr.length) | 0]; }

function resize() {
  const { innerWidth: ww, innerHeight: hh } = window;
  const w = Math.max(ww, 1);
  const h = Math.max(hh, 1);
  state.w = w;
  state.h = h;
  canvas.width = Math.floor(w * DPR);
  canvas.height = Math.floor(h * DPR);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  try { ctx.imageSmoothingQuality = 'high'; } catch {}
}

// Simplex noise (2D), small implementation (public domain derivative)
// Based on Stefan Gustavson's Simplex noise
function makeSimplex(seed = Math.random() * 65536) {
  const grad3 = new Float32Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
  ]);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let n, q;
  for (let i = 255; i > 0; i--) {
    n = (Math.sin(seed + i) * 43758.5453) % 1; if (n < 0) n += 1;
    q = (n * (i + 1)) | 0; const t = p[i]; p[i] = p[q]; p[q] = t;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  function noise2D(xin, yin) {
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255; const jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = permMod12[ii + perm[jj]] * 3;
      t0 *= t0; n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = permMod12[ii + i1 + perm[jj + j1]] * 3;
      t1 *= t1; n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = permMod12[ii + 1 + perm[jj + 1]] * 3;
      t2 *= t2; n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }
  return { noise2D };
}

const simplex = makeSimplex();

function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (simplex.noise2D(x * freq, y * freq) * 0.5 + 0.5);
    freq *= lacunarity; amp *= gain;
  }
  return sum;
}

function makeNebulaSprite(size = 768) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  try { g.imageSmoothingQuality = 'high'; } catch {}
  const img = g.createImageData(size, size);
  // Random palette between blue/pink/teal variants
  const palettes = [
    [ [40, 60, 120], [120, 60, 160], [255, 140, 200] ],
    [ [10, 80, 120], [40, 140, 160], [140, 240, 255] ],
    [ [30, 10, 60], [80, 20, 120], [180, 80, 220] ],
  ];
  const pal = choose(palettes);
  const scale = rand(0.6, 1.1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size - 0.5) * scale;
      const v = (y / size - 0.5) * scale;
      const r = Math.sqrt(u * u + v * v);
      const n = fbm(u * 2.5, v * 2.5, 5, 2.0, 0.55);
      // Vignette falloff to fade edges
      const falloff = Math.max(0, 1 - r * 1.8);
      let m = Math.pow(n, 1.8) * falloff;
      const t = Math.min(1, Math.max(0, (n * 1.3 - 0.25)));
      const c0 = pal[0], c1 = pal[1], c2 = pal[2];
      const rC = c0[0] * (1 - t) + c1[0] * t;
      const gC = c0[1] * (1 - t) + c1[1] * t;
      const bC = c0[2] * (1 - t) + c1[2] * t;
      const rr = rC * (0.6 + 0.4 * t) + c2[0] * (t * t * 0.2);
      const gg = gC * (0.6 + 0.4 * t) + c2[1] * (t * t * 0.2);
      const bb = bC * (0.6 + 0.4 * t) + c2[2] * (t * t * 0.2);
      const idx = (y * size + x) * 4;
      img.data[idx] = rr | 0;
      img.data[idx + 1] = gg | 0;
      img.data[idx + 2] = bb | 0;
      img.data[idx + 3] = (Math.min(255, Math.max(0, m * 235))) | 0;
    }
  }
  g.putImageData(img, 0, 0);
  // Keep sprite pre-multiplied look without additive self-blend to avoid grid artifacts
  g.globalCompositeOperation = 'source-over';
  return c;
}

function makeGalaxySprite(size = 640) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d');
  // Core glow
  const grad = g.createRadialGradient(size/2, size/2, 2, size/2, size/2, size/2);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.15, 'rgba(255,230,200,0.6)');
  grad.addColorStop(0.35, 'rgba(180,160,255,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0,0,size,size);
  // Dust arms: scatter faint stars along two spiraled arcs
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,255,255,0.28)';
  const cx = size/2, cy = size/2;
  for (let arm = 0; arm < 2; arm++) {
    const dir = arm === 0 ? 1 : -1;
    for (let i = 0; i < 1400; i++) {
      const t = i / 1400 * 6.0 * Math.PI;
      const r = (t / (6*Math.PI)) * (size * 0.45) + rand(-3, 3);
      const ang = t * 0.8 * dir + arm * Math.PI;
      const x = cx + Math.cos(ang) * r + rand(-2, 2);
      const y = cy + Math.sin(ang) * r + rand(-2, 2);
      const a = Math.max(0, 0.18 - (r / (size * 0.7)) * 0.18) * rand(0.6, 1.0);
      g.globalAlpha = a;
      g.fillRect(x, y, 1, 1);
    }
  }
  g.globalAlpha = 1;
  return c;
}

function initStars(w, h) {
  state.stars = CONFIG.starLayers.map(layer => {
    const arr = new Array(layer.count);
    for (let i = 0; i < layer.count; i++) {
      arr[i] = {
        x: Math.random() * (w + CONFIG.wrapPadding*2) - CONFIG.wrapPadding,
        y: Math.random() * (h + CONFIG.wrapPadding*2) - CONFIG.wrapPadding,
        r: rand(layer.size[0], layer.size[1]),
        hue: layer.color[0] + rand(-15, 10),
        sat: 20 + Math.random() * 30,
        bri: 70 + Math.random() * 30,
        baseA: rand(0.6, 1.0),
        fFreq: rand(layer.flicker[0], layer.flicker[1]),
        fPhase: Math.random() * Math.PI * 2,
        vx: (CONFIG.driftDir.x + rand(-0.02, 0.02)) * layer.speed,
        vy: (CONFIG.driftDir.y + rand(-0.02, 0.02)) * layer.speed,
      };
    }
    return { meta: layer, stars: arr };
  });
}

function initSprites() {
  state.nebulaSprites = [];
  for (let i = 0; i < CONFIG.nebulas; i++) {
    const s = makeNebulaSprite(640 + ((i%2)*128));
    const k = 0.2 + i * 0.08; // depth factor
    state.nebulaSprites.push({
      img: s,
      x: Math.random() * state.w - state.w*0.5,
      y: Math.random() * state.h - state.h*0.5,
      scale: rand(0.8, 1.6),
      vx: CONFIG.driftDir.x * (6 * k),
      vy: CONFIG.driftDir.y * (6 * k),
      depth: k,
      rot: rand(-0.05, 0.05),
      a: rand(0.28, 0.5)
    });
  }
  state.galaxySprites = [];
  for (let i = 0; i < CONFIG.galaxies; i++) {
    const s = makeGalaxySprite(560 + ((i%2)*120));
    const k = 0.1 + i * 0.05;
    state.galaxySprites.push({
      img: s,
      x: Math.random() * state.w - state.w*0.5,
      y: Math.random() * state.h - state.h*0.5,
      scale: rand(0.6, 1.2),
      vx: CONFIG.driftDir.x * (2 * k),
      vy: CONFIG.driftDir.y * (2 * k),
      depth: k,
      rot: rand(-0.01, 0.01),
      a: rand(0.25, 0.4)
    });
  }
}

function wrapSprite(s) {
  const pad = Math.max(s.img.width, s.img.height) * s.scale * 0.5;
  const W = state.w + pad*2, H = state.h + pad*2;
  if (s.x > state.w + pad) s.x -= W;
  if (s.x < -pad) s.x += W;
  if (s.y > state.h + pad) s.y -= H;
  if (s.y < -pad) s.y += H;
}

function update(dt, t) {
  // Ease pointer towards target for smooth parallax
  const p = state.pointer;
  p.x += (p.tx - p.x) * Math.min(1, dt * 6);
  p.y += (p.ty - p.y) * Math.min(1, dt * 6);

  // Move stars
  const W = state.w + CONFIG.wrapPadding * 2;
  const H = state.h + CONFIG.wrapPadding * 2;
  for (const layer of state.stars) {
    const arr = layer.stars; const vx = layer.meta.speed * CONFIG.driftDir.x;
    const vy = layer.meta.speed * CONFIG.driftDir.y;
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      s.x += s.vx * dt * 10; s.y += s.vy * dt * 10;
      if (s.x > state.w + CONFIG.wrapPadding) s.x -= W;
      if (s.x < -CONFIG.wrapPadding) s.x += W;
      if (s.y > state.h + CONFIG.wrapPadding) s.y -= H;
      if (s.y < -CONFIG.wrapPadding) s.y += H;
    }
  }

  // Move nebulas/galaxies slower for depth
  for (const s of state.nebulaSprites) { s.x += s.vx * dt * 6; s.y += s.vy * dt * 6; wrapSprite(s); }
  for (const s of state.galaxySprites) { s.x += s.vx * dt * 4; s.y += s.vy * dt * 4; wrapSprite(s); }
}

function draw(t) {
  ctx.clearRect(0, 0, state.w, state.h);
  // Space background
  ctx.fillStyle = CONFIG.bgColor; ctx.fillRect(0, 0, state.w, state.h);

  // Subtle vignette
  const g = ctx.createRadialGradient(state.w*0.5, state.h*0.4, Math.min(state.w,state.h)*0.2,
                                     state.w*0.5, state.h*0.5, Math.max(state.w,state.h)*0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0,0,state.w,state.h);

  const px = (state.pointer.x - state.w/2) / state.w; // -0.5..0.5
  const py = (state.pointer.y - state.h/2) / state.h;
  const parX = -px * CONFIG.mouseParallax;
  const parY = -py * CONFIG.mouseParallax;

  // Far sprites first, use screen blending for smoother integration
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const s of state.galaxySprites) {
    const hw = (s.img.width * s.scale) / 2;
    const hh = (s.img.height * s.scale) / 2;
    ctx.globalAlpha = s.a;
    ctx.save();
    ctx.translate(s.x + parX * s.depth, s.y + parY * s.depth);
    ctx.rotate(s.rot);
    ctx.drawImage(s.img, -hw, -hh, hw*2, hh*2);
    ctx.restore();
  }

  for (const s of state.nebulaSprites) {
    const hw = (s.img.width * s.scale) / 2;
    const hh = (s.img.height * s.scale) / 2;
    ctx.globalAlpha = s.a;
    ctx.save();
    ctx.translate(s.x + parX * s.depth, s.y + parY * s.depth);
    ctx.rotate(s.rot * 0.1);
    ctx.drawImage(s.img, -hw, -hh, hw*2, hh*2);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // Stars by layers (far to near), apply flicker
  for (const layer of state.stars) {
    const depth = layer.meta.speed / CONFIG.starLayers[CONFIG.starLayers.length - 1].speed; // 0..1
    for (let i = 0; i < layer.stars.length; i++) {
      const s = layer.stars[i];
      const a = s.baseA * (0.8 + 0.2 * Math.sin(t * s.fFreq + s.fPhase))
              * (0.9 + 0.1 * Math.sin((t * 0.25 + s.fPhase) * 0.7));
      ctx.fillStyle = `hsla(${s.hue}, ${s.sat}%, ${s.bri}%, ${a})`;
      const dx = s.x + parX * depth;
      const dy = s.y + parY * depth;
      // Sub-pixel bloom: draw small rect then a glow dot
      ctx.fillRect(dx, dy, 1, 1);
      if (s.r > 1.2) {
        ctx.beginPath();
        ctx.arc(dx, dy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.globalCompositeOperation = 'source-over';
}

function loop(now) {
  const t = (now - state.t0) / 1000;
  const dt = Math.min(0.05, Math.max(0.001, t - (state.t || 0)));
  state.t = t;
  update(dt, t);
  draw(t);
  requestAnimationFrame(loop);
}

function onPointer(e) {
  let x, y;
  if (e.touches && e.touches.length) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
  else { x = e.clientX; y = e.clientY; }
  state.pointer.tx = x; state.pointer.ty = y;
}

// Init
resize();
initStars(state.w, state.h);
initSprites();
window.addEventListener('resize', () => { resize(); initStars(state.w, state.h); });
window.addEventListener('mousemove', onPointer);
window.addEventListener('touchmove', onPointer, { passive: true });
requestAnimationFrame(loop);
