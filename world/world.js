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
import { getImage, getPlanetTexture, getAsteroidTexture } from '../core/assets.js';
import { spawnAsteroid } from './gen.js';

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
    state.particles.push(p);
  }
}

function addShake(state, amt){
  if (!state) return;
  if (typeof state.shakeMag !== 'number') state.shakeMag = 0;
  const cap = 8; // px
  state.shakeMag = Math.min(cap, state.shakeMag + (amt || 0));
}

export function updateWorld(state, dt){
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

    // Exhaust particles (lightweight): emit a couple per tick while thrusting
    // Keep overall cap to avoid runaway allocations
    const maxParticles = 400;
    if (state.particles.length < maxParticles) {
      const count = 2; // conservative
      for (let i = 0; i < count; i++) {
        const p = state.particlePool.acquire ? state.particlePool.acquire() : {x:0,y:0,vx:0,vy:0,r:1,life:0};
        // Emit slightly behind the ship with small lateral jitter
        const back = s.r * 0.9 + Math.random() * 2;
        const jitter = (Math.random() - 0.5) * 4;
        const ang = s.a + Math.PI; // behind
        p.x = s.x + Math.cos(ang) * back + Math.cos(s.a + Math.PI/2) * jitter;
        p.y = s.y + Math.sin(ang) * back + Math.sin(s.a + Math.PI/2) * jitter;
        const base = 0.6 + Math.random() * 0.6;
        p.vx = s.vx * 0.4 + Math.cos(ang) * base + (Math.random() - 0.5) * 0.2;
        p.vy = s.vy * 0.4 + Math.sin(ang) * base + (Math.random() - 0.5) * 0.2;
        p.r = 1 + Math.random() * 1.5;
        p.life = 30 + (Math.random() * 15); // ~0.5s at 60fps
        p.max = p.life;
        p.color = '#ff9f6b'; // warm exhaust
        state.particles.push(p);
      }
    }
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
    // Subtle planetary pull within 50px of the surface
    if (state.planets && state.planets.length){
      for (const pl of state.planets){
        const dx = pl.x - s.x, dy = pl.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d > pl.r && d < pl.r + 50){
          const t = 1 - ((d - pl.r) / 50); // 0..1 as approach surface
          const pull = 0.02 * t; // gentle
          const invd = d > 0 ? 1/d : 0;
          s.vx += dx * invd * pull * dt;
          s.vy += dy * invd * pull * dt;
        }
      }
    }
    for(const st of state.stars){
      const dx = s.x - st.x;
      const dy = s.y - st.y;
      if(dx*dx + dy*dy <= (s.r + (st.r||1))*(s.r + (st.r||1))){
        if(!state.invincible) state.gameOver = true;
      }
    }
  }

  // black hole gravity (pull on ship and some entities)
  function applyGravity(obj){
    // No gravity on the player ship while docked or anchored
    if (obj === s && (isDocked || s.anchored)) return;
    if(state.blackholes && state.blackholes.length){
      for(const b of state.blackholes){
      const dx = b.x - obj.x;
      const dy = b.y - obj.y;
      const d2 = dx*dx + dy*dy;
      // softened gravity
      const g = (GRAVITY.blackholePull) / (d2 + GRAVITY.blackholeFalloff);
      obj.vx = (obj.vx || 0) + dx * g * dt;
      obj.vy = (obj.vy || 0) + dy * g * dt;
      if(obj === s && d2 < (b.r*0.5)*(b.r*0.5)){
        if(!state.invincible){
          // configurable inner damage
          if (!state.godMode) s.hull -= GRAVITY.innerDamage * dt;
          addShake(state, 0.1);
          if(s.hull <= 0){
            s.lives--;
            if(s.lives <= 0) state.gameOver = true;
            s.hull = s.hullMax;
          }
        }
      }
      }
    }
    // star gravity (gentle, scaled by star size)
    if(state.stars && state.stars.length){
      for(const st of state.stars){
        const dx = st.x - obj.x;
        const dy = st.y - obj.y;
        const d2 = dx*dx + dy*dy;
        const mass = (st.r || 1) * (st.r || 1);
        const g = (GRAVITY.starPull * mass) / (d2 + GRAVITY.starFalloff);
        obj.vx = (obj.vx || 0) + dx * g * dt;
        obj.vy = (obj.vy || 0) + dy * g * dt;
      }
    }
  }
  applyGravity(s);

  // --- pirate respawn timer ---
  if (state.pirateSpawnTimer == null) state.pirateSpawnTimer = CFG.pirates.spawnEvery;
  state.pirateSpawnTimer -= dt;
  if (state.pirates.length < CFG.pirates.max && state.pirateSpawnTimer <= 0) {
    state.pirates.push(makePirate());
    state.pirateSpawnTimer = CFG.pirates.spawnEvery;
  }

  // --- simple pirate AI: seek the player and shoot, with boarding ---
  if (state.pirates && state.pirates.length) {
    for (const p of state.pirates) {
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      let ang = Math.atan2(dy, dx);
      // Avoid planets: add repulsion when near any planet
      let ax = Math.cos(ang) * 0.09; // stronger seek accel
      let ay = Math.sin(ang) * 0.09;
      let nearestD = Infinity; let nx = 0, ny = 0, pr = 0;
      for (const pl of state.planets){
        const pdx = p.x - pl.x; const pdy = p.y - pl.y;
        const d2 = pdx*pdx + pdy*pdy;
        if (d2 < nearestD){ nearestD = d2; nx = pdx; ny = pdy; pr = pl.r; }
      }
      if (nearestD < Infinity){
        const d = Math.max(0.001, Math.sqrt(nearestD));
        const avoidR = pr + 140; // standoff distance
        if (d < avoidR){
          const k = (avoidR - d) / avoidR; // 0..1
          // normalize away from planet
          const invd = 1/d; const rx = nx*invd, ry = ny*invd;
          ax += rx * (0.14 * k);
          ay += ry * (0.14 * k);
        }
      }
      // Slight bias to outer regions (away from world center)
      const cx = (WORLD.w/2) - p.x, cy = (WORLD.h/2) - p.y; // towards center
      const cd = Math.hypot(cx, cy) || 1;
      ax -= (cx / cd) * 0.005;
      ay -= (cy / cd) * 0.005;

      p.a = Math.atan2(ay, ax);
      const maxSpeed = (CFG.pirates?.speed || 1.8);
      p.vx = (p.vx || 0) + ax * dt;
      p.vy = (p.vy || 0) + ay * dt;
      const v = Math.hypot(p.vx, p.vy);
      if (v > maxSpeed) {
        p.vx = (p.vx / v) * maxSpeed;
        p.vy = (p.vy / v) * maxSpeed;
      }
      // fire towards player on cooldown and within aggro
      const distToShip = Math.hypot(dx, dy);
      p.cool = (p.cool || 0) - dt;
      if (p.cool <= 0 && distToShip < (CFG.pirates?.aggro || 380)) {
        const b = state.bulletPool.acquire();
        const speed = CFG.pirates.bulletSpeed;
        // shoot along current facing (seek vector after avoidance)
        const fx = Math.cos(p.a), fy = Math.sin(p.a);
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
      if (distToShip < br){
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
  // --- hunters: seek player (no shooting)
  if (state.hunters && state.hunters.length) {
    for (const h of state.hunters) {
      const dx = s.x - h.x;
      const dy = s.y - h.y;
      const ang = Math.atan2(dy, dx);
      h.a = ang;
      const accel = 0.05;
      const maxSpeed = 1.2;
      h.vx = (h.vx || 0) + Math.cos(ang) * accel * dt;
      h.vy = (h.vy || 0) + Math.sin(ang) * accel * dt;
      const v = Math.hypot(h.vx, h.vy);
      if (v > maxSpeed) {
        h.vx = (h.vx / v) * maxSpeed;
        h.vy = (h.vy / v) * maxSpeed;
      }
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
        applyGravity(e);
      }
      const dx = e.x - s.x;
      const dy = e.y - s.y;
      if(dx*dx + dy*dy < (e.r + s.r) * (e.r + s.r)){
        if(!state.invincible){
          if(type === 'pirate' || type === 'asteroid' || type === 'hunter'){
            let dmg = e.damage || 10;
            const shieldLvl = s.shield || 0;
            const mult = Math.max(0.5, 1 - 0.1 * (shieldLvl - 1));
            if (!state.godMode) s.hull -= dmg * mult;
            addShake(state, Math.min(6, (dmg || 10) * 0.25));
            spawnSparks(state, s.x, s.y, { count: 12, color: '#ffd56b' });
            if(s.hull <= 0){
              s.lives--;
              if(s.lives <= 0) state.gameOver = true;
              s.hull = s.hullMax;
            }
          } else if(type === 'trader'){
            state.gameOver = true;
          }
        }
        list.splice(i,1);
        continue;
      }
      // star destroys entities (NPCs/asteroids/traders/patrols)
      for(const st of state.stars){
        const sx = e.x - st.x; const sy = e.y - st.y;
        if(sx*sx + sy*sy <= (e.r + (st.r||1))*(e.r + (st.r||1))){
          list.splice(i,1);
          continue;
        }
      }
      // interactions with world objects for asteroids
      if (type === 'asteroid'){
        // destroyed by stars
        let destroyed = false;
        for(const st of state.stars){
          const ddx = e.x - st.x; const ddy = e.y - st.y;
          if (ddx*ddx + ddy*ddy <= (e.r + (st.r||1))*(e.r + (st.r||1))) { destroyed = true; break; }
        }
        if (destroyed){ list.splice(i,1); continue; }
        // bounce off planets
        for(const p of state.planets){
          const pdx = e.x - p.x; const pdy = e.y - p.y;
          const pr = e.r + p.r;
          if (pdx*pdx + pdy*pdy < pr*pr){
            // normal and reflect
            const d = Math.max(0.001, Math.hypot(pdx,pdy));
            const nx = pdx / d, ny = pdy / d;
            const vdotn = (e.vx||0)*nx + (e.vy||0)*ny;
            const elast = CFG.asteroids?.elasticity ?? 0.6;
            e.vx = (e.vx||0) - 2*vdotn*nx;
            e.vy = (e.vy||0) - 2*vdotn*ny;
            e.vx *= elast; e.vy *= elast;
            // push just outside planet
            const overlap = pr - d;
            e.x += nx * overlap;
            e.y += ny * overlap;
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
            toast('⚠️ Patrol detected contraband — leave the area!');
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
        state.pirates.push(np);
        base.spawn = CFG.pirateBase.spawnEvery;
      }
      if (base.cool <= 0){
        const dx = state.ship.x - base.x, dy = state.ship.y - base.y;
        const d = Math.hypot(dx, dy);
        if (d < 420){
          const a = Math.atan2(dy, dx);
          const blt = state.bulletPool.acquire();
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
      if (!state.invincible && (dxs*dxs + dys*dys) < rr*rr){
        if (!state.godMode) state.ship.hull -= 20;
        addShake(state, 2);
        if (state.ship.hull <= 0){
          state.ship.lives--; if (state.ship.lives <= 0) state.gameOver = true;
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
        toast('⚠️ Stellar instability nearby!');
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
      toast('☀️ Solar flare!');
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
      // Remove the star
      state.stars.splice(i, 1);
      toast('💥 Supernova! New asteroid field detected.');
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
        const mult = Math.max(0.5, 1 - 0.1 * (shieldLvl - 1));
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
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if(b.life <= 0){
      state.bullets.splice(i,1);
      state.bulletPool.release(b);
      continue;
    }
    // enemy bullet hits player
    if (b.friendly === false) {
      const dx = b.x - s.x;
      const dy = b.y - s.y;
      const rr = (b.r + s.r) * (b.r + s.r);
      if (dx*dx + dy*dy <= rr) {
        if(!state.invincible){
          const shieldLvl = s.shield || 0;
          const mult = Math.max(0.5, 1 - 0.1 * (shieldLvl - 1));
          const dmg = (b.damage || 5) * mult;
          if (!state.godMode) s.hull -= dmg;
          addShake(state, Math.min(6, dmg * 0.2));
          spawnSparks(state, s.x, s.y, { count: 10, color: '#ff9f6b' });
          if(s.hull <= 0){
            s.lives--;
            if(s.lives <= 0) state.gameOver = true;
            s.hull = s.hullMax;
          }
        }
        state.bullets.splice(i,1);
        state.bulletPool.release(b);
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
        state.bulletPool.release(b);
        continue;
      }
    }
    // remove bullets that leave the world area
    if (
      b.x < -10 || b.x > WORLD.w + 10 ||
      b.y < -10 || b.y > WORLD.h + 10
    ){
      state.bullets.splice(i,1);
      state.bulletPool.release(b);
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

export function drawWorld(ctx, state){
  const cam = state.camera;
  ctx.clearRect(0,0,cam.w,cam.h);
  // Apply subtle camera shake as a global translation
  const _ox = state.shakeX || 0;
  const _oy = state.shakeY || 0;
  ctx.save();
  ctx.translate(_ox, _oy);
  const ship = state.ship;
  // Discover visible planets and toast once when charted
  if (!state._discoveredSet){
    state._discoveredSet = new Set(Array.isArray(state.discovered) ? state.discovered : []);
  }
  for (const p of state.planets){
    if (state._discoveredSet.has(p.id)) continue;
    if (p.x > cam.x - p.r && p.x < cam.x + cam.w + p.r && p.y > cam.y - p.r && p.y < cam.y + cam.h + p.r){
      state._discoveredSet.add(p.id);
      if (Array.isArray(state.discovered)) state.discovered.push(p.id);
      toast(`📡 Charted ${p.name}`);
    }
  }
  const starImg = getImage('star');
  for(const s of state.stars){
    if(!isVisible(cam, s)) continue;
    const r = s.r || 1;
    const x = s.x - cam.x, y = s.y - cam.y;
    // Legacy-like star disc with dynamic hue (no per-frame texture baking)
    const hue = (typeof s.hue === 'number') ? s.hue : 210;
    const disc = ctx.createRadialGradient(x - r*0.2, y - r*0.2, r*0.2, x, y, r);
    disc.addColorStop(0, `hsl(${Math.floor(hue)},80%,90%)`);
    disc.addColorStop(1, `hsl(${Math.floor(hue)},80%,45%)`);
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    // Soft luminous halo
    const g = ctx.createRadialGradient(x, y, r*0.4, x, y, r*1.6);
    g.addColorStop(0, `hsla(${Math.floor(hue)},80%,80%,0.35)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r*1.6, 0, Math.PI*2);
    ctx.fill();
    // Subtle pulse ring when unstable
    if (s.phase === 'unstable'){
      s.pulse = (s.pulse || 0) + 0.06;
      const k = (Math.sin(s.pulse) + 1) * 0.5; // 0..1
      ctx.save();
      ctx.globalAlpha = 0.2 + 0.2 * k;
      ctx.strokeStyle = 'rgba(255,220,120,0.6)';
      ctx.lineWidth = 1.5 + 1.5 * k;
      ctx.beginPath();
      ctx.arc(x, y, r + 8 + 5 * k, 0, Math.PI*2);
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
  for(const p of state.planets){
    if(!isVisible(cam, p)) continue;
    const px = p.x - cam.x, py = p.y - cam.y;
    // Rings (behind) if any
    if (p.rings) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rings.tilt || 0);
      const grad = ctx.createRadialGradient(0,0,p.rings.inner, 0,0, p.rings.outer);
      grad.addColorStop(0, 'rgba(255,255,255,0.05)');
      grad.addColorStop(0.6, 'rgba(220,220,220,0.08)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      // annulus
      ctx.beginPath();
      ctx.arc(0, 0, p.rings.outer, 0, Math.PI*2);
      ctx.arc(0, 0, Math.max(0.1, p.rings.inner), 0, Math.PI*2, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Base planet disc
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const planetImg = getPlanetTexture({ hue: p.hue, noiseSeed: p.texSeed, r: p.r, type: p.type, dpr });
    ctx.drawImage(planetImg, px - p.r, py - p.r, p.r*2, p.r*2);
    // Atmosphere glow
    ctx.save();
    const ag = ctx.createRadialGradient(px - p.r*0.3, py - p.r*0.3, p.r*0.6, px, py, p.r*1.2);
    ag.addColorStop(0, `hsla(${Math.floor(p.hue||180)},70%,70%,0.12)`);
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(px, py, p.r*1.2, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // The baked texture incorporates legacy-style features; skip extra overlays.

    // Planet label (name) with pill background and slight distance fade
    if (p.name) {
      ctx.save();
      const cx = cam.x + cam.w/2, cy = cam.y + cam.h/2;
      const distToCam = Math.hypot(p.x - cx, p.y - cy);
      const maxd = Math.max(cam.w, cam.h);
      const alpha = Math.max(0.6, 1 - distToCam / maxd); // 0.6..1
      const text = p.name;
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lx = px;
      const ly = py - p.r - 12; // above the planet
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
        const ly = py + p.r + 14; // below planet
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
  // Docking prompt near nearest planet when not docked
  if (!state.docked){
    let nearest = null; let nd = Infinity;
    for (const pl of state.planets){
      const dx = pl.x - state.ship.x, dy = pl.y - state.ship.y; const d = Math.hypot(dx, dy);
      if (d < nd){ nd = d; nearest = pl; }
    }
    if (nearest && nd < nearest.r + 80){
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Press E to Dock', nearest.x - cam.x, nearest.y - cam.y - nearest.r - 10);
      ctx.restore();
    }
  }
  // Solar flares (dissipating particles along expanding ring)
  if (state.flares && state.flares.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of state.flares) {
      const x = f.x - cam.x, y = f.y - cam.y;
      const maxR = (f.limit != null) ? f.limit : (f.originR || 40) + (GRAVITY.flareMaxRange || 900);
      const t = Math.max(0, Math.min(1, (f.r - (f.originR||0)) / Math.max(1, (maxR - (f.originR||0)))));
      const baseAlpha = 0.35 * (1 - t); // fade as it expands
      const count = 48; // particles along circumference
      const pr = 2; // particle radius
      for(let k=0;k<count;k++){
        const ang = (k / count) * Math.PI * 2 + (t * 2); // small drift
        const px = x + Math.cos(ang) * f.r;
        const py = y + Math.sin(ang) * f.r;
        const a = baseAlpha * (0.6 + 0.4 * Math.random());
        const grad = ctx.createRadialGradient(px, py, 0, px, py, pr*2.2);
        grad.addColorStop(0, `rgba(255,220,140,${a.toFixed(3)})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, pr*2.2, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  // draw black holes
  if(state.blackholes){
    for(const b of state.blackholes){
      if(!isVisible(cam, b)) continue;
      ctx.save();
      ctx.translate(b.x - cam.x, b.y - cam.y);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, b.r + 4, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
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
  const pirateImg = getImage('pirateShip') || shipImg;
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
    ctx.rotate((p.a != null ? p.a : Math.atan2((s.y-p.y),(s.x-p.x))));
    ctx.strokeStyle = '#ffb3b3';
    ctx.lineWidth = 2;
    const r = p.r || 14;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r*0.6, -r*0.6);
    ctx.lineTo(-r*0.3, 0);
    ctx.lineTo(-r*0.6, r*0.6);
    ctx.closePath();
    ctx.stroke();
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
  // gates
  if(state.gates){
    ctx.strokeStyle = '#9bf';
    ctx.lineWidth = 2;
    for(const g of state.gates){
      if(!isVisible(cam, g)) continue;
      ctx.beginPath();
      ctx.arc(g.x - cam.x, g.y - cam.y, g.r, 0, Math.PI*2);
      ctx.stroke();
      // Prompt when near a gate
      const s = state.ship;
      const dx = g.x - s.x, dy = g.y - s.y; const d = Math.hypot(dx, dy);
      if (d < (g.r + 30)){
        ctx.save();
        ctx.fillStyle = 'rgba(200,220,255,0.85)';
        ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press F to Warp', g.x - cam.x, g.y - cam.y - g.r - 10);
        ctx.restore();
      }
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
  // Particles (exhaust etc.) - draw behind the ship
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(const p of state.particles){
    if(!isVisible(cam, p)) continue;
    const alpha = Math.max(0, Math.min(1, (p.life || 0) / (p.max || 1)));
    const x = p.x - cam.x, y = p.y - cam.y;
    const r = Math.max(0.8, p.r || 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r*2.2);
    const col = p.color || '#f80';
    g.addColorStop(0, col + (alpha > 0.6 ? '' : ''));
    g.addColorStop(0.2, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.6 * alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r*2.2, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Thruster flame directly attached to ship when thrusting
  ctx.save();
  ctx.translate(ship.x - cam.x, ship.y - cam.y);
  ctx.rotate(ship.a);
  if (ship.thrust) {
    ctx.globalCompositeOperation = 'lighter';
    const len = Math.max(10, ship.r * 0.9 + 6 + Math.random()*4);
    const base = Math.max(4, ship.r * 0.35);
    const grad = ctx.createLinearGradient(0, 0, -len, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.2, 'rgba(255,200,120,0.7)');
    grad.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-ship.r - 2, 0);
    ctx.lineTo(-ship.r - len, -base);
    ctx.lineTo(-ship.r - len, base);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // Ship hull (legacy-style vector triangle with gradient + outline)
  // Optional flicker during invulnerability
  let drawShip = true;
  if (typeof ship.inv === 'number' && ship.inv > 0) {
    // simple blink: skip some frames while invulnerable
    drawShip = (Math.floor(ship.inv) % 2 === 0);
  }
  if (drawShip) {
    // Body gradient
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
    // Side hatch/detail
    ctx.beginPath();
    ctx.rect(-ship.r * 0.95, -6, -11, 12);
    ctx.stroke();
  }
  ctx.restore();

  // Bullets with small glow
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(const b of state.bullets){
    if(!isVisible(cam, b)) continue;
    const x = b.x - cam.x, y = b.y - cam.y;
    const r = 2.2;
    const col = (b.friendly === false) ? '255,70,70' : '255,240,80';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r*2);
    g.addColorStop(0, `rgba(${col},1.0)`);
    g.addColorStop(0.4, `rgba(${col},0.8)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r*2, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  // end outer shake translate
  ctx.restore();
}
