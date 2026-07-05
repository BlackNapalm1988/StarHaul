import { getSave, upsertSave } from './_shared/db.js';
import { verifyJWT, bearerToken } from './_shared/jwt.js';

const MAX_SAVE_BYTES = 64 * 1024; // 64 KB ceiling

export async function onRequestGet({ request, env }) {
  const payload = await auth(request, env);
  if (!payload) return err(401, 'Unauthorized');

  const row = await getSave(env.DB, payload.sub);
  if (!row) return json(null);
  return json({ data: JSON.parse(row.data), updatedAt: row.updated_at });
}

export async function onRequestPost({ request, env }) {
  const payload = await auth(request, env);
  if (!payload) return err(401, 'Unauthorized');

  let body;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }

  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_SAVE_BYTES) return err(413, 'Save data too large');

  await upsertSave(env.DB, payload.sub, serialized);
  return new Response(null, { status: 204 });
}

async function auth(request, env) {
  return verifyJWT(bearerToken(request), env.JWT_SECRET);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function err(status, message) {
  return json({ error: message }, status);
}
