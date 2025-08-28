import test from 'node:test';
import assert from 'node:assert/strict';
import { updateWorld } from './world.js';
import { WORLD } from '../core/config.js';

function makeState() {
  return {
    camera: { x: 0, y: 0, w: 800, h: 600 },
    ship: {
      x: WORLD.w / 2,
      y: WORLD.h / 2,
      vx: 0,
      vy: 0,
      a: 0,
      turn: 0,
      thrust: false,
      r: 16,
      centered: true
    },
    bullets: [],
    particles: [],
    bulletPool: { release() {} },
    particlePool: { release() {} }
  };
}

test('ship clamps to left edge', () => {
  const state = makeState();
  state.ship.x = 10;
  state.ship.vx = -50;
  updateWorld(state, 1);
  assert.equal(state.ship.x, state.ship.r);
  assert.equal(state.ship.vx, 0);
});

test('ship clamps to top edge', () => {
  const state = makeState();
  state.ship.y = 10;
  state.ship.vy = -50;
  updateWorld(state, 1);
  assert.equal(state.ship.y, state.ship.r);
  assert.equal(state.ship.vy, 0);
});

test('ship clamps to right edge', () => {
  const state = makeState();
  state.ship.x = WORLD.w - 10;
  state.ship.vx = 50;
  updateWorld(state, 1);
  assert.equal(state.ship.x, WORLD.w - state.ship.r);
  assert.equal(state.ship.vx, 0);
});

test('ship clamps to bottom edge', () => {
  const state = makeState();
  state.ship.y = WORLD.h - 10;
  state.ship.vy = 50;
  updateWorld(state, 1);
  assert.equal(state.ship.y, WORLD.h - state.ship.r);
  assert.equal(state.ship.vy, 0);
});
