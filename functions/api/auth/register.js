import { getUserByUsername, createUser } from '../_shared/db.js';
import { randomSalt, hashPassword } from '../_shared/password.js';
import { signJWT } from '../_shared/jwt.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }

  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!USERNAME_RE.test(username)) return err(400, 'Username must be 3-20 alphanumeric characters or underscores');
  if (password.length < 8 || password.length > 72) return err(400, 'Password must be 8-72 characters');

  const existing = await getUserByUsername(env.DB, username);
  if (existing) return err(409, 'Username already taken');

  const id = crypto.randomUUID();
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  await createUser(env.DB, id, username, hash, salt);

  const token = await signJWT({ sub: id, username, exp: Math.floor(Date.now() / 1000) + 7 * 86400 }, env.JWT_SECRET);
  return json({ token, username });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function err(status, message) {
  return json({ error: message }, status);
}
