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

  // random planet colour
  const hue = Math.floor(Math.random() * 360);
  const grad = ctx.createRadialGradient(r * 0.3, r * 0.3, r * 0.2, r, r, r);
  grad.addColorStop(0, `hsl(${hue},60%,70%)`);
  grad.addColorStop(1, `hsl(${hue},60%,30%)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  // add some noise for variety
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() * 30) - 15;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function bakeStarTexture() {
  const r = 60;
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.5, '#ffd700');
  grad.addColorStop(1, '#ff8c00');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  // subtle noise
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() * 20) - 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function bakeAsteroidTexture(){
  const r = 20;
  const c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

const imageSources = {
  startScreen: 'StarHauler_Startscreen.png',
  ship: bakeShipTexture,
  planet: bakePlanetTexture,
  star: bakeStarTexture,
  asteroid: bakeAsteroidTexture
};

function loadImage(key, src, onProgress) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      images[key] = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
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
  try {
    await Promise.all(promises);
  } catch (err) {
    throw new Error(`Failed to load assets: ${err.message || err}`);
  }
  return images;
}

export function getImage(key) {
  return images[key];
}
