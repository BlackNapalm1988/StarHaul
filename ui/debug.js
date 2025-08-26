export function initDebug(opts){
  const el = document.createElement('div');
  el.id = 'debugOverlay';
  Object.assign(el.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    background: 'rgba(0,0,0,0.7)',
    color: '#0f0',
    font: '12px monospace',
    padding: '4px',
    display: 'none',
    zIndex: 1000
  });
  document.body.appendChild(el);

  let last = performance.now();
  let fps = 0;
  function loop(now){
    fps = 1000 / (now - last);
    last = now;
    if(el.style.display !== 'none'){
      const s = opts.getState();
      if(s){
        el.innerHTML =
          `FPS: ${fps.toFixed(1)}<br>` +
          `Entities: stars ${s.stars.length} planets ${s.planets.length} bullets ${s.bullets.length} particles ${s.particles.length}<br>` +
          `State: running ${opts.isRunning()} debug ${opts.isDebug()} thrust ${s.ship.thrust} turn ${s.ship.turn}`;
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('keydown', e => {
    if(e.code === 'Backquote'){
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
  });
}
