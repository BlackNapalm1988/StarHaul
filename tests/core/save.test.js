import test from 'node:test';
import assert from 'node:assert/strict';
import { saveGame, loadGame } from '../../core/save.js';

function installFakeLocalStorage() {
  const store = new Map();
  global.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: key => { store.delete(key); }
  };
  return store;
}

function makeState(overrides = {}) {
  return {
    seed: 123,
    credits: 500,
    fuel: 80,
    ammo: 40,
    cargo: 5,
    reputation: 3,
    discovered: [1, 2],
    missions: [{ id: 'm1' }],
    ship: {
      x: 100,
      y: 200,
      hull: 90,
      hullMax: 100,
      lives: 2,
      anchored: true,
      engine: 2,
      hold: 1,
      shield: 0,
      gun: 3,
      radar: 1
    },
    docked: { id: 4 },
    home: { id: 1 },
    ...overrides
  };
}

test('saveGame + loadGame round-trips the persisted fields', () => {
  installFakeLocalStorage();
  const state = makeState();
  saveGame(state);
  const loaded = loadGame();

  assert.equal(loaded.seed, 123);
  assert.equal(loaded.credits, 500);
  assert.equal(loaded.fuel, 80);
  assert.equal(loaded.ammo, 40);
  assert.equal(loaded.cargo, 5);
  assert.equal(loaded.reputation, 3);
  assert.deepEqual(loaded.discovered, [1, 2]);
  assert.deepEqual(loaded.missions, [{ id: 'm1' }]);
  assert.equal(loaded.dockedId, 4);
  assert.equal(loaded.homeId, 1);
  assert.deepEqual(loaded.ship, {
    x: 100, y: 200, hull: 90, hullMax: 100, lives: 2, anchored: true
  });
  assert.deepEqual(loaded.upgrades, { engine: 2, hold: 1, shield: 0, gun: 3, radar: 1 });
});

test('loadGame returns null when nothing has been saved', () => {
  installFakeLocalStorage();
  assert.equal(loadGame(), null);
});

test('loadGame returns null and does not throw on corrupt JSON', () => {
  const store = installFakeLocalStorage();
  store.set('starhaul-save', '{not valid json');
  assert.equal(loadGame(), null);
});

test('loadGame backfills defaults for saves missing newer fields', () => {
  const store = installFakeLocalStorage();
  store.set('starhaul-save', JSON.stringify({ seed: 7, credits: 10 }));
  const loaded = loadGame();
  assert.deepEqual(loaded.missions, []);
  assert.deepEqual(loaded.ship, {});
  assert.equal(loaded.dockedId, null);
  assert.equal(loaded.homeId, null);
  assert.equal(loaded.fuel, undefined);
  assert.equal(loaded.ammo, undefined);
  assert.equal(loaded.cargo, undefined);
});

test('saveGame is a no-op when state is missing', () => {
  installFakeLocalStorage();
  assert.doesNotThrow(() => saveGame(null));
  assert.equal(loadGame(), null);
});

test('saveGame tolerates a state with no ship or docked/home planets', () => {
  installFakeLocalStorage();
  const state = makeState({ ship: undefined, docked: null, home: null });
  assert.doesNotThrow(() => saveGame(state));
  const loaded = loadGame();
  assert.equal(loaded.dockedId, null);
  assert.equal(loaded.homeId, null);
  assert.equal(loaded.ship.x, undefined);
});
