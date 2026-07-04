CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  pw_hash    TEXT NOT NULL,
  pw_salt    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saves (
  user_id    TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS leaderboard (
  user_id            TEXT PRIMARY KEY,
  username           TEXT NOT NULL,
  net_worth          INTEGER NOT NULL DEFAULT 0,
  missions_completed INTEGER NOT NULL DEFAULT 0,
  reputation         INTEGER NOT NULL DEFAULT 0,
  ticks_survived     INTEGER NOT NULL DEFAULT 0,
  recorded_at        INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_lb_net_worth ON leaderboard(net_worth DESC);
CREATE INDEX IF NOT EXISTS idx_lb_ticks     ON leaderboard(ticks_survived DESC);
CREATE INDEX IF NOT EXISTS idx_lb_missions  ON leaderboard(missions_completed DESC);
CREATE INDEX IF NOT EXISTS idx_lb_rep       ON leaderboard(reputation DESC);
