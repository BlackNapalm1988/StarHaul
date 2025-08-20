import { ui, toast, bindUIHandlers } from './ui.js';
import { CFG, newShip, makePlanet, makeStar } from './entities.js';

// Canvas setup for simple rendering without sprite graphics
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let state = null;

export function startNewGame() {
  state = { ship: newShip(), planets: [], stars: [] };
  // centre the ship on the canvas
  state.ship.x = canvas.width / 2;
  state.ship.y = canvas.height / 2;
  for (let i = 0; i < CFG.planets; i++) state.planets.push(makePlanet(i));
  for (let s = 0; s < CFG.stars; s++) state.stars.push(makeStar());
  // hide the start screen so the game canvas is visible
  ui.startScreen?.classList.add('hidden');
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

function drawShip(ship) {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.a);
  ctx.beginPath();
  ctx.moveTo(0, -ship.r);
  ctx.lineTo(ship.r * 0.8, ship.r);
  ctx.lineTo(-ship.r * 0.8, ship.r);
  ctx.closePath();
  ctx.strokeStyle = '#6df2d6';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawShip(state.ship);
}

function loop() {
  render();
  requestAnimationFrame(loop);
}

export function initGame() {
  startNewGame();
  requestAnimationFrame(loop);
}
