function isVisible(cam, obj){
  return (
    obj.x + obj.r > cam.x &&
    obj.x - obj.r < cam.x + cam.w &&
    obj.y + obj.r > cam.y &&
    obj.y - obj.r < cam.y + cam.h
  );
}

import { WORLD } from '../core/config.js';
import { getImage } from '../core/assets.js';

export function updateWorld(state, dt){
  const cam = state.camera;
  const s = state.ship;

  // --- ship physics ---
  s.a += s.turn * 0.1 * dt;
  if (s.thrust) {
    const acc = 0.1;
    s.vx += Math.cos(s.a) * acc * dt;
    s.vy += Math.sin(s.a) * acc * dt;
  }
  s.x += s.vx * dt;
  s.y += s.vy * dt;

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
  s.vx *= 0.99;
  s.vy *= 0.99;

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
    if(!isVisible(cam, b)) continue;
    // placeholder for in-view bullet logic
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
  for(const s of state.stars){
    if(!isVisible(cam, s)) continue;
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x - cam.x, s.y - cam.y, 2, 2);
  }
  const planetImg = getImage('planet');
  for(const p of state.planets){
    if(!isVisible(cam, p)) continue;
    ctx.drawImage(planetImg, p.x - cam.x - p.r, p.y - cam.y - p.r, p.r*2, p.r*2);
  }
  const ship = state.ship;
  const shipImg = getImage('ship');
  ctx.save();
  ctx.translate(ship.x - cam.x, ship.y - cam.y);
  ctx.rotate(ship.a);
  ctx.drawImage(shipImg, -ship.r, -ship.r, ship.r*2, ship.r*2);
  ctx.restore();
  ctx.fillStyle = '#ff0';
  for(const b of state.bullets){
    if(!isVisible(cam, b)) continue;
    ctx.fillRect(b.x - cam.x -1, b.y - cam.y -1, 2,2);
  }
  ctx.fillStyle = '#f80';
  for(const p of state.particles){
    if(!isVisible(cam, p)) continue;
    ctx.fillRect(p.x - cam.x, p.y - cam.y, 1,1);
  }
}
