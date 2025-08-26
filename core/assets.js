const imageSources = {
  startScreen: 'StarHauler_Startscreen.png'
};

const images = {};

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
  const promises = keys.map(key => loadImage(key, imageSources[key], update));
  await Promise.all(promises);
  return images;
}

export function getImage(key) {
  return images[key];
}
