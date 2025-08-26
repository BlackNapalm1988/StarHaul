import { newShip } from '../entities/player.js';
import { makePirate } from '../entities/npc.js';
import { createPool } from '../core/pool.js';

export function makePlanet(id){
  return { id, x: Math.random()*WORLD.w, y: Math.random()*WORLD.h, r: 40, offers: [] };
}

export function makeBlackHole(){
  return { x: Math.random()*WORLD.w, y: Math.random()*WORLD.h, r: 80 };
}

export function makeStar(){
  return { x: Math.random()*WORLD.w, y: Math.random()*WORLD.h, r: 60 };
}

export function reset(seed = Math.random()){
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
    missions: [],
    stars: []
  };
  for(let i=0;i<CFG.planets;i++) state.planets.push(makePlanet(i));
  for(let i=0;i<CFG.blackholes;i++) state.blackholes.push(makeBlackHole());
  for(let i=0;i<CFG.stars;i++) state.stars.push(makeStar());
  for(let i=0;i<3;i++) state.pirates.push(makePirate());
  return state;
}
