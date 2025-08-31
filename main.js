import { start, pause, resume } from './core/loop.js';
import { CFG } from './core/config.js';
import { initInput } from './core/input.js';
import { reset } from './world/gen.js';
import { refreshOffers, tickMissions } from './systems/contracts.js';
import { updateHUD } from './ui/hud.js';
import { renderDock, dockToggle, dock, undock, marketBuy } from './ui/dock.js';
import { updateWorld, drawWorld } from './world/world.js';
import { loadAll, getImage } from './core/assets.js';
import { saveGame, loadGame } from './core/save.js';
import { initDebug } from './ui/debug.js';
import { initMap, updateMap } from './ui/map.js';
import { WORLD } from './core/config.js';
import { toast } from './ui/toast.js';

let state = null;
let running = false;
let ctx = null;
let debugMode = false;
let paused = false;
let appSettings = { godMode:false, entityNaming:false };

function readSettings(){
  try { appSettings = Object.assign(appSettings, JSON.parse(localStorage.getItem('starhaul:settings')||'{}')); } catch {}
}

const DOCK_RADIUS = 80;

function findNearestDockablePlanet(state){
  if(!state) return null;
  const { ship, planets } = state;
  let nearest = null;
  let best = Infinity;
  for(const p of planets){
    const dx = p.x - ship.x;
    const dy = p.y - ship.y;
    const dist = Math.hypot(dx, dy);
    if(dist <= p.r + DOCK_RADIUS && dist < best){
      best = dist;
      nearest = p;
    }
  }
  return nearest;
}

function findNearbyGate(state){
  if(!state || !state.gates || !state.ship) return null;
  const s = state.ship;
  for(const g of state.gates){
    const dx = g.x - s.x, dy = g.y - s.y; const d = Math.hypot(dx, dy);
    if (d <= (g.r || 20) + 30) return g;
  }
  return null;
}

const ui = {
  dockUI: document.getElementById('dockUI'),
  missionList: document.getElementById('missionList'),
  upgrades: document.getElementById('upgrades'),
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

function update(dt){
  updateWorld(state, dt);
  refreshOffers(state, dt);
  tickMissions(state, dt);
  updateHUD(ui, state);
  if (state && state.gameOver && !paused) {
    pause();
    paused = true;
    const over = document.getElementById('gameOver');
    const finalStats = document.getElementById('finalStats');
    if (finalStats) finalStats.textContent = `Credits ${Math.floor(state.credits)} · Rep ${state.reputation || 0}`;
    if (over) over.classList.remove('hidden');
  }
}

function draw(){
  drawWorld(ctx, state);
  updateMap();
}

function setupHiDPICanvas(canvas, ctx){
  const apply = () => {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    try { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); } catch {}
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch {}
    if (state && state.camera){ state.camera.w = w; state.camera.h = h; }
  };
  apply();
  let t = null;
  window.addEventListener('resize', () => {
    if (t) cancelAnimationFrame(t);
    t = requestAnimationFrame(() => { apply(); t = null; });
  });
}

function startGame(loaded){
  const canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  setupHiDPICanvas(canvas, ctx);
  readSettings();
  if (loaded) {
    state = reset(loaded.seed);
    state.credits = loaded.credits;
    state.reputation = loaded.reputation || 0;
    state.discovered = loaded.discovered || [];
    if (typeof loaded.fuel === 'number') state.fuel = loaded.fuel;
    if (typeof loaded.ammo === 'number') state.ammo = loaded.ammo;
    if (typeof loaded.cargo === 'number') state.cargo = loaded.cargo;
    if (loaded.ship) {
      if (typeof loaded.ship.x === 'number') state.ship.x = loaded.ship.x;
      if (typeof loaded.ship.y === 'number') state.ship.y = loaded.ship.y;
    }
    state.missions = loaded.missions || [];
    Object.assign(state.ship, loaded.upgrades || {});
    // Reapply upgrade-derived stats after loading
    const s = state.ship;
    if (typeof s.hold === 'number' && s.hold > 0) {
      state._baseCargoMax = state._baseCargoMax || state.cargoMax;
      state.cargoMax = (state._baseCargoMax || state.cargoMax) + (s.hold * 20);
    }
    if (typeof s.shield === 'number' && s.shield > 0) {
      state._baseHullMax = state._baseHullMax || s.hullMax;
      s.hullMax = (state._baseHullMax || s.hullMax) + (s.shield * 20);
      if (s.hull > s.hullMax) s.hull = s.hullMax;
    }
  } else {
    state = reset();
  }
  state.camera = {x:0, y:0, w:canvas.clientWidth || canvas.width, h:canvas.clientHeight || canvas.height};
  state.godMode = !!appSettings.godMode;
  state.entityNaming = !!appSettings.entityNaming;
  state.invincible = debugMode || state.godMode;
  // If starting docked (home planet), show dock UI immediately
  if (state.docked) {
    try { dock(state, state.docked, ui); } catch {}
  }
  running = true;
  start(update, draw);
}

