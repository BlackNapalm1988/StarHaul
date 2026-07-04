const SAVE_KEY = 'starhaul-save';
const SAVE_TS_KEY = 'starhaul:save-ts';

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
    missions: state.missions || [],
    ticks: state.ticks || 0,
    planetSupply: state.planets ? state.planets.map(p => ({ id: p.id, supply: p.supply || {} })) : []
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    localStorage.setItem(SAVE_TS_KEY, String(Date.now()));
  } catch (err) {
    console.warn('Failed to save game', err);
  }
}

export async function cloudSave(saveData) {
  const { getToken } = await import('./auth.js');
  const token = getToken();
  if (!token) return;
  try {
    await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(saveData)
    });
  } catch {}
}

export async function cloudLoad() {
  const { getToken } = await import('./auth.js');
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/save', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const envelope = await res.json();
    if (!envelope || !envelope.data) return null;
    const data = envelope.data;
    const cloudTs = envelope.updatedAt || 0;
    let localTs = 0;
    try { localTs = parseInt(localStorage.getItem(SAVE_TS_KEY) || '0', 10); } catch {}
    if (cloudTs >= localTs) {
      // Cloud is equal or newer: store locally so offline play reflects it
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        localStorage.setItem(SAVE_TS_KEY, String(cloudTs));
      } catch {}
      return data;
    }
    // Local is newer (offline play since last sync): push local up, return local
    const localRaw = localStorage.getItem(SAVE_KEY);
    if (localRaw) {
      const localData = JSON.parse(localRaw);
      cloudSave(localData).catch(() => {});
    }
    return null;
  } catch {
    return null;
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
    if (typeof data.ticks !== 'number') data.ticks = 0;
    if (!Array.isArray(data.planetSupply)) data.planetSupply = [];
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
