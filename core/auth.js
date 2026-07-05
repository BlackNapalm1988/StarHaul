const TOKEN_KEY = 'starhaul:token';
const USER_KEY  = 'starhaul:username';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}

export function getUsername() {
  try { return localStorage.getItem(USER_KEY) || null; } catch { return null; }
}

export function setAuth(token, username) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
  } catch {}
}

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

export function isLoggedIn() {
  return !!getToken();
}
