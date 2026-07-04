function isTextEntryTarget(target) {
  if (!target || target === document.body) return false;
  if (target.isContentEditable) return true;
  const tag = String(target.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function isBodyCapturingKeyboard() {
  return document.body?.classList?.contains('is-reporting');
}

function isVisibleElement(id) {
  const el = document.getElementById(id);
  return !!el && !el.classList.contains('hidden') && el.getAttribute('aria-hidden') !== 'true';
}

function isUiCapturingKeyboard(target) {
  if (isBodyCapturingKeyboard()) return true;
  if (isTextEntryTarget(target)) return true;
  if (target?.closest?.('#reportPanel, #settingsScreen, #pauseOverlay, #gameOver, #debugOverlay')) return true;
  return isVisibleElement('reportPanel') ||
    isVisibleElement('settingsScreen') ||
    isVisibleElement('pauseOverlay') ||
    isVisibleElement('gameOver');
}

function releaseShipControls(state) {
  const s = state?.ship;
  if (!s) return;
  s.turn = 0;
  s.thrust = false;
  s.brake = false;
}

export function initInput(opts){
  window.addEventListener('keydown', function(e){
    if(isUiCapturingKeyboard(e.target)) {
      releaseShipControls(opts.getState && opts.getState());
      return;
    }
    if(!opts.isRunning() || !opts.getState()) return;
    if(e.repeat) return;
    const s = opts.getState().ship;
    if(s.flare>0) return;
    if(e.ctrlKey && opts.isDebug && opts.isDebug()){
      switch(e.code){
        case 'Digit1': opts.cheatFuel && opts.cheatFuel(); return;
        case 'Digit2': opts.cheatCargo && opts.cheatCargo(); return;
        case 'Digit3': opts.cheatHazard && opts.cheatHazard(); return;
      }
    }
    switch(e.code){
      case 'ArrowLeft':
        // Prevent page scroll for bare Arrow keys (no modifiers)
        if(!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) e.preventDefault();
        s.turn=-1; 
        break;
      case 'KeyA': s.turn=-1; break;
      case 'ArrowRight':
        if(!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) e.preventDefault();
        s.turn=1; 
        break;
      case 'KeyD': s.turn=1; break;
      case 'ArrowUp': 
        if(!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) e.preventDefault();
        s.thrust=true; 
        break;
      case 'KeyW': s.thrust=true; break;
      case 'ArrowDown':
        if(!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) e.preventDefault();
        s.brake=true;
        break;
      case 'KeyS': s.brake=true; break;
      case 'Space': e.preventDefault(); opts.fire(); break;
      case 'KeyE': opts.dockToggle(); break;
      case 'ShiftLeft': case 'ShiftRight': opts.hyperspace(); break;
      case 'KeyP': opts.togglePause(); break;
    }
  });
  window.addEventListener('keyup', function(e){
    if(isUiCapturingKeyboard(e.target)) {
      releaseShipControls(opts.getState && opts.getState());
      return;
    }
    if(!opts.isRunning() || !opts.getState()) return;
    const s = opts.getState().ship;
    if(s.flare>0) return;
    switch(e.code){
      case 'ArrowLeft': case 'KeyA': if(s.turn<0) s.turn=0; break;
      case 'ArrowRight': case 'KeyD': if(s.turn>0) s.turn=0; break;
      case 'ArrowUp': case 'KeyW': s.thrust=false; break;
      case 'ArrowDown': case 'KeyS': s.brake=false; break;
    }
  });
}
