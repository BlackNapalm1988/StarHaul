import test from 'node:test';
import assert from 'node:assert/strict';
import { updateWorld } from '../../world/world.js';
import { WORLD } from '../../core/config.js';

function makeState() {
  return {
    camera: { x: 0, y: 0, w: 800, h: 600 },
    ship: {
      x: WORLD.w / 2,
      y: WORLD.h / 2,
      vx: 0,
      vy: 0,
      a: 0,
      turn: 0,
      thrust: false,
      r: 16,
      centered: true,
      hull: 100,
      hullMax: 100,
      lives: 3
    },
    bullets: [],
    particles: [],
    bulletPool: { release() {} },
    particlePool: { release() {} },
    pirates: [],
    traders: [],
    asteroids: [],
    gameOver: false
  };
}

test('ship clamps to left edge', () => {
  const state = makeState();
  state.ship.x = 10;
  state.ship.vx = -50;
  updateWorld(state, 1);
  assert.equal(state.ship.x, state.ship.r);
  assert.equal(state.ship.vx, 0);
});

test('ship clamps to top edge', () => {
  const state = makeState();
  state.ship.y = 10;
  state.ship.vy = -50;
  updateWorld(state, 1);
  assert.equal(state.ship.y, state.ship.r);
  assert.equal(state.ship.vy, 0);
});

test('ship clamps to right edge', () => {
  const state = makeState();
  state.ship.x = WORLD.w - 10;
  state.ship.vx = 50;
  updateWorld(state, 1);
  assert.equal(state.ship.x, WORLD.w - state.ship.r);
  assert.equal(state.ship.vx, 0);
});

test('ship clamps to bottom edge', () => {
  const state = makeState();
  state.ship.y = WORLD.h - 10;
  state.ship.vy = 50;
  updateWorld(state, 1);
  assert.equal(state.ship.y, WORLD.h - state.ship.r);
  assert.equal(state.ship.vy, 0);
});

test('asteroids move with velocity', () => {
  const state = makeState();
  state.asteroids.push({x:100, y:100, vx:10, vy:0, r:5});
  updateWorld(state, 1);
  assert.equal(state.asteroids[0].x, 110);
});

test('traders move with velocity', () => {
  const state = makeState();
  state.traders.push({x:100, y:100, vx:0, vy:5, r:5});
  updateWorld(state, 1);
  assert.equal(state.traders[0].y, 105);
});

test('pirates cleaned when out of bounds', () => {
  const state = makeState();
  state.pirates.push({x:-20, y:0, vx:0, vy:0, r:10});
  updateWorld(state, 1);
  assert.equal(state.pirates.length, 0);
});

test('pirate collision damages hull and removes pirate', () => {
  const state = makeState();
  const pirate = {x: state.ship.x, y: state.ship.y, r: 10, damage: 10};
  state.pirates.push(pirate);
  updateWorld(state, 1);
  assert.equal(state.pirates.length, 0);
  assert.equal(state.ship.hull, 90);
});

test('pirate collision does not damage docked ship', () => {
  const state = makeState();
  state.docked = { x: state.ship.x, y: state.ship.y };
  state.pirates.push({x: state.ship.x, y: state.ship.y, r: 10, damage: 10});
  updateWorld(state, 1);
  assert.equal(state.pirates.length, 1);
  assert.equal(state.ship.hull, 100);
});

test('enemy bullets do not damage docked ship', () => {
  const state = makeState();
  state.docked = { x: state.ship.x, y: state.ship.y };
  state.bullets.push({ x: state.ship.x, y: state.ship.y, vx:0, vy:0, r:2, life:10, friendly:false, damage:50 });
  updateWorld(state, 1);
  assert.equal(state.ship.hull, 100);
});

test('pirates do not fire at docked players and steer away from planets', () => {
  const state = makeState();
  const planet = { x: 1000, y: 1000, r: 140, kind: 'planet' };
  state.ship.x = planet.x;
  state.ship.y = planet.y;
  state.docked = planet;
  state.planets = [planet];
  state.pirates.push({
    x: planet.x + planet.r + 70,
    y: planet.y,
    homeX: planet.x + planet.r + 70,
    homeY: planet.y,
    patrolAngle: 0,
    patrolDir: 1,
    r: 10,
    vx: 0,
    vy: 0,
    cool: 0
  });

  updateWorld(state, 1);

  assert.equal(state.bullets.length, 0);
  assert.ok(state.pirates[0].vx > 0);
  assert.equal(state.ship.hull, 100);
});

