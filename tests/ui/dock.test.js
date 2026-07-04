import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDockIntel, dock, getDockingScreenForPlanet } from '../../ui/dock.js';

test('docking screen maps planet types to immersive backdrop images', () => {
  assert.equal(getDockingScreenForPlanet({ type: 'gas' }), 'assets/backgrounds/planet_docking_screens/gas.png');
  assert.equal(getDockingScreenForPlanet({ type: 'ice' }), 'assets/backgrounds/planet_docking_screens/ice.png');
  assert.equal(getDockingScreenForPlanet({ type: 'industrial' }), 'assets/backgrounds/planet_docking_screens/industrial.png');
  assert.equal(getDockingScreenForPlanet({ type: 'lava' }), 'assets/backgrounds/planet_docking_screens/lava.png');
  assert.equal(getDockingScreenForPlanet({ type: 'rocky' }), 'assets/backgrounds/planet_docking_screens/rocky.png');
  assert.equal(getDockingScreenForPlanet({ type: 'ocean' }), 'assets/backgrounds/planet_docking_screens/water.png');
  assert.equal(getDockingScreenForPlanet({ type: 'unknown' }), 'assets/backgrounds/planet_docking_screens/rocky.png');
});

test('dock intel builds state-linked terminal news and market tickers', () => {
  const state = {
    credits: 725,
    reputation: 3,
    missions: [{ id: 'm1' }],
    pirates: [{ x: 840, y: 140 }],
    planets: [
      { id: 0, name: 'Eden-100', type: 'ocean', x: 100, y: 100, texSeed: 11 },
      { id: 1, name: 'Kovax-101', type: 'gas', x: 900, y: 120, texSeed: 22 },
      {
        id: 2,
        name: 'Tarsis-102',
        type: 'industrial',
        x: 400,
        y: 500,
        texSeed: 33,
        offers: [{ id: 'o1', to: 1, reward: 640, cargoName: 'Fuel Rods', qty: 4, reqRep: 0 }]
      }
    ]
  };
  state.docked = state.planets[2];

  const intel = buildDockIntel(state, state.docked);
  const copy = [intel.status, intel.local, intel.traffic, ...intel.news, ...intel.market].join(' ');

  assert.match(intel.status, /Tarsis-102/);
  assert.ok(intel.news.some(line => line.includes('ELECTION')));
  assert.ok(intel.news.some(line => line.includes('PIRATE WATCH') && line.includes('Kovax-101')));
  assert.ok(intel.news.some(line => line.includes('Fuel Rods') && line.includes('Kovax-101')));
  assert.ok(intel.market.some(line => line.includes('Eden-100')));
  assert.ok(intel.market.some(line => line.includes('Kovax-101')));
  assert.doesNotMatch(copy, /[\u2600-\u27BF]|[\u{1F300}-\u{1FAFF}]/u);
});

test('dock controls are active on the first visible dock render', () => {
  let clickHandler = null;
  global.document = {
    body: { classList: { toggle() {} } },
    getElementById(id) {
      if (id === 'market' || id === 'missions') {
        return { querySelector: () => ({ textContent: '' }) };
      }
      if (id === 'lifeFill') return { style: {} };
      return null;
    }
  };
  global.localStorage = { setItem() {} };

  const planet = { id: 1, name: 'Dock-101', type: 'rocky', x: 0, y: 0, r: 120, offers: [] };
  const other = { id: 2, name: 'Run-102', type: 'ice', x: 500, y: 0, r: 120, offers: [] };
  const state = {
    seed: 1,
    credits: 500,
    fuel: 0,
    ammo: 0,
    cargo: 0,
    cargoMax: 50,
    reputation: 0,
    discovered: [],
    missions: [],
    planets: [planet, other],
    pirates: [],
    ship: { x: 0, y: 0, hull: 100, hullMax: 100, lives: 3 }
  };
  const ui = {
    dockUI: {
      style: {},
      addEventListener(type, handler) {
        if (type === 'click') clickHandler = handler;
      },
      querySelectorAll: () => []
    },
    dockBackdrop: { classList: { remove() {}, add() {} }, dataset: {} },
    dockBackdropImage: {},
    dockStatusLine: { textContent: '' },
    dockLocalReadout: { textContent: '' },
    dockTrafficReadout: { textContent: '' },
    dockNewsTicker: { innerHTML: '' },
    dockMarketTicker: { innerHTML: '' },
    missionList: { innerHTML: '' },
    upgrades: { innerHTML: '', querySelectorAll: () => [] },
    credits: { textContent: '' },
    fuel: { textContent: '' },
    ammo: { textContent: '' },
    cargo: { textContent: '' },
    cargoMax: { textContent: '' },
    hull: { textContent: '' },
    hullMax: { textContent: '' },
    lives: { textContent: '' },
    rep: { textContent: '' },
    missionCount: { textContent: '' },
    missionLogList: { innerHTML: '', querySelectorAll: () => [] }
  };

  dock(state, planet, ui);

  assert.equal(typeof clickHandler, 'function');
  clickHandler({
    target: {
      closest(selector) {
        return selector === '[data-buy]' ? { dataset: { buy: 'fuel' } } : null;
      }
    }
  });
  assert.equal(state.fuel, 50);
  assert.equal(state.credits, 400);
});
