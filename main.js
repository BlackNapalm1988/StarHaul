import { start, pause, resume } from './core/loop.js';
import { initInput } from './core/input.js';
import { reset } from './world/gen.js';
import { refreshOffers } from './systems/contracts.js';
import { updateHUD } from './ui/hud.js';
import { renderDock, dockToggle, dock, undock, marketBuy } from './ui/dock.js';

let state = null;
let running = false;

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
  refreshOffers(state);
  updateHUD(ui, state);
}

function draw(){
  // drawing handled elsewhere
}

function startGame(){
  state = reset();
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
