function isVisible(cam, obj){
  return (
    obj.x + obj.r > cam.x &&
    obj.x - obj.r < cam.x + cam.w &&
    obj.y + obj.r > cam.y &&
    obj.y - obj.r < cam.y + cam.h
  );
}

import { WORLD, CFG, GRAVITY } from '../core/config.js';
import { toast } from '../ui/toast.js';
import { makePirate } from '../entities/npc.js';
import { getImage, getPlanetTexture, getAsteroidTexture, getStarTexture, getSpriteSheet, getSpriteArea, getDirectionalFrameIndex, getDirectionalFrameAngle } from '../core/assets.js';
import { spawnAsteroid, makeNebula } from './gen.js';

// --- lightweight VFX helpers ---
function spawnSparks(state, x, y, opts = {}){
  const count = opts.count ?? 10;
  const color = opts.color ?? '#ffd56b';
  const spMin = opts.spMin ?? 0.8;
  const spMax = opts.spMax ?? 2.0;
  const lifeMin = opts.lifeMin ?? 12;
  const lifeMax = opts.lifeMax ?? 28;
  const maxParticles = opts.maxParticles ?? 500;
  if (!state.particles) state.particles = [];
  const need = Math.min(count, Math.max(0, maxParticles - state.particles.length));
  for(let i=0;i<need;i++){
    const ang = Math.random() * Math.PI * 2;
    const spd = spMin + Math.random() * (spMax - spMin);
    const p = (state.particlePool && state.particlePool.acquire) ? state.particlePool.acquire() : {x:0,y:0,vx:0,vy:0,r:1,life:0};
    p.x = x; p.y = y;
    p.vx = Math.cos(ang) * spd;
    p.vy = Math.sin(ang) * spd;
    p.r = 1 + Math.random()*1.2;
    p.life = lifeMin + Math.random() * (lifeMax - lifeMin);
    p.max = p.life;
    p.color = color;
    p.drawLayer = opts.drawLayer || 'world';
    state.particles.push(p);
  }
}

function addShake(state, amt){
  if (!state) return;
  if (typeof state.shakeMag !== 'number') state.shakeMag = 0;
  const cap = 8; // px
  state.shakeMag = Math.min(cap, state.shakeMag + (amt || 0));
}

function acquireBullet(state){
  return state.bulletPool && typeof state.bulletPool.acquire === 'function'
    ? state.bulletPool.acquire()
    : { x:0, y:0, vx:0, vy:0, r:2, life:0 };
}

function releaseBullet(state, bullet){
  if (state.bulletPool && typeof state.bulletPool.release === 'function') {
    state.bulletPool.release(bullet);
  }
}

function gravityConfigFor(kind){
  if (kind === 'planet') {
    return {
      pull: GRAVITY.planetPull || 0,
      falloff: GRAVITY.planetFalloff || 1,
      influence: GRAVITY.planetInfluence || 0,
      maxAccel: GRAVITY.planetMaxAccel || Infinity
    };
  }
  if (kind === 'star') {
    return {
      pull: GRAVITY.starPull || 0,
      falloff: GRAVITY.starFalloff || 1,
      influence: GRAVITY.starInfluence || 0,
      maxAccel: GRAVITY.starMaxAccel || Infinity
    };
  }
  if (kind === 'blackhole') {
    return {
      pull: GRAVITY.blackholePull || 0,
      falloff: GRAVITY.blackholeFalloff || 1,
      influence: GRAVITY.blackholeInfluence || 0,
      maxAccel: GRAVITY.blackholeMaxAccel || Infinity
    };
  }
  return { pull: 0, falloff: 1, influence: 0, maxAccel: 0 };
}

function gravityScaleFor(type){
  if (type === 'ship') return GRAVITY.shipScale ?? 1;
  if (type === 'asteroid') return GRAVITY.asteroidScale ?? 1;
  if (type === 'bullet') return GRAVITY.bulletScale ?? 1;
  return GRAVITY.entityScale ?? 1;
}

function planetInteractionRadius(planet){
  return Math.max(1, planet?.r || 1);
}

function blackHoleHazardRadius(blackhole, ship){
  return Math.max(24, (blackhole?.r || 1) * 1.1 + (ship?.r || 0));
}

function blackHoleCoreRadius(blackhole, ship){
  return Math.max(ship?.r || 12, (blackhole?.r || 1) * 0.45);
}

function gravitySources(state){
  return [
    ...((state.planets || []).map(body => ({ body, kind: 'planet' }))),
    ...((state.stars || []).map(body => ({ body, kind: 'star' }))),
    ...((state.blackholes || []).map(body => ({ body, kind: 'blackhole' })))
  ];
}

function gravityContributionFrom(source, x, y){
  const cfg = gravityConfigFor(source.kind);
  if (!cfg.pull) return { ax: 0, ay: 0, active: false };
  const body = source.body;
  const dx = (body.x || 0) - x;
  const dy = (body.y || 0) - y;
  const d2 = dx*dx + dy*dy;
  const r = body.r || 1;
  const influence = r + (cfg.influence || 0);
  if (influence > 0 && d2 > influence * influence) {
    return { ax: 0, ay: 0, active: false };
  }
  const strength = cfg.pull * r * r;
  const factor = strength / (d2 + cfg.falloff);
  let ax = dx * factor;
  let ay = dy * factor;
  const mag = Math.hypot(ax, ay);
  if (mag > cfg.maxAccel) {
    const k = cfg.maxAccel / mag;
    ax *= k;
    ay *= k;
  }
  return { ax, ay, active: true, kind: source.kind, body };
}

function gravityVectorAt(state, x, y, sources = gravitySources(state)){
  let ax = 0;
  let ay = 0;
  const parts = [];
  for (const source of sources){
    const c = gravityContributionFrom(source, x, y);
    if (!c.active) continue;
    ax += c.ax;
    ay += c.ay;
    parts.push(c);
  }
  return { ax, ay, mag: Math.hypot(ax, ay), parts };
}

function nearestPlanetClearance(state, obj){
  if (!obj || !Array.isArray(state?.planets) || !state.planets.length) return { planet: null, clearance: Infinity, distance: Infinity };
  let best = { planet: null, clearance: Infinity, distance: Infinity };
  for (const planet of state.planets){
    const dx = obj.x - planet.x;
    const dy = obj.y - planet.y;
    const distance = Math.hypot(dx, dy);
    const clearance = distance - planetInteractionRadius(planet);
    if (clearance < best.clearance) best = { planet, clearance, distance };
  }
  return best;
}

function isInsidePlanetHeat(state, obj, margin = 0){
  return nearestPlanetClearance(state, obj).clearance <= margin;
}

function setGameOver(state, cause){
  state.gameOver = true;
  if (!state.gameOverCause) state.gameOverCause = cause || 'unknown';
}

function resolveShipLoss(state, cause){
  const s = state?.ship;
  if (!s) return;
  const lives = Number.isFinite(s.lives) ? s.lives : 1;
  s.lives = Math.max(0, lives - 1);
  if (s.lives <= 0) {
    s.hull = 0;
    setGameOver(state, cause);
    return;
  }
  s.hull = s.hullMax || 100;
}

function steerLocalEnemy(enemy, target, cfg, state, dt, opts = {}){
  enemy.homeX ??= enemy.x;
  enemy.homeY ??= enemy.y;
  enemy.patrolAngle ??= Math.random() * Math.PI * 2;
  enemy.patrolDir ??= Math.random() < 0.5 ? -1 : 1;

  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distToTarget = Math.hypot(dx, dy);
  const homeDx = enemy.homeX - enemy.x;
  const homeDy = enemy.homeY - enemy.y;
  const distFromHome = Math.hypot(homeDx, homeDy);
  const chaseRadius = cfg.chaseRadius || 520;
  const leashRadius = cfg.leashRadius || 760;
  const engaged = !!opts.canAttack && distToTarget < chaseRadius && distFromHome < leashRadius;

  let tx = target.x;
  let ty = target.y;
  let accel = opts.chaseAccel || 0.045;
  let maxSpeed = cfg.speed || 1.8;

  if (!engaged) {
    const returning = distFromHome > leashRadius;
    enemy.patrolAngle += (enemy.patrolDir || 1) * (opts.patrolTurn || 0.006) * dt;
    if (returning) {
      tx = enemy.homeX;
      ty = enemy.homeY;
      accel = opts.returnAccel || 0.06;
      maxSpeed *= 0.85;
    } else {
      const patrolRadius = cfg.patrolRadius || 260;
      tx = enemy.homeX + Math.cos(enemy.patrolAngle) * patrolRadius;
      ty = enemy.homeY + Math.sin(enemy.patrolAngle) * patrolRadius;
      accel = opts.patrolAccel || 0.025;
      maxSpeed *= 0.6;
    }
  }

  const tdx = tx - enemy.x;
  const tdy = ty - enemy.y;
  const td = Math.hypot(tdx, tdy) || 1;
  let ax = (tdx / td) * accel;
  let ay = (tdy / td) * accel;

  if (engaged) {
    const standoffRange = opts.standoffRange || cfg.standoffRange || 140;
    if (distToTarget < standoffRange) {
      const inv = distToTarget > 0 ? 1 / distToTarget : 0;
      const awayX = inv ? -dx * inv : Math.cos(enemy.patrolAngle || 0);
      const awayY = inv ? -dy * inv : Math.sin(enemy.patrolAngle || 0);
      const orbitDir = enemy.patrolDir || 1;
      const tangentX = -awayY * orbitDir;
      const tangentY = awayX * orbitDir;
      const close = Math.max(0, (standoffRange - distToTarget) / standoffRange);
      const push = opts.standoffAccel || cfg.standoffAccel || 0.08;
      const orbit = opts.orbitAccel || cfg.orbitAccel || 0.035;
      ax = awayX * push * close + tangentX * orbit;
      ay = awayY * push * close + tangentY * orbit;
      maxSpeed *= 0.85;
    }
  }

  let nearestD = Infinity; let nx = 0, ny = 0, pr = 0;
  for (const pl of state.planets || []){
    const pdx = enemy.x - pl.x; const pdy = enemy.y - pl.y;
    const d2 = pdx*pdx + pdy*pdy;
    if (d2 < nearestD){ nearestD = d2; nx = pdx; ny = pdy; pr = pl.r; }
  }
  if (nearestD < Infinity){
    const d = Math.max(0.001, Math.sqrt(nearestD));
    const avoidR = pr + (opts.planetAvoidRadius || cfg.planetAvoidRadius || 140);
    if (d < avoidR){
      const k = (avoidR - d) / avoidR;
      const avoidAccel = opts.planetAvoidAccel || cfg.planetAvoidAccel || 0.14;
      ax += (nx / d) * (avoidAccel * k);
      ay += (ny / d) * (avoidAccel * k);
    }
  }

  const edge = 120;
  const edgeAccel = 0.08;
  if (enemy.x < edge) ax += edgeAccel * (1 - enemy.x / edge);
  if (enemy.x > WORLD.w - edge) ax -= edgeAccel * (1 - (WORLD.w - enemy.x) / edge);
  if (enemy.y < edge) ay += edgeAccel * (1 - enemy.y / edge);
  if (enemy.y > WORLD.h - edge) ay -= edgeAccel * (1 - (WORLD.h - enemy.y) / edge);

  enemy.a = Math.atan2(ay, ax);
  enemy.vx = (enemy.vx || 0) + ax * dt;
  enemy.vy = (enemy.vy || 0) + ay * dt;
  if (!engaged) {
    enemy.vx *= 0.996;
    enemy.vy *= 0.996;
  }
  const v = Math.hypot(enemy.vx, enemy.vy);
  if (v > maxSpeed) {
    enemy.vx = (enemy.vx / v) * maxSpeed;
    enemy.vy = (enemy.vy / v) * maxSpeed;
  }

  return { engaged, dx, dy, distToTarget };
}

function wrapWorldEntity(e){
  if (e.x < -e.r) e.x += WORLD.w + e.r * 2;
  if (e.x > WORLD.w + e.r) e.x -= WORLD.w + e.r * 2;
  if (e.y < -e.r) e.y += WORLD.h + e.r * 2;
  if (e.y > WORLD.h + e.r) e.y -= WORLD.h + e.r * 2;
}

function hueNorm(h){
  return Math.round(((h % 360) + 360) % 360);
}

function planetAtmosphereHue(p){
  const type = (p.type || '').toString().toLowerCase();
  if(type === 'ice') return 200;
  if(type === 'lava') return 26;
  if(type === 'industrial') return 190;
  if(type === 'rocky') return 52;
  return hueNorm(typeof p.hue === 'number' ? p.hue : 185);
}

function clamp01(v){
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t){
  return a + (b - a) * t;
}

function makePlanetDepthContext(planets){
  const list = Array.isArray(planets) ? planets : [];
  let maxR = 1;
  for(const p of list){
    maxR = Math.max(maxR, p.r || 1);
  }
  return { planets: list, maxR };
}

function planetScreenEdge(p, cam){
  const x = p.x - cam.x;
  const y = p.y - cam.y;
  const viewCx = cam.w * 0.5;
  const viewCy = cam.h * 0.5;
  const maxScreenD = Math.hypot(cam.w, cam.h) * 0.5 || 1;
  return clamp01(Math.hypot(x - viewCx, y - viewCy) / maxScreenD);
}

