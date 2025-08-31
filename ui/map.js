import { WORLD } from '../core/config.js';
import { pause, resume } from '../core/loop.js';
import { toast } from './toast.js';

let miniCanvas, miniCtx, bigCanvas, bigCtx, overlay, getState;
let pausedByMap = false;

function setupHiDPICanvas(canvas, ctx){
  const apply = () => {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const w = canvas.clientWidth || canvas.width || 1;
    const h = canvas.clientHeight || canvas.height || 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    try { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); } catch {}
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch {}
  };
  apply();
  let raf = null;
  const onResize = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { apply(); raf = null; });
  };
  window.addEventListener('resize', onResize);
}

function sizeBigMap(){
  if (!bigCanvas) return;
  // Desired: inner drawing area shows entire WORLD while fitting viewport
  const pad = 12, innerPad = 10;
  const margin = 20; // breathing room from window edges
  const vw = Math.max(320, window.innerWidth - margin*2);
  const vh = Math.max(240, window.innerHeight - margin*2);
  const worldAspect = WORLD.w / WORLD.h;
  // available inner area after panel padding
  const maxInnerW = Math.max(200, vw - 2*(pad+innerPad));
  const maxInnerH = Math.max(150, vh - 2*(pad+innerPad));
  let innerW, innerH;
  if (maxInnerW / maxInnerH > worldAspect){
    innerH = maxInnerH;
    innerW = innerH * worldAspect;
  } else {
    innerW = maxInnerW;
    innerH = innerW / worldAspect;
  }
  const canvasW = Math.round(innerW + 2*(pad+innerPad));
  const canvasH = Math.round(innerH + 2*(pad+innerPad));
  bigCanvas.style.width = canvasW + 'px';
  bigCanvas.style.height = canvasH + 'px';
  // Re-apply HiDPI backing store with new CSS size
  if (bigCtx) setupHiDPICanvas(bigCanvas, bigCtx);
}

