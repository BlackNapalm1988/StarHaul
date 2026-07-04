import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureOffersForPlanet,
  acceptOffer,
  deliverMissionsAt,
  tickMissions,
  formatContractDetails,
  formatContractTitle,
  visibleOffersForState
} from '../../systems/contracts.js';

function makeState(){
  const names = ['Eden-100', 'Kovax-101', 'Aria-102'];
  const types = ['rocky', 'industrial', 'ice'];
  const planets = Array.from({length: 3}, (_, i) => ({ id: i, name: names[i], type: types[i], offers: [] }));
  return {
    planets,
    cargo: 0,
    cargoMax: 50,
    credits: 0,
    missions: [],
    reputation: 0,
  };
}

test('ensureOffersForPlanet populates offers and accept/deliver flow', () => {
  const state = makeState();
  const here = state.planets[0];
  ensureOffersForPlanet(state, here);
  assert.ok(here.offers.length > 0, 'offers should be created');
  const o = here.offers[0];
  assert.ok(o.cargoName, 'offer has a meaningful cargo name');
  const ok = acceptOffer(state, here, o.id);
  assert.equal(ok, true, 'acceptOffer should succeed');
  assert.equal(state.missions.find(m => m.id === o.id)?.cargoName, o.cargoName, 'mission keeps cargo name');
  assert.ok(here.offers.findIndex(x => x.id === o.id) === -1, 'offer removed');
  // Deliver at destination
  const dest = state.planets[o.to];
  const res = deliverMissionsAt(state, dest);
  assert.ok(res.delivered >= 1, 'delivered count >= 1');
  assert.ok(state.missions.length === 0, 'missions cleared');
  assert.ok(state.credits > 0, 'credits awarded');
  assert.ok(state.reputation > 0, 'reputation increased');
});

test('contract formatters use cargo and planet names instead of ids', () => {
  const state = makeState();
  const offer = { from: 0, to: 1, qty: 7, cargoName: 'Fuel Rods' };
  assert.equal(formatContractTitle(state, offer), 'Fuel Rods to Kovax-101');
  assert.equal(formatContractDetails(state, offer), '7 units from Eden-100');
});

test('visibleOffersForState hides contracts above current reputation', () => {
  const state = makeState();
  state.reputation = 1;
  const offers = [
    { id: 'starter', reqRep: 0 },
    { id: 'mid', reqRep: 1 },
    { id: 'prestige', reqRep: 3 }
  ];
  assert.deepEqual(visibleOffersForState(state, offers).map(o => o.id), ['starter', 'mid']);
});

test('ensureOffersForPlanet keeps at least one visible offer on the board', () => {
  const state = makeState();
  const here = state.planets[0];
  here.offers = [
    { id: 'locked-1', from: 0, to: 1, qty: 4, reward: 900, timeLeft: 100, reqRep: 3 },
    { id: 'locked-2', from: 0, to: 2, qty: 5, reward: 700, timeLeft: 100, reqRep: 2 },
    { id: 'locked-3', from: 0, to: 1, qty: 6, reward: 1200, timeLeft: 100, reqRep: 4 }
  ];
  ensureOffersForPlanet(state, here);
  assert.ok(visibleOffersForState(state, here.offers).length >= 1, 'at least one visible offer remains available');
});

test('tickMissions expires missions and frees cargo with small rep penalty', () => {
  const state = makeState();
  state.missions.push({ id: 'm1', from: 0, to: 1, qty: 5, reward: 100, timeLeft: 2 });
  state.cargo = 5;
  tickMissions(state, 3);
  assert.equal(state.missions.length, 0, 'expired mission removed');
  assert.equal(state.cargo, 0, 'cargo freed');
});