function planetApproachClose(p, ship){
  if(!ship) return 0;
  const baseR = p.r || 1;
  const shipD = Math.hypot((ship.x || 0) - p.x, (ship.y || 0) - p.y);
  const surfaceD = Math.max(0, shipD - baseR);
  return 1 - clamp01(surfaceD / 1300);
}

function planetDepthMetrics(p, ship, cam, context = {}){
  const baseR = p.r || 1;
  const x = p.x - cam.x;
  const y = p.y - cam.y;
  const edge = planetScreenEdge(p, cam);
  const close = planetApproachClose(p, ship);
  const planets = context.planets || [];
  let weightedClose = close;
  let weightedEdge = edge;
  let maxClose = close;
  let totalWeight = 1;
  for(const other of planets){
    if(other === p) continue;
    const otherR = other.r || 1;
    const groupReach = Math.max(420, (baseR + otherR) * 3.25);
    const d = Math.hypot(other.x - p.x, other.y - p.y);
    if(d > groupReach) continue;
    const proximity = 1 - d / groupReach;
    const weight = proximity * proximity;
    const otherClose = planetApproachClose(other, ship);
    const otherEdge = planetScreenEdge(other, cam);
    weightedClose += otherClose * weight;
    weightedEdge += otherEdge * weight;
    maxClose = Math.max(maxClose, otherClose);
    totalWeight += weight;
  }

  const sharedClose = weightedClose / totalWeight;
  const groupClose = Math.max(close, sharedClose * 0.55 + maxClose * 0.45);
  const groupBlend = clamp01((totalWeight - 1) * 0.72);
  const groupEdge = lerp(edge, weightedEdge / totalWeight, groupBlend);
  const scale = 1;
  const detailClose = Math.max(close, groupClose * 0.82);
  const detail = Math.max(0.16, Math.min(1, 0.25 + 0.75 * Math.pow(detailClose, 0.8) - 0.18 * groupEdge));
  return {
    x,
    y,
    baseR,
    r: baseR * scale,
    scale,
    close: groupClose,
    detail,
    haze: clamp01(1 - detail),
    edge: groupEdge
  };
}

function drawAnnulus(ctx, inner, outer){
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, Math.PI * 2);
  ctx.arc(0, 0, Math.max(0.1, inner), 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
}