test('pirates do not attack undocked players inside planet heat zone', () => {
  const state = makeState();
  const planet = { x: 1000, y: 1000, r: 140, kind: 'planet' };
  state.planets = [planet];
  state.ship.x = planet.x + planet.r + 120;
  state.ship.y = planet.y;
  state.pirates.push({
    x: state.ship.x + 90,
    y: state.ship.y,
    homeX: state.ship.x + 90,
    homeY: state.ship.y,
    patrolAngle: 0,
    patrolDir: 1,
    r: 10,
    vx: 0,
    vy: 0,
    cool: 0
  });

  updateWorld(state, 1);

  assert.equal(state.bullets.length, 0);
  assert.equal(state.pirates[0].boardTimer || 0, 0);
});

test('far pirates patrol locally instead of chasing player across map', () => {
  const state = makeState();
  state.ship.x = 5000;
  state.ship.y = 1000;
  state.pirates.push({
    x: 1000,
    y: 1000,
    homeX: 1000,
    homeY: 1000,
    patrolAngle: Math.PI,
    patrolDir: 1,
    r: 10,
    vx: 0,
    vy: 0,
    cool: 1000
  });
  updateWorld(state, 1);
  assert.ok(state.pirates[0].vx < 0);
});

test('close pirates strafe away instead of ramming directly into player', () => {
  const state = makeState();
  const pirate = {
    x: state.ship.x + 60,
    y: state.ship.y,
    homeX: state.ship.x + 60,
    homeY: state.ship.y,
    patrolAngle: 0,
    patrolDir: 1,
    r: 10,
    vx: 0,
    vy: 0,
    cool: 1000
  };
  state.pirates.push(pirate);

  updateWorld(state, 1);

  assert.ok(state.pirates[0].vx > 0);
  const towardPlayerX = state.ship.x - state.pirates[0].x;
  const towardPlayerY = state.ship.y - state.pirates[0].y;
  const dotTowardPlayer = state.pirates[0].vx * towardPlayerX + state.pirates[0].vy * towardPlayerY;
  assert.ok(dotTowardPlayer <= 0);
});

test('nebula slows ship and drains fuel while undocked', () => {
  const state = makeState();
  state.ship.vx = 10;
  state.ship.vy = 0;
  state.fuel = 100;
  state.nebulae = [{ x: state.ship.x, y: state.ship.y, r: 200, vx: 0, vy: 0, blobs: [] }];
  updateWorld(state, 1);
  assert.ok(state.ship.vx < 10);
  assert.ok(state.fuel < 100);
  assert.equal(state.inNebula, true);
});

test('nebula does not slow or drain docked ship', () => {
  const state = makeState();
  state.ship.vx = 10;
  state.fuel = 100;
  state.docked = { x: state.ship.x, y: state.ship.y };
  state.nebulae = [{ x: state.ship.x, y: state.ship.y, r: 200, vx: 0, vy: 0, blobs: [] }];
  updateWorld(state, 1);
  assert.equal(state.ship.vx, 0);
  assert.equal(state.fuel, 100);
  assert.equal(state.inNebula, false);
});

test('planet gravity gently pulls the ship toward the planet', () => {
  const state = makeState();
  state.ship.x = 1000;
  state.ship.y = 1000;
  state.planets = [{ x: 1320, y: 1000, r: 140, kind: 'planet' }];

  updateWorld(state, 1);

  assert.ok(state.ship.vx > 0);
  assert.ok(state.gravityDebugX > 0);
});

test('black hole gravity is stronger than planet gravity at similar range', () => {
  const planetState = makeState();
  planetState.ship.x = 1000;
  planetState.ship.y = 1000;
  planetState.planets = [{ x: 1400, y: 1000, r: 120, kind: 'planet' }];
  updateWorld(planetState, 1);

  const blackHoleState = makeState();
  blackHoleState.ship.x = 1000;
  blackHoleState.ship.y = 1000;
  blackHoleState.blackholes = [{ x: 1400, y: 1000, r: 80, kind: 'blackhole' }];
  updateWorld(blackHoleState, 1);

  assert.ok(blackHoleState.ship.vx > planetState.ship.vx * 2);
});

