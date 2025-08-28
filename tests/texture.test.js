import assert from 'node:assert';
import { createCanvas, Image } from 'canvas';

global.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error('Unsupported element');
    return createCanvas(0, 0);
  }
};

global.Image = Image;

import { loadAll, getImage } from '../core/assets.js';
import { drawWorld } from '../world/world.js';

try {
  await loadAll();

  assert.ok(getImage('star'), 'Star texture loaded');
  assert.ok(getImage('planet'), 'Planet texture loaded');

  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  const state = {
    camera: { x: 0, y: 0, w: 200, h: 200 },
    stars: [{ x: 50, y: 50, r: 30 }],
    planets: [{ x: 150, y: 150, r: 20 }],
    asteroids: [],
    traders: [],
    pirates: [],
    bullets: [],
    particles: [],
    ship: { x: -1000, y: -1000, r: 10, a: 0 }
  };

  drawWorld(ctx, state);

  const starPixel = ctx.getImageData(50, 50, 1, 1).data;
  const planetPixel = ctx.getImageData(150, 150, 1, 1).data;

  assert.ok(starPixel[3] > 0, 'Star should render with non-zero alpha');
  assert.ok(planetPixel[3] > 0, 'Planet should render with non-zero alpha');

  console.log('Texture test passed');
} catch (e) {
  console.error(e);
  process.exit(1);
}
