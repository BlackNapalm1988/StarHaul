let running = false;
let paused = false;
let lastTime = 0;
let accumulator = 0;
const STEP = 1000 / 60;
let updateFn = () => {};
let drawFn = () => {};

function loop(ts){
  if(!running) return;
  if(!lastTime) lastTime = ts;
  let delta = ts - lastTime;
  if(delta > 1000) delta = STEP;
  lastTime = ts;
  accumulator += delta;
  while(accumulator >= STEP){
    if(!paused) updateFn(STEP / (1000/60));
    accumulator -= STEP;
  }
  drawFn(accumulator / STEP);
  requestAnimationFrame(loop);
}

export function start(update, draw){
  updateFn = update;
  drawFn = draw;
  running = true;
  paused = false;
  lastTime = 0;
  accumulator = 0;
  requestAnimationFrame(loop);
}

export function pause(){
  paused = true;
}

export function resume(){
  if(!running) return;
  paused = false;
}
