import { WORLD, CFG } from '../core/config.js';

const num = (v, path) => {
  if (typeof v !== 'number') throw new Error(`CFG.${path} must be a number`);
};

num(CFG.pirateBase?.r, 'pirateBase.r');
num(CFG.pirateBase?.hp, 'pirateBase.hp');
num(CFG.pirateBase?.spawnEvery, 'pirateBase.spawnEvery');
num(CFG.pirateBase?.fireEvery, 'pirateBase.fireEvery');
num(CFG.hunters?.fireEvery, 'hunters.fireEvery');

export function makePirate(rand = Math.random){
  const side = Math.floor(rand()*4);
  // spawn just inside the world bounds to avoid immediate culling
  const m = 10;
  const pos = [
    {x:m, y: rand()*WORLD.h},
    {x:WORLD.w - m, y: rand()*WORLD.h},
    {x:rand()*WORLD.w, y:m},
    {x:rand()*WORLD.w, y:WORLD.h - m}
  ][side];
  return {
    x:pos.x, y:pos.y, r:16, vx:0, vy:0, a:0,
    hp: (CFG.pirates?.hp || 7),
    cool: CFG.pirates.fireEvery,
    boardTimer: 0,
    kind:'pirate'
  };
}

export function makePirateBase(rand = Math.random){
  const tag = Math.floor((rand()*36**2)).toString(36).toUpperCase();
  return {x:rand()*WORLD.w, y:rand()*WORLD.h, r:CFG.pirateBase.r, hp:CFG.pirateBase.hp, spawn:CFG.pirateBase.spawnEvery, cool:CFG.pirateBase.fireEvery, kind:'base', name:`Pirate Base ${tag}`};
}

export function makeHunter(rand = Math.random){
  const side = Math.floor(rand()*4);
  const m = 10;
  const pos = [
    {x:m, y: rand()*WORLD.h},
    {x:WORLD.w - m, y: rand()*WORLD.h},
    {x:rand()*WORLD.w, y:m},
    {x:rand()*WORLD.w, y:WORLD.h - m}
  ][side];
  return {x:pos.x, y:pos.y, r:16, vx:0, vy:0, cool:CFG.hunters.fireEvery, kind:'hunter'};
}

export function makePatrol(rand = Math.random){
  const side = Math.floor(rand()*4);
  const m = 10;
  const pos = [
    {x:m, y: rand()*WORLD.h},
    {x:WORLD.w - m, y: rand()*WORLD.h},
    {x:rand()*WORLD.w, y:m},
    {x:rand()*WORLD.w, y:WORLD.h - m}
  ][side];
  const ang = rand()*Math.PI*2;
  const speed = 1.6;
  return {x:pos.x, y:pos.y, vx:Math.cos(ang)*speed, vy:Math.sin(ang)*speed, a:ang, scan:120, r:14, kind:'patrol'};
}
