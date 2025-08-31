import test from 'node:test';
import assert from 'node:assert/strict';
import { updateWorld } from './world.js';
import { WORLD } from '../core/config.js';

function baseState(){
  return {
    camera: { x: 0, y: 0, w: 800, h: 600 },
    ship: { x: WORLD.w/2, y: WORLD.h/2, vx:0, vy:0, a:0, turn:0, thrust:false, r: 16, centered:true, hull:100, hullMax:100, lives:3 },
    bullets: [], particles: [], bulletPool: { release(){} }, particlePool: { release(){} },
    pirates: [], traders: [], asteroids: [], stars: [], planets: [], blackholes: []
  };
}

test('large asteroid fragments into smaller pieces on hit', () => {
  const state = baseState();
  const big = { x: state.ship.x + 5, y: state.ship.y, vx:0, vy:0, r: 24, seed: 12345 };
  state.asteroids.push(big);
  // player bullet overlapping asteroid
  state.bullets.push({ x: big.x, y: big.y, vx:0, vy:0, r:2, life:10, friendly:true, damage:5 });
  updateWorld(state, 1);
  // asteroid removed and replaced by smaller ones
  assert.ok(state.asteroids.length >= 1, 'fragments created');
  assert.ok(state.asteroids.every(a => a.r < 24), 'all fragments smaller');
});