function drawMap(ctx, canvas, state){
  if(!ctx || !state) return;
  // use CSS pixel dimensions for drawing; HiDPI transform handles device pixels
  const cw = canvas.clientWidth || canvas.width;
  const ch = canvas.clientHeight || canvas.height;
  const isBig = (canvas === bigCanvas);
  // Background console panel with border (only for big map)
  ctx.clearRect(0,0,cw, ch);
  const pad = isBig ? 12 : 0;
  const rx = 10;
  if (isBig){
    ctx.fillStyle = 'rgba(8,12,20,0.92)';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad+rx, pad);
    ctx.lineTo(cw-pad-rx, pad);
    ctx.quadraticCurveTo(cw-pad, pad, cw-pad, pad+rx);
    ctx.lineTo(cw-pad, ch-pad-rx);
    ctx.quadraticCurveTo(cw-pad, ch-pad, cw-pad-rx, ch-pad);
    ctx.lineTo(pad+rx, ch-pad);
    ctx.quadraticCurveTo(pad, ch-pad, pad, ch-pad-rx);
    ctx.lineTo(pad, pad+rx);
    ctx.quadraticCurveTo(pad, pad, pad+rx, pad);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Inner glow border
    ctx.strokeStyle = 'rgba(109,242,214,0.15)';
    ctx.stroke();
  }
  // Compute drawing area (full canvas for mini, inset for big)
  const innerPad = isBig ? 10 : 0;
  const ix = pad + innerPad, iy = pad + innerPad;
  const iw = cw - (pad + innerPad) * 2;
  const ih = ch - (pad + innerPad) * 2;
  ctx.save();
  if (isBig){
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
  }

  // Radar jamming overlay
  if (typeof state.time === 'number' && typeof state.radarJammedUntil === 'number' && state.time < state.radarJammedUntil) {
    ctx.clearRect(ix, iy, iw, ih);
    // simple static noise / jam pattern
    ctx.fillStyle = '#10141f';
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for(let i=0;i<120;i++){
      const x = ix + Math.random()*iw;
      const y = iy + Math.random()*ih;
      const w = 6 + Math.random()*12;
      ctx.fillRect(x, y, w, 1);
    }
    ctx.fillStyle = 'rgba(255,80,80,0.8)';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.fillText('RADAR JAMMED', ix + 8, iy + 16);
    ctx.restore();
    return;
  }
  const sx = iw / WORLD.w;
  const sy = ih / WORLD.h;
  ctx.clearRect(ix, iy, iw, ih);

  // Faint grid (only on big map)
  const COLS = 10, ROWS = 8;
  const cellW = iw / COLS;
  const cellH = ih / ROWS;
  if (isBig){
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for(let c=1;c<COLS;c++){ const x = ix + c*cellW; ctx.beginPath(); ctx.moveTo(x, iy); ctx.lineTo(x, iy+ih); ctx.stroke(); }
    for(let r=1;r<ROWS;r++){ const y = iy + r*cellH; ctx.beginPath(); ctx.moveTo(ix, y); ctx.lineTo(ix+iw, y); ctx.stroke(); }
  }
  // planets
  ctx.fillStyle = '#8be';
  for(const p of state.planets){
    const pr = Math.max(2, Math.min(8, p.r * sx * 0.4));
    ctx.beginPath();
    ctx.arc(ix + p.x * sx, iy + p.y * sy, pr, 0, Math.PI*2);
    ctx.fill();
    // labels (avoid clutter on tiny mini-map scale)
    const rScaled = pr;
    if (isBig && p.name && (cw >= 400 || rScaled > 6)){
      const lx = ix + p.x * sx;
      const ly = iy + p.y * sy - (rScaled + 8);
      const text = p.name;
      ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // pill background
      const w = ctx.measureText(text).width;
      const padX = 6, padY = 3;
      const bw = w + padX*2, bh = 14;
      const rx = 6, bx = lx - bw/2, by = ly - bh/2;
      ctx.fillStyle = 'rgba(10,14,22,0.65)';
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + rx, by);
      ctx.lineTo(bx + bw - rx, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rx);
      ctx.lineTo(bx + bw, by + bh - rx);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rx, by + bh);
      ctx.lineTo(bx + rx, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rx);
      ctx.lineTo(bx, by + rx);
      ctx.quadraticCurveTo(bx, by, bx + rx, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(230,237,243,0.95)';
      ctx.fillText(text, lx, ly);
    }
  }
  // stars
  ctx.fillStyle = '#ffd56b';
  for(const s of state.stars){
    const rr = Math.max(2, Math.min(10, s.r * sx * 0.35));
    ctx.beginPath();
    ctx.arc(ix + s.x * sx, iy + s.y * sy, rr, 0, Math.PI*2);
    ctx.fill();
  }
  // black holes if any
  if(state.blackholes){
    ctx.fillStyle = '#000';
    for(const b of state.blackholes){
      const rr = Math.max(3, Math.min(10, b.r * sx * 0.4));
      ctx.beginPath();
      ctx.arc(ix + b.x * sx, iy + b.y * sy, rr, 0, Math.PI*2);
      ctx.fill();
    }
  }
  // pirate bases
  if(state.pirateBases){
    ctx.fillStyle = '#f44';
    for(const pb of state.pirateBases){
      const rr = Math.max(2, Math.min(8, pb.r * sx * 0.4));
      ctx.beginPath();
      ctx.arc(ix + pb.x * sx, iy + pb.y * sy, rr, 0, Math.PI*2);
      ctx.fill();
    }
  }
  // gates
  if(state.gates){
    ctx.fillStyle = '#9bf';
    for(const g of state.gates){
      const rr = Math.max(2, Math.min(8, g.r * sx * 0.5));
      ctx.beginPath();
      ctx.arc(ix + g.x * sx, iy + g.y * sy, rr, 0, Math.PI*2);
      ctx.fill();
    }
  }
  // ship
  const ship = state.ship;
  if(ship){
    ctx.fillStyle = '#9cf';
    ctx.beginPath();
    ctx.arc(ix + ship.x * sx, iy + ship.y * sy, isBig ? 4 : 3, 0, Math.PI*2);
    ctx.fill();
  }
  // Flag marker
  if (isBig && state.navTarget){
    const mx = ix + state.navTarget.x * sx;
    const my = iy + state.navTarget.y * sy;
    ctx.fillStyle = '#ffd56b';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my-14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my-14); ctx.lineTo(mx+10, my-10); ctx.lineTo(mx, my-6); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();

  // Sector labels (only on big map, draw outside clip)
  if (isBig){
    ctx.fillStyle = 'rgba(200,220,240,0.8)';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for(let c=0;c<COLS;c++){ const label = String.fromCharCode(65 + c); const x = ix + c*cellW + cellW/2; ctx.fillText(label, x, iy - 10); }
    ctx.textAlign = 'right';
    for(let r=0;r<ROWS;r++){ const label = String(r+1); const y = iy + r*cellH + cellH/2; ctx.fillText(label, ix - 8, y); }
  }
}

