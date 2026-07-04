import { cp, mkdir, rm } from 'node:fs/promises';
import { basename, dirname } from 'node:path';

const runtimeEntries = [
  '_headers',
  'bg.js',
  'assets',
  'core',
  'entities',
  'index.html',
  'main.js',
  'style.css',
  'systems',
  'ui',
  'world/gen.js',
  'world/world.js'
];

function shouldCopy(src) {
  const name = basename(src);
  if (name === '.DS_Store') return false;
  if (name.endsWith('.test.js')) return false;
  if (name.endsWith('.pxd')) return false;
  return true;
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

for (const entry of runtimeEntries) {
  const target = `dist/${entry}`;
  await mkdir(dirname(target), { recursive: true });
  await cp(entry, target, { recursive: true, filter: shouldCopy });
}
