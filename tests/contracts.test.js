import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureOffersForPlanet, acceptOffer, deliverMissionsAt, tickMissions } from '../systems/contracts.js';

function makeState(){
  const planets = Array.from({length: 3}, (_, i) => ({ id: i, offers: [] }));
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
  const ok = acceptOffer(state, here, o.id);
  assert.equal(ok, true, 'acceptOffer should succeed');
  assert.ok(state.missions.find(m => m.id === o.id), 'mission added');
  assert.ok(here.offers.findIndex(x => x.id === o.id) === -1, 'offer removed');
  // Deliver at destination
  const dest = state.planets[o.to];
  const res = deliverMissionsAt(state, dest);
  assert.ok(res.delivered >= 1, 'delivered count >= 1');
  assert.ok(state.missions.length === 0, 'missions cleared');
  assert.ok(state.credits > 0, 'credits awarded');
  assert.ok(state.reputation > 0, 'reputation increased');
});

test('tickMissions expires missions and frees cargo with small rep penalty', () => {
  const state = makeState();
  state.missions.push({ id: 'm1', from: 0, to: 1, qty: 5, reward: 100, timeLeft: 2 });
  state.cargo = 5;
  tickMissions(state, 3);
  assert.equal(state.missions.length, 0, 'expired mission removed');
  assert.equal(state.cargo, 0, 'cargo freed');
});

