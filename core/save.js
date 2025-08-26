const SAVE_KEY = 'starhaul-save';

export function saveGame(state) {
  if (!state) return;
  const data = {
    seed: state.seed,
    credits: state.credits,
    upgrades: {
      engine: state.ship?.engine,
      hold: state.ship?.hold,
      shield: state.ship?.shield,
      gun: state.ship?.gun,
      radar: state.ship?.radar
    },
    reputation: state.reputation || 0,
    discovered: state.discovered || []
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
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load game', err);
    return null;
  }
}