function restartGame(){
  const canvas = document.getElementById('game');
  state = reset();
  state.camera = { x: 0, y: 0, w: canvas.clientWidth || canvas.width, h: canvas.clientHeight || canvas.height };
  readSettings();
  state.godMode = !!appSettings.godMode;
  state.entityNaming = !!appSettings.entityNaming;
  state.invincible = debugMode || state.godMode;
  paused = false;
  pauseOverlay.classList.add('hidden');
  running = true;
  resume();
}

function togglePause(){
  if(!running) return;
  if(!paused){
    saveGame(state);
    pause();
    pauseOverlay.classList.remove('hidden');
  } else {
    pauseOverlay.classList.add('hidden');
    resume();
  }
  paused = !paused;
}

initInput({
  isRunning: () => running,
  getState: () => state,
  fire: () => {
    if (!state || !state.ship) return;
    const s = state.ship;
    if (s.cool > 0) return;
    if (state.ammo <= 0) return;
    if (state.bullets && state.bullets.length >= (CFG.bullets?.max || Infinity)) return;
    const b = state.bulletPool.acquire();
    const gunLvl = s.gun || 1;
    const baseSpeed = CFG.bullets?.speed ?? 4.0;
    const speed = baseSpeed * (1 + 0.15 * (gunLvl - 1));
    b.x = s.x + Math.cos(s.a) * (s.r + 2);
    b.y = s.y + Math.sin(s.a) * (s.r + 2);
    b.vx = Math.cos(s.a) * speed;
    b.vy = Math.sin(s.a) * speed;
    b.r = 2;
    b.life = CFG.bullets?.life ?? 180; // ~frames at 60fps
    b.friendly = true;
    b.damage = 3 + 2 * (gunLvl - 1);
    state.bullets.push(b);
    s.cool = CFG.bullets?.cool ?? 10;
    state.ammo = Math.max(0, state.ammo - 1);
    updateHUD(ui, state);
  },
  dockToggle: () => {
    const planet = findNearestDockablePlanet(state);
    if (planet || state.docked) dockToggle(state, ui, planet);
  },
  useGate: () => {
    if (!state || !state.ship) return;
    const g = findNearbyGate(state);
    if (!g) return;
    const link = state.gates && state.gates.find(x => x.id === g.link);
    if (!link) return;
    // teleport near the linked gate, dampen velocity
    const s = state.ship;
    s.x = Math.min(WORLD.w - s.r, Math.max(s.r, link.x + 40));
    s.y = Math.min(WORLD.h - s.r, Math.max(s.r, link.y + 40));
    s.vx *= 0.2; s.vy *= 0.2;
    // recenter camera
    if (state.camera){
      state.camera.x = Math.max(0, Math.min(WORLD.w - state.camera.w, s.x - state.camera.w/2));
      state.camera.y = Math.max(0, Math.min(WORLD.h - state.camera.h, s.y - state.camera.h/2));
    }
    toast('Warped via gate');
  },
  hyperspace: () => {
    if (!state || !state.ship) return;
    const s = state.ship;
    function safe(x,y){
      // stay clear of borders
      if (x < s.r+40 || x > WORLD.w - s.r - 40 || y < s.r+40 || y > WORLD.h - s.r - 40) return false;
      const check = (arr, pad) => {
        if (!arr) return true;
        for (const e of arr){
          const dx = x - e.x, dy = y - e.y; const rr = (e.r||0) + pad;
          if (dx*dx + dy*dy < rr*rr) return false;
        }
        return true;
      };
      return check(state.stars, 260) && check(state.planets, 140) && check(state.blackholes, 300);
    }
    let placed = false;
    for (let i=0;i<30;i++){
      const x = 60 + Math.random() * (WORLD.w - 120);
      const y = 60 + Math.random() * (WORLD.h - 120);
      if (safe(x,y)) { s.x = x; s.y = y; placed = true; break; }
    }
    if (!placed){ s.x = WORLD.w/2; s.y = WORLD.h/2; }
    s.vx = 0; s.vy = 0;
    if (state.camera){
      state.camera.x = Math.max(0, Math.min(WORLD.w - state.camera.w, s.x - state.camera.w/2));
      state.camera.y = Math.max(0, Math.min(WORLD.h - state.camera.h, s.y - state.camera.h/2));
    }
    toast('Hyperspace jump');
  },
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

initMap({ getState: () => state });

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const startScreen = document.getElementById('startScreen');
const newGameBtn = document.getElementById('newGameBtn');
const continueBtn = document.getElementById('continueBtn');
const startImage = document.getElementById('startImage');
const debugToggle = document.getElementById('debugToggle');
const godModeToggle = document.getElementById('godModeToggle');
const entityNamingToggle = document.getElementById('entityNamingToggle');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const tabDebugBtn = document.getElementById('tabDebugBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeBtn = document.getElementById('resumeBtn');
const pauseRestartBtn = document.getElementById('pauseRestartBtn');
const toMenuBtn = document.getElementById('toMenuBtn');
const missionPill = document.getElementById('missionPill');
const missionLog = document.getElementById('missionLog');
const undockBtn = document.getElementById('undockBtn');
const setHomeBtn = document.getElementById('setHomeBtn');
const fireBtn = document.getElementById('fireBtn');
const settingsBackBtn = document.getElementById('settingsBackBtn');
const settingsScreen = document.getElementById('settingsScreen');
const gameOverOverlay = document.getElementById('gameOver');
const goMenuBtn = document.getElementById('goMenuBtn');
const saveScoreBtn = document.getElementById('saveScoreBtn');
const pilotNameInput = document.getElementById('pilotName');
const leaderboardBody = document.getElementById('leaderboardBody');
const clearScoresBtn = document.getElementById('clearScoresBtn');
if (debugToggle) debugToggle.addEventListener('change', e => {
  debugMode = e.target.checked;
  if (state) state.invincible = debugMode || (state && state.godMode);
});
if (godModeToggle) godModeToggle.addEventListener('change', e => {
  const on = !!e.target.checked;
  try { localStorage.setItem('starhaul:settings', JSON.stringify(Object.assign({ godMode:false, entityNaming:false }, JSON.parse(localStorage.getItem('starhaul:settings')||'{}'), { godMode:on }))); } catch {}
  if (state){ state.godMode = on; state.invincible = debugMode || on; }
});
if (entityNamingToggle) entityNamingToggle.addEventListener('change', e => {
  const on = !!e.target.checked;
  try { localStorage.setItem('starhaul:settings', JSON.stringify(Object.assign({ godMode:false, entityNaming:false }, JSON.parse(localStorage.getItem('starhaul:settings')||'{}'), { entityNaming:on }))); } catch {}
  if (state) state.entityNaming = on;
});
if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => {
  if (startScreen) startScreen.classList.add('hidden');
  settingsScreen.classList.remove('hidden');
});
// Fallback delegation in case binding misses (ensures Settings button always works)
document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('#openSettingsBtn');
  if (btn && settingsScreen) {
    if (startScreen) startScreen.classList.add('hidden');
    settingsScreen.classList.remove('hidden');
  }
});
if (tabDebugBtn) tabDebugBtn.addEventListener('click', () => {
  const t = document.getElementById('tabDebug');
  if (t) t.classList.remove('hidden');
});

pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', restartGame);
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', restartGame);
if (toMenuBtn) toMenuBtn.addEventListener('click', () => {
  // return to main menu
  pause();
  paused = false;
  running = false;
  pauseOverlay.classList.add('hidden');
  startScreen.classList.remove('hidden');
});

if (missionPill && missionLog) {
  missionPill.addEventListener('click', () => {
    missionLog.style.display = missionLog.style.display === 'none' || !missionLog.style.display ? 'block' : 'none';
  });
}

// Fallback click handlers (in case delegation misses)
if (undockBtn) undockBtn.addEventListener('click', () => { if (state) undock(state, ui); });
if (setHomeBtn) setHomeBtn.addEventListener('click', () => { if (state && state.docked) state.home = state.docked; });
if (fireBtn) fireBtn.addEventListener('click', () => {
  if (!state || !state.ship) return;
  const s = state.ship;
  if (s.cool > 0) return;
  if (state.ammo <= 0) return;
  if (state.bullets && state.bullets.length >= (CFG.bullets?.max || Infinity)) return;
  const gunLvl = s.gun || 1;
  const b = state.bulletPool.acquire();
  const baseSpeed = CFG.bullets?.speed ?? 4.0;
  const speed = baseSpeed * (1 + 0.15 * (gunLvl - 1));
  b.x = s.x + Math.cos(s.a) * (s.r + 2);
  b.y = s.y + Math.sin(s.a) * (s.r + 2);
  b.vx = Math.cos(s.a) * speed;
  b.vy = Math.sin(s.a) * speed;
  b.r = 2;
  b.life = CFG.bullets?.life ?? 180;
  b.friendly = true;
  b.damage = 3 + 2 * (gunLvl - 1);
  state.bullets.push(b);
  s.cool = CFG.bullets?.cool ?? 10;
  state.ammo = Math.max(0, state.ammo - 1);
  updateHUD(ui, state);
});