function drawPlanetAura(ctx, p, px, py, time, metrics){
  const r = metrics?.r || p.r || 1;
  const hue = planetAtmosphereHue(p);
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.014 + ((p.texSeed || 0) & 1023) * 0.01);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.shadowBlur = r * 0.22;
  ctx.shadowColor = `hsla(${hue},90%,62%,${0.08 + pulse * 0.03 + (metrics?.close || 0) * 0.04})`;
  ctx.strokeStyle = `hsla(${hue},92%,74%,${0.01 + pulse * 0.005 + (metrics?.detail || 0) * 0.006})`;
  ctx.lineWidth = Math.max(1, r * 0.006);
  ctx.beginPath();
  ctx.arc(px, py, r * 1.015, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPlanetRings(ctx, p, px, py, time, front = false, metrics){
  if(!p.rings) return;
  const r = metrics?.r || p.r || 1;
  const scale = metrics?.scale || 1;
  const inner = p.rings.inner * scale;
  const outer = p.rings.outer * scale;
  const detail = metrics?.detail ?? 1;
  const hue = planetAtmosphereHue(p);
  const wobble = Math.sin(time * 0.005 + ((p.texSeed || 0) & 255) * 0.02) * 0.018;
  const tilt = (p.rings.tilt || 0) + wobble;
  const squash = 0.28 + 0.1 * Math.abs(Math.sin(tilt));
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(tilt);
  ctx.scale(1, squash);
  if(front){
    ctx.beginPath();
    ctx.rect(-outer - r * 0.1, 0, (outer + r * 0.1) * 2, outer + r * 0.2);
    ctx.clip();
  }
  ctx.globalCompositeOperation = front ? 'screen' : 'source-over';
  const grad = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
  grad.addColorStop(0, `hsla(${hue + 10},80%,76%,${(front ? 0.02 : 0.025) * detail})`);
  grad.addColorStop(0.32, `hsla(${hue + 28},78%,72%,${(front ? 0.13 : 0.09) * detail})`);
  grad.addColorStop(0.68, `hsla(${hue - 8},70%,64%,${(front ? 0.08 : 0.06) * detail})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  drawAnnulus(ctx, inner, outer);
  ctx.strokeStyle = `hsla(${hue + 18},92%,78%,${(front ? 0.22 : 0.12) * detail})`;
  ctx.lineWidth = Math.max(1, r * 0.008) / squash;
  for(let i = 0; i < 3; i++){
    const rr = inner + (outer - inner) * (0.28 + i * 0.19);
    ctx.beginPath();
    ctx.arc(0, 0, rr, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlanetWeather(ctx, p, px, py, time, metrics){
  const type = (p.type || 'rocky').toString().toLowerCase();
  const r = metrics?.r || p.r || 1;
  const detail = metrics?.detail ?? 1;
  const hue = planetAtmosphereHue(p);
  const seed = p.texSeed || 1;
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, r * 0.985, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.28 + detail * 0.72;
  ctx.globalCompositeOperation = 'screen';
  const surfaceLift = ctx.createRadialGradient(px - r * 0.38, py - r * 0.44, 0, px - r * 0.05, py - r * 0.08, r * 1.05);
  surfaceLift.addColorStop(0, `hsla(${hue + 10},88%,78%,0.18)`);
  surfaceLift.addColorStop(0.46, `hsla(${hue},74%,58%,0.08)`);
  surfaceLift.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = surfaceLift;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  if(type === 'gas'){
    for(let i = 0; i < 11; i++){
      const y = py - r * 0.78 + i * r * 0.156;
      const latitude = (y - py) / r;
      const width = r * Math.sqrt(Math.max(0.08, 1 - latitude * latitude));
      const drift = Math.sin(time * (0.007 + i * 0.0005) + i * 1.67 + seed * 0.0001) * r * 0.07;
      ctx.fillStyle = `hsla(${hue + (i % 2 ? 16 : -10)},92%,${i % 2 ? 70 : 58}%,${0.09 + (i % 3) * 0.018})`;
      ctx.beginPath();
      ctx.ellipse(px + drift, y, width * 1.12, r * (0.018 + (i % 4) * 0.005), Math.sin(i + seed) * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
    const stormA = time * 0.003 + seed * 0.00003;
    const sx = px + Math.cos(stormA) * r * 0.34;
    const sy = py + Math.sin(stormA * 0.7) * r * 0.22;
    ctx.strokeStyle = `hsla(${hue + 28},100%,82%,0.2)`;
    ctx.lineWidth = Math.max(1, r * 0.012);
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 0.2, r * 0.07, stormA, 0, Math.PI * 2);
    ctx.stroke();
  } else if(type === 'ocean' || type === 'water' || type === 'ice'){
    ctx.globalCompositeOperation = 'screen';
    const cloudHue = type === 'ice' ? 205 : 190;
    for(let i = 0; i < 14; i++){
      const k = hashUnit(i, seed & 2047, 503);
      const y = py - r * 0.78 + k * r * 1.56;
      const latitude = (y - py) / r;
      const width = r * Math.sqrt(Math.max(0.12, 1 - latitude * latitude));
      const span = width * 2.4;
      const travel = (((time * (0.5 + k) * 0.13 + k * 997) % span) + span) % span;
      const x = px - width * 1.2 + travel;
      ctx.fillStyle = `hsla(${cloudHue},90%,88%,${type === 'ice' ? 0.085 : 0.11})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r * (0.1 + k * 0.08), r * (0.008 + k * 0.012), Math.sin(k * 12) * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    const glint = ctx.createRadialGradient(px - r * 0.32, py - r * 0.35, 0, px - r * 0.24, py - r * 0.28, r * 0.42);
    glint.addColorStop(0, 'rgba(255,255,255,0.18)');
    glint.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.arc(px - r * 0.24, py - r * 0.28, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if(type === 'lava'){
    ctx.globalCompositeOperation = 'lighter';
    for(let i = 0; i < 12; i++){
      const k = hashUnit(i, seed & 4095, 811);
      const a = k * Math.PI * 2;
      const d = r * (0.18 + hashUnit(i, seed & 4095, 812) * 0.66);
      const x = px + Math.cos(a) * d;
      const y = py + Math.sin(a) * d;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.035 + i * 1.9);
      ctx.strokeStyle = `rgba(255,120,34,${0.1 + pulse * 0.14})`;
      ctx.lineWidth = Math.max(1, r * (0.008 + k * 0.01));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a + 1.7) * r * (0.06 + k * 0.09), y + Math.sin(a + 1.7) * r * (0.06 + k * 0.09));
      ctx.stroke();
    }
  } else if(type === 'industrial'){
    ctx.globalCompositeOperation = 'screen';
    for(let i = 0; i < 34; i++){
      const a = hashUnit(i, seed & 4095, 901) * Math.PI * 2;
      const d = Math.sqrt(hashUnit(i, seed & 4095, 902)) * r * 0.78;
      const x = px + Math.cos(a) * d;
      const y = py + Math.sin(a) * d;
      if(x > px + r * 0.28) continue;
      const flicker = 0.55 + 0.45 * Math.sin(time * 0.05 + i * 2.1);
      ctx.fillStyle = `rgba(255,218,142,${0.14 + flicker * 0.26})`;
      ctx.fillRect(x, y, Math.max(1, r * 0.007), Math.max(1, r * 0.007));
    }
  } else {
    ctx.globalCompositeOperation = 'screen';
    const haze = ctx.createRadialGradient(px - r * 0.34, py - r * 0.38, 0, px - r * 0.1, py - r * 0.1, r * 0.95);
    haze.addColorStop(0, `hsla(${hue + 16},70%,72%,0.12)`);
    haze.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.shadowBlur = r * 0.12;
  ctx.shadowColor = `hsla(${hue},95%,70%,0.14)`;
  ctx.strokeStyle = `hsla(${hue},95%,82%,0.038)`;
  ctx.lineWidth = Math.max(1, r * 0.006);
  ctx.beginPath();
  ctx.arc(px, py, r * 0.99, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPlanetCloseDetail(ctx, p, px, py, time, metrics){
  const detail = metrics?.detail ?? 0;
  const close = metrics?.close ?? 0;
  if(detail < 0.28 || close < 0.08) return;
  const type = (p.type || 'rocky').toString().toLowerCase();
  const r = metrics?.r || p.r || 1;
  const hue = planetAtmosphereHue(p);
  const seed = p.texSeed || 1;
  const alpha = Math.min(0.46, Math.max(0, (detail - 0.25) * 0.55 + close * 0.18));
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, r * 0.982, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalCompositeOperation = type === 'lava' ? 'lighter' : 'screen';
  ctx.globalAlpha = alpha;

  if(type === 'gas'){
    for(let i = 0; i < 18; i++){
      const k = hashUnit(i, seed & 4095, 1201);
      const y = py - r * 0.82 + i * r * 0.096;
      const latitude = (y - py) / r;
      const width = r * Math.sqrt(Math.max(0.05, 1 - latitude * latitude));
      const drift = Math.sin(time * (0.005 + k * 0.004) + seed * 0.0002 + i) * r * 0.1;
      ctx.strokeStyle = `hsla(${hue + (i % 3 - 1) * 14},96%,${62 + k * 18}%,${0.13 + k * 0.08})`;
      ctx.lineWidth = Math.max(1, r * (0.004 + k * 0.004));
      ctx.beginPath();
      ctx.ellipse(px + drift, y, width * (0.72 + k * 0.36), r * (0.011 + k * 0.01), Math.sin(k * 16) * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const craterCount = type === 'industrial' ? 22 : type === 'ocean' || type === 'water' ? 12 : 28;
    for(let i = 0; i < craterCount; i++){
      const a = hashUnit(i, seed & 4095, 1301) * Math.PI * 2;
      const d = Math.sqrt(hashUnit(i, seed & 4095, 1302)) * r * 0.82;
      const x = px + Math.cos(a) * d;
      const y = py + Math.sin(a) * d;
      if(x > px + r * 0.42 && type !== 'lava') continue;
      const k = hashUnit(i, seed & 4095, 1303);
      const rr = Math.max(1.2, r * (0.012 + k * 0.03));
      if(type === 'lava'){
        const pulse = 0.65 + 0.35 * Math.sin(time * 0.035 + i * 1.8);
        ctx.strokeStyle = `rgba(255,148,46,${0.16 + pulse * 0.18})`;
        ctx.lineWidth = Math.max(1, r * 0.008);
        ctx.beginPath();
        ctx.moveTo(x - rr * 1.4, y);
        ctx.lineTo(x + Math.cos(a + 1.3) * rr * 3.2, y + Math.sin(a + 1.3) * rr * 3.2);
        ctx.stroke();
      } else if(type === 'industrial'){
        ctx.fillStyle = `hsla(${hue + 8},88%,78%,${0.12 + k * 0.14})`;
        ctx.fillRect(x, y, Math.max(1, r * 0.006), Math.max(1, r * 0.006));
        if(k > 0.68){
          ctx.strokeStyle = `hsla(${hue - 24},76%,64%,0.11)`;
          ctx.lineWidth = Math.max(1, r * 0.004);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * r * 0.08, y + Math.sin(a) * r * 0.08);
          ctx.stroke();
        }
      } else if(type === 'ocean' || type === 'water' || type === 'ice'){
        ctx.strokeStyle = `hsla(${type === 'ice' ? 206 : 176},92%,86%,${0.08 + k * 0.11})`;
        ctx.lineWidth = Math.max(1, r * 0.005);
        ctx.beginPath();
        ctx.ellipse(x, y, rr * (2.3 + k), rr * 0.55, a, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = `hsla(${hue + 12},70%,76%,${0.08 + k * 0.12})`;
        ctx.lineWidth = Math.max(1, r * 0.006);
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  const shadow = ctx.createRadialGradient(px + r * 0.35, py + r * 0.42, 0, px + r * 0.18, py + r * 0.16, r * 1.08);
  shadow.addColorStop(0, 'rgba(0,0,0,0)');
  shadow.addColorStop(0.62, 'rgba(0,0,0,0.08)');
  shadow.addColorStop(1, 'rgba(0,0,0,0.24)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.min(0.38, alpha + 0.08);
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlanetDistanceHaze(ctx, px, py, metrics){
  const haze = metrics?.haze ?? 0;
  if(haze <= 0.05) return;
  const r = metrics.r;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.min(0.34, haze * 0.34);
  const veil = ctx.createRadialGradient(px - r * 0.28, py - r * 0.35, 0, px, py, r * 1.08);
  veil.addColorStop(0, 'rgba(205,230,255,0.12)');
  veil.addColorStop(0.52, 'rgba(35,45,58,0.08)');
  veil.addColorStop(1, 'rgba(1,4,8,0.58)');
  ctx.fillStyle = veil;
  ctx.beginPath();
  ctx.arc(px, py, r * 1.01, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function nebulaGravityBodies(state){
  return [
    ...((state.blackholes || []).map(body => ({ body, kind: 'blackhole' }))),
    ...((state.stars || []).map(body => ({ body, kind: 'star' }))),
    ...((state.planets || []).map(body => ({ body, kind: 'planet' })))
  ];
}

function nebulaGravityInfluence(state, wx, wy, n, time, index, bodies = nebulaGravityBodies(state)){
  let ox = 0, oy = 0, stretch = 1, squeeze = 1, alpha = 0, angle = 0, strengthMax = 0;
  for(const item of bodies){
    const body = item.body;
    const dx = body.x - wx;
    const dy = body.y - wy;
    const d = Math.hypot(dx, dy) || 1;
    const reach = item.kind === 'blackhole'
      ? Math.max((n.r || 1) * 0.95, (body.r || 1) * 8)
      : Math.max((n.r || 1) * 0.42, (body.r || 1) * 2.15);
    if(d > reach) continue;
    const t = 1 - d / reach;
    const weight = item.kind === 'blackhole' ? 1.55 : item.kind === 'star' ? 0.72 : 0.48;
    const k = t * t * weight;
    const inv = 1 / d;
    const tx = -dy * inv;
    const ty = dx * inv;
    const swirl = Math.sin(time * 0.015 + index * 1.7 + (body.x + body.y) * 0.0007);
    const pull = item.kind === 'blackhole' ? (body.r || 1) * 0.82 : (body.r || 1) * 0.2;
    const curl = item.kind === 'blackhole' ? (body.r || 1) * 0.68 : (body.r || 1) * 0.18;
    ox += (dx * inv * pull + tx * curl * swirl) * k;
    oy += (dy * inv * pull + ty * curl * swirl) * k;
    stretch = Math.max(stretch, 1 + k * (item.kind === 'blackhole' ? 1.45 : 0.7));
    squeeze = Math.min(squeeze, 1 - Math.min(0.38, k * 0.22));
    alpha += k * 0.035;
    if(k > strengthMax){
      strengthMax = k;
      angle = Math.atan2(dy, dx) + (item.kind === 'blackhole' ? swirl * 0.65 : Math.PI * 0.5);
    }
  }
  return { ox, oy, stretch, squeeze, alpha: Math.min(0.08, alpha), angle, strength: strengthMax };
}

function drawNebulaCloud(ctx, cam, n, state = {}, pass = 'back', gravityBodies = nebulaGravityBodies(state)){
  const visibleR = (n.r || 1) * 1.35;
  if (!isVisible(cam, { x: n.x, y: n.y, r: visibleR })) return;
  const scale = n.baseR ? n.r / n.baseR : 1;
  const x = n.x - cam.x;
  const y = n.y - cam.y;
  const time = state.time || 0;
  const seed = Math.floor((n.hue || 220) * 17 + (n.baseR || n.r || 1));
  const passAlpha = pass === 'front'
    ? (0.055 + (n.layer || 0) * 0.04)
    : (0.12 + (1 - (n.layer || 0)) * 0.04);
  ctx.save();
  ctx.globalCompositeOperation = pass === 'front' ? 'screen' : 'source-over';
  const blobs = Array.isArray(n.blobs) ? n.blobs : [];
  for (let i = 0; i < blobs.length; i++){
    const b = blobs[i];
    const frontness = hashUnit(i, seed, 719);
    if(pass === 'back' && frontness < 0.18) continue;
    const baseLocalX = (b.x || 0) * scale;
    const baseLocalY = (b.y || 0) * scale;
    const orbit = Math.atan2(baseLocalY, baseLocalX || 0.001) + Math.PI * 0.5;
    const drift = Math.sin(time * (0.006 + frontness * 0.004) + i * 1.31 + seed * 0.01) * (n.r || 1) * 0.025;
    const localX = baseLocalX + Math.cos(orbit) * drift;
    const localY = baseLocalY + Math.sin(orbit) * drift;
    const wx = n.x + localX;
    const wy = n.y + localY;
    const influence = nebulaGravityInfluence(state, wx, wy, n, time, i, gravityBodies);
    if(pass === 'front' && influence.strength < 0.05) continue;
    const bx = wx + influence.ox - cam.x;
    const by = wy + influence.oy - cam.y;
    const br = Math.max(1, (b.r || n.r * 0.2) * scale * (pass === 'front' ? 0.42 : 0.68));
    const hue = Math.floor(b.hue ?? n.hue ?? 220);
    const shimmer = 0.82 + Math.sin(time * 0.01 + i * 2.2) * 0.18;
    const a = (b.alpha ?? 0.24) * (n.alpha ?? 0.32) * passAlpha * shimmer + influence.alpha * (pass === 'front' ? 0.16 : 0.24);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(influence.strength > 0 ? influence.angle : orbit);
    ctx.scale(influence.stretch, influence.squeeze);
    const glowHue = hue + Math.sin(time * 0.006 + i) * 8;
    ctx.shadowBlur = br * (pass === 'front' ? 0.46 : 0.7);
    ctx.shadowColor = `hsla(${glowHue},82%,66%,${Math.min(0.16, a * 1.8)})`;
    ctx.fillStyle = `hsla(${glowHue},78%,64%,${Math.min(0.035, a * 0.28)})`;
    ctx.beginPath();
    ctx.arc(0, 0, br * (pass === 'front' ? 0.48 : 0.34), 0, Math.PI * 2);
    ctx.fill();
    if(pass === 'front' && influence.strength > 0.09){
      ctx.strokeStyle = `hsla(${hue + 18},88%,75%,${Math.min(0.07, influence.strength * 0.035)})`;
      ctx.lineWidth = Math.max(1, br * 0.01);
      ctx.beginPath();
      ctx.moveTo(-br * 0.25, 0);
      ctx.lineTo(br * 0.58, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  if(pass === 'back'){
    const coreR = Math.max(16, n.r * 0.12);
    const core = ctx.createRadialGradient(x, y, 0, x, y, coreR);
    core.addColorStop(0, 'rgba(255,255,255,0.06)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVectorPlayerShip(ctx, ship){
  const g = ctx.createLinearGradient(-ship.r, ship.r, ship.r, -ship.r);
  g.addColorStop(0, '#2a3448');
  g.addColorStop(1, '#3b4a66');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#9cebdc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ship.r, 0);
  ctx.lineTo(-ship.r * 0.7, -ship.r * 0.65);
  ctx.lineTo(-ship.r, 0);
  ctx.lineTo(-ship.r * 0.7, ship.r * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-ship.r * 0.95, -6, -11, 12);
  ctx.stroke();
}

function drawPlayerShipSprite(ctx, ship){
  const sheet = getSpriteSheet('player', ship.spriteState || 'idle') || getSpriteSheet('player', 'idle');
  const img = sheet ? getImage(sheet.imageKey) : null;
  if (!img || !sheet) {
    ctx.save();
    ctx.rotate(ship.a || 0);
    drawVectorPlayerShip(ctx, ship);
    ctx.restore();
    return;
  }
  const frame = Number.isInteger(sheet.fixedFrame)
    ? sheet.fixedFrame
    : getDirectionalFrameIndex(ship.a || 0, sheet);
  const fw = sheet.frameWidth;
  const fh = sheet.frameHeight;
  const sx = frame * fw;
  const sy = 0;
  const size = (ship.spriteSize || ship.r * (sheet.renderScale || 4));
  if (sheet.rotateWithShip) {
    const frameAngle = typeof sheet.fixedFrameAngle === 'number'
      ? sheet.fixedFrameAngle
      : getDirectionalFrameAngle(frame, sheet);
    ctx.rotate((ship.a || 0) - frameAngle);
  }
  ctx.drawImage(img, sx, sy, fw, fh, -size / 2, -size / 2, size, size);
}

let pirateShipTextureCache = null;

function getPirateShipSpriteTexture(){
  const img = getImage('pirateShip');
  if(!img) return null;
  if(pirateShipTextureCache?.source === img) return pirateShipTextureCache.canvas;
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const sx = Math.round(iw * 0.03);
  const sy = Math.round(ih * 0.1);
  const sw = Math.round(iw * 0.94);
  const sh = Math.round(ih * 0.79);
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const g = canvas.getContext('2d');
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  try {
    const data = g.getImageData(0, 0, sw, sh);
    for(let i = 0; i < data.data.length; i += 4){
      const r = data.data[i];
      const green = data.data[i + 1];
      const b = data.data[i + 2];
      const max = Math.max(r, green, b);
      const min = Math.min(r, green, b);
      const brightness = (r + green + b) / 3;
      const saturation = max - min;
      if(brightness < 14 && saturation < 12){
        data.data[i + 3] = 0;
      } else if(data.data[i + 3] > 0) {
        data.data[i] = Math.min(255, r * 1.14 + 22);
        data.data[i + 1] = Math.min(255, green * 1.14 + 18);
        data.data[i + 2] = Math.min(255, b * 1.14 + 18);
      }
    }
    g.putImageData(data, 0, 0);
  } catch {}
  pirateShipTextureCache = { source: img, canvas };
  return canvas;
}

function drawVectorPirateShip(ctx, pirate){
  ctx.strokeStyle = '#ffb3b3';
  ctx.lineWidth = 2;
  const r = pirate.r || 14;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r*0.6, -r*0.6);
  ctx.lineTo(-r*0.3, 0);
  ctx.lineTo(-r*0.6, r*0.6);
  ctx.closePath();
  ctx.stroke();
}

function drawPirateShipSprite(ctx, pirate, ship){
  const tex = getPirateShipSpriteTexture();
  const angle = pirate.a != null
    ? pirate.a
    : Math.atan2(((ship?.y || 0) - pirate.y), ((ship?.x || 0) - pirate.x));
  ctx.rotate(angle + Math.PI / 2);
  if(!tex){
    ctx.rotate(-Math.PI / 2);
    drawVectorPirateShip(ctx, pirate);
    return;
  }
  const r = pirate.r || 16;
  const h = r * 4.9;
  const w = h * ((tex.width || 1) / (tex.height || 1));
  ctx.drawImage(tex, -w / 2, -h / 2, w, h);
}

function playerSpriteWorldPoint(ship, areaName){
  const sheet = getSpriteSheet('player', ship.spriteState || 'idle') || getSpriteSheet('player', 'idle');
  const area = getSpriteArea('player', areaName);
  if (!sheet || !area) return null;
  const size = ship.spriteSize || ship.r * (sheet.renderScale || 4);
  const localX = (area.x / sheet.frameWidth - 0.5) * size;
  const localY = (area.y / sheet.frameHeight - 0.5) * size;
  const frame = Number.isInteger(sheet.fixedFrame)
    ? sheet.fixedFrame
    : getDirectionalFrameIndex(ship.a || 0, sheet);
  const frameAngle = typeof sheet.fixedFrameAngle === 'number'
    ? sheet.fixedFrameAngle
    : getDirectionalFrameAngle(frame, sheet);
  const rot = sheet.rotateWithShip ? (ship.a || 0) - frameAngle : 0;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  return {
    x: ship.x + localX * cr - localY * sr,
    y: ship.y + localX * sr + localY * cr
  };
}

function emitPlayerEngineParticles(state, ship, areaNames, opts = {}){
  if (!state || !ship || !Array.isArray(areaNames)) return;
  const maxParticles = opts.maxParticles || 400;
  if (!state.particles || state.particles.length >= maxParticles) return;
  const ca = Math.cos(ship.a), sa = Math.sin(ship.a);
  const direction = opts.direction || 'aft';
  const dir = direction === 'forward' ? 1 : -1;
  const count = opts.count ?? 2;
  const color = opts.color || '#4db8ff';
  const spMin = opts.speedMin ?? 1.2;
  const spMax = opts.speedMax ?? 3.0;
  const lifeMin = opts.lifeMin ?? 18;
  const lifeMax = opts.lifeMax ?? 36;
  const radiusMin = opts.radiusMin ?? 1.2;
  const radiusMax = opts.radiusMax ?? 3.0;
  const jitter = opts.jitter ?? 2;
  const startOffset = opts.startOffset ?? 0;
  const drawLayer = opts.drawLayer || 'shipFx';

  for (const areaName of areaNames){
    const port = playerSpriteWorldPoint(ship, areaName);
    if (!port) continue;
    for (let i = 0; i < count && state.particles.length < maxParticles; i++) {
      const p = state.particlePool.acquire ? state.particlePool.acquire() : {x:0,y:0,vx:0,vy:0,r:1,life:0};
      const spd = spMin + Math.random() * Math.max(0, spMax - spMin);
      p.x = port.x + ca * dir * startOffset + (Math.random() - 0.5) * jitter;
      p.y = port.y + sa * dir * startOffset + (Math.random() - 0.5) * jitter;
      p.vx = ship.vx * 0.25 + ca * dir * spd + (Math.random() - 0.5) * 0.35;
      p.vy = ship.vy * 0.25 + sa * dir * spd + (Math.random() - 0.5) * 0.35;
      p.r = radiusMin + Math.random() * Math.max(0, radiusMax - radiusMin);
      p.life = lifeMin + Math.random() * Math.max(0, lifeMax - lifeMin);
      p.max = p.life;
      p.color = color;
      p.drawLayer = drawLayer;
      state.particles.push(p);
    }
  }
}

function getDevicePixelRatio(){
  return typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number'
    ? window.devicePixelRatio
    : 1;
}

export function updateWorld(state, dt){
  state.planets ||= [];
  state.stars ||= [];
  state.blackholes ||= [];
  state.pirates ||= [];
  state.hunters ||= [];
  state.patrols ||= [];
  state.pirateBases ||= [];
  state.traders ||= [];
  state.asteroids ||= [];
  state.nebulae ||= [];
  state.bullets ||= [];
  state.particles ||= [];
  state.flares ||= [];
  const cam = state.camera;
  const s = state.ship;
  // accumulate a simple time base for timed effects
  state.time = (state.time || 0) + dt;
  const isDocked = !!state.docked;
  // If anchored and thrusting, release anchor
  if (s.anchored && s.thrust) s.anchored = false;

  // --- ship physics ---
  // rotation: configurable turn rate
  s.a += s.turn * (CFG.ship?.turn || 0.1) * dt;
  const isMoored = isDocked || s.anchored;
  if (!isMoored && s.thrust) {
    const engLvl = s.engine || 1;
    const baseAcc = CFG.ship?.accel ?? 0.1;
    const acc = baseAcc * (1 + 0.2 * (engLvl - 1));
    const fuelUse = CFG.economy?.fuelUse ?? 0.05;
    if (state.fuel > 0) state.fuel = Math.max(0, state.fuel - fuelUse * dt);
    else s.thrust = false;
    s.vx += Math.cos(s.a) * acc * dt;
    s.vy += Math.sin(s.a) * acc * dt;
  }
  if (!isMoored && s.brake) {
    const brakeFuelUse = (CFG.economy?.fuelUse ?? 0.05) * 6;
    if (state.fuel > 0) state.fuel = Math.max(0, state.fuel - brakeFuelUse * dt);
    else s.brake = false;
    s.vx *= Math.pow(0.965, dt);
    s.vy *= Math.pow(0.965, dt);
  }

  // Engine particles from named sprite hardpoints.
  if (!isMoored && s.thrust) {
    emitPlayerEngineParticles(state, s, ['Left_Main_Engine', 'Right_Main_Engine'], {
      color: '#4db8ff',
      direction: 'aft',
      count: 2,
      speedMin: 1.2,
      speedMax: 3.0,
      lifeMin: 18,
      lifeMax: 36
    });
  }
  if (!isMoored && s.brake) {
    emitPlayerEngineParticles(state, s, ['Left_Main_Engine_Brake', 'Right_Main_Engine_Brake'], {
      color: '#ffb347',
      direction: 'forward',
      count: 2,
      speedMin: 1.2,
      speedMax: 3.0,
      lifeMin: 18,
      lifeMax: 36,
      radiusMin: 1.2,
      radiusMax: 3.0,
      jitter: 2,
      startOffset: 14
    });
  }
  if (!isMoored && !s.thrust && !s.brake && s.turn < 0) {
    emitPlayerEngineParticles(state, s, ['Right_Main_Engine'], {
      color: '#4db8ff',
      direction: 'aft',
      count: 1,
      speedMin: 0.8,
      speedMax: 1.7,
      lifeMin: 12,
      lifeMax: 24
    });
  }
  if (!isMoored && !s.thrust && !s.brake && s.turn > 0) {
    emitPlayerEngineParticles(state, s, ['Left_Main_Engine'], {
      color: '#4db8ff',
      direction: 'aft',
      count: 1,
      speedMin: 0.8,
      speedMax: 1.7,
      lifeMin: 12,
      lifeMax: 24
    });
  }
  if (isDocked){
    // Keep ship centered on the planet while docked
    s.x = state.docked.x; s.y = state.docked.y;
    s.vx = 0; s.vy = 0;
  } else if (s.anchored) {
    // Remain stationary until thrust is applied to drop anchor
    s.vx = 0; s.vy = 0;
  } else {
    // clamp top speed before integration
    const maxSp = CFG.ship?.maxSpeed;
    if (typeof maxSp === 'number' && maxSp > 0) {
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > maxSp) {
        const k = maxSp / sp;
        s.vx *= k; s.vy *= k;
      }
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }
  // player gun cooldown ticks down
  if (s.cool && s.cool > 0) s.cool -= dt;
  if (s.cool < 0) s.cool = 0;

  const clampedX = Math.max(s.r, Math.min(WORLD.w - s.r, s.x));
  if (clampedX !== s.x) {
    s.x = clampedX;
    s.vx = 0;
  }
  const clampedY = Math.max(s.r, Math.min(WORLD.h - s.r, s.y));
  if (clampedY !== s.y) {
    s.y = clampedY;
    s.vy = 0;
  }
  // configurable friction
  const fr = CFG.ship?.friction ?? 0.99;
  s.vx *= fr;
  s.vy *= fr;

  // camera shake decay/update
  if (state.shakeMag && state.shakeMag > 0) {
    // exponential-ish decay
    state.shakeMag = Math.max(0, state.shakeMag - 6 * dt);
    const m = state.shakeMag;
    state.shakeX = (Math.random() - 0.5) * 2 * m;
    state.shakeY = (Math.random() - 0.5) * 2 * m;
  } else {
    state.shakeX = 0; state.shakeY = 0;
  }

  // camera follows the ship, ease in when first centering
  if (!s.centered) {
    s.centerX += (s.x - s.centerX) * 0.1;
    s.centerY += (s.y - s.centerY) * 0.1;
    cam.x = s.centerX - cam.w / 2;
    cam.y = s.centerY - cam.h / 2;
    if (Math.abs(s.centerX - s.x) < 1 && Math.abs(s.centerY - s.y) < 1) {
      s.centered = true;
    }
  } else {
    cam.x = s.x - cam.w / 2;
    cam.y = s.y - cam.h / 2;
  }
  cam.x = Math.max(0, Math.min(WORLD.w - cam.w, cam.x));
  cam.y = Math.max(0, Math.min(WORLD.h - cam.h, cam.y));

  // star collision: instant game over (disabled while docked/anchored)
  if (!isMoored){
    for(const st of state.stars){
      const dx = s.x - st.x;
      const dy = s.y - st.y;
      if(dx*dx + dy*dy <= (s.r + (st.r||1))*(s.r + (st.r||1))){
        if(!state.invincible) setGameOver(state, 'star');
      }
    }
  }

  // Celestial gravity bends movable entities without moving the source bodies.
  // Computed once per tick (not once per entity) since planets/stars/blackholes
  // don't move within a tick — this avoids rebuilding the source list per call.
  const gravitySrcs = gravitySources(state);
  function applyGravity(obj, type = 'entity'){
    // No gravity on the player ship while docked or anchored
    if (obj === s && (isDocked || s.anchored)) return;
    const scale = gravityScaleFor(type);
    if (!scale) return;
    const vector = gravityVectorAt(state, obj.x || 0, obj.y || 0, gravitySrcs);
    if (obj === s) {
      state.gravityDebugX = vector.ax;
      state.gravityDebugY = vector.ay;
      state.gravityDebugMagnitude = vector.mag;
    }
    obj.vx = (obj.vx || 0) + vector.ax * dt * scale;
    obj.vy = (obj.vy || 0) + vector.ay * dt * scale;
    if(obj === s && state.blackholes && state.blackholes.length){
      for(const b of state.blackholes){
        const dx = b.x - obj.x;
        const dy = b.y - obj.y;
        const d = Math.hypot(dx, dy);
        const hazardR = blackHoleHazardRadius(b, s);
        if(d <= hazardR && !state.invincible && !state.godMode){
          const coreR = blackHoleCoreRadius(b, s);
          if (d <= coreR) {
            s.lives = 0;
            s.hull = 0;
            setGameOver(state, 'blackhole');
            return;
          }
          const intensity = 1 - Math.max(0, Math.min(1, (d - coreR) / Math.max(1, hazardR - coreR)));
          s.hull -= (GRAVITY.innerDamage || 0.3) * dt * (1 + intensity * 3);
          addShake(state, 0.1 + intensity * 0.35);
          if(s.hull <= 0){
            resolveShipLoss(state, 'blackhole');
            if (state.gameOver) return;
          }
        }
      }
    }
  }
  applyGravity(s, 'ship');

  // --- nebula clouds: slow and drain fuel while flying through them ---
  let inNebula = false;
  for (const n of state.nebulae){
    n.x += (n.vx || 0) * dt;
    n.y += (n.vy || 0) * dt;
    wrapWorldEntity(n);
    const dx = s.x - n.x;
    const dy = s.y - n.y;
    if (!isDocked && dx*dx + dy*dy < (n.r || 0) * (n.r || 0)){
      inNebula = true;
    }
  }
  if (inNebula){
    const slow = CFG.nebulae?.slow ?? 0.985;
    s.vx *= slow;
    s.vy *= slow;
    if (!state.godMode && state.fuel > 0) {
      state.fuel = Math.max(0, state.fuel - (CFG.nebulae?.fuelDrain ?? 0.02) * dt);
    }
    if (!state.inNebula) toast('Nebula cloud: engines slowed, fuel burn increased.');
  }
  state.inNebula = inNebula;

  // --- pirate respawn timer ---
  if (state.pirateSpawnTimer == null) state.pirateSpawnTimer = CFG.pirates.spawnEvery;
  state.pirateSpawnTimer -= dt;
  if (state.pirates.length < CFG.pirates.max && state.pirateSpawnTimer <= 0) {
    state.pirates.push(makePirate());
    state.pirateSpawnTimer = CFG.pirates.spawnEvery;
  }

  // --- pirate AI: patrol locally, chase nearby undocked players, shoot, and board ---
  if (state.pirates && state.pirates.length) {
    const pirateHeatMargin = CFG.pirates?.planetNoAttackRadius || 0;
    const playerInPlanetHeat = isDocked || isInsidePlanetHeat(state, s, pirateHeatMargin);
    const piratesCanAttack = !isDocked && !playerInPlanetHeat;
    for (const p of state.pirates) {
      const threat = steerLocalEnemy(p, s, CFG.pirates || {}, state, dt, { canAttack: piratesCanAttack });
      const { dx, dy, distToTarget: distToShip } = threat;
      // fire towards player on cooldown and within aggro
      p.cool = (p.cool || 0) - dt;
      if (piratesCanAttack && threat.engaged && p.cool <= 0 && distToShip < (CFG.pirates?.aggro || 380)) {
        const b = acquireBullet(state);
        const speed = CFG.pirates.bulletSpeed;
        const a = Math.atan2(dy, dx);
        const fx = Math.cos(a), fy = Math.sin(a);
        b.x = p.x + fx * (p.r + 2);
        b.y = p.y + fy * (p.r + 2);
        b.vx = fx * speed;
        b.vy = fy * speed;
        b.r = 2;
        b.life = 240;
        b.friendly = false;
        b.damage = CFG.pirates.damage;
        state.bullets.push(b);
        p.cool = CFG.pirates.fireEvery;
      }
      // boarding mechanic: linger in close range to steal
      const br = (CFG.pirates?.boardRange || 22) + (p.r || 0) + (s.r || 0);
      if (piratesCanAttack && threat.engaged && distToShip < br){
        p.boardTimer = (p.boardTimer || 0) + dt;
        if (p.boardTimer >= (CFG.pirates?.boardTime || 90)){
          // Steal credits and cargo, rep penalty
          const cr = CFG.pirates?.steal?.credits || [60,160];
          const cg = CFG.pirates?.steal?.cargo || [3,10];
          const lossC = Math.min(state.credits, Math.floor(cr[0] + Math.random()*(cr[1]-cr[0]+1)));
          const lossG = Math.min(state.cargo, Math.floor(cg[0] + Math.random()*(cg[1]-cg[0]+1)));
          state.credits -= lossC;
          state.cargo -= lossG;
          state.reputation = Math.max(0, (state.reputation||0) - (CFG.pirates?.repPenalty || 1));
          toast(`Pirates boarded! -$${lossC}, -${lossG} cargo, Rep -${CFG.pirates?.repPenalty || 1}`);
          // knock pirate back
          const invd = distToShip>0 ? 1/distToShip : 0;
          p.vx -= dx * invd * 2; p.vy -= dy * invd * 2;
          p.boardTimer = 0;
        }
      } else {
        p.boardTimer = 0;
      }
      // collision with asteroids damages pirates
      if (state.asteroids && state.asteroids.length){
        for (let j = state.asteroids.length - 1; j >= 0; j--) {
          const a = state.asteroids[j];
          const adx = p.x - a.x, ady = p.y - a.y;
          const rr = (p.r + a.r) * (p.r + a.r);
          if (adx*adx + ady*ady <= rr){
            p.hp = (p.hp != null ? p.hp : (CFG.pirates?.hp || 5)) - Math.max(1, Math.round(a.r / 12));
            // small explosion effect
            spawnSparks(state, p.x, p.y, { count: 8, color:'#ffd56b' });
            if (p.hp <= 0){
              // remove pirate
              const idx = state.pirates.indexOf(p);
              if (idx !== -1) state.pirates.splice(idx,1);
              break;
            } else {
              // bounce back a bit
              const d = Math.max(0.001, Math.hypot(adx, ady));
              const nx = adx / d, ny = ady / d;
              p.vx += nx * 0.6; p.vy += ny * 0.6;
            }
          }
        }
      }
    }
  }
  // --- hunters: local patrols that chase only inside their territory
  if (state.hunters && state.hunters.length) {
    for (const h of state.hunters) {
      steerLocalEnemy(h, s, CFG.hunters || {}, state, dt, {
        canAttack: !isDocked,
        chaseAccel: 0.035,
        patrolAccel: 0.02,
        returnAccel: 0.045,
        patrolTurn: 0.004
      });
    }
  }

  const moveEntities = (list, type) => {
    for(let i=list.length-1;i>=0;i--){
      const e = list[i];
      e.x += (e.vx||0) * dt;
      e.y += (e.vy||0) * dt;
      if (type === 'asteroid') {
        e.a = (e.a || 0) + (e.av || 0) * dt;
      }
      if(type === 'pirate' || type === 'hunter' || type === 'trader' || type === 'asteroid' || type === 'patrol'){
        applyGravity(e, type);
      }
      const dx = e.x - s.x;
      const dy = e.y - s.y;
      if(dx*dx + dy*dy < (e.r + s.r) * (e.r + s.r)){
        const isEnemyContact = type === 'pirate' || type === 'hunter';
        if (isDocked && isEnemyContact) continue;
        if(!state.invincible){
          if(type === 'pirate' || type === 'asteroid' || type === 'hunter'){
            let dmg = e.damage || 10;
            const shieldLvl = s.shield || 0;
            const mult = Math.max(0.5, 1 - 0.1 * shieldLvl);
            if (!state.godMode) s.hull -= dmg * mult;
            addShake(state, Math.min(6, (dmg || 10) * 0.25));
            spawnSparks(state, s.x, s.y, { count: 12, color: '#ffd56b' });
            if(s.hull <= 0){
              s.lives--;
              if(s.lives <= 0) setGameOver(state, isEnemyContact ? 'combat' : 'collision');
              s.hull = s.hullMax;
            }
          } else if(type === 'trader'){
            setGameOver(state, 'collision');
          }
        }
        list.splice(i,1);
        continue;
      }
      // star destroys entities (NPCs/asteroids/traders/patrols)
      let destroyedByStar = false;
      for(const st of state.stars){
        const sx = e.x - st.x; const sy = e.y - st.y;
        if(sx*sx + sy*sy <= (e.r + (st.r||1))*(e.r + (st.r||1))){
          list.splice(i,1);
          destroyedByStar = true;
          break;
        }
      }
      if (destroyedByStar) continue;
      // interactions with world objects for asteroids
      if (type === 'asteroid'){
        // Star destruction for asteroids is already handled by the generic
        // destroyedByStar check above (which continue()s on a hit), so only
        // the planet-bounce interaction remains here.
        // bounce off planets
        for(const p of state.planets){
          const pdx = e.x - p.x; const pdy = e.y - p.y;
          const planetR = planetInteractionRadius(p);
          const pr = e.r + planetR;
          if (pdx*pdx + pdy*pdy < pr*pr){
            // normal and reflect
            const d = Math.hypot(pdx,pdy);
            let nx;
            let ny;
            if (d > 0.001) {
              nx = pdx / d;
              ny = pdy / d;
            } else {
              const a = Math.atan2(e.vy || 0, e.vx || 1);
              nx = Math.cos(a);
              ny = Math.sin(a);
            }
            const vdotn = (e.vx||0)*nx + (e.vy||0)*ny;
            const elast = CFG.asteroids?.elasticity ?? 0.6;
            if (vdotn < 0) {
              e.vx = (e.vx||0) - 2*vdotn*nx;
              e.vy = (e.vy||0) - 2*vdotn*ny;
              e.vx *= elast; e.vy *= elast;
            }
            // push just outside planet
            e.x = p.x + nx * (pr + 0.5);
            e.y = p.y + ny * (pr + 0.5);
            const outward = (e.vx || 0) * nx + (e.vy || 0) * ny;
            const minEscape = 0.28;
            if (outward < minEscape) {
              e.vx = (e.vx || 0) + nx * (minEscape - outward);
              e.vy = (e.vy || 0) + ny * (minEscape - outward);
            }
            // add some spin from collision
            e.av = (e.av||0) + (Math.random()-0.5) * 0.01;
            break;
          }
        }
      }
      if(
        e.x < -e.r || e.x > WORLD.w + e.r ||
        e.y < -e.r || e.y > WORLD.h + e.r
      ){
        list.splice(i,1);
      }
    }
  };

  moveEntities(state.pirates, 'pirate');
  moveEntities(state.traders, 'trader');
  if(state.hunters) moveEntities(state.hunters, 'hunter');
  if(state.patrols) moveEntities(state.patrols, 'patrol');
  moveEntities(state.asteroids, 'asteroid');

  // Patrols: warning + contraband seizure (with cooldowns)
  if (state.patrols && state.patrols.length){
    for (const pt of state.patrols){
      pt.scan = (pt.scan != null ? pt.scan : 0) - dt;
      pt.warnTimer = Math.max(0, (pt.warnTimer || 0) - dt);
      pt.warnCleanCooldown = Math.max(0, (pt.warnCleanCooldown || 0) - dt);
      const dxp = state.ship.x - pt.x, dyp = state.ship.y - pt.y;
      const rr = (CFG.patrols?.scanRadius || 220); const d2 = dxp*dxp + dyp*dyp;
      if (pt.scan <= 0 && d2 < rr*rr){
        let hasIllegal = false, seized = 0; const keep = [];
        if (Array.isArray(state.missions) && state.missions.length){
          for (const m of state.missions){ if (m.illegal) { hasIllegal = true; seized += (m.qty||0); } else keep.push(m); }
        }
        if (hasIllegal){
          if ((pt.warnTimer || 0) <= 0){
            toast('Patrol detected contraband - leave the area');
            pt.warnTimer = 180; // ~3 seconds
            pt.scan = 60;       // rescan soon
          } else {
            state.missions = keep;
            state.cargo = Math.max(0, state.cargo - seized);
            const fine = CFG.patrols?.fine || 200;
            state.credits = Math.max(0, state.credits - fine);
            state.reputation = Math.max(0, (state.reputation||0) - (CFG.contraband?.repPenalty || 2));
            toast(`Contraband seized! -$${fine} • Rep -${CFG.contraband?.repPenalty || 2}`);
            pt.scan = 600; // cooldown
            pt.warnTimer = 0;
          }
        } else {
          if ((pt.warnCleanCooldown || 0) <= 0){
            toast('Patrol scanning nearby');
            pt.warnCleanCooldown = 600;
          }
          pt.scan = 300; // slower rescan when clean
        }
      }
    }
  }

  // Pirate bases: spawn pirates and fire at player; damage on contact
  if (state.pirateBases && state.pirateBases.length){
    for (let i = state.pirateBases.length - 1; i >= 0; i--){
      const base = state.pirateBases[i];
      base.spawn = (base.spawn != null ? base.spawn : CFG.pirateBase.spawnEvery) - dt;
      base.cool = (base.cool != null ? base.cool : CFG.pirateBase.fireEvery) - dt;
      if (base.spawn <= 0){
        const np = makePirate(Math.random);
        np.x = base.x + (Math.random()*120 - 60);
        np.y = base.y + (Math.random()*120 - 60);
        np.homeX = base.x;
        np.homeY = base.y;
        state.pirates.push(np);
        base.spawn = CFG.pirateBase.spawnEvery;
      }
      if (!isDocked && base.cool <= 0){
        const dx = state.ship.x - base.x, dy = state.ship.y - base.y;
        const d = Math.hypot(dx, dy);
        if (d < 420){
          const a = Math.atan2(dy, dx);
          const blt = acquireBullet(state);
          blt.x = base.x; blt.y = base.y;
          blt.vx = Math.cos(a) * 3; blt.vy = Math.sin(a) * 3;
          blt.r = 3; blt.life = 220; blt.friendly = false; blt.damage = CFG.pirates?.damage || 10;
          state.bullets.push(blt);
        }
        base.cool = CFG.pirateBase.fireEvery;
      }
      // Ship collision
      const dxs = base.x - state.ship.x, dys = base.y - state.ship.y;
      const rr = (base.r + state.ship.r * 0.8);
      if (!isDocked && !state.invincible && (dxs*dxs + dys*dys) < rr*rr){
        if (!state.godMode) state.ship.hull -= 20;
        addShake(state, 2);
        if (state.ship.hull <= 0){
          state.ship.lives--; if (state.ship.lives <= 0) setGameOver(state, 'combat');
          state.ship.hull = state.ship.hullMax;
        }
      }
    }
  }

  // --- star lifecycle: aging, flares, supernova ---
  if (!state.flares) state.flares = [];
  for (let i = state.stars.length - 1; i >= 0; i--) {
    const st = state.stars[i];
    if (st.age == null) st.age = 0;
    if (st.supernovaAt == null) st.supernovaAt = 2400 + Math.random()*2400;
    st.age += dt;
    // Legacy-like growth and hue shift
    const frac = Math.max(0, Math.min(1, (st.age || 0) / (st.supernovaAt || 1)));
    st.hue = 210 - 210 * frac;
    if (typeof st.baseR === 'number') {
      st.r = st.baseR * (1 + 0.4 * frac);
    }
    // Unstable warning when within window and near ship
    const warnWindow = CFG.supernova?.warnWindow ?? 900;
    const warnRadius = CFG.ui?.starWarnRadius ?? 460;
    const remaining = (st.supernovaAt || 0) - (st.age || 0);
    if (remaining <= warnWindow && !st.warned){
      const dx = (state.ship?.x||0) - st.x;
      const dy = (state.ship?.y||0) - st.y;
      const d = Math.hypot(dx, dy);
      if (d < warnRadius){
        toast('Stellar instability nearby');
        st.warned = true;
      }
    }
    if (remaining <= warnWindow && st.phase !== 'unstable') {
      st.phase = 'unstable';
      st.pulse = 0;
    }
    // Flares
    st.flareTimer = (st.flareTimer == null) ? (600 + Math.random()*900) : (st.flareTimer - dt);
    if (st.flareTimer <= 0) {
      // spawn an expanding ring flare from this star
      const limit = (st.r || 40) + (GRAVITY.flareMaxRange || 900);
      state.flares.push({ x: st.x, y: st.y, r: (st.r||40), originR: (st.r||40), speed: GRAVITY.flareSpeed * (1 + (st.r||40)/120), hit:false, limit, color:'#ffd56b' });
        toast('Solar flare');
      st.flareTimer = 900 + Math.random()*900; // schedule next
    }
    // Supernova
    if (st.age >= st.supernovaAt) {
      // Convert star into a cloud of asteroids, scaled by star size
      const basePieces = Math.max(8, Math.floor((st.r || 80) / 6));
      const capacity = Math.max(0, (CFG.asteroids?.max || Infinity) - state.asteroids.length);
      const pieces = Math.min(basePieces, capacity);
      for (let k = 0; k < pieces; k++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = (st.r || 60) * (0.3 + Math.random()*0.7);
        const spd = 1.0 + Math.random()*1.5;
        const r = 10 + Math.random()*18;
        state.asteroids.push({
          x: st.x + Math.cos(ang)*dist,
          y: st.y + Math.sin(ang)*dist,
          vx: Math.cos(ang)*spd,
          vy: Math.sin(ang)*spd,
          r,
          seed: ((Math.random()*0xffffffff)>>>0)
        });
      }
      state.nebulae.push(makeNebula(st.x, st.y, 520 + Math.random()*220, st.hue || 210));
      // Remove the star
      state.stars.splice(i, 1);
      toast('Supernova. New asteroid field detected.');
      continue;
    }
  }

  // Update flares (expanding rings) and apply effects
  for (let i = state.flares.length - 1; i >= 0; i--) {
    const f = state.flares[i];
    f.r += (f.speed || GRAVITY.flareSpeed) * dt;
    const maxR = (f.limit != null) ? f.limit : Math.max(WORLD.w, WORLD.h);
    // Ship interaction: damage when ring passes ship
    const dx = s.x - f.x; const dy = s.y - f.y;
    const d = Math.hypot(dx, dy);
    const thick = GRAVITY.flareThickness;
    if (!f.hit && !isDocked && !s.anchored && d > f.r - thick && d < f.r + thick) {
      if (!state.invincible) {
        const shieldLvl = s.shield || 0;
        const mult = Math.max(0.5, 1 - 0.1 * shieldLvl);
        s.hull -= GRAVITY.flareDamage * mult;
        addShake(state, 3);
      }
      // Jam radar for a short while
      state.radarJammedUntil = (state.time || 0) + (GRAVITY.radarJamSeconds || 180);
      f.hit = true; // avoid multi-hit per flare
    }
    // dissipate sooner and don’t extend too far
    if (f.r > maxR) {
      state.flares.splice(i, 1);
    }
  }

  // asteroid respawn timer (keep field lively)
  if (state.asteroidSpawnTimer == null) state.asteroidSpawnTimer = CFG.asteroids.spawnEvery;
  state.asteroidSpawnTimer -= dt;
  if (state.asteroids.length < CFG.asteroids.max && state.asteroidSpawnTimer <= 0) {
    spawnAsteroid(state);
    state.asteroidSpawnTimer = CFG.asteroids.spawnEvery;
  }

  // trader respawn timer
  if (state.traderSpawnTimer == null) state.traderSpawnTimer = CFG.traders.spawnEvery;
  state.traderSpawnTimer -= dt;
  if (state.traders.length < CFG.traders.max && state.traderSpawnTimer <= 0) {
    const side = Math.floor(Math.random()*4);
    const m = 10;
    const pos = [
      {x:m, y: Math.random()*WORLD.h},
      {x:WORLD.w - m, y: Math.random()*WORLD.h},
      {x:Math.random()*WORLD.w, y:m},
      {x:Math.random()*WORLD.w, y:WORLD.h - m}
    ][side];
    const ang = Math.random()*Math.PI*2;
    const speed = 0.5 + Math.random();
    state.traders.push({ x:pos.x, y:pos.y, vx:Math.cos(ang)*speed, vy:Math.sin(ang)*speed, a:ang, r:16 });
    state.traderSpawnTimer = CFG.traders.spawnEvery;
  }

  for(let i=state.bullets.length-1;i>=0;i--){
    const b = state.bullets[i];
    applyGravity(b, 'bullet');
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if(b.life <= 0){
      state.bullets.splice(i,1);
      releaseBullet(state, b);
      continue;
    }
    // enemy bullet hits player
    if (!isDocked && b.friendly === false) {
      const dx = b.x - s.x;
      const dy = b.y - s.y;
      const rr = (b.r + s.r) * (b.r + s.r);
      if (dx*dx + dy*dy <= rr) {
        if(!state.invincible){
          const shieldLvl = s.shield || 0;
          const mult = Math.max(0.5, 1 - 0.1 * shieldLvl);
          const dmg = (b.damage || 5) * mult;
          if (!state.godMode) s.hull -= dmg;
          addShake(state, Math.min(6, dmg * 0.2));
          spawnSparks(state, s.x, s.y, { count: 10, color: '#ff9f6b' });
          if(s.hull <= 0){
            s.lives--;
            if(s.lives <= 0) setGameOver(state, 'combat');
            s.hull = s.hullMax;
          }
        }
        state.bullets.splice(i,1);
        releaseBullet(state, b);
        continue;
      }
    }
    // player bullet hits pirates/asteroids/bases
    if (b.friendly === true) {
      let hit = false;
      // pirates
      for (let j = state.pirates.length - 1; j >= 0; j--) {
        const e = state.pirates[j];
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const rr = (b.r + e.r) * (b.r + e.r);
        if (dx*dx + dy*dy <= rr) {
          e.hp = (e.hp || 1) - (b.damage || 3);
          spawnSparks(state, b.x, b.y, { count: 10, color: '#ffd56b' });
          if (e.hp <= 0) state.pirates.splice(j, 1);
          hit = true;
          break;
        }
      }
      // asteroids
      if (!hit) {
        for (let j = state.asteroids.length - 1; j >= 0; j--) {
          const e = state.asteroids[j];
          const dx = b.x - e.x;
          const dy = b.y - e.y;
          const rr = (b.r + e.r) * (b.r + e.r);
          if (dx*dx + dy*dy <= rr) {
            // break large asteroids into smaller fragments
            spawnSparks(state, b.x, b.y, { count: 14, color: '#ffb37a' });
            if (e.r > 14) {
              let pieces = 2 + ((e.seed||0) % 2); // 2..3
              const capacity = Math.max(0, (CFG.asteroids?.max || Infinity) - state.asteroids.length);
              if (pieces > capacity) pieces = capacity;
              for(let k=0;k<pieces;k++){
                const nr = Math.max(8, e.r * (0.45 + Math.random()*0.2));
                const ang = Math.atan2(dy, dx) + (Math.random()*0.8 - 0.4);
                const spd = 0.6 + Math.random()*0.8;
                state.asteroids.push({
                  x: e.x + Math.cos(ang)* (e.r*0.2),
                  y: e.y + Math.sin(ang)* (e.r*0.2),
                  vx: (e.vx||0) + Math.cos(ang)*spd,
                  vy: (e.vy||0) + Math.sin(ang)*spd,
                  r: nr,
                  seed: (e.seed>>>0) + k + 1
                });
              }
            }
            state.asteroids.splice(j, 1);
            hit = true;
            break;
          }
        }
      }
      // pirate bases
      if (!hit && state.pirateBases && state.pirateBases.length){
        for (let j = state.pirateBases.length - 1; j >= 0; j--) {
          const base = state.pirateBases[j];
          const dx = b.x - base.x;
          const dy = b.y - base.y;
          const rr = (b.r + base.r) * (b.r + base.r);
          if (dx*dx + dy*dy <= rr) {
            const dmg = (b.damage || 10);
            base.hp = (base.hp != null ? base.hp : CFG.pirateBase.hp) - dmg;
            spawnSparks(state, b.x, b.y, { count: 12, color: '#ff9f6b' });
            if (base.hp <= 0){
              state.pirateBases.splice(j,1);
              const bounty = (CFG.pirateBase?.bounty || 200);
              state.credits += bounty;
              toast(`Pirate base destroyed! +$${bounty}`);
            }
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        state.bullets.splice(i,1);
        releaseBullet(state, b);
        continue;
      }
    }
    // remove bullets that leave the world area
    if (
      b.x < -10 || b.x > WORLD.w + 10 ||
      b.y < -10 || b.y > WORLD.h + 10
    ){
      state.bullets.splice(i,1);
      releaseBullet(state, b);
      continue;
    }
    if(!isVisible(cam, b)) continue;
  }
  for(let i=state.particles.length-1;i>=0;i--){
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if(p.life <= 0){
      state.particles.splice(i,1);
      state.particlePool.release(p);
    }
  }
}

const DEPTH_STAR_LAYERS = [
  { parallax: 0.08, tile: 420, count: 4, size: 0.75, alpha: 0.16, seed: 17, color: '202,220,255' },
  { parallax: 0.18, tile: 360, count: 5, size: 1.05, alpha: 0.22, seed: 41, color: '180,216,255' },
  { parallax: 0.34, tile: 300, count: 4, size: 1.35, alpha: 0.24, seed: 73, color: '216,235,255' }
];

const DEPTH_DUST_LAYER = { parallax: 0.56, tile: 280, count: 3, seed: 131 };

function hashUnit(x, y, seed){
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function drawCameraDepthBackdrop(ctx, cam){
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for(const layer of DEPTH_STAR_LAYERS){
    const tile = layer.tile;
    const minX = Math.floor((cam.x * layer.parallax - tile) / tile);
    const maxX = Math.ceil(((cam.x + cam.w) * layer.parallax + tile) / tile);
    const minY = Math.floor((cam.y * layer.parallax - tile) / tile);
    const maxY = Math.ceil(((cam.y + cam.h) * layer.parallax + tile) / tile);
    for(let ty = minY; ty <= maxY; ty++){
      for(let tx = minX; tx <= maxX; tx++){
        for(let i = 0; i < layer.count; i++){
          const rx = hashUnit(tx, ty, layer.seed + i * 19);
          const ry = hashUnit(tx, ty, layer.seed + i * 37);
          const twinkle = hashUnit(tx, ty, layer.seed + i * 53);
          const wx = tx * tile + rx * tile;
          const wy = ty * tile + ry * tile;
          const x = wx - cam.x * layer.parallax;
          const y = wy - cam.y * layer.parallax;
          if(x < -8 || x > cam.w + 8 || y < -8 || y > cam.h + 8) continue;
          const a = layer.alpha * (0.62 + twinkle * 0.54);
          const size = layer.size * (0.7 + twinkle * 0.8);
          ctx.fillStyle = `rgba(${layer.color},${a})`;
          if(size < 1.15){
            ctx.fillRect(x, y, 1, 1);
          } else {
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  const dust = DEPTH_DUST_LAYER;
  const tile = dust.tile;
  const minX = Math.floor((cam.x * dust.parallax - tile) / tile);
  const maxX = Math.ceil(((cam.x + cam.w) * dust.parallax + tile) / tile);
  const minY = Math.floor((cam.y * dust.parallax - tile) / tile);
  const maxY = Math.ceil(((cam.y + cam.h) * dust.parallax + tile) / tile);
  ctx.globalCompositeOperation = 'lighter';
  for(let ty = minY; ty <= maxY; ty++){
    for(let tx = minX; tx <= maxX; tx++){
      for(let i = 0; i < dust.count; i++){
        const rx = hashUnit(tx, ty, dust.seed + i * 29);
        const ry = hashUnit(tx, ty, dust.seed + i * 47);
        const k = hashUnit(tx, ty, dust.seed + i * 71);
        const wx = tx * tile + rx * tile;
        const wy = ty * tile + ry * tile;
        const x = wx - cam.x * dust.parallax;
        const y = wy - cam.y * dust.parallax;
        if(x < -32 || x > cam.w + 32 || y < -32 || y > cam.h + 32) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.42 + k * 0.18);
        const w = 18 + k * 30;
        const h = 0.8 + k * 1.4;
        const g = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
        g.addColorStop(0, 'rgba(160,210,255,0)');
        g.addColorStop(0.5, `rgba(190,226,255,${0.035 + k * 0.045})`);
        g.addColorStop(1, 'rgba(160,210,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function starTextureSeed(star){
  if(typeof star.texSeed === 'number') return star.texSeed;
  const x = Math.floor(star.x || 0);
  const y = Math.floor(star.y || 0);
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

function drawTexturedStar(ctx, star, x, y, r){
  const hue = (typeof star.hue === 'number') ? star.hue : 210;
  const unstable = star.phase === 'unstable';
  const texSeed = starTextureSeed(star);
  const tex = getStarTexture({ hue, seed: texSeed });

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  let coronaSeed = texSeed || 1;
  const coronaRnd = () => {
    coronaSeed = (Math.imul(coronaSeed, 1664525) + 1013904223) >>> 0;
    return coronaSeed / 4294967296;
  };
  ctx.lineCap = 'round';
  for(let i = 0; i < 26; i++){
    const a = coronaRnd() * Math.PI * 2;
    const inner = r * (0.95 + coronaRnd() * 0.08);
    const outer = r * (1.03 + coronaRnd() * (unstable ? 0.34 : 0.22));
    ctx.strokeStyle = `hsla(${Math.floor(hue + 8 + coronaRnd() * 18)},100%,78%,${unstable ? 0.055 : 0.03})`;
    ctx.lineWidth = Math.max(0.7, r * (0.004 + coronaRnd() * 0.008));
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
    ctx.stroke();
  }

  ctx.strokeStyle = `hsla(${Math.floor(hue + 10)},100%,80%,${unstable ? 0.1 : 0.045})`;
  ctx.lineWidth = Math.max(0.8, r * 0.01);
  const rayCount = 8;
  const seed = texSeed;
  for(let i = 0; i < rayCount; i++){
    const a = (i / rayCount) * Math.PI * 2 + (seed % 628) / 100;
    const inner = r * (0.98 + (i % 2) * 0.03);
    const outerR = r * (1.1 + ((seed >>> (i % 12)) & 7) * 0.028);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * outerR, y + Math.sin(a) * outerR);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(tex, x - r, y - r, r * 2, r * 2);
  ctx.restore();

  const core = ctx.createRadialGradient(x - r * 0.18, y - r * 0.2, 0, x, y, r * 0.38);
  core.addColorStop(0, 'rgba(255,255,255,0.56)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function drawBlackHole(ctx, b, cam, time){
  const img = getImage('blackhole');
  if (!img) {
    drawProceduralBlackHole(ctx, b, cam, time);
    return;
  }
  const x = b.x - cam.x;
  const y = b.y - cam.y;
  const r = b.r || 1;
  const seed = ((Math.floor(b.x || 0) * 73856093) ^ (Math.floor(b.y || 0) * 19349663)) >>> 0;
  const spin = time * 0.002 + (seed & 1023) * 0.0008;
  const visualR = r * 2.75;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'screen';
  const lens = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, visualR * 1.04);
  lens.addColorStop(0, 'rgba(255,255,255,0)');
  lens.addColorStop(0.42, 'rgba(120,190,255,0.075)');
  lens.addColorStop(0.74, 'rgba(176,112,255,0.05)');
  lens.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lens;
  ctx.beginPath();
  ctx.arc(0, 0, visualR * 1.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(spin);
  ctx.drawImage(img, -visualR, -visualR, visualR * 2, visualR * 2);
  ctx.restore();
}

function drawProceduralBlackHole(ctx, b, cam, time){
  const x = b.x - cam.x;
  const y = b.y - cam.y;
  const r = b.r || 1;
  const seed = ((Math.floor(b.x || 0) * 73856093) ^ (Math.floor(b.y || 0) * 19349663)) >>> 0;
  const spin = time * 0.012 + (seed & 1023) * 0.006;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'screen';
  const lens = ctx.createRadialGradient(0, 0, r * 0.48, 0, 0, r * 2.55);
  lens.addColorStop(0, 'rgba(255,255,255,0)');
  lens.addColorStop(0.38, 'rgba(120,190,255,0.09)');
  lens.addColorStop(0.72, 'rgba(176,112,255,0.055)');
  lens.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lens;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(spin);
  ctx.scale(1, 0.34);
  const disk = ctx.createRadialGradient(0, 0, r * 0.82, 0, 0, r * 2.25);
  disk.addColorStop(0, 'rgba(255,255,255,0)');
  disk.addColorStop(0.2, 'rgba(154,221,255,0.28)');
  disk.addColorStop(0.48, 'rgba(255,174,83,0.18)');
  disk.addColorStop(0.74, 'rgba(154,116,255,0.1)');
  disk.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = disk;
  drawAnnulus(ctx, r * 0.78, r * 2.25);
  ctx.lineCap = 'round';
  for(let i = 0; i < 5; i++){
    const rr = r * (1.05 + i * 0.24);
    const a0 = spin * (i % 2 ? -0.65 : 0.5) + i * 0.9;
    ctx.strokeStyle = `rgba(220,238,255,${0.16 - i * 0.018})`;
    ctx.lineWidth = Math.max(1, r * (0.028 - i * 0.002));
    ctx.beginPath();
    ctx.arc(0, 0, rr, a0, a0 + Math.PI * (0.42 + i * 0.06));
    ctx.stroke();
  }
  ctx.restore();

  ctx.globalCompositeOperation = 'source-over';
  const core = ctx.createRadialGradient(-r * 0.12, -r * 0.18, r * 0.08, 0, 0, r);
  core.addColorStop(0, '#030308');
  core.addColorStop(0.72, '#000');
  core.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(210,236,255,0.28)';
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.02, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawArrow(ctx, x, y, vx, vy, color, width = 1){
  const len = Math.hypot(vx, vy);
  if (len < 0.5) return;
  const ux = vx / len;
  const uy = vy / len;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + vx, y + vy);
  ctx.stroke();
  const hx = x + vx;
  const hy = y + vy;
  const head = Math.min(7, Math.max(4, len * 0.24));
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - ux * head - uy * head * 0.55, hy - uy * head + ux * head * 0.55);
  ctx.lineTo(hx - ux * head + uy * head * 0.55, hy - uy * head - ux * head * 0.55);
  ctx.closePath();
  ctx.fill();
}

function drawGravityDebug(ctx, state, cam){
  if (!state.debugGravity) return;
  const colors = {
    planet: 'rgba(109,242,214,0.42)',
    star: 'rgba(255,213,107,0.42)',
    blackhole: 'rgba(188,124,255,0.5)'
  };
  ctx.save();
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textBaseline = 'middle';
  const gravitySrcs = gravitySources(state);
  for (const source of gravitySrcs){
    const cfg = gravityConfigFor(source.kind);
    const body = source.body;
    const influence = (body.r || 1) + (cfg.influence || 0);
    if (!isVisible(cam, { x: body.x, y: body.y, r: influence })) continue;
    const x = body.x - cam.x;
    const y = body.y - cam.y;
    const color = colors[source.kind] || 'rgba(255,255,255,0.35)';
    ctx.strokeStyle = color;
    ctx.lineWidth = source.kind === 'blackhole' ? 2 : 1;
    ctx.setLineDash(source.kind === 'planet' ? [6, 8] : source.kind === 'star' ? [12, 9] : [3, 5]);
    ctx.beginPath();
    ctx.arc(x, y, influence, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.fillText(`${source.kind} gravity`, x + 10, y);
  }

  const step = 180;
  const startX = Math.floor(cam.x / step) * step;
  const startY = Math.floor(cam.y / step) * step;
  const vectorScale = GRAVITY.debugVectorScale || 1800;
  for (let wx = startX; wx <= cam.x + cam.w + step; wx += step){
    for (let wy = startY; wy <= cam.y + cam.h + step; wy += step){
      const v = gravityVectorAt(state, wx, wy, gravitySrcs);
      if (v.mag < 0.0008) continue;
      const sx = wx - cam.x;
      const sy = wy - cam.y;
      const len = Math.min(54, Math.max(4, v.mag * vectorScale));
      const ux = v.ax / (v.mag || 1);
      const uy = v.ay / (v.mag || 1);
      drawArrow(ctx, sx, sy, ux * len, uy * len, 'rgba(146,255,166,0.58)', 1);
    }
  }

  const ship = state.ship;
  if (ship) {
    const v = gravityVectorAt(state, ship.x, ship.y, gravitySrcs);
    if (v.mag > 0.0001) {
      const len = Math.min(90, Math.max(16, v.mag * vectorScale * 1.25));
      drawArrow(
        ctx,
        ship.x - cam.x,
        ship.y - cam.y,
        (v.ax / v.mag) * len,
        (v.ay / v.mag) * len,
        'rgba(255,255,255,0.9)',
        2
      );
    }
  }
  ctx.restore();
}

function drawViewportVignette(ctx, cam){
  const w = cam.w || 0;
  const h = cam.h || 0;
  if(!w || !h) return;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const outer = Math.hypot(w, h) * 0.58;
  const inner = Math.min(w, h) * 0.24;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const vignette = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.58, 'rgba(0,0,0,0.16)');
  vignette.addColorStop(0.82, 'rgba(0,0,0,0.48)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  const rim = ctx.createLinearGradient(0, 0, w, h);
  rim.addColorStop(0, 'rgba(95,255,202,0.07)');
  rim.addColorStop(0.5, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(255,92,78,0.07)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawDebugBoundingBoxes(ctx, state, cam){
  if (!state.debugBoundingBoxes) return;
  const groups = [
    ['ship', state.ship ? [state.ship] : [], 'rgba(109,242,214,0.95)'],
    ['planet', state.planets || [], 'rgba(109,242,214,0.62)'],
    ['star', state.stars || [], 'rgba(255,213,107,0.72)'],
    ['blackhole', state.blackholes || [], 'rgba(188,124,255,0.72)'],
    ['asteroid', state.asteroids || [], 'rgba(180,190,200,0.55)'],
    ['pirate', state.pirates || [], 'rgba(255,90,90,0.75)'],
    ['hunter', state.hunters || [], 'rgba(255,150,80,0.72)'],
    ['trader', state.traders || [], 'rgba(90,170,255,0.62)'],
    ['patrol', state.patrols || [], 'rgba(95,255,136,0.62)'],
    ['base', state.pirateBases || [], 'rgba(255,80,80,0.72)'],
    ['bullet', state.bullets || [], 'rgba(255,255,120,0.72)']
  ];
  ctx.save();
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  for (const [label, items, color] of groups) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    for (const item of items) {
      if (!item || !isVisible(cam, item)) continue;
      const r = label === 'planet' ? planetInteractionRadius(item) : Math.max(2, item.r || 2);
      const x = item.x - cam.x;
      const y = item.y - cam.y;
      ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      if (r >= 8) ctx.fillText(label, x - r, y - r - 12);
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawWorld(ctx, state){
  const cam = state.camera;
  ctx.clearRect(0,0,cam.w,cam.h);
  // Apply subtle camera shake as a global translation
  const _ox = state.shakeX || 0;
  const _oy = state.shakeY || 0;
  ctx.save();
  ctx.translate(_ox, _oy);
  const ship = state.ship;
  const time = state.time || 0;
  drawCameraDepthBackdrop(ctx, cam);
  // Discover visible planets and toast once when charted
  if (!state._discoveredSet){
    state._discoveredSet = new Set(Array.isArray(state.discovered) ? state.discovered : []);
  }
  for (const p of state.planets){
    if (state._discoveredSet.has(p.id)) continue;
    if (p.x > cam.x - p.r && p.x < cam.x + cam.w + p.r && p.y > cam.y - p.r && p.y < cam.y + cam.h + p.r){
      state._discoveredSet.add(p.id);
      if (Array.isArray(state.discovered)) state.discovered.push(p.id);
      toast(`Charted ${p.name}`);
    }
  }
  // Computed once per frame (not once per nebula blob) since gravity sources
  // don't move mid-frame — avoids rebuilding this list ~900 times/frame.
  const nebulaGravitySrcs = nebulaGravityBodies(state);
  if(state.nebulae){
    for(const n of state.nebulae){
      drawNebulaCloud(ctx, cam, n, state, 'back', nebulaGravitySrcs);
    }
  }
  for(const s of state.stars){
    if(!isVisible(cam, s)) continue;
    const r = s.r || 1;
    const x = s.x - cam.x, y = s.y - cam.y;
    drawTexturedStar(ctx, s, x, y, r);
    // Subtle pulse ring when unstable
    if (s.phase === 'unstable'){
      s.pulse = (s.pulse || 0) + 0.06;
      const k = (Math.sin(s.pulse) + 1) * 0.5; // 0..1
      ctx.save();
      ctx.globalAlpha = 0.2 + 0.2 * k;
      ctx.strokeStyle = 'rgba(255,220,120,0.72)';
      ctx.lineWidth = 1.5 + 1.5 * k;
      ctx.beginPath();
      ctx.arc(x, y, r + 10 + 7 * k, 0, Math.PI*2);
      ctx.stroke();
      ctx.globalAlpha = 0.1 + 0.14 * k;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.25 + k * 0.14), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Star label if enabled
    if (state.entityNaming && s.name) {
      ctx.save();
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const lx = x + r + 10;
      const ly = y;
      const text = s.name;
      const w = ctx.measureText(text).width;
      const padX = 8, padY = 4;
      const bw = w + padX*2, bh = 16 + (padY-4);
      const rx = 8;
      const bx = lx - padX, by = ly - bh/2;
      ctx.fillStyle = 'rgba(10,14,22,0.65)';
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + rx, by);
      ctx.lineTo(bx + bw - rx, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rx);
      ctx.lineTo(bx + bw, by + bh - rx);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rx, by + bh);
      ctx.lineTo(bx + rx, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rx);
      ctx.lineTo(bx, by + rx);
      ctx.quadraticCurveTo(bx, by, bx + rx, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(230,237,243,0.95)';
      ctx.fillText(text, lx, ly);
      ctx.restore();
    }
  }
  const planetDepthContext = makePlanetDepthContext(state.planets);
  for(const p of state.planets){
    const visibleR = Math.max((p.r || 1) * 1.65, p.rings ? (p.rings.outer || p.r || 1) * 1.65 : 0);
    if(!isVisible(cam, { x: p.x, y: p.y, r: visibleR })) continue;
    const depth = planetDepthMetrics(p, ship, cam, planetDepthContext);
    const px = depth.x, py = depth.y, pr = depth.r;
    drawPlanetAura(ctx, p, px, py, time, depth);
    drawPlanetRings(ctx, p, px, py, time, false, depth);
    // Base planet disc
    const dpr = Math.max(1, Math.min(getDevicePixelRatio(), 2));
    const planetImg = getPlanetTexture({ hue: p.hue, noiseSeed: p.texSeed, r: p.r, type: p.type, dpr });
    ctx.save();
    ctx.globalAlpha = lerp(0.72, 1, depth.detail);
    if(typeof ctx.filter === 'string'){
      const blur = (1 - depth.detail) * 1.55;
      const saturation = Math.round(lerp(70, 108, depth.detail));
      const contrast = Math.round(lerp(78, 108, depth.detail));
      ctx.filter = `blur(${blur.toFixed(2)}px) saturate(${saturation}%) contrast(${contrast}%)`;
    }
    ctx.drawImage(planetImg, px - pr, py - pr, pr * 2, pr * 2);
    if(typeof ctx.filter === 'string') ctx.filter = 'none';
    ctx.restore();
    drawPlanetDistanceHaze(ctx, px, py, depth);
    drawPlanetWeather(ctx, p, px, py, time, depth);
    drawPlanetCloseDetail(ctx, p, px, py, time, depth);
    drawPlanetRings(ctx, p, px, py, time, true, depth);

    // Planet label (name) with pill background and slight distance fade
    if (p.name) {
      ctx.save();
      const cx = cam.x + cam.w/2, cy = cam.y + cam.h/2;
      const distToCam = Math.hypot(p.x - cx, p.y - cy);
      const maxd = Math.max(cam.w, cam.h);
      const alpha = Math.max(0.48, Math.min(1, (1 - distToCam / maxd) * 0.72 + depth.detail * 0.42));
      const text = p.name;
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lx = px;
      const ly = py - pr - 12; // above the rendered planet
      const w = ctx.measureText(text).width;
      const padX = 8, padY = 4;
      const bw = w + padX*2, bh = 16 + (padY-4);
      // rounded pill background
      const rx = 8;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(10,14,22,0.65)';
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      const bx = lx - bw/2, by = ly - bh/2;
      ctx.beginPath();
      ctx.moveTo(bx + rx, by);
      ctx.lineTo(bx + bw - rx, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rx);
      ctx.lineTo(bx + bw, by + bh - rx);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rx, by + bh);
      ctx.lineTo(bx + rx, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rx);
      ctx.lineTo(bx, by + rx);
      ctx.quadraticCurveTo(bx, by, bx + rx, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // text
      ctx.fillStyle = `rgba(230,237,243,${alpha})`;
      ctx.globalAlpha = 1;
      ctx.fillText(text, lx, ly);
      ctx.restore();
    }

    // Docking prompt if player is nearby
    if (ship && !state.docked) {
      const dx = ship.x - p.x, dy = ship.y - p.y;
      const d = Math.hypot(dx, dy);
      const DOCK_R = 80;
      if (d <= p.r + DOCK_R) {
        const speed = Math.hypot(ship.vx||0, ship.vy||0);
        const ready = speed <= 0.8;
        const msg = ready ? 'Press E to Dock' : 'Too fast — slow down';
        ctx.save();
        ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lx = px;
        const ly = py + pr + 14; // below the rendered planet
        const w = ctx.measureText(msg).width;
        const padX = 8, padY = 4;
        const bw = w + padX*2, bh = 16 + (padY-4);
        const rx = 8;
        ctx.fillStyle = ready ? 'rgba(20,44,32,0.75)' : 'rgba(44,20,20,0.75)';
        ctx.strokeStyle = ready ? 'rgba(80,200,120,0.5)' : 'rgba(200,80,80,0.5)';
        ctx.lineWidth = 1;
        const bx = lx - bw/2, by = ly - bh/2;
        ctx.beginPath();
        ctx.moveTo(bx + rx, by);
        ctx.lineTo(bx + bw - rx, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rx);
        ctx.lineTo(bx + bw, by + bh - rx);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rx, by + bh);
        ctx.lineTo(bx + rx, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rx);
        ctx.lineTo(bx, by + rx);
        ctx.quadraticCurveTo(bx, by, bx + rx, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(230,237,243,0.95)';
        ctx.fillText(msg, lx, ly);
        ctx.restore();
      }
    }
  }
  if(state.nebulae){
    for(const n of state.nebulae){
      drawNebulaCloud(ctx, cam, n, state, 'front', nebulaGravitySrcs);
    }
  }
  // Solar flares (dissipating particles along expanding ring).
  // Every particle used the same shape/radius and only differed by a random
  // alpha baked into the gradient's color stop, which meant a fresh
  // CanvasGradient per particle (up to 48 per flare per frame). Since scaling
  // a fully-opaque gradient by ctx.globalAlpha produces the same composited
  // result as baking that alpha into the stop, build the gradient once (at a
  // local origin, repositioned via translate) and vary only globalAlpha.
  if (state.flares && state.flares.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flarePr = 2; // particle radius
    const flareGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, flarePr*2.2);
    flareGrad.addColorStop(0, 'rgba(255,220,140,1)');
    flareGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flareGrad;
    for (const f of state.flares) {
      const x = f.x - cam.x, y = f.y - cam.y;
      const maxR = (f.limit != null) ? f.limit : (f.originR || 40) + (GRAVITY.flareMaxRange || 900);
      const t = Math.max(0, Math.min(1, (f.r - (f.originR||0)) / Math.max(1, (maxR - (f.originR||0)))));
      const baseAlpha = 0.35 * (1 - t); // fade as it expands
      const count = 48; // particles along circumference
      for(let k=0;k<count;k++){
        const ang = (k / count) * Math.PI * 2 + (t * 2); // small drift
        const px = x + Math.cos(ang) * f.r;
        const py = y + Math.sin(ang) * f.r;
        const a = baseAlpha * (0.6 + 0.4 * Math.random());
        ctx.globalAlpha = a;
        ctx.translate(px, py);
        ctx.beginPath();
        ctx.arc(0, 0, flarePr*2.2, 0, Math.PI*2);
        ctx.fill();
        ctx.translate(-px, -py);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // draw black holes
  if(state.blackholes){
    for(const b of state.blackholes){
      if(!isVisible(cam, { x: b.x, y: b.y, r: (b.r || 1) * 2.6 })) continue;
      drawBlackHole(ctx, b, cam, time);
      if (state.entityNaming && b.name){
        const x = b.x - cam.x + b.r + 10;
        const y = b.y - cam.y;
        const text = b.name;
        ctx.save();
        ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(text).width;
        const padX = 8, padY = 4;
        const bw = w + padX*2, bh = 16 + (padY-4);
        const rx = 8;
        const bx = x - padX, by = y - bh/2;
        ctx.fillStyle = 'rgba(10,14,22,0.65)';
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + rx, by);
        ctx.lineTo(bx + bw - rx, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rx);
        ctx.lineTo(bx + bw, by + bh - rx);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rx, by + bh);
        ctx.lineTo(bx + rx, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rx);
        ctx.lineTo(bx, by + rx);
        ctx.quadraticCurveTo(bx, by, bx + rx, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(230,237,243,0.95)';
        ctx.fillText(text, x, y);
        ctx.restore();
      }
    }
  }
  // ship reference declared earlier in this function
  const shipImg = getImage('ship');
  const traderImg = getImage('traderShip') || shipImg;
  const asteroidImg = getImage('asteroid') || getImage('planet');
  // pirate bases (console-style disc with outline)
  if(state.pirateBases){
    for(const b of state.pirateBases){
      if(!isVisible(cam, b)) continue;
      const x = b.x - cam.x, y = b.y - cam.y;
      ctx.save();
      ctx.fillStyle = '#633';
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#a33'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
      if (state.entityNaming && b.name){
        const lx = x + b.r + 10;
        const ly = y;
        const text = b.name + (b.hp != null ? ` (${Math.max(0,b.hp)})` : '');
        ctx.save();
        ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(text).width;
        const padX = 8, padY = 4;
        const bw = w + padX*2, bh = 16 + (padY-4);
        const rx = 8;
        const bx = lx - padX, by = ly - bh/2;
        ctx.fillStyle = 'rgba(10,14,22,0.65)';
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + rx, by);
        ctx.lineTo(bx + bw - rx, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rx);
        ctx.lineTo(bx + bw, by + bh - rx);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rx, by + bh);
        ctx.lineTo(bx + rx, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rx);
        ctx.lineTo(bx, by + rx);
        ctx.quadraticCurveTo(bx, by, bx + rx, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(230,237,243,0.95)';
        ctx.fillText(text, lx, ly);
        ctx.restore();
      }
    }
  }
  for(const a of state.asteroids){
    if(!isVisible(cam, a)) continue;
    const tex = getAsteroidTexture({ r: Math.max(6, a.r|0), seed: (a.seed|0) });
    ctx.save();
    ctx.translate(a.x - cam.x, a.y - cam.y);
    if (a.a) ctx.rotate(a.a);
    ctx.drawImage(tex, -a.r, -a.r, a.r*2, a.r*2);
    ctx.restore();
  }
  for(const t of state.traders){
    if(!isVisible(cam, t)) continue;
    ctx.save();
    ctx.translate(t.x - cam.x, t.y - cam.y);
    ctx.rotate(t.a || 0);
    ctx.drawImage(traderImg, -t.r, -t.r, t.r*2, t.r*2);
    ctx.restore();
  }
  if(state.patrols){
    for(const t of state.patrols){
      if(!isVisible(cam, t)) continue;
      ctx.save();
      ctx.translate(t.x - cam.x, t.y - cam.y);
      ctx.rotate(t.a || 0);
      // Legacy-style patrol triangle in green tint
      ctx.strokeStyle = '#4f8';
      ctx.lineWidth = 2;
      const r = t.r || 14;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r*0.6, -r*0.6);
      ctx.lineTo(-r*0.6, r*0.6);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
  for(const p of state.pirates){
    if(!isVisible(cam, p)) continue;
    ctx.save();
    ctx.translate(p.x - cam.x, p.y - cam.y);
    drawPirateShipSprite(ctx, p, ship);
    ctx.restore();
  }
  if(state.hunters){
    for(const h of state.hunters){
      if(!isVisible(cam, h)) continue;
      ctx.save();
      ctx.translate(h.x - cam.x, h.y - cam.y);
      ctx.rotate(h.a || 0);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      const r = h.r || 14;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r*0.6, -r*0.6);
      ctx.lineTo(-r*0.6, r*0.6);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
  // Navigation arrow to custom marker or tracked mission
  let targetPoint = null;
  if (state.tracked){
    // find mission and its destination planet
    let destId = null;
    for (const m of (state.missions||[])){ if (m.id === state.tracked){ destId = m.to; break; } }
    if (destId != null){
      const pl = state.planets.find(pp => pp.id === destId);
      if (pl) targetPoint = { x: pl.x, y: pl.y, label: pl.name };
    }
  }
  if (!targetPoint && state.navTarget){
    targetPoint = { x: state.navTarget.x, y: state.navTarget.y };
  }
  if (targetPoint){
    const target = state.navTarget;
    const cx = cam.x + cam.w/2, cy = cam.y + cam.h/2;
    const dx = (targetPoint.x) - cx, dy = (targetPoint.y) - cy; // in world coords
    const ang = Math.atan2(dy, dx);
    const screenCx = cam.w/2 + (state.shakeX||0), screenCy = cam.h/2 + (state.shakeY||0);
    const R = Math.min(cam.w, cam.h) / 2 - 24;
    const ax = screenCx + Math.cos(ang) * R;
    const ay = screenCy + Math.sin(ang) * R;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(109,242,214,.9)';
    ctx.beginPath();
    const size = 10;
    ctx.moveTo(size, 0);
    ctx.lineTo(-size, -size*0.8);
    ctx.lineTo(-size*0.2, 0);
    ctx.lineTo(-size, size*0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Gradients only depend on (color, radius) — most particles in a burst share both,
  // so caching per-frame by that key avoids recreating a CanvasGradient per particle.
  // The gradient is built at local origin (0,0) and repositioned via translate at
  // fill time, since gradient coordinates are resolved through the CTM in effect
  // when they're used, not when they were created.
  const particleGradientCache = new Map();
  const getParticleGradient = (col, r) => {
    const rKey = Math.round(r * 4) / 4;
    const key = col + '|' + rKey;
    let g = particleGradientCache.get(key);
    if (!g) {
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, rKey*2.2);
      g.addColorStop(0, col);
      g.addColorStop(0.2, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      particleGradientCache.set(key, g);
    }
    return g;
  };
  const drawParticleLayer = (predicate) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for(const p of state.particles){
      if(!predicate(p) || !isVisible(cam, p)) continue;
      const alpha = Math.max(0, Math.min(1, (p.life || 0) / (p.max || 1)));
      const x = p.x - cam.x, y = p.y - cam.y;
      const r = Math.max(0.8, p.r || 1);
      const col = p.color || '#f80';
      ctx.globalAlpha = (p.drawLayer === 'shipFx' ? 0.9 : 0.6) * alpha;
      ctx.fillStyle = getParticleGradient(col, r);
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.arc(0, 0, r*2.2, 0, Math.PI*2);
      ctx.fill();
      ctx.translate(-x, -y);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  };

  // World particles sit behind the player hull.
  drawParticleLayer(p => p.drawLayer !== 'shipFx');

  // Ship hull
  // Optional flicker during invulnerability
  let drawShip = true;
  if (typeof ship.inv === 'number' && ship.inv > 0) {
    // simple blink: skip some frames while invulnerable
    drawShip = (Math.floor(ship.inv) % 2 === 0);
  }
  if (drawShip) {
    ctx.save();
    ctx.translate(ship.x - cam.x, ship.y - cam.y);
    drawPlayerShipSprite(ctx, ship);
    ctx.restore();
  }

  // Ship engine FX sit over the hull so front brake jets remain visible.
  drawParticleLayer(p => p.drawLayer === 'shipFx');

  // Bullets with small glow.
  // Bullet radius is fixed and there are only two colors (friendly/enemy), so
  // both gradients are built once and reused (repositioned via translate) instead
  // of allocating a new CanvasGradient per bullet per frame.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bulletR = 2.2;
  const bulletGradients = {};
  const getBulletGradient = (col) => {
    let g = bulletGradients[col];
    if (!g) {
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, bulletR*2);
      g.addColorStop(0, `rgba(${col},1.0)`);
      g.addColorStop(0.4, `rgba(${col},0.8)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      bulletGradients[col] = g;
    }
    return g;
  };
  for(const b of state.bullets){
    if(!isVisible(cam, b)) continue;
    const x = b.x - cam.x, y = b.y - cam.y;
    const col = (b.friendly === false) ? '255,70,70' : '255,240,80';
    ctx.fillStyle = getBulletGradient(col);
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, bulletR*2, 0, Math.PI*2);
    ctx.fill();
    ctx.translate(-x, -y);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  drawDebugBoundingBoxes(ctx, state, cam);
  drawGravityDebug(ctx, state, cam);
  // end outer shake translate
  ctx.restore();
  drawViewportVignette(ctx, cam);
}
