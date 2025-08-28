export const WORLD = { w: 4000, h: 4000 };

export const CFG = {
  ship: { r: 16, invuln: 120, hullMax: 100 },
  economy: { startCredits: 500, fuelStart: 100, ammoStart: 50, cargoMax: 50 },
  contracts: { perPlanet: 3, maxTime: 600 },
  pirateBase: { r: 80, hp: 50, spawnEvery: 600, fireEvery: 120 },
  hunters: { fireEvery: 90 },
  planets: 8,
  blackholes: 2,
  stars: 200
};

const num = (v, path) => {
  if (typeof v !== 'number') throw new Error(`CFG.${path} must be a number`);
};

(() => {
  num(CFG.ship?.r, 'ship.r');
  num(CFG.ship?.invuln, 'ship.invuln');
  num(CFG.ship?.hullMax, 'ship.hullMax');
  num(CFG.economy?.startCredits, 'economy.startCredits');
  num(CFG.economy?.fuelStart, 'economy.fuelStart');
  num(CFG.economy?.ammoStart, 'economy.ammoStart');
  num(CFG.economy?.cargoMax, 'economy.cargoMax');
  num(CFG.contracts?.perPlanet, 'contracts.perPlanet');
  num(CFG.contracts?.maxTime, 'contracts.maxTime');
  num(CFG.pirateBase?.r, 'pirateBase.r');
  num(CFG.pirateBase?.hp, 'pirateBase.hp');
  num(CFG.pirateBase?.spawnEvery, 'pirateBase.spawnEvery');
  num(CFG.pirateBase?.fireEvery, 'pirateBase.fireEvery');
  num(CFG.hunters?.fireEvery, 'hunters.fireEvery');
  num(CFG.planets, 'planets');
  num(CFG.blackholes, 'blackholes');
  num(CFG.stars, 'stars');
})();
