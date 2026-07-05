export const WORLD = { w: 10400, h: 7800 };

export const CFG = {
  ship: { r: 16, invuln: 120, hullMax: 100, accel: 0.11, friction: 0.993, maxSpeed: 6.2, turn: 0.08 },
  economy: { startCredits: 500, fuelStart: 100, ammoStart: 50, cargoMax: 50, repairPerHull: 20, fuelUse: 0.055, supplyDecay: 0.02, supplyShiftDeliver: 15, supplyShiftBuy: 8, priceVariance: 0.5 },
  bullets: { max: 7, speed: 9.5, life: 110, cool: 9 },
  contracts: { perPlanet: 3, minTime: 320, maxTime: 600, illegalChance: 0.2 },
  pirateBase: { r: 80, hp: 60, spawnEvery: 400, fireEvery: 180, bounty: 200 },
  hunters: { fireEvery: 90, speed: 1.2, chaseRadius: 620, leashRadius: 900, patrolRadius: 320 },
  pirates: {
    fireEvery: 120,
    bulletSpeed: 6.5,
    damage: 10,
    spawnEvery: 300,
    max: 16,
    speed: 2.1,
    aggro: 380,
    chaseRadius: 520,
    leashRadius: 760,
    patrolRadius: 260,
    planetAvoidRadius: 320,
    planetAvoidAccel: 0.18,
    planetNoAttackRadius: 360,
    standoffRange: 140,
    standoffAccel: 0.08,
    orbitAccel: 0.035,
    hp: 7,
    boardRange: 22,
    boardTime: 90,
    steal: { credits: [60, 160], cargo: [3, 10] },
    repPenalty: 1
  },
  asteroids: { spawnEvery: 220, max: 140, elasticity: 0.6 },
  traders: { spawnEvery: 1200, max: 8 },
  nebulae: { count: 6, slow: 0.985, fuelDrain: 0.02 },
  rescue: { towBase: 50, towPer1000: 25, emergencyFuel: 25 },
  patrols: { scanRadius: 220, fine: 200 },
  contraband: { repPenalty: 2 },
  planets: 12,
  blackholes: 3,
  stars: 7,
  supernova: { warnWindow: 900 },
  ui: { starWarnRadius: 460 }
};

const num = (v, path) => {
  if (typeof v !== 'number') throw new Error(`CFG.${path} must be a number`);
};

(() => {
  num(CFG.ship?.r, 'ship.r');
  num(CFG.ship?.invuln, 'ship.invuln');
  num(CFG.ship?.hullMax, 'ship.hullMax');
  num(CFG.ship?.accel, 'ship.accel');
  num(CFG.ship?.friction, 'ship.friction');
  num(CFG.ship?.maxSpeed, 'ship.maxSpeed');
  num(CFG.ship?.turn, 'ship.turn');
  num(CFG.economy?.startCredits, 'economy.startCredits');
  num(CFG.economy?.fuelStart, 'economy.fuelStart');
  num(CFG.economy?.ammoStart, 'economy.ammoStart');
  num(CFG.economy?.cargoMax, 'economy.cargoMax');
  num(CFG.economy?.repairPerHull, 'economy.repairPerHull');
  num(CFG.economy?.fuelUse, 'economy.fuelUse');
  num(CFG.economy?.supplyDecay, 'economy.supplyDecay');
  num(CFG.economy?.supplyShiftDeliver, 'economy.supplyShiftDeliver');
  num(CFG.economy?.supplyShiftBuy, 'economy.supplyShiftBuy');
  num(CFG.economy?.priceVariance, 'economy.priceVariance');
  num(CFG.bullets?.max, 'bullets.max');
  num(CFG.bullets?.speed, 'bullets.speed');
  num(CFG.bullets?.life, 'bullets.life');
  num(CFG.bullets?.cool, 'bullets.cool');
  num(CFG.contracts?.perPlanet, 'contracts.perPlanet');
  num(CFG.contracts?.minTime, 'contracts.minTime');
  num(CFG.contracts?.maxTime, 'contracts.maxTime');
  num(CFG.contracts?.illegalChance, 'contracts.illegalChance');
  num(CFG.pirateBase?.r, 'pirateBase.r');
  num(CFG.pirateBase?.hp, 'pirateBase.hp');
  num(CFG.pirateBase?.spawnEvery, 'pirateBase.spawnEvery');
  num(CFG.pirateBase?.fireEvery, 'pirateBase.fireEvery');
  num(CFG.pirateBase?.bounty, 'pirateBase.bounty');
  num(CFG.hunters?.fireEvery, 'hunters.fireEvery');
  num(CFG.hunters?.speed, 'hunters.speed');
  num(CFG.hunters?.chaseRadius, 'hunters.chaseRadius');
  num(CFG.hunters?.leashRadius, 'hunters.leashRadius');
  num(CFG.hunters?.patrolRadius, 'hunters.patrolRadius');
  num(CFG.pirates?.fireEvery, 'pirates.fireEvery');
  num(CFG.pirates?.bulletSpeed, 'pirates.bulletSpeed');
  num(CFG.pirates?.damage, 'pirates.damage');
  num(CFG.pirates?.spawnEvery, 'pirates.spawnEvery');
  num(CFG.pirates?.max, 'pirates.max');
  num(CFG.pirates?.speed, 'pirates.speed');
  num(CFG.pirates?.aggro, 'pirates.aggro');
  num(CFG.pirates?.chaseRadius, 'pirates.chaseRadius');
  num(CFG.pirates?.leashRadius, 'pirates.leashRadius');
  num(CFG.pirates?.patrolRadius, 'pirates.patrolRadius');
  num(CFG.pirates?.planetAvoidRadius, 'pirates.planetAvoidRadius');
  num(CFG.pirates?.planetAvoidAccel, 'pirates.planetAvoidAccel');
  num(CFG.pirates?.planetNoAttackRadius, 'pirates.planetNoAttackRadius');
  num(CFG.pirates?.standoffRange, 'pirates.standoffRange');
  num(CFG.pirates?.standoffAccel, 'pirates.standoffAccel');
  num(CFG.pirates?.orbitAccel, 'pirates.orbitAccel');
  num(CFG.pirates?.hp, 'pirates.hp');
  num(CFG.pirates?.boardRange, 'pirates.boardRange');
  num(CFG.pirates?.boardTime, 'pirates.boardTime');
  num(CFG.pirates?.repPenalty, 'pirates.repPenalty');
  num(CFG.asteroids?.spawnEvery, 'asteroids.spawnEvery');
  num(CFG.asteroids?.max, 'asteroids.max');
  num(CFG.asteroids?.elasticity, 'asteroids.elasticity');
  num(CFG.traders?.spawnEvery, 'traders.spawnEvery');
  num(CFG.traders?.max, 'traders.max');
  num(CFG.nebulae?.count, 'nebulae.count');
  num(CFG.nebulae?.slow, 'nebulae.slow');
  num(CFG.nebulae?.fuelDrain, 'nebulae.fuelDrain');
  num(CFG.rescue?.towBase, 'rescue.towBase');
  num(CFG.rescue?.towPer1000, 'rescue.towPer1000');
  num(CFG.rescue?.emergencyFuel, 'rescue.emergencyFuel');
  num(CFG.patrols?.scanRadius, 'patrols.scanRadius');
  num(CFG.patrols?.fine, 'patrols.fine');
  num(CFG.contraband?.repPenalty, 'contraband.repPenalty');
  num(CFG.planets, 'planets');
  num(CFG.blackholes, 'blackholes');
  num(CFG.stars, 'stars');
  num(CFG.supernova?.warnWindow, 'supernova.warnWindow');
  num(CFG.ui?.starWarnRadius, 'ui.starWarnRadius');
})();

