import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../../core/config.js';
import { marketBuy, upgradeCost, buyUpgrade, setHome, MAX_LEVEL } from '../../systems/economy.js';

function makeState(overrides = {}) {
  return {
    credits: 500,
    fuel: 0,
    ammo: 0,
    cargoMax: CFG.economy.cargoMax,
    ship: { hull: 50, hullMax: 100, engine: 0, hold: 0, shield: 0, gun: 0, radar: 0 },
    ...overrides
  };
}

test('marketBuy(fuel) charges credits and adds fuel', () => {
  const state = makeState({ credits: 150 });
  marketBuy(state, 'fuel');
  assert.equal(state.credits, 50);
  assert.equal(state.fuel, 50);
});

test('marketBuy(fuel) is a no-op without enough credits', () => {
  const state = makeState({ credits: 99 });
  marketBuy(state, 'fuel');
  assert.equal(state.credits, 99);
  assert.equal(state.fuel, 0);
});

test('marketBuy(ammo) charges credits and adds ammo', () => {
  const state = makeState({ credits: 60 });
  marketBuy(state, 'ammo');
  assert.equal(state.credits, 10);
  assert.equal(state.ammo, 10);
});

test('marketBuy(repair) heals hull in bounded increments at CFG.economy.repairPerHull cost', () => {
  const state = makeState({ credits: 500 });
  marketBuy(state, 'repair');
  const per = CFG.economy.repairPerHull;
  assert.equal(state.ship.hull, 60);
  assert.equal(state.credits, 500 - 10 * per);
});

test('marketBuy(repair) is a no-op once hull is already full', () => {
  const state = makeState({ credits: 500, ship: { hull: 100, hullMax: 100 } });
  marketBuy(state, 'repair');
  assert.equal(state.ship.hull, 100);
  assert.equal(state.credits, 500);
});

test('marketBuy(repair) never overshoots hullMax when missing hull is small', () => {
  const state = makeState({ credits: 500, ship: { hull: 95, hullMax: 100 } });
  marketBuy(state, 'repair');
  assert.equal(state.ship.hull, 100);
});

test('upgradeCost scales by 1.5x per level above the base', () => {
  const base = upgradeCost('engine', 1);
  const next = upgradeCost('engine', 2);
  assert.equal(base, 200);
  assert.equal(next, Math.floor(200 * 1.5));
});

test('buyUpgrade deducts cost and increments the ship stat', () => {
  const state = makeState({ credits: 1000 });
  buyUpgrade(state, 'gun');
  assert.equal(state.ship.gun, 1);
  assert.equal(state.credits, 1000 - upgradeCost('gun', 1));
});

test('buyUpgrade is a no-op without enough credits', () => {
  const state = makeState({ credits: 0 });
  buyUpgrade(state, 'gun');
  assert.equal(state.ship.gun, 0);
  assert.equal(state.credits, 0);
});

test('buyUpgrade refuses to exceed MAX_LEVEL', () => {
  const state = makeState({ credits: 1_000_000, ship: { engine: MAX_LEVEL } });
  buyUpgrade(state, 'engine');
  assert.equal(state.ship.engine, MAX_LEVEL);
});

test('buyUpgrade(hold) raises cargoMax by 20 per level using the original base as the floor', () => {
  const state = makeState({ credits: 1_000_000 });
  buyUpgrade(state, 'hold');
  assert.equal(state.ship.hold, 1);
  assert.equal(state.cargoMax, CFG.economy.cargoMax + 20);
  buyUpgrade(state, 'hold');
  assert.equal(state.cargoMax, CFG.economy.cargoMax + 40);
});

test('buyUpgrade(shield) raises hullMax by 20 per level and tops up current hull', () => {
  const state = makeState({ credits: 1_000_000, ship: { hull: 80, hullMax: 100, shield: 0 } });
  buyUpgrade(state, 'shield');
  assert.equal(state.ship.shield, 1);
  assert.equal(state.ship.hullMax, 120);
  assert.equal(state.ship.hull, 100);
});

test('setHome assigns the given planet as home', () => {
  const state = makeState();
  const planet = { id: 3, name: 'Aria-102' };
  setHome(state, planet);
  assert.equal(state.home, planet);
});
