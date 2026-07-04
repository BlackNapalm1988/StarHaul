import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../../core/config.js';
import { calculateTowCost, resolveOutOfFuel } from '../../systems/rescue.js';

function makeFuelState(overrides = {}) {
  const home = overrides.home || { id: 1, name: 'Homeport', x: 100, y: 120, r: 80 };
  return {
    ship: {
      x: 4100,
      y: 3120,
      vx: 2,
      vy: -1,
      thrust: true,
      brake: true,
      anchored: false,
      centered: true,
      r: 16
    },
    camera: { x: 0, y: 0, w: 800, h: 600 },
    home,
    docked: null,
    fuel: 0,
    credits: 200,
    gameOver: false,
    ...overrides
  };
}

test('calculateTowCost uses base fee plus distance fee', () => {
  assert.equal(calculateTowCost(0), CFG.rescue.towBase);
  assert.equal(
    calculateTowCost(4000),
    CFG.rescue.towBase + CFG.rescue.towPer1000 * 4
  );
  assert.ok(calculateTowCost(4500) > calculateTowCost(4000));
});

test('resolveOutOfFuel tows paid players home with emergency fuel', () => {
  const state = makeFuelState({ credits: 10 });
  const result = resolveOutOfFuel(state);

  assert.equal(result.status, 'towed');
  assert.equal(result.cost, 10);
  assert.equal(state.credits, 0);
  assert.equal(state.lastTowCost, 10);
  assert.equal(state.fuel, CFG.rescue.emergencyFuel);
  assert.equal(state.docked, state.home);
  assert.equal(state.ship.x, state.home.x);
  assert.equal(state.ship.y, state.home.y);
  assert.equal(state.ship.vx, 0);
  assert.equal(state.ship.vy, 0);
  assert.equal(state.ship.thrust, false);
  assert.equal(state.ship.brake, false);
  assert.equal(state.gameOver, false);
});

test('resolveOutOfFuel ends the run when player has no credits', () => {
  const state = makeFuelState({ credits: 0 });
  const result = resolveOutOfFuel(state);

  assert.equal(result.status, 'gameOver');
  assert.equal(state.gameOver, true);
  assert.equal(state.gameOverCause, 'fuel');
});

test('resolveOutOfFuel allows docking when a planet is in range', () => {
  const dockable = { id: 2, name: 'Near Dock', x: 4000, y: 3000, r: 70 };
  const state = makeFuelState({ credits: 0 });
  const result = resolveOutOfFuel(state, dockable);

  assert.equal(result.status, 'dockable');
  assert.equal(result.planet, dockable);
  assert.equal(state.docked, null);
  assert.equal(state.gameOver, false);
  assert.equal(state.credits, 0);
});
