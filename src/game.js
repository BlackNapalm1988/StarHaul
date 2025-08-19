import { ui, toast, bindUIHandlers } from './ui.js';
import { CFG, newShip, makePlanet, makeStar } from './entities.js';

let state = null;

export function startNewGame() {
  state = { ship: newShip(), planets: [], stars: [] };
  for (let i = 0; i < CFG.planets; i++) state.planets.push(makePlanet(i));
  for (let s = 0; s < CFG.stars; s++) state.stars.push(makeStar());
  toast('Game started');
}

function showPause() { toast('Paused'); }
function restartGame() { startNewGame(); }
function undock() {}
function setHome() {}
function toggleMissionLog() {
  ui.missionLog.style.display = ui.missionLog.style.display === 'none' ? 'block' : 'none';
}
function viewScores() {}
function quitToMenu() {}
function hidePause() {}
function pauseRestart() {}
function pauseToMenu() {}
function saveScore() {}
function showMenu() {}
function marketBuy() {}

bindUIHandlers({
  showPause,
  restartGame,
  undock,
  setHome,
  toggleMissionLog,
  startNewGame,
  viewScores,
  quitToMenu,
  hidePause,
  pauseRestart,
  pauseToMenu,
  saveScore,
  showMenu,
  marketBuy
});

export function initGame() {
  startNewGame();
}
