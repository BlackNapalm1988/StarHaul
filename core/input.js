export function initInput(opts){
  window.addEventListener('keydown', function(e){
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
      case 'Space': e.preventDefault(); opts.fire(); break;
      case 'KeyE': opts.dockToggle(); break;
      case 'KeyF': opts.useGate(); break;
      case 'ShiftLeft': case 'ShiftRight': opts.hyperspace(); break;
      case 'KeyP': opts.togglePause(); break;
    }
  });
  window.addEventListener('keyup', function(e){
    if(!opts.isRunning() || !opts.getState()) return;
    const s = opts.getState().ship;
    if(s.flare>0) return;
    switch(e.code){
      case 'ArrowLeft': case 'KeyA': if(s.turn<0) s.turn=0; break;
      case 'ArrowRight': case 'KeyD': if(s.turn>0) s.turn=0; break;
      case 'ArrowUp': case 'KeyW': s.thrust=false; break;
    }
  });
}
