import test from 'node:test';
import assert from 'node:assert/strict';
import { updateWorld } from './world.js';
import { WORLD } from '../core/config.js';

function makeState(invincible){
  return {
    invincible,
    camera: { x: 0, y: 0, w: 800, h: 600 },
    ship: { x: WORLD.w/2, y: WORLD.h/2, vx:0, vy:0, a:0, turn:0, thrust:false, r: 16, centered:true, hull:100, hullMax:100, lives:3 },
    bullets: [], particles: [], bulletPool: { release(){} }, particlePool: { release(){} },
    pirates: [], traders: [], asteroids: [], stars: [], planets: [], blackholes: []
  };
}

test('enemy bullets do not damage player when invincible', () => {
  const state = makeState(true);
  // enemy bullet overlapping ship
  state.bullets.push({ x: state.ship.x, y: state.ship.y, vx:0, vy:0, r:2, life:10, friendly:false, damage:50 });
  updateWorld(state, 1);
  assert.equal(state.ship.hull, 100);
  assert.equal(state.ship.lives, 3);
});

test('enemy bullets damage player when not invincible', () => {
  const state = makeState(false);
  state.bullets.push({ x: state.ship.x, y: state.ship.y, vx:0, vy:0, r:2, life:10, friendly:false, damage:10 });
  updateWorld(state, 1);
  assert.ok(state.ship.hull < 100);
});

