import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, CFG } from '../../core/config.js';
import { newShip } from '../../entities/player.js';

test('newShip spawns centered in the world with full hull and default loadout', () => {
  const ship = newShip();
  assert.equal(ship.x, WORLD.w / 2);
  assert.equal(ship.y, WORLD.h / 2);
  assert.equal(ship.vx, 0);
  assert.equal(ship.vy, 0);
  assert.equal(ship.r, CFG.ship.r);
  assert.equal(ship.hull, CFG.ship.hullMax);
  assert.equal(ship.hullMax, CFG.ship.hullMax);
  assert.equal(ship.inv, CFG.ship.invuln);
  assert.equal(ship.lives, 3);
  assert.equal(ship.canShoot, true);
  assert.equal(ship.cool, 0);
  assert.deepEqual(ship.trail, []);
});

test('newShip returns a fresh object and trail array on each call', () => {
  const a = newShip();
  const b = newShip();
  assert.notEqual(a, b);
  assert.notEqual(a.trail, b.trail);
  a.trail.push({ x: 1, y: 1 });
  assert.equal(b.trail.length, 0);
});
