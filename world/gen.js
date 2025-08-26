import { newShip } from '../entities/player.js';
import { makePirate } from '../entities/npc.js';

export function makePlanet(id){
  return { id, x: Math.random()*WORLD.w, y: Math.random()*WORLD.h, r: 40, offers: [] };
}

export function makeBlackHole(){
  return { x: Math.random()*WORLD.w, y: Math.random()*WORLD.h, r: 80 };
}

export function makeStar(){
  return { x: Math.random()*WORLD.w, y: Math.random()*WORLD.h, r: 60 };
}

export function reset(){
  const state = {
    ship: newShip(),
    credits: CFG.economy.startCredits,
    fuel: CFG.economy.fuelStart,
    ammo: CFG.economy.ammoStart,
    cargo: 0,
    cargoMax: CFG.economy.cargoMax,
    bullets: [],
    particles: [],
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