test('black hole core ends the run', () => {
  const state = makeState();
  state.ship.x = 1000;
  state.ship.y = 1000;
  state.blackholes = [{ x: 1000, y: 1000, r: 80, kind: 'blackhole' }];

  updateWorld(state, 1);

  assert.equal(state.gameOver, true);
  assert.equal(state.gameOverCause, 'blackhole');
  assert.equal(state.ship.hull, 0);
});

test('black hole event horizon damages the ship before core contact', () => {
  const state = makeState();
  state.ship.x = 1084;
  state.ship.y = 1000;
  state.blackholes = [{ x: 1000, y: 1000, r: 80, kind: 'blackhole' }];

  updateWorld(state, 1);

  assert.equal(state.gameOver, false);
  assert.ok(state.ship.hull < 100);
});

test('bullets bend under celestial gravity', () => {
  const state = makeState();
  state.planets = [{ x: 1320, y: 1000, r: 140, kind: 'planet' }];
  state.bullets.push({ x: 1000, y: 1000, vx: 0, vy: 0, r: 2, life: 10, friendly: true });

  updateWorld(state, 1);

  assert.equal(state.bullets.length, 1);
  assert.ok(state.bullets[0].vx > 0);
  assert.ok(state.bullets[0].x > 1000);
});

test('asteroids overlapping a planet keep outward escape velocity', () => {
  const state = makeState();
  state.ship.x = 5000;
  state.ship.y = 5000;
  state.planets = [{ x: 1000, y: 1000, r: 100, kind: 'planet' }];
  state.asteroids.push({ x: 1110, y: 1000, vx: 2, vy: 0, r: 20 });

  updateWorld(state, 1);

  assert.equal(state.asteroids.length, 1);
  assert.ok(state.asteroids[0].x >= 1120);
  assert.ok(state.asteroids[0].vx > 0);
});

test('thrust emits blue particles from both main engine hardpoints', () => {
  const state = makeState();
  state.ship.a = -Math.PI / 2;
  state.ship.thrust = true;
  state.fuel = 100;
  updateWorld(state, 1);
  const blue = state.particles.filter(p => p.color === '#4db8ff');
  assert.ok(blue.length >= 4);
  assert.ok(blue.some(p => p.x < state.ship.x - 10));
  assert.ok(blue.some(p => p.x > state.ship.x + 10));
  assert.ok(blue.every(p => p.drawLayer === 'shipFx'));
});

test('braking emits short orange particles from both brake hardpoints and drains fuel', () => {
  const state = makeState();
  state.ship.a = -Math.PI / 2;
  state.ship.brake = true;
  state.ship.vx = 10;
  state.fuel = 100;
  updateWorld(state, 1);
  const orange = state.particles.filter(p => p.color === '#ffb347');
  assert.ok(orange.length >= 4);
  assert.ok(orange.some(p => p.x < state.ship.x - 10));
  assert.ok(orange.some(p => p.x > state.ship.x + 10));
  assert.ok(orange.every(p => p.y < state.ship.y - 10));
  assert.ok(orange.every(p => p.vy < 0));
  assert.ok(orange.every(p => p.life >= 17));
  assert.ok(orange.every(p => p.life <= 36));
  assert.ok(orange.every(p => p.drawLayer === 'shipFx'));
  assert.ok(state.ship.vx < 10);
  assert.ok(state.fuel < 99.8);
});

test('turning left fires the right main engine only', () => {
  const state = makeState();
  state.ship.a = -Math.PI / 2;
  state.ship.turn = -1;
  updateWorld(state, 1);
  const blue = state.particles.filter(p => p.color === '#4db8ff');
  assert.ok(blue.length >= 1);
  assert.ok(blue.every(p => p.x > state.ship.x + 10));
});

test('turning right fires the left main engine only', () => {
  const state = makeState();
  state.ship.a = -Math.PI / 2;
  state.ship.turn = 1;
  updateWorld(state, 1);
  const blue = state.particles.filter(p => p.color === '#4db8ff');
  assert.ok(blue.length >= 1);
  assert.ok(blue.every(p => p.x < state.ship.x - 10));
});

test('trader collision triggers game over and removes trader', () => {
  const state = makeState();
  const trader = {x: state.ship.x, y: state.ship.y, r: 10};
  state.traders.push(trader);
  updateWorld(state, 1);
  assert.equal(state.traders.length, 0);
  assert.equal(state.gameOver, true);
});
