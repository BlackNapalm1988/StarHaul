const DEBUG_OPTIONS = [
  ['invincible', 'Invincible'],
  ['gravityArrows', 'Gravity Arrows'],
  ['godMode', 'God Mode'],
  ['entityNaming', 'Entity Naming'],
  ['boundingBoxes', 'Bounding Boxes'],
  ['fps', 'FPS']
];

function checked(value) {
  return value ? 'checked' : '';
}

export function initDebug(opts){
  const el = document.createElement('div');
  el.id = 'debugOverlay';
  el.className = 'debug-menu hidden';
  el.innerHTML = `
    <div class="debug-titlebar">
      <span>DEBUG MENU</span>
      <span class="debug-hotkey">\`</span>
    </div>
    <div class="debug-options">
      ${DEBUG_OPTIONS.map(([key, label]) => `
        <label class="debug-option">
          <input type="checkbox" data-debug-option="${key}" ${checked(opts.getOption?.(key))}>
          <span>${label}</span>
        </label>
      `).join('')}
    </div>
    <div id="debugStats" class="debug-stats"></div>
  `;
  document.body.appendChild(el);

  const syncInputs = () => {
    for (const input of el.querySelectorAll('[data-debug-option]')) {
      input.checked = !!opts.getOption?.(input.dataset.debugOption);
    }
  };

  el.addEventListener('change', e => {
    const input = e.target?.closest?.('[data-debug-option]');
    if (!input) return;
    opts.setOption?.(input.dataset.debugOption, input.checked);
    syncInputs();
  });

  let last = performance.now();
  let fps = 0;
  function loop(now){
    fps = 1000 / Math.max(1, now - last);
    last = now;
    const s = opts.getState();
    if (s) {
      s.debugGravity = !!opts.getOption?.('gravityArrows');
      s.debugBoundingBoxes = !!opts.getOption?.('boundingBoxes');
      s.debugFps = !!opts.getOption?.('fps');
    }

    const stats = document.getElementById('debugStats');
    if (stats && !el.classList.contains('hidden')) {
      if (s && opts.getOption?.('fps')) {
        const gx = typeof s.gravityDebugX === 'number' ? s.gravityDebugX : 0;
        const gy = typeof s.gravityDebugY === 'number' ? s.gravityDebugY : 0;
        const gm = Math.hypot(gx, gy);
        stats.innerHTML =
          `FPS: ${fps.toFixed(1)}<br>` +
          `Entities: stars ${s.stars.length} planets ${s.planets.length} bullets ${s.bullets.length} particles ${s.particles.length}<br>` +
          `Gravity: ${gm.toFixed(4)} (${gx.toFixed(4)}, ${gy.toFixed(4)})<br>` +
          `State: running ${opts.isRunning()} invincible ${opts.getOption?.('invincible')} thrust ${s.ship.thrust} turn ${s.ship.turn}`;
      } else {
        stats.textContent = opts.getOption?.('fps') ? 'No active run.' : 'FPS readout disabled.';
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('keydown', e => {
    if(e.code === 'Backquote' && !(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)){
      e.preventDefault();
      el.classList.toggle('hidden');
      syncInputs();
    }
  });
}
