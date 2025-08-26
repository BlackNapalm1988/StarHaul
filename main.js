import { start, pause, resume } from './core/loop.js';
import { initInput } from './core/input.js';
import { reset } from './world/gen.js';
import { refreshOffers } from './systems/contracts.js';
import { updateHUD } from './ui/hud.js';
import { renderDock, dockToggle, dock, undock, marketBuy } from './ui/dock.js';
import { updateWorld, drawWorld } from './world/world.js';

let state = null;
let running = false;
let ctx = null;

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

function startGame(){
  const canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  state = reset();
  state.camera = {x:0, y:0, w:canvas.width, h:canvas.height};
  running = true;
  start(update, draw);
}

function togglePause(){
  if(!running) return;
  pause();
}

initInput({
  isRunning: () => running,
  getState: () => state,
  fire: () => {},
  dockToggle: () => dockToggle(state, ui, state.planets[0]),
  useGate: () => {},
  hyperspace: () => {},
  togglePause
});

document.addEventListener('DOMContentLoaded', startGame);
