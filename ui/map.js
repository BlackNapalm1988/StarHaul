import { WORLD } from '../core/config.js';

let miniCanvas, miniCtx, bigCanvas, bigCtx, overlay, getState;

function drawMap(ctx, canvas, state){
  if(!ctx || !state) return;
  const sx = canvas.width / WORLD.w;
  const sy = canvas.height / WORLD.h;
  ctx.clearRect(0,0,canvas.width, canvas.height);
  // planets
  ctx.fillStyle = '#8be';
  for(const p of state.planets){
    ctx.beginPath();
    ctx.arc(p.x * sx, p.y * sy, Math.max(2, p.r * sx), 0, Math.PI*2);
    ctx.fill();
  }
  // stars
  ctx.fillStyle = '#ffd56b';
  for(const s of state.stars){
    ctx.beginPath();
    ctx.arc(s.x * sx, s.y * sy, Math.max(2, s.r * sx), 0, Math.PI*2);
    ctx.fill();
  }
  // black holes if any
  if(state.blackholes){
    ctx.fillStyle = '#000';
    for(const b of state.blackholes){
      ctx.beginPath();
      ctx.arc(b.x * sx, b.y * sy, Math.max(2, b.r * sx), 0, Math.PI*2);
      ctx.fill();
    }
  }
  // ship
  const ship = state.ship;
  if(ship){
    ctx.fillStyle = '#9cf';
    ctx.beginPath();
    ctx.arc(ship.x * sx, ship.y * sy, 4, 0, Math.PI*2);
    ctx.fill();
  }
}

export function initMap(opts){
  getState = opts.getState;
  miniCanvas = document.getElementById('mini');
  bigCanvas = document.getElementById('bigmap');
  overlay = document.getElementById('mapOverlay');
  if(!miniCanvas || !bigCanvas || !overlay) return;
  miniCtx = miniCanvas.getContext('2d');
  bigCtx = bigCanvas.getContext('2d');

  const closeBtn = document.getElementById('mapCloseBtn');

  miniCanvas.addEventListener('click', () => {
    overlay.classList.remove('hidden');
    drawMap(bigCtx, bigCanvas, getState());
  });

  overlay.addEventListener('click', e => {
    if(e.target === overlay) overlay.classList.add('hidden');
  });

  if(closeBtn){
    closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  }
}

export function updateMap(){
  if(!getState) return;
  const state = getState();
  drawMap(miniCtx, miniCanvas, state);
  if(overlay && !overlay.classList.contains('hidden')){
    drawMap(bigCtx, bigCanvas, state);
  }
}
