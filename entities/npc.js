export function makePirate(){
  const side = Math.floor(Math.random()*4);
  const m = 80;
  const pos = [
    {x:-m, y: Math.random()*WORLD.h},
    {x:WORLD.w+m, y: Math.random()*WORLD.h},
    {x:Math.random()*WORLD.w, y:-m},
    {x:Math.random()*WORLD.w, y:WORLD.h+m}
  ][side];
  return {x:pos.x, y:pos.y, r:16, vx:0, vy:0, a:0, hp:7, cool:120, boardTimer:90};
}

export function makePirateBase(){
  return {x:Math.random()*WORLD.w, y:Math.random()*WORLD.h, r:CFG.pirateBase.r, hp:CFG.pirateBase.hp, spawn:CFG.pirateBase.spawnEvery, cool:CFG.pirateBase.fireEvery};
}

export function makeHunter(){
  const side = Math.floor(Math.random()*4);
  const m = 80;
  const pos = [
    {x:-m, y: Math.random()*WORLD.h},
    {x:WORLD.w+m, y: Math.random()*WORLD.h},
    {x:Math.random()*WORLD.w, y:-m},
    {x:Math.random()*WORLD.w, y:WORLD.h+m}
  ][side];
  return {x:pos.x, y:pos.y, r:16, vx:0, vy:0, cool:CFG.hunters.fireEvery};
}

export function makePatrol(){
  const side = Math.floor(Math.random()*4);
  const m = 80;
  const pos = [
    {x:-m, y: Math.random()*WORLD.h},
    {x:WORLD.w+m, y: Math.random()*WORLD.h},
    {x:Math.random()*WORLD.w, y:-m},
    {x:Math.random()*WORLD.w, y:WORLD.h+m}
  ][side];
  const ang = Math.random()*Math.PI*2;
  const speed = 1.6;
  return {x:pos.x, y:pos.y, vx:Math.cos(ang)*speed, vy:Math.sin(ang)*speed, a:ang, scan:120, r:14};
}
