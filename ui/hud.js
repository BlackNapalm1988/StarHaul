export function updateHUD(ui, state){
  if(!state) return;
  ui.credits.textContent = Math.floor(state.credits);
  ui.fuel.textContent = Math.floor(state.fuel);
  ui.ammo.textContent = state.ammo;
  ui.cargo.textContent = state.cargo;
  ui.cargoMax.textContent = state.cargoMax;
  ui.hull.textContent = Math.floor(state.ship.hull);
  ui.hullMax.textContent = state.ship.hullMax;
  ui.lives.textContent = state.ship.lives;
  ui.missionCount.textContent = state.missions.length;
  ui.rep.textContent = state.reputation || 0;
  renderMissionLog(ui, state);
}

export function renderMissionLog(ui, state){
  if(!ui.missionLogList) return;
  if(!state || !state.missions.length){
    ui.missionLogList.innerHTML = '<div class="item">No active missions.</div>';
    return;
  }
  ui.missionLogList.innerHTML = state.missions.map(m => `<div class="item">Deliver ${m.qty} to ${m.to}</div>`).join('');
}