// Centralized gravity tuning
export const GRAVITY = {
  planetPull: 0.0004,      // scaled by radius squared; gentle local pull
  planetFalloff: 160000,
  planetInfluence: 720,    // px beyond planet radius
  planetMaxAccel: 0.0175,
  starPull: 0.000225,      // scaled by radius squared; wider route-bending pull
  starFalloff: 700000,
  starInfluence: 1600,
  starMaxAccel: 0.0275,
  blackholePull: 0.006,    // scaled by radius squared; strongest local hazard
  blackholeFalloff: 80000,
  blackholeInfluence: 1900,
  blackholeMaxAccel: 0.045,
  shipScale: 1,
  entityScale: 0.85,
  asteroidScale: 1.1,
  bulletScale: 0.35,
  debugVectorScale: 1800,
  innerDamage: 0.3,        // hull damage per tick-equivalent near center
  // Solar flares
  flareSpeed: 4.0,         // px/tick (~240 px/s)
  flareThickness: 8,       // thinner hit window for less distraction
  flareDamage: 6,          // damage when wave hits
  flareMaxRange: 900,      // max outward distance from star before flare dissipates
  radarJamSeconds: 90      // shorter jam duration (~1.5s at 60 fps)
};

(() => {
  num(GRAVITY.planetPull, 'GRAVITY.planetPull');
  num(GRAVITY.planetFalloff, 'GRAVITY.planetFalloff');
  num(GRAVITY.planetInfluence, 'GRAVITY.planetInfluence');
  num(GRAVITY.planetMaxAccel, 'GRAVITY.planetMaxAccel');
  num(GRAVITY.starPull, 'GRAVITY.starPull');
  num(GRAVITY.starFalloff, 'GRAVITY.starFalloff');
  num(GRAVITY.starInfluence, 'GRAVITY.starInfluence');
  num(GRAVITY.starMaxAccel, 'GRAVITY.starMaxAccel');
  num(GRAVITY.blackholePull, 'GRAVITY.blackholePull');
  num(GRAVITY.blackholeFalloff, 'GRAVITY.blackholeFalloff');
  num(GRAVITY.blackholeInfluence, 'GRAVITY.blackholeInfluence');
  num(GRAVITY.blackholeMaxAccel, 'GRAVITY.blackholeMaxAccel');
  num(GRAVITY.shipScale, 'GRAVITY.shipScale');
  num(GRAVITY.entityScale, 'GRAVITY.entityScale');
  num(GRAVITY.asteroidScale, 'GRAVITY.asteroidScale');
  num(GRAVITY.bulletScale, 'GRAVITY.bulletScale');
  num(GRAVITY.debugVectorScale, 'GRAVITY.debugVectorScale');
})();

// Minimum spacing (extra padding, in px) between entity kinds during spawning
// Applied in world/gen to reduce overlaps beyond radius sums.
export const SPACING = {
  default: 6,
  star: { star: 40, planet: 120, blackhole: 60, base: 24 },
  planet: { planet: 18, blackhole: 50, base: 16, star: 120 },
  blackhole: { blackhole: 60, star: 40, planet: 30, base: 20 },
  base: { star: 16, planet: 12, blackhole: 20, base: 24 }
};