if (settingsBackBtn && settingsScreen) settingsBackBtn.addEventListener('click', () => {
  settingsScreen.classList.add('hidden');
  if (!running && startScreen) startScreen.classList.remove('hidden');
});
if (goMenuBtn) goMenuBtn.addEventListener('click', () => {
  gameOverOverlay.classList.add('hidden');
  startScreen.classList.remove('hidden');
  running = false;
  renderLeaderboard();
});
if (saveScoreBtn) saveScoreBtn.addEventListener('click', () => {
  try{
    const name = (pilotNameInput && pilotNameInput.value || 'Pilot').trim();
    const score = {
      name,
      credits: state ? state.credits : 0,
      rep: state ? (state.reputation || 0) : 0,
      time: Date.now()
    };
    const key = 'starhaul:scores';
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.push(score);
    localStorage.setItem(key, JSON.stringify(arr));
  }catch(err){
    console.warn('Failed to save score', err);
  }
  if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
  startScreen.classList.remove('hidden');
  running = false;
  renderLeaderboard();
});

let saved = null;

readSettings();
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
  // init settings UI from persisted values
  const godModeToggle = document.getElementById('godModeToggle');
  const entityNamingToggle = document.getElementById('entityNamingToggle');
  if (godModeToggle) godModeToggle.checked = !!appSettings.godMode;
  if (entityNamingToggle) entityNamingToggle.checked = !!appSettings.entityNaming;
  renderLeaderboard();
}).catch(err => {
  loadingOverlay.classList.add('hidden');
  loadingText.textContent = `Error loading assets: ${err.message}`;
  if (typeof alert === 'function') {
    alert(`Error loading assets: ${err.message}`);
  }
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

function renderLeaderboard(){
  if(!leaderboardBody) return;
  const key = 'starhaul:scores';
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  arr.sort((a,b) => (b.credits||0) - (a.credits||0) || (b.rep||0)-(a.rep||0) || (b.time||0)-(a.time||0));
  const top = arr.slice(0,10);
  if (!top.length){
    leaderboardBody.innerHTML = '<div class="muted">No scores yet. Finish a run and save your score!</div>';
    return;
  }
  const rows = top.map((s,i) => `<tr><td>${i+1}</td><td>${s.name||'Pilot'}</td><td>${Math.floor(s.credits||0)}</td><td>${s.rep||0}</td><td>${new Date(s.time||0).toLocaleDateString()}</td></tr>`).join('');
  leaderboardBody.innerHTML = `<table><thead><tr><th>#</th><th>Pilot</th><th>Credits</th><th>Rep</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table>`;
}

if (clearScoresBtn) clearScoresBtn.addEventListener('click', () => {
  try { localStorage.removeItem('starhaul:scores'); } catch {}
  renderLeaderboard();
});
