import { start, pause, resume } from './core/loop.js';
import { CFG } from './core/config.js';
import { initInput } from './core/input.js';
import { reset } from './world/gen.js';
import { refreshOffers, tickMissions } from './systems/contracts.js';
import { resolveOutOfFuel } from './systems/rescue.js';
import { upgradeCost } from './systems/economy.js';
import { updateHUD } from './ui/hud.js';
import { dockToggle, dock, undock, renderDock } from './ui/dock.js';
import { updateWorld, drawWorld } from './world/world.js';
import { loadAll, getImage, getSpriteSheet, getSpriteArea, getDirectionalFrameIndex, getDirectionalFrameAngle } from './core/assets.js';
import { saveGame, loadGame, cloudSave, cloudLoad } from './core/save.js';
import { isLoggedIn } from './core/auth.js';
import { initAuthHUD } from './ui/auth-modal.js';
import { initDebug } from './ui/debug.js';
import { initMap, updateMap } from './ui/map.js';
import { initMusicPlayer } from './ui/music.js';
import { initPlaytestReporter } from './ui/report.js';
import { WORLD } from './core/config.js';
import { toast } from './ui/toast.js';

window.__starhaulModuleLoaded = true;

let state = null;
let running = false;
let ctx = null;
let paused = false;
let appSettings = {
  invincible: false,
  gravityArrows: false,
  godMode: false,
  entityNaming: false,
  boundingBoxes: false,
  fps: true
};
let settingsReturnToPause = false;
let lastDockRenderTick = -1;

function readSettings(){
  try { appSettings = Object.assign(appSettings, JSON.parse(localStorage.getItem('starhaul:settings')||'{}')); } catch {}
}

function saveSettings(){
  try { localStorage.setItem('starhaul:settings', JSON.stringify(appSettings)); } catch {}
}

function applyDebugSettings(){
  if (!state) return;
  state.godMode = !!appSettings.godMode;
  state.entityNaming = !!appSettings.entityNaming;
  state.invincible = !!(appSettings.invincible || appSettings.godMode);
  state.debugGravity = !!appSettings.gravityArrows;
  state.debugBoundingBoxes = !!appSettings.boundingBoxes;
  state.debugFps = !!appSettings.fps;
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

function playerSpriteWorldPoint(ship, areaName){
  const sheet = getSpriteSheet('player', ship.spriteState || 'idle') || getSpriteSheet('player', 'idle');
  const area = getSpriteArea('player', areaName);
  if (!sheet || !area) return null;
  const size = ship.spriteSize || ship.r * (sheet.renderScale || 4);
  const localX = (area.x / sheet.frameWidth - 0.5) * size;
  const localY = (area.y / sheet.frameHeight - 0.5) * size;
  const frame = Number.isInteger(sheet.fixedFrame)
    ? sheet.fixedFrame
    : getDirectionalFrameIndex(ship.a || 0, sheet);
  const frameAngle = typeof sheet.fixedFrameAngle === 'number'
    ? sheet.fixedFrameAngle
    : getDirectionalFrameAngle(frame, sheet);
  const rot = sheet.rotateWithShip ? (ship.a || 0) - frameAngle : 0;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  return {
    x: ship.x + localX * cr - localY * sr,
    y: ship.y + localX * sr + localY * cr
  };
}

function firePlayerWeapon(){
  if (!state || !state.ship) return;
  const s = state.ship;
  if (s.cool > 0) return;
  if (state.ammo <= 0) return;
  if (state.bullets && state.bullets.length >= (CFG.bullets?.max || Infinity)) return;
  const b = state.bulletPool.acquire();
  const gunLvl = s.gun || 1;
  const baseSpeed = CFG.bullets?.speed ?? 4.0;
  const speed = baseSpeed * (1 + 0.15 * (gunLvl - 1));
  const muzzle = playerSpriteWorldPoint(s, 'Main_Gun') || {
    x: s.x + Math.cos(s.a) * (s.r + 2),
    y: s.y + Math.sin(s.a) * (s.r + 2)
  };
  b.x = muzzle.x;
  b.y = muzzle.y;
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
}

const ui = {
  dockUI: document.getElementById('dockUI'),
  dockBackdrop: document.getElementById('dockBackdrop'),
  dockBackdropImage: document.getElementById('dockBackdropImage'),
  dockStatusLine: document.getElementById('dockStatusLine'),
  dockLocalReadout: document.getElementById('dockLocalReadout'),
  dockTrafficReadout: document.getElementById('dockTrafficReadout'),
  dockNewsTicker: document.getElementById('dockNewsTicker'),
  dockMarketTicker: document.getElementById('dockMarketTicker'),
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

function hideDockSurfaces(){
  document.body?.classList.remove('is-docked');
  if (ui.dockUI) ui.dockUI.style.display = 'none';
  if (ui.dockBackdrop) ui.dockBackdrop.classList.add('hidden');
}

function gameOverMessageFor(cause){
  switch(cause){
    case 'fuel':
      return 'You float aimlessly in space, but nobody is able to reach you. Game Over.';
    case 'combat':
      return 'Your ship was destroyed in an epic battle. Game Over.';
    case 'star':
      return 'A star burns through the hull before the distress beacon can clear static. Game Over.';
    case 'blackhole':
      return 'The gravity well folds your route into a final, silent orbit. Game Over.';
    case 'collision':
      return 'A catastrophic collision tears the ship apart. Game Over.';
    default:
      return 'Your route ends in the dark between stations. Game Over.';
  }
}

function calcNetWorth(s) {
  if (!s) return 0;
  const keys = ['engine', 'gun', 'hold', 'shield', 'radar'];
  const upgradeVal = keys.reduce((sum, k) => sum + upgradeCost(k, Math.max(1, s.ship?.[k] || 0)), 0);
  return Math.floor((s.credits || 0) + upgradeVal + (s.cargo || 0) * 10);
}

function showGameOver(){
  pause();
  paused = true;
  hideDockSurfaces();
  musicPlayer?.setActive(false);
  const pausePanel = document.getElementById('pauseOverlay');
  const over = document.getElementById('gameOver');
  const finalStats = document.getElementById('finalStats');
  const message = document.getElementById('gameOverMessage');
  const cause = state?.gameOverCause || 'unknown';
  if (pausePanel) pausePanel.classList.add('hidden');
  if (message) message.textContent = gameOverMessageFor(cause);
  if (finalStats) finalStats.textContent = `Credits ${Math.floor(state.credits)} · Rep ${state.reputation || 0} · Cause ${cause.toUpperCase()}`;
  if (over) over.classList.remove('hidden');
  // Pre-fill pilot name with logged-in username; auto-submit score to cloud
  import('./core/auth.js').then(({ getUsername, isLoggedIn, getToken }) => {
    if (pilotNameInput && isLoggedIn()) pilotNameInput.value = getUsername() || '';
    if (isLoggedIn() && state) {
      const scores = {
        netWorth: calcNetWorth(state),
        missionsCompleted: (state.missions?.length || 0),
        reputation: state.reputation || 0,
        ticksSurvived: Math.floor(state.ticks || 0)
      };
      fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(scores)
      }).catch(() => {});
    }
  });
}

