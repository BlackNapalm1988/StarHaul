import { newShip } from '../entities/player.js';
import { makePirate } from '../entities/npc.js';
import { createPool } from '../core/pool.js';
import { WORLD, CFG } from '../core/config.js';

let rand = Math.random;

function seedRandom(seed) {
  let s = seed >>> 0;
  rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const num = (v, path) => {
  if (typeof v !== 'number') throw new Error(`CFG.${path} must be a number`);
};

num(CFG.economy?.startCredits, 'economy.startCredits');
num(CFG.economy?.fuelStart, 'economy.fuelStart');
num(CFG.economy?.ammoStart, 'economy.ammoStart');
num(CFG.economy?.cargoMax, 'economy.cargoMax');
num(CFG.planets, 'planets');
num(CFG.blackholes, 'blackholes');
num(CFG.stars, 'stars');

export function makePlanet(id){
  return { id, x: rand()*WORLD.w, y: rand()*WORLD.h, r: 40, offers: [] };
}

export function makeBlackHole(){
  return { x: rand()*WORLD.w, y: rand()*WORLD.h, r: 80 };
}

export function makeStar(){
  return { x: rand()*WORLD.w, y: rand()*WORLD.h, r: 60 };
}

export function makeAsteroid(){
  const ang = rand()*Math.PI*2;
  const speed = 0.2 + rand()*0.8;
  const r = 10 + rand()*20;
  return {
    x: rand()*WORLD.w,
    y: rand()*WORLD.h,
    vx: Math.cos(ang)*speed,
    vy: Math.sin(ang)*speed,
    r
  };
}

export function makeTrader(){
  const side = Math.floor(rand()*4);
  const m = 80;
  const pos = [
    {x:-m, y: rand()*WORLD.h},
    {x:WORLD.w+m, y: rand()*WORLD.h},
    {x:rand()*WORLD.w, y:-m},
    {x:rand()*WORLD.w, y:WORLD.h+m}
  ][side];
  const ang = rand()*Math.PI*2;
  const speed = 0.5 + rand();
  return {
    x: pos.x,
    y: pos.y,
    vx: Math.cos(ang)*speed,
    vy: Math.sin(ang)*speed,
    a: ang,
    r: 16
  };
}

export function spawnAsteroid(state){
  const a = makeAsteroid();
  state.asteroids.push(a);
  return a;
}

export function spawnTrader(state){
  const t = makeTrader();
  if(!state.traders) state.traders = [];
  state.traders.push(t);
  return t;
}

export function reset(seed = Math.random()){
  seedRandom(seed);
  const state = {
    seed,
    ship: newShip(),
    credits: CFG.economy.startCredits,
    fuel: CFG.economy.fuelStart,
    ammo: CFG.economy.ammoStart,
    cargo: 0,
    cargoMax: CFG.economy.cargoMax,
    reputation: 0,
    discovered: [],
    bullets: [],
    particles: [],
    bulletPool: createPool(() => ({x:0, y:0, vx:0, vy:0, r:2, life:0})),
    particlePool: createPool(() => ({x:0, y:0, vx:0, vy:0, r:1, life:0})),
    asteroids: [],
    planets: [],
    blackholes: [],
    pirates: [],
    traders: [],
    missions: [],
    stars: []
  };
  for(let i=0;i<CFG.planets;i++) state.planets.push(makePlanet(i));
  for(let i=0;i<CFG.blackholes;i++) state.blackholes.push(makeBlackHole());
  for(let i=0;i<CFG.stars;i++) state.stars.push(makeStar());
  for(let i=0;i<3;i++) state.pirates.push(makePirate(rand));
  for(let i=0;i<20;i++) state.asteroids.push(makeAsteroid());
  for(let i=0;i<2;i++) state.traders.push(makeTrader());
  return state;
}
