function isVisible(cam, obj){
  return (
    obj.x + obj.r > cam.x &&
    obj.x - obj.r < cam.x + cam.w &&
    obj.y + obj.r > cam.y &&
    obj.y - obj.r < cam.y + cam.h
  );
}

export function updateWorld(state, dt){
  const cam = state.camera;
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
  for(const p of state.planets){
    if(!isVisible(cam, p)) continue;
    ctx.fillStyle = '#0af';
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, Math.PI*2);
    ctx.fill();
  }
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
