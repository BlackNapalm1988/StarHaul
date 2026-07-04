export async function getUserByUsername(db, username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
}

export async function createUser(db, id, username, pwHash, pwSalt) {
  await db.prepare(
    'INSERT INTO users (id, username, pw_hash, pw_salt, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, username, pwHash, pwSalt, Date.now()).run();
}

export async function getSave(db, userId) {
  return db.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').bind(userId).first();
}

export async function upsertSave(db, userId, data) {
  await db.prepare(`
    INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).bind(userId, data, Date.now()).run();
}

export async function upsertLeaderboard(db, userId, username, scores) {
  const { netWorth, missionsCompleted, reputation, ticksSurvived } = scores;
  await db.prepare(`
    INSERT INTO leaderboard (user_id, username, net_worth, missions_completed, reputation, ticks_survived, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username           = excluded.username,
      net_worth          = MAX(excluded.net_worth, net_worth),
      missions_completed = MAX(excluded.missions_completed, missions_completed),
      reputation         = MAX(excluded.reputation, reputation),
      ticks_survived     = MAX(excluded.ticks_survived, ticks_survived),
      recorded_at        = excluded.recorded_at
  `).bind(userId, username, netWorth, missionsCompleted, reputation, ticksSurvived, Date.now()).run();
}

export async function getLeaderboard(db, limit = 25) {
  const q = (orderCol) =>
    db.prepare(`SELECT username, net_worth, missions_completed, reputation, ticks_survived FROM leaderboard ORDER BY ${orderCol} DESC LIMIT ?`).bind(limit).all();
  const [nw, ti, mi, re] = await Promise.all([q('net_worth'), q('ticks_survived'), q('missions_completed'), q('reputation')]);
  return {
    byNetWorth:  nw.results,
    byTicks:     ti.results,
    byMissions:  mi.results,
    byReputation: re.results
  };
}
