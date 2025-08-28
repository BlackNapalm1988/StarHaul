import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnAsteroid, spawnTrader } from './gen.js';

function makeState(){
  return { asteroids: [], traders: [] };
}

test('spawnAsteroid adds asteroid', () => {
  const state = makeState();
  const a = spawnAsteroid(state);
  assert.equal(state.asteroids.length, 1);
  assert.ok(typeof a.x === 'number' && typeof a.y === 'number');
});

test('spawnTrader adds trader', () => {
  const state = makeState();
  const t = spawnTrader(state);
  assert.equal(state.traders.length, 1);
  assert.ok(typeof t.x === 'number' && typeof t.y === 'number');
});
