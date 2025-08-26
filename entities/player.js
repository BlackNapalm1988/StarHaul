export function newShip(){
  return {
    x: WORLD.w/2, y: WORLD.h/2, vx:0, vy:0, a:-Math.PI/2,
    turn:0, thrust:false, r:CFG.ship.r,
    inv:CFG.ship.invuln, blink:0, justSpawned:true,
    lives:3, hull:CFG.ship.hullMax, hullMax:CFG.ship.hullMax, canShoot:true, cool:0,
    engine:1, hold:0, shield:0, gun:1, radar:1, trail:[],
    centerX:0, centerY:0, centered:false, flare:0
  };
}
