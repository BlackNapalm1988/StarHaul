import { getLeaderboard, upsertLeaderboard } from './_shared/db.js';
import { verifyJWT, bearerToken } from './_shared/jwt.js';

export async function onRequestGet({ env }) {
  const board = await getLeaderboard(env.DB, 25);
  return json(board);
}

export async function onRequestPost({ request, env }) {
  const payload = await verifyJWT(bearerToken(request), env.JWT_SECRET);
  if (!payload) return err(401, 'Unauthorized');

  let body;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }

  const scores = {
    netWorth:          clamp(body.netWorth, 0, 1e9),
    missionsCompleted: clamp(body.missionsCompleted, 0, 1e6),
    reputation:        clamp(body.reputation, 0, 1e6),
    ticksSurvived:     clamp(body.ticksSurvived, 0, 1e10)
  };

  await upsertLeaderboard(env.DB, payload.sub, payload.username, scores);
  return new Response(null, { status: 201 });
}

function clamp(v, min, max) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : min;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function err(status, message) {
  return json({ error: message }, status);
}