function updatePauseStats(suffix = ''){
  const el = document.getElementById('pauseStats');
  if (!el || !state) return;
  el.textContent = `Credits ${Math.floor(state.credits)} · Fuel ${Math.floor(state.fuel)} · Hull ${Math.ceil(state.ship.hull)}/${state.ship.hullMax} · Rep ${state.reputation || 0}${suffix}`;
}

function syncMusicPlayerVisibility(){
  const show = !!(running && !paused && state && !state.gameOver && !state.docked);
  musicPlayer?.setActive(show);
  if (show) musicPlayer?.update(state);
}

function update(dt){
  updateWorld(state, dt);
  const rescue = resolveOutOfFuel(state, findNearestDockablePlanet(state));
  if (rescue.status === 'towed') {
    dock(state, rescue.planet, ui);
    const name = rescue.planet?.name || 'home';
    if (ui.dockStatusLine) ui.dockStatusLine.textContent = `EMERGENCY TOW COMPLETE // ${name.toUpperCase()} // FEE $${rescue.cost}`;
  }
  if (!state.gameOver) {
    refreshOffers(state, dt);
    tickMissions(state, dt);
  }
  if (state.docked) {
    const dockRenderTick = Math.floor((state.time || 0) / 10);
    if (dockRenderTick !== lastDockRenderTick) {
      renderDock(ui, state);
      lastDockRenderTick = dockRenderTick;
    }
  } else {
    lastDockRenderTick = -1;
  }
  updateHUD(ui, state);
  syncMusicPlayerVisibility();
  if (state && state.gameOver && !paused) {
    showGameOver();
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
      if (typeof loaded.ship.hull === 'number') state.ship.hull = loaded.ship.hull;
      if (typeof loaded.ship.lives === 'number') state.ship.lives = loaded.ship.lives;
      state.ship.anchored = !!loaded.ship.anchored;
    }
    state.home = state.planets.find(p => p.id === loaded.homeId) || null;
    state.docked = state.planets.find(p => p.id === loaded.dockedId) || null;
    state.missions = loaded.missions || [];
    if (typeof loaded.ticks === 'number') state.ticks = loaded.ticks;
    if (Array.isArray(loaded.planetSupply)) {
      for (const entry of loaded.planetSupply) {
        const p = state.planets.find(pl => pl.id === entry.id);
        if (p && entry.supply) p.supply = { ...entry.supply };
      }
    }
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
  applyDebugSettings();
  paused = false;
  lastDockRenderTick = -1;
  if (pauseOverlay) pauseOverlay.classList.add('hidden');
  if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
  // If starting docked (home planet), show dock UI immediately
  if (state.docked) {
    try { dock(state, state.docked, ui); } catch {}
  } else {
    hideDockSurfaces();
  }
  running = true;
  syncMusicPlayerVisibility();
  start(update, draw);
}

