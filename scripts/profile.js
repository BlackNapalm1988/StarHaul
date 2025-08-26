import { performance } from 'node:perf_hooks';
import { updateWorld, drawWorld } from '../world/world.js';
import { createPool } from '../core/pool.js';

function makeEntities(n, r){
  const arr = [];
  for(let i=0;i<n;i++){
    arr.push({x: Math.random()*4000, y: Math.random()*4000, r});
  }
  return arr;
}

const state = {
  camera: {x:0, y:0, w:1920, h:1080},
  stars: makeEntities(300, 2),
  planets: makeEntities(10, 40),
  bullets: [],
  particles: [],
  bulletPool: createPool(() => ({x:0,y:0,vx:0,vy:0,r:1,life:1})),
  particlePool: createPool(() => ({x:0,y:0,vx:0,vy:0,r:1,life:1}))
};

const ctx = {
  clearRect(){},
  fillRect(){},
  beginPath(){},
  arc(){},
  fill(){},
  set fillStyle(v){},
  get fillStyle(){return '#000';}
};

const frames = 600;
const start = performance.now();
for(let i=0;i<frames;i++){
  updateWorld(state, 1);
  drawWorld(ctx, state);
}
const end = performance.now();
console.log('Average frame ms:', (end-start)/frames);
