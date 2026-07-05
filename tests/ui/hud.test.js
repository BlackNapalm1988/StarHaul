import test from 'node:test';
import assert from 'node:assert/strict';
import { updateHUD } from '../../ui/hud.js';

function textEl() {
  return { textContent: '', style: {} };
}

function makeUi() {
  return {
    credits: textEl(),
    fuel: textEl(),
    ammo: textEl(),
    cargo: textEl(),
    cargoMax: textEl(),
    hull: textEl(),
    hullMax: textEl(),
    lives: textEl(),
    rep: textEl(),
    missionCount: textEl(),
    missionLogList: {
      innerHTML: '',
      querySelectorAll: () => []
    }
  };
}

test('mission log rerenders when mission timer changes', () => {
  global.document = {
    getElementById(id) {
      return id === 'lifeFill' ? { style: {} } : null;
    }
  };
  const ui = makeUi();
  const state = {
    credits: 0,
    fuel: 0,
    ammo: 0,
    cargo: 0,
    cargoMax: 50,
    reputation: 0,
    tracked: null,
    planets: [
      { id: 1, name: 'Origin' },
      { id: 2, name: 'Destination' }
    ],
    ship: { hull: 100, hullMax: 100, lives: 3 },
    missions: [{ id: 'm1', from: 1, to: 2, qty: 1, reward: 100, timeLeft: 90 }]
  };

  updateHUD(ui, state);
  assert.match(ui.missionLogList.innerHTML, /90s/);

  state.missions[0].timeLeft = 89;
  updateHUD(ui, state);
  assert.match(ui.missionLogList.innerHTML, /89s/);
});
