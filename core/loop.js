let running = false;
let paused = false;
let lastTime = 0;
let updateFn = () => {};
let drawFn = () => {};

function loop(ts){
  if(!running) return;
  if(!lastTime) lastTime = ts;
  let dt = (ts - lastTime) / (1000/60);
  if(dt <= 0 || dt > 5) dt = 1;
  lastTime = ts;
  if(!paused) updateFn(dt);
  drawFn();
  requestAnimationFrame(loop);
}

export function start(update, draw){
  updateFn = update;
  drawFn = draw;
  running = true;
  paused = false;
  lastTime = 0;
  requestAnimationFrame(loop);
}

export function pause(){
  paused = true;
}

export function resume(){
  if(!running) return;
  paused = false;
}