function restartGame(){
  hideDockSurfaces();
  const canvas = document.getElementById('game');
  state = reset();
  state.camera = { x: 0, y: 0, w: canvas.clientWidth || canvas.width, h: canvas.clientHeight || canvas.height };
  readSettings();
  applyDebugSettings();
  paused = false;
  lastDockRenderTick = -1;
  pauseOverlay.classList.add('hidden');
  running = true;
  syncMusicPlayerVisibility();
  resume();
}

function togglePause(){
  if(!running) return;
  if(!paused){
    saveAll(state);
    pause();
    syncMusicPlayerVisibility();
    updatePauseStats();
    pauseOverlay.classList.remove('hidden');
  } else {
    pauseOverlay.classList.add('hidden');
    resume();
  }
  paused = !paused;
  syncMusicPlayerVisibility();
}

initInput({
  isRunning: () => running,
  getState: () => state,
  fire: firePlayerWeapon,
  dockToggle: () => {
    const planet = findNearestDockablePlanet(state);
    if (planet || state.docked) dockToggle(state, ui, planet);
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
  isDebug: () => appSettings.invincible || appSettings.godMode,
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
  getOption: key => !!appSettings[key],
  setOption: (key, value) => {
    if (!(key in appSettings)) return;
    appSettings[key] = !!value;
    saveSettings();
    applyDebugSettings();
  }
});

initMap({ getState: () => state });

const musicPlayer = initMusicPlayer({ getState: () => state });
initPlaytestReporter({
  getState: () => state,
  isRunning: () => running,
  onSaved: report => toast(`${report.type} report saved`),
  onCached: report => toast(`${report.type} report saved locally`)
});

initAuthHUD(document.getElementById('hud'));

// When auth state changes, push current save to cloud (or pull cloud save)
window.addEventListener('starhaul:auth', async (e) => {
  if (!e.detail) return; // logout — nothing to push
  if (state) {
    saveGame(state);
    cloudSave(loadGame()).catch(() => {});
  } else {
    // Not in a run yet — try pulling cloud save so Continue is available
    const cloud = await cloudLoad();
    if (cloud) {
      saved = cloud;
      if (continueBtn) { continueBtn.disabled = false; continueBtn.title = 'Continue saved run'; }
    }
  }
});

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const startScreen = document.getElementById('startScreen');
const newGameBtn = document.getElementById('newGameBtn');
const continueBtn = document.getElementById('continueBtn');
const startImage = document.getElementById('startImage');
const openLeaderboardBtn = document.getElementById('openLeaderboardBtn');
const openHelpBtn = document.getElementById('openHelpBtn');
const leaderboardOverlay = document.getElementById('leaderboardOverlay');
const leaderboardBackBtn = document.getElementById('leaderboardBackBtn');
const helpOverlay = document.getElementById('helpOverlay');
const helpBackBtn = document.getElementById('helpBackBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeBtn = document.getElementById('resumeBtn');
const pauseSaveBtn = document.getElementById('pauseSaveBtn');
const pauseSettingsBtn = document.getElementById('pauseSettingsBtn');
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

function showStartSubscreen(overlay) {
  if (!overlay || !startScreen) return;
  startScreen.classList.add('hidden');
  overlay.classList.remove('hidden');
}

function hideStartSubscreen(overlay) {
  if (overlay) overlay.classList.add('hidden');
  if (startScreen) startScreen.classList.remove('hidden');
}

if (openLeaderboardBtn) openLeaderboardBtn.addEventListener('click', () => {
  renderLeaderboard();
  showStartSubscreen(leaderboardOverlay);
});
if (leaderboardBackBtn) leaderboardBackBtn.addEventListener('click', () => hideStartSubscreen(leaderboardOverlay));
if (openHelpBtn) openHelpBtn.addEventListener('click', () => showStartSubscreen(helpOverlay));
if (helpBackBtn) helpBackBtn.addEventListener('click', () => hideStartSubscreen(helpOverlay));
pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', restartGame);
resumeBtn.addEventListener('click', togglePause);
if (pauseSaveBtn) pauseSaveBtn.addEventListener('click', () => {
  if (!state) return;
  saveAll(state);
  updatePauseStats(' · Saved');
});
if (pauseSettingsBtn) pauseSettingsBtn.addEventListener('click', () => {
  if (!settingsScreen) return;
  settingsReturnToPause = true;
  pauseOverlay.classList.add('hidden');
  settingsScreen.classList.remove('hidden');
});
pauseRestartBtn.addEventListener('click', restartGame);
if (toMenuBtn) toMenuBtn.addEventListener('click', () => {
  // return to main menu
  hideDockSurfaces();
  musicPlayer?.setActive(false);
  pause();
  paused = false;
  running = false;
  settingsReturnToPause = false;
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
if (fireBtn) fireBtn.addEventListener('click', firePlayerWeapon);

if (settingsBackBtn && settingsScreen) settingsBackBtn.addEventListener('click', () => {
  settingsScreen.classList.add('hidden');
  if (settingsReturnToPause && running) {
    settingsReturnToPause = false;
    updatePauseStats();
    pauseOverlay.classList.remove('hidden');
    return;
  }
  settingsReturnToPause = false;
  if (!running && startScreen) startScreen.classList.remove('hidden');
});
if (goMenuBtn) goMenuBtn.addEventListener('click', () => {
  musicPlayer?.setActive(false);
  gameOverOverlay.classList.add('hidden');
  startScreen.classList.remove('hidden');
  running = false;
  paused = false;
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
  musicPlayer?.setActive(false);
  startScreen.classList.remove('hidden');
  running = false;
  paused = false;
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
  if (continueBtn) {
    continueBtn.disabled = !saved;
    continueBtn.title = saved ? 'Continue saved run' : 'No saved run';
  }
  const img = getImage('startScreen');
  if (img) startImage.src = img.src;
  renderLeaderboard();
  // Silently try to pull cloud save — may upgrade `saved` to cloud version
  cloudLoad().then(cloud => {
    if (cloud) {
      saved = cloud;
      if (continueBtn) { continueBtn.disabled = false; continueBtn.title = 'Continue saved run'; }
    }
  }).catch(() => {});
}).catch(err => {
  loadingText.textContent = `Error loading assets: ${err.message}`;
  loadingOverlay.classList.remove('hidden');
  if (typeof alert === 'function') {
    alert(`Error loading assets: ${err.message}`);
  }
});

newGameBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  startGame();
});

continueBtn.addEventListener('click', () => {
  if (!saved) return;
  startScreen.classList.add('hidden');
  startGame(saved);
});

function saveAll(s) {
  if (!s) return;
  saveGame(s);
  if (isLoggedIn()) cloudSave(loadGame()).catch(() => {});
}

window.addEventListener('beforeunload', () => {
  if(state) saveAll(state);
});

function renderLeaderboardLocal(){
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

function renderLeaderboardCloud(board){
  if(!leaderboardBody) return;
  const section = (title, rows) => {
    if (!rows || !rows.length) return '';
    const header = `<tr><th>#</th><th>Pilot</th><th>${title}</th></tr>`;
    const body = rows.map((r,i) => {
      const val = title === 'Net Worth' ? Math.floor(r.net_worth||0)
                : title === 'Ticks' ? Math.floor(r.ticks_survived||0)
                : title === 'Missions' ? (r.missions_completed||0)
                : (r.reputation||0);
      return `<tr><td>${i+1}</td><td>${r.username||'?'}</td><td>${val}</td></tr>`;
    }).join('');
    return `<h4 style="margin:12px 0 4px;font-size:11px;letter-spacing:.1em">${title.toUpperCase()}</h4><table><thead>${header}</thead><tbody>${body}</tbody></table>`;
  };
  leaderboardBody.innerHTML =
    section('Net Worth', board.byNetWorth) +
    section('Ticks', board.byTicks) +
    section('Missions', board.byMissions) +
    section('Reputation', board.byReputation);
}

function renderLeaderboard(){
  if(!leaderboardBody) return;
  renderLeaderboardLocal();
  fetch('/api/leaderboard').then(r => r.ok ? r.json() : null).then(board => {
    if (board && (board.byNetWorth?.length || board.byTicks?.length)) renderLeaderboardCloud(board);
  }).catch(() => {});
}

if (clearScoresBtn) clearScoresBtn.addEventListener('click', () => {
  try { localStorage.removeItem('starhaul:scores'); } catch {}
  renderLeaderboard();
});
