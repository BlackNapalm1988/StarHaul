// Simple cache for last-rendered HUD values to avoid redundant DOM writes
const _hudCache = {
  credits: null,
  fuel: null,
  ammo: null,
  cargo: null,
  cargoMax: null,
  hull: null,
  hullMax: null,
  lives: null,
  rep: null,
  missionCount: null
};

// cache for life bar DOM and last width
let _lifeEl = null;
let _lastLifePct = -1;

function setTextIfChanged(el, value, key){
  if(!_hudCache.hasOwnProperty(key)) return; // safety guard
  if(_hudCache[key] !== value){
    el.textContent = value;
    _hudCache[key] = value;
  }
}

export function updateHUD(ui, state){
  if(!state) return;
  // Compute current values (round where needed) and only update if changed
  setTextIfChanged(ui.credits, Math.floor(state.credits), 'credits');
  setTextIfChanged(ui.fuel, Math.floor(state.fuel), 'fuel');
  setTextIfChanged(ui.ammo, state.ammo, 'ammo');
  setTextIfChanged(ui.cargo, state.cargo, 'cargo');
  setTextIfChanged(ui.cargoMax, state.cargoMax, 'cargoMax');
  setTextIfChanged(ui.hull, Math.floor(state.ship.hull), 'hull');
  setTextIfChanged(ui.hullMax, state.ship.hullMax, 'hullMax');
  setTextIfChanged(ui.lives, state.ship.lives, 'lives');
  setTextIfChanged(ui.rep, state.reputation || 0, 'rep');

  // Life bar width reflect hull ratio
  if(!_lifeEl) _lifeEl = document.getElementById('lifeFill');
  if(_lifeEl && state.ship && state.ship.hullMax){
    const pct = Math.max(0, Math.min(100, Math.round((state.ship.hull / state.ship.hullMax) * 100)));
    if(pct !== _lastLifePct){
      _lifeEl.style.width = pct + '%';
      // Color bands: green > 60, amber 30-60, red < 30
      if(pct > 60){
        _lifeEl.style.background = 'var(--ok)';
        _lifeEl.style.boxShadow = '0 0 10px rgba(107,255,154,0.25)';
      } else if(pct > 30){
        _lifeEl.style.background = 'var(--warn)';
        _lifeEl.style.boxShadow = '0 0 10px rgba(255,213,107,0.25)';
      } else {
        _lifeEl.style.background = 'var(--bad)';
        _lifeEl.style.boxShadow = '0 0 10px rgba(255,107,107,0.3)';
      }
      _lastLifePct = pct;
    }
  }

  const count = state.missions?.length || 0;
  // Update count and re-render mission log only if the array length changed
  if(_hudCache.missionCount !== count){
    ui.missionCount.textContent = count;
    _hudCache.missionCount = count;
    renderMissionLog(ui, state);
  }
}

export function renderMissionLog(ui, state){
  if(!ui.missionLogList) return;
  let html = '';
  if(!state || !state.missions || !state.missions.length){
    html = '<div class="item">No active missions.</div>';
  } else {
    html = state.missions.map(m => {
      const illegal = m.illegal ? '<span class="badge" style="background:rgba(255,0,0,.15);color:#f99">Illegal</span>' : '';
      const time = Math.max(0, Math.floor(m.timeLeft || 0));
      const tracked = state.tracked === m.id;
      const btn = `<button class="btn" data-track="${m.id}">${tracked ? 'Untrack' : 'Track'}</button>`;
      return `<div class="item"><div>Deliver ${m.qty} to ${m.to} ${illegal} <span class="badge">${time}s</span></div><div>${btn}</div></div>`;
    }).join('');
  }
  // Avoid touching innerHTML if content hasn't changed
  if(ui.missionLogList.innerHTML !== html){
    ui.missionLogList.innerHTML = html;
    // bind track toggles
    ui.missionLogList.querySelectorAll('[data-track]')?.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-track');
        state.tracked = (state.tracked === id) ? null : id;
        renderMissionLog(ui, state);
      });
    });
  }
}
