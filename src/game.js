import { ui, toast, bindUIHandlers } from './ui.js';
import { CFG, newShip, makePlanet, makeStar } from './entities.js';

// Canvas setup for simple rendering without sprite graphics
let canvas;
let ctx;

// runtime state
let state = null;
let keys = { left: false, right: false, thrust: false };
let paused = true;
let running = false;

function startNewGame() {
  state = { ship: newShip(), planets: [], stars: [] };
  // centre the ship on the canvas
  state.ship.x = canvas.width / 2;
  state.ship.y = canvas.height / 2;
  for (let i = 0; i < CFG.planets; i++) state.planets.push(makePlanet(i));
  for (let s = 0; s < CFG.stars; s++) state.stars.push(makeStar());
  // hide the start screen so the game canvas is visible
  ui.startScreen?.classList.add('hidden');
  ui.pauseOverlay?.classList.add('hidden');
  paused = false;
  toast('Game started');
}

function showPause() {
  if (paused) return;
  paused = true;
  ui.pauseOverlay?.classList.remove('hidden');
}

function hidePause() {
  paused = false;
  ui.pauseOverlay?.classList.add('hidden');
}

function restartGame() { initGame(); }
function pauseRestart() { hidePause(); initGame(); }
function pauseToMenu() { hidePause(); showMenu(); }
function quitToMenu() { showMenu(); }
function undock() {}
function setHome() {}
function toggleMissionLog() {
  ui.missionLog.style.display = ui.missionLog.style.display === 'none' ? 'block' : 'none';
}
function viewScores() {}
function saveScore() {}
function showMenu() {
  paused = true;
  ui.startScreen?.classList.remove('hidden');
  ui.pauseOverlay?.classList.add('hidden');
}
function marketBuy() {}

function handleKey(e, down) {
  switch (e.key) {
    case 'ArrowLeft':
      keys.left = down;
      break;
    case 'ArrowRight':
      keys.right = down;
      break;
    case 'ArrowUp':
      keys.thrust = down;
      break;
    case 'p':
    case 'P':
      if (down) paused ? hidePause() : showPause();
      break;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');

  document.addEventListener('keydown', e => handleKey(e, true));
  document.addEventListener('keyup', e => handleKey(e, false));

  bindUIHandlers({
    showPause,
    restartGame,
    undock,
    setHome,
    toggleMissionLog,
    startNewGame: initGame,
    viewScores,
    quitToMenu,
    hidePause,
    pauseRestart,
    pauseToMenu,
    saveScore,
    showMenu,
    marketBuy
  });

  // ensure the start screen is visible after refresh
  showMenu();
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

function drawPlanet(p) {
  ctx.drawImage(p.tex, p.x - p.tex.width / 2, p.y - p.tex.height / 2);
}

function drawStar(s) {
  ctx.drawImage(s.tex, s.x - s.tex.width / 2, s.y - s.tex.height / 2);
}

function updateShip(ship) {
  if (keys.left) ship.a -= CFG.ship.turn;
  if (keys.right) ship.a += CFG.ship.turn;
  if (keys.thrust) {
    ship.vx += Math.cos(ship.a) * CFG.ship.accel;
    ship.vy += Math.sin(ship.a) * CFG.ship.accel;
  }
  ship.x += ship.vx;
  ship.y += ship.vy;
  ship.vx *= CFG.ship.friction;
  ship.vy *= CFG.ship.friction;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  state.planets.forEach(drawPlanet);
  state.stars.forEach(drawStar);
  drawShip(state.ship);
}

function loop() {
  if (!paused) updateShip(state.ship);
  render();
  requestAnimationFrame(loop);
}

export function initGame() {
  startNewGame();
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}
