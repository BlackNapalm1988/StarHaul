import assert from 'node:assert';
import { createCanvas, Image } from 'canvas';

global.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error('Unsupported element');
    return createCanvas(0, 0);
  }
};

global.Image = Image;

import { loadAll, getImage, getPlanetTexture, getAsteroidTexture, getStarTexture, getSpriteSheet, getSpriteArea, getDirectionalFrameIndex, getDirectionalFrameAngle } from '../../core/assets.js';
import { drawWorld } from '../../world/world.js';

try {
  await loadAll();

  assert.ok(getImage('star'), 'Star texture loaded');
  assert.ok(getImage('planet'), 'Planet texture loaded');
  assert.ok(getImage('blackhole'), 'Black hole sprite loaded');
  assert.ok(getImage('playerIdleSprites'), 'Player idle sprite sheet loaded');
  assert.ok(getImage('starSprite:blue'), 'Blue star sprite loaded');
  assert.ok(getImage('starSprite:yellow'), 'Yellow star sprite loaded');
  assert.ok(getImage('starSprite:white'), 'White star sprite loaded');
  assert.ok(getImage('starSprite:red'), 'Red star sprite loaded');
  assert.ok(getImage('planetSprite:gas'), 'Gas planet sprite loaded');
  assert.ok(getImage('planetSprite:ice'), 'Ice planet sprite loaded');
  assert.ok(getImage('planetSprite:industrial'), 'Industrial planet sprite loaded');
  assert.ok(getImage('planetSprite:ocean'), 'Ocean planet sprite loaded');
  assert.ok(getImage('planetSprite:lava'), 'Lava planet sprite loaded');
  assert.ok(getImage('planetSprite:rocky'), 'Rocky planet sprite loaded');
  const starTexture = getStarTexture({ hue: 42, seed: 777 });
  const starCtx = starTexture.getContext('2d');
  const starCore = starCtx.getImageData(96, 96, 1, 1).data;
  const starCorner = starCtx.getImageData(0, 0, 1, 1).data;
  const starLimb = starCtx.getImageData(160, 96, 1, 1).data;
  const luma = px => px[0] * 0.2126 + px[1] * 0.7152 + px[2] * 0.0722;
  assert.ok(starCore[3] > 0, 'Star texture should have an opaque plasma core');
  assert.equal(starCorner[3], 0, 'Star texture corners should remain transparent');
  assert.ok(luma(starCore) > luma(starLimb), 'Star texture should have a brighter core than limb');
  const blueStar = getStarTexture({ type: 'blue', seed: 1 });
  const yellowStar = getStarTexture({ type: 'yellow', seed: 1 });
  const whiteStar = getStarTexture({ type: 'white', seed: 1 });
  const redStar = getStarTexture({ type: 'red', seed: 1 });
  assert.notEqual(blueStar, yellowStar, 'Blue and yellow star sprites should use distinct textures');
  assert.notEqual(whiteStar, redStar, 'White and red star sprites should use distinct textures');
  assert.equal(getStarTexture({ hue: 210, seed: 1 }), blueStar, 'Blue-hue stars should resolve to the blue sprite');
  assert.equal(getStarTexture({ hue: 42, seed: 1 }), yellowStar, 'Yellow-hue stars should resolve to the yellow sprite');
  assert.equal(getStarTexture({ hue: 165, seed: 1 }), whiteStar, 'White-hue stars should resolve to the white sprite');
  assert.equal(getStarTexture({ hue: 5, seed: 1 }), redStar, 'Red-hue stars should resolve to the red sprite');
  const oceanPlanet = getPlanetTexture({ r: 32, hue: 190, noiseSeed: 2468, type: 'ocean', dpr: 1 });
  const waterPlanet = getPlanetTexture({ r: 32, hue: 190, noiseSeed: 2468, type: 'water', dpr: 1 });
  const gasPlanet = getPlanetTexture({ r: 32, hue: 36, noiseSeed: 2468, type: 'gas', dpr: 1 });
  const icePlanet = getPlanetTexture({ r: 32, hue: 210, noiseSeed: 2468, type: 'ice', dpr: 1 });
  const industrialPlanet = getPlanetTexture({ r: 32, hue: 210, noiseSeed: 2468, type: 'industrial', dpr: 1 });
  const rockyPlanet = getPlanetTexture({ r: 32, hue: 42, noiseSeed: 2468, type: 'rocky', dpr: 1 });
  const lavaPlanet = getPlanetTexture({ r: 32, hue: 18, noiseSeed: 2468, type: 'lava', dpr: 1 });
  const oceanCtx = oceanPlanet.getContext('2d');
  const gasCtx = gasPlanet.getContext('2d');
  const planetCenter = oceanCtx.getImageData(32, 32, 1, 1).data;
  const planetCorner = oceanCtx.getImageData(0, 0, 1, 1).data;
  const planetLit = oceanCtx.getImageData(20, 20, 1, 1).data;
  const planetShade = oceanCtx.getImageData(46, 46, 1, 1).data;
  const planetGasSample = gasCtx.getImageData(32, 16, 1, 1).data;
  const planetOceanSample = oceanCtx.getImageData(32, 16, 1, 1).data;
  assert.ok(planetCenter[3] > 0, 'Planet texture should have an opaque body');
  assert.equal(planetCorner[3], 0, 'Planet texture corners should remain transparent');
  assert.ok(luma(planetLit) > luma(planetShade), 'Planet texture should use directional lighting');
  assert.notDeepEqual(Array.from(planetGasSample), Array.from(planetOceanSample), 'Planet types should render distinct surfaces');
  assert.equal(waterPlanet, oceanPlanet, 'Water planet type should reuse ocean planet sprite art');
  assert.equal(getPlanetTexture({ r: 32, type: 'water_world', dpr: 1 }), oceanPlanet, 'Metadata water_world id should reuse ocean planet sprite art');
  assert.equal(getPlanetTexture({ r: 32, type: 'gas_world', dpr: 1 }), gasPlanet, 'Metadata gas_world id should reuse gas planet sprite art');
  assert.equal(getPlanetTexture({ r: 32, type: 'urban_industrial', dpr: 1 }), industrialPlanet, 'Metadata industrial descriptor should reuse industrial planet sprite art');
  const alphaBounds = canvas => {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] <= 8) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    return { minX, minY, maxX, maxY };
  };
  for (const [label, texture] of [
    ['gas', gasPlanet],
    ['ice', icePlanet],
    ['industrial', industrialPlanet],
    ['ocean', oceanPlanet],
    ['rocky', rockyPlanet],
    ['lava', lavaPlanet]
  ]) {
    const bounds = alphaBounds(texture);
    assert.ok(bounds.minX <= 1, `${label} planet should fill the left side of its render box`);
    assert.ok(bounds.minY <= 1, `${label} planet should fill the top side of its render box`);
    assert.ok(bounds.maxX >= texture.width - 2, `${label} planet should fill the right side of its render box`);
    assert.ok(bounds.maxY >= texture.height - 2, `${label} planet should fill the bottom side of its render box`);
  }
  const asteroidTexture = getAsteroidTexture({ r: 32, seed: 12345 });
  const asteroidCtx = asteroidTexture.getContext('2d');
  const asteroidCenter = asteroidCtx.getImageData(32, 32, 1, 1).data;
  const asteroidCorner = asteroidCtx.getImageData(0, 0, 1, 1).data;
  const asteroidLit = asteroidCtx.getImageData(24, 24, 1, 1).data;
  const asteroidShade = asteroidCtx.getImageData(40, 40, 1, 1).data;
  assert.ok(asteroidCenter[3] > 0, 'Asteroid texture should have an opaque rocky body');
  assert.equal(asteroidCorner[3], 0, 'Asteroid texture corners should remain transparent');
  assert.ok(luma(asteroidLit) > luma(asteroidShade), 'Asteroid texture should use directional lighting');
  assert.equal(getDirectionalFrameIndex(-Math.PI / 2, getSpriteSheet('player')), 0, 'North should use first player frame');
  assert.equal(getDirectionalFrameIndex(0, getSpriteSheet('player')), 2, 'East should use third player frame');
  assert.equal(getDirectionalFrameAngle(2, getSpriteSheet('player')), 0, 'East frame angle should face right');
  assert.equal(getSpriteSheet('player').fixedFrame, 0, 'Player renderer should use first idle frame as rotation source');
  assert.equal(getSpriteSheet('player').renderScale, 5, 'Player idle sprite should render at updated scale');
  assert.deepEqual(getSpriteArea('player', 'Left_Main_Engine'), { x: 30, y: 205, purpose: 'engine' });
  assert.deepEqual(getSpriteArea('player', 'Right_Main_Engine'), { x: 215, y: 205, purpose: 'engine' });
  assert.deepEqual(getSpriteArea('player', 'Left_Main_Engine_Brake'), { x: 30, y: 115, purpose: 'engine' });
  assert.deepEqual(getSpriteArea('player', 'Right_Main_Engine_Brake'), { x: 215, y: 115, purpose: 'engine' });
  assert.deepEqual(getSpriteArea('player', 'Cargo_Hold_Door'), { x: 123, y: 235, purpose: 'cargo', stub: true });
  assert.deepEqual(getSpriteArea('player', 'Main_Gun'), { x: 120, y: 0, purpose: 'weapon' });
  assert.deepEqual(getSpriteArea('player', 'Left_Cannon'), { x: 45, y: 47, purpose: 'weapon', stub: true });
  assert.deepEqual(getSpriteArea('player', 'Right_Cannon'), { x: 199, y: 45, purpose: 'weapon', stub: true });

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
    ship: { x: 100, y: 100, r: 10, a: 0 }
  };

  drawWorld(ctx, state);

  const starPixel = ctx.getImageData(50, 50, 1, 1).data;
  const shipPixel = ctx.getImageData(100, 100, 1, 1).data;
  const planetPixel = ctx.getImageData(150, 150, 1, 1).data;

  assert.ok(starPixel[3] > 0, 'Star should render with non-zero alpha');
  assert.ok(shipPixel[3] > 0, 'Player ship should render with non-zero alpha');
  assert.ok(planetPixel[3] > 0, 'Planet should render with non-zero alpha');

  const cosmicCanvas = createCanvas(220, 180);
  const cosmicCtx = cosmicCanvas.getContext('2d');
  drawWorld(cosmicCtx, {
    time: 180,
    camera: { x: 0, y: 0, w: 220, h: 180 },
    stars: [],
    planets: [],
    blackholes: [{ x: 120, y: 90, r: 24 }],
    asteroids: [],
    traders: [],
    pirates: [],
    hunters: [],
    patrols: [],
    pirateBases: [],
    nebulae: [{
      x: 105,
      y: 90,
      r: 90,
      baseR: 90,
      hue: 220,
      alpha: 0.4,
      layer: 0.7,
      blobs: [
        { x: -30, y: 0, r: 42, hue: 214, alpha: 0.34 },
        { x: 20, y: 12, r: 36, hue: 266, alpha: 0.32 }
      ]
    }],
    bullets: [],
    particles: [],
    ship: { x: 30, y: 30, r: 10, a: 0 }
  });
  const blackHoleCore = cosmicCtx.getImageData(120, 90, 1, 1).data;
  const accretionPixel = cosmicCtx.getImageData(152, 90, 1, 1).data;
  const nebulaPixel = cosmicCtx.getImageData(75, 90, 1, 1).data;
  assert.ok(blackHoleCore[3] > 0, 'Black hole core should render with non-zero alpha');
  assert.ok(accretionPixel[3] > 0, 'Black hole accretion glow should render with non-zero alpha');
  assert.ok(nebulaPixel[3] > 0, 'Nebula wisps should render with non-zero alpha');

  function renderParticlePixel(drawLayer) {
    const fxCanvas = createCanvas(200, 200);
    const fxCtx = fxCanvas.getContext('2d');
    drawWorld(fxCtx, {
      camera: { x: 0, y: 0, w: 200, h: 200 },
      stars: [],
      planets: [],
      blackholes: [],
      asteroids: [],
      traders: [],
      pirates: [],
      hunters: [],
      patrols: [],
      pirateBases: [],
      nebulae: [],
      bullets: [],
      particles: [{ x: 100, y: 100, vx: 0, vy: 0, r: 8, life: 20, max: 20, color: '#ffb347', drawLayer }],
      ship: { x: 100, y: 100, r: 16, a: -Math.PI / 2, hull: 100, hullMax: 100, lives: 3 }
    });
    return fxCtx.getImageData(100, 100, 1, 1).data;
  }

  const buriedFx = renderParticlePixel('world');
  const visibleFx = renderParticlePixel('shipFx');
  assert.ok(visibleFx[0] > buriedFx[0] + 40, 'Ship FX particles should render visibly over the player sprite');

  console.log('Texture test passed');
} catch (e) {
  console.error(e);
  process.exit(1);
}
