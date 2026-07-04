import { getUserByUsername } from '../_shared/db.js';
import { verifyPassword } from '../_shared/password.js';
import { signJWT } from '../_shared/jwt.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }

  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  const user = await getUserByUsername(env.DB, username);
  if (!user) return err(401, 'Invalid username or password');

  const ok = await verifyPassword(password, user.pw_salt, user.pw_hash);
  if (!ok) return err(401, 'Invalid username or password');

  const token = await signJWT({ sub: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 7 * 86400 }, env.JWT_SECRET);
  return json({ token, username: user.username });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function err(status, message) {
  return json({ error: message }, status);
}
