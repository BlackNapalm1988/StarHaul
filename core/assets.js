import { CFG } from './config.js';

const images = {};

function bakeShipTexture() {
  const r = CFG.ship.r;
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f0';
  ctx.beginPath();
  ctx.moveTo(r * 2, r);
  ctx.lineTo(0, r + r / 2);
  ctx.lineTo(0, r - r / 2);
  ctx.closePath();
  ctx.fill();
  return c;
}

function bakePlanetTexture() {
  const r = 40;
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0af';
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

const imageSources = {
  startScreen: 'StarHauler_Startscreen.png',
  ship: bakeShipTexture,
  planet: bakePlanetTexture
};

function loadImage(key, src, onProgress) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      images[key] = img;
      resolve(img);
    };
    img.onerror = reject;
  }).then(res => {
    if (onProgress) onProgress();
    return res;
  });
}

export async function loadAll(progressCallback) {
  const keys = Object.keys(imageSources);
  let loaded = 0;
  const total = keys.length;
  const update = () => {
    loaded++;
    if (progressCallback) progressCallback(loaded / total);
  };
  const promises = keys.map(key => {
    const src = imageSources[key];
    if (typeof src === 'string') {
      return loadImage(key, src, update);
    }
    const img = src();
    images[key] = img;
    update();
    return Promise.resolve(img);
  });
  await Promise.all(promises);
  return images;
}

export function getImage(key) {
  return images[key];
}
