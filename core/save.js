const SAVE_KEY = 'starhaul-save';

export function saveGame(state) {
  if (!state) return;
  const data = {
    seed: state.seed,
    credits: state.credits,
    fuel: state.fuel,
    ammo: state.ammo,
    cargo: state.cargo,
    ship: {
      x: state.ship?.x,
      y: state.ship?.y,
      hull: state.ship?.hull,
      hullMax: state.ship?.hullMax,
      lives: state.ship?.lives,
      anchored: !!state.ship?.anchored
    },
    dockedId: typeof state.docked?.id === 'number' ? state.docked.id : null,
    homeId: typeof state.home?.id === 'number' ? state.home.id : null,
    upgrades: {
      engine: state.ship?.engine,
      hold: state.ship?.hold,
      shield: state.ship?.shield,
      gun: state.ship?.gun,
      radar: state.ship?.radar
    },
    reputation: state.reputation || 0,
    discovered: state.discovered || [],
    missions: state.missions || []
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save game', err);
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Backward compatibility for saves without new fields
    if (!data.missions) data.missions = [];
    if (!data.ship) data.ship = {};
    if (!('dockedId' in data)) data.dockedId = null;
    if (!('homeId' in data)) data.homeId = null;
    if (typeof data.fuel !== 'number') data.fuel = undefined;
    if (typeof data.ammo !== 'number') data.ammo = undefined;
    if (typeof data.cargo !== 'number') data.cargo = undefined;
    return data;
  } catch (err) {
    console.warn('Failed to load game', err);
    return null;
  }
}
