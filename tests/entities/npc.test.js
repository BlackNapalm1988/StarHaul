import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, CFG } from '../../core/config.js';
import { makePirate, makePirateBase, makeHunter, makePatrol } from '../../entities/npc.js';

function fixedRand(value) {
  return () => value;
}

test('makePirate places the pirate within world bounds and sets combat defaults', () => {
  const pirate = makePirate(fixedRand(0.5));
  assert.ok(pirate.x >= 0 && pirate.x <= WORLD.w);
  assert.ok(pirate.y >= 0 && pirate.y <= WORLD.h);
  assert.equal(pirate.homeX, pirate.x);
  assert.equal(pirate.homeY, pirate.y);
  assert.equal(pirate.hp, CFG.pirates.hp);
  assert.equal(pirate.cool, CFG.pirates.fireEvery);
  assert.equal(pirate.kind, 'pirate');
  assert.equal(pirate.boardTimer, 0);
});

test('makePirate is deterministic for a given rand function', () => {
  const a = makePirate(fixedRand(0.25));
  const b = makePirate(fixedRand(0.25));
  assert.deepEqual(a, b);
});

test('makePirate patrolDir depends on the rand threshold at 0.5', () => {
  assert.equal(makePirate(fixedRand(0.49)).patrolDir, -1);
  assert.equal(makePirate(fixedRand(0.51)).patrolDir, 1);
});

test('makePirateBase uses configured radius/hp and a generated name tag', () => {
  const base = makePirateBase(fixedRand(0.5));
  assert.equal(base.r, CFG.pirateBase.r);
  assert.equal(base.hp, CFG.pirateBase.hp);
  assert.equal(base.spawn, CFG.pirateBase.spawnEvery);
  assert.equal(base.cool, CFG.pirateBase.fireEvery);
  assert.equal(base.kind, 'base');
  assert.match(base.name, /^Pirate Base [0-9A-Z]+$/);
});

test('makeHunter sets home position and hunter-specific cooldown', () => {
  const hunter = makeHunter(fixedRand(0.75));
  assert.equal(hunter.kind, 'hunter');
  assert.equal(hunter.cool, CFG.hunters.fireEvery);
  assert.equal(hunter.homeX, hunter.x);
  assert.equal(hunter.homeY, hunter.y);
});

test('makePatrol spawns on one of the four world edges moving inward', () => {
  for (const rv of [0.05, 0.3, 0.55, 0.8]) {
    const patrol = makePatrol(fixedRand(rv));
    assert.equal(patrol.kind, 'patrol');
    const onEdge = patrol.x === 10 || patrol.x === WORLD.w - 10 || patrol.y === 10 || patrol.y === WORLD.h - 10;
    assert.ok(onEdge, `patrol at (${patrol.x}, ${patrol.y}) should sit on a world edge`);
    assert.ok(Number.isFinite(patrol.vx) && Number.isFinite(patrol.vy));
  }
});
