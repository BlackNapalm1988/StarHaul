import { start, pause, resume } from './core/loop.js';
import { initInput } from './core/input.js';
import { reset } from './world/gen.js';
import { refreshOffers } from './systems/contracts.js';
import { updateHUD } from './ui/hud.js';
import { renderDock, dockToggle, dock, undock, marketBuy } from './ui/dock.js';
import { updateWorld, drawWorld } from './world/world.js';
import { loadAll, getImage } from './core/assets.js';
import { saveGame, loadGame } from './core/save.js';
import { initDebug } from './ui/debug.js';

let state = null;
let running = false;
let ctx = null;
let debugMode = false;

const ui = {
  dockUI: document.getElementById('dockUI'),
  missionList: document.getElementById('missionList'),
  credits: document.getElementById('credits'),
  fuel: document.getElementById('fuel'),
  ammo: document.getElementById('ammo'),
  cargo: document.getElementById('cargo'),
  cargoMax: document.getElementById('cargoMax'),
  hull: document.getElementById('hull'),
  hullMax: document.getElementById('hullMax'),
  lives: document.getElementById('lives'),
  rep: document.getElementById('rep'),
  missionCount: document.getElementById('missionCount'),
  missionLogList: document.getElementById('missionLogList')
};

function update(){
  updateWorld(state, 1);
  refreshOffers(state);
  updateHUD(ui, state);
}

function draw(){
  drawWorld(ctx, state);
}

function startGame(loaded){
  const canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  if (loaded) {
    state = reset(loaded.seed);
    state.credits = loaded.credits;
    state.reputation = loaded.reputation || 0;
    state.discovered = loaded.discovered || [];
    Object.assign(state.ship, loaded.upgrades || {});
  } else {
    state = reset();
  }
  state.camera = {x:0, y:0, w:canvas.width, h:canvas.height};
  running = true;
  start(update, draw);
}

function togglePause(){
  if(!running) return;
  saveGame(state);
  pause();
}

initInput({
  isRunning: () => running,
  getState: () => state,
  fire: () => {},
  dockToggle: () => dockToggle(state, ui, state.planets[0]),
  useGate: () => {},
  hyperspace: () => {},
  togglePause,
  isDebug: () => debugMode,
  cheatFuel: () => { state.fuel += 50; updateHUD(ui, state); },
  cheatCargo: () => {
    state.cargo = Math.min(state.cargoMax, state.cargo + 10);
    updateHUD(ui, state);
  },
  cheatHazard: () => {
    state.stars.push({ x: state.ship.x + 100, y: state.ship.y, r: 60 });
  }
});

initDebug({
  getState: () => state,
  isRunning: () => running,
  isDebug: () => debugMode
});

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const startScreen = document.getElementById('startScreen');
const newGameBtn = document.getElementById('newGameBtn');
const continueBtn = document.getElementById('continueBtn');
const startImage = document.getElementById('startImage');
const debugToggle = document.getElementById('debugToggle');
const missionPill = document.getElementById('missionPill');
const missionLog = document.getElementById('missionLog');
debugToggle.addEventListener('change', e => {
  debugMode = e.target.checked;
});
missionPill.addEventListener('click', () => {
  missionLog.style.display = missionLog.style.display === 'block' ? 'none' : 'block';
});

let saved = null;

loadAll(p => {
  loadingText.textContent = `Loading... ${Math.round(p * 100)}%`;
}).then(() => {
  loadingOverlay.classList.add('hidden');
  startScreen.classList.remove('hidden');
  saved = loadGame();
  if(!saved) continueBtn.classList.add('hidden');
  else continueBtn.classList.remove('hidden');
  const img = getImage('startScreen');
  if (img) startImage.src = img.src;
});

newGameBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  startGame();
});

continueBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  startGame(saved);
});

window.addEventListener('beforeunload', () => {
  if(state) saveGame(state);
});