/**
 * Initialize the map UI.
 * Requires the following DOM elements to exist:
 * - #mini: canvas for the mini map
 * - #bigmap: canvas for the full-screen map
 * - #mapOverlay: overlay container for the full map
 * If any required element is missing, a console warning is logged and
 * initialization is skipped.
 */
export function initMap(opts){
  getState = opts.getState;
  miniCanvas = document.getElementById('mini');
  bigCanvas = document.getElementById('bigmap');
  overlay = document.getElementById('mapOverlay');
  if(!miniCanvas || !bigCanvas || !overlay){
    const missing = [];
    if(!miniCanvas) missing.push('#mini');
    if(!bigCanvas) missing.push('#bigmap');
    if(!overlay) missing.push('#mapOverlay');
    console.warn(`initMap: missing required element(s): ${missing.join(', ')}`);
    return;
  }
  miniCtx = miniCanvas.getContext('2d');
  bigCtx = bigCanvas.getContext('2d');
  setupHiDPICanvas(miniCanvas, miniCtx);
  setupHiDPICanvas(bigCanvas, bigCtx);
  sizeBigMap();

  const closeBtn = document.getElementById('mapCloseBtn');

  miniCanvas.addEventListener('click', () => {
    overlay.classList.remove('hidden');
    if (!pausedByMap) { pause(); pausedByMap = true; }
    sizeBigMap();
    drawMap(bigCtx, bigCanvas, getState());
  });

  // While big map is open, any key closes it and blocks game inputs
  function onKeyDownClose(e){
    if (overlay && !overlay.classList.contains('hidden')){
      e.preventDefault();
      e.stopPropagation();
      overlay.classList.add('hidden');
      if (pausedByMap) { resume(); pausedByMap = false; }
    }
  }
  document.addEventListener('keydown', onKeyDownClose, true);
  window.addEventListener('resize', () => { if(overlay && !overlay.classList.contains('hidden')){ sizeBigMap(); drawMap(bigCtx, bigCanvas, getState()); } });

  overlay.addEventListener('click', e => {
    if(e.target === overlay){
      overlay.classList.add('hidden');
      if (pausedByMap) { resume(); pausedByMap = false; }
    }
  });

  if(closeBtn){
    closeBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      if (pausedByMap) { resume(); pausedByMap = false; }
    });
  }

  // Click to place a navigation flag on the big map
  bigCanvas.addEventListener('click', (e) => {
    const rect = bigCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    const cw = bigCanvas.clientWidth || bigCanvas.width;
    const ch = bigCanvas.clientHeight || bigCanvas.height;
    const pad = 12, innerPad = 10;
    const ix = pad + innerPad, iy = pad + innerPad;
    const iw = cw - (pad + innerPad) * 2;
    const ih = ch - (pad + innerPad) * 2;
    if (x < ix || x > ix+iw || y < iy || y > iy+ih) return; // outside map area
    const sx = iw / WORLD.w, sy = ih / WORLD.h;
    const wx = (x - ix) / sx;
    const wy = (y - iy) / sy;
    const state = getState();
    state.navTarget = { x: wx, y: wy };
    toast('Navigation marker set');
    drawMap(bigCtx, bigCanvas, state);
  });
}

export function updateMap(){
  if(!getState) return;
  const state = getState();
  drawMap(miniCtx, miniCanvas, state);
  if(overlay && !overlay.classList.contains('hidden')){
    drawMap(bigCtx, bigCanvas, state);
  }
}
