export const ui = {
  hud: document.getElementById('hud'),
  dockUI: document.getElementById('dockUI'),
  radar: document.getElementById('radar'),
  missionLog: document.getElementById('missionLog'),
  missionLogList: document.getElementById('missionLogList'),
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
  pauseBtn: document.getElementById('pauseBtn'),
  restartBtn: document.getElementById('restartBtn'),
  missionPill: document.getElementById('missionPill'),
  toasts: document.getElementById('toasts'),
  missionList: document.getElementById('missionList'),
  upgrades: document.getElementById('upgrades'),
  undockBtn: document.getElementById('undockBtn'),
  setHomeBtn: document.getElementById('setHomeBtn'),
  lifeFill: document.getElementById('lifeFill'),
  startScreen: document.getElementById('startScreen'),
  newGameBtn: document.getElementById('newGameBtn'),
  viewScoresBtn: document.getElementById('viewScoresBtn'),
  quitBtn: document.getElementById('quitBtn'),
  scoresBody: document.getElementById('scoresBody'),
  leaderboard: document.getElementById('leaderboard'),
  pauseOverlay: document.getElementById('pauseOverlay'),
  resumeBtn: document.getElementById('resumeBtn'),
  pauseRestartBtn: document.getElementById('pauseRestartBtn'),
  toMenuBtn: document.getElementById('toMenuBtn'),
  pauseStats: document.getElementById('pauseStats'),
  gameOver: document.getElementById('gameOver'),
  finalStats: document.getElementById('finalStats'),
  pilotName: document.getElementById('pilotName'),
  saveScoreBtn: document.getElementById('saveScoreBtn'),
  goMenuBtn: document.getElementById('goMenuBtn')
};

export function toast(msg) {
  if (!ui.toasts) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  ui.toasts.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .5s ease, transform .5s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => el.remove(), 520);
  }, 1500);
}

export function bindUIHandlers(handlers) {
  if (!ui.pauseBtn) return;
  ui.pauseBtn.addEventListener('click', handlers.showPause);
  ui.restartBtn.addEventListener('click', handlers.restartGame);
  ui.undockBtn.addEventListener('click', handlers.undock);
  ui.setHomeBtn.addEventListener('click', handlers.setHome);
  ui.missionPill.addEventListener('click', handlers.toggleMissionLog);
  ui.newGameBtn.addEventListener('click', handlers.startNewGame);
  ui.viewScoresBtn.addEventListener('click', handlers.viewScores);
  ui.quitBtn.addEventListener('click', handlers.quitToMenu);
  ui.resumeBtn.addEventListener('click', handlers.hidePause);
  ui.pauseRestartBtn.addEventListener('click', handlers.pauseRestart);
  ui.toMenuBtn.addEventListener('click', handlers.pauseToMenu);
  ui.saveScoreBtn.addEventListener('click', handlers.saveScore);
  ui.goMenuBtn.addEventListener('click', handlers.showMenu);
  document.querySelectorAll('[data-buy]').forEach(b => {
    b.onclick = () => handlers.marketBuy(b.getAttribute('data-buy'));
  });
}
