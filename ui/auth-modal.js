import { setAuth, clearAuth, isLoggedIn, getUsername } from '../core/auth.js';

let container = null;

function emit(token, username) {
  window.dispatchEvent(new CustomEvent('starhaul:auth', { detail: { token, username } }));
}

function emitLogout() {
  window.dispatchEvent(new CustomEvent('starhaul:auth', { detail: null }));
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function render(mode = 'login', error = '') {
  if (!container) return;
  const isLogin = mode === 'login';
  container.innerHTML = `
    <div class="overlay terminal-subscreen" id="authModalOverlay">
      <div class="terminal-panel">
        <div class="terminal-titlebar">
          <span>SHIPLINK IDENTITY</span>
          <span>${isLogin ? 'PILOT LOGIN' : 'REGISTER PILOT'}</span>
        </div>
        <h1>${isLogin ? 'LOGIN' : 'REGISTER'}</h1>
        ${error ? `<div class="muted" style="color:#f88;margin-bottom:8px">${escapeHtml(error)}</div>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
          <label class="terminal-label" for="authUsername">PILOT NAME</label>
          <input id="authUsername" class="terminal-input" placeholder="3-20 chars, letters/numbers/_" maxlength="20" autocomplete="username" />
          <label class="terminal-label" for="authPassword">ACCESS CODE</label>
          <input id="authPassword" class="terminal-input" type="password" placeholder="8+ characters" maxlength="72" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
        </div>
        <div class="actions terminal-actions">
          <button class="btn" id="authSubmitBtn">${isLogin ? 'Login' : 'Register'}</button>
          <button class="btn" id="authToggleBtn">${isLogin ? 'New pilot? Register' : 'Have an account? Login'}</button>
          <button class="btn" id="authCancelBtn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  const overlay = container.querySelector('#authModalOverlay');
  const usernameInput = container.querySelector('#authUsername');
  const passwordInput = container.querySelector('#authPassword');
  const submitBtn = container.querySelector('#authSubmitBtn');

  usernameInput.focus();

  submitBtn.addEventListener('click', () => submit(isLogin, usernameInput.value, passwordInput.value));
  container.querySelector('#authToggleBtn').addEventListener('click', () => render(isLogin ? 'register' : 'login'));
  container.querySelector('#authCancelBtn').addEventListener('click', hide);

  async function submit(login, username, password) {
    submitBtn.disabled = true;
    submitBtn.textContent = login ? 'Logging in...' : 'Registering...';
    try {
      const url = login ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const body = await res.json();
      if (!res.ok) {
        render(login ? 'login' : 'register', body.error || 'Server error');
        return;
      }
      setAuth(body.token, body.username);
      emit(body.token, body.username);
      hide();
    } catch {
      render(login ? 'login' : 'register', 'Connection error — try again');
    }
  }
}

export function showAuthModal(mode = 'login') {
  container = document.getElementById('authModal');
  if (!container) return;
  render(mode);
}

export function hide() {
  if (container) container.innerHTML = '';
}

export function initAuthHUD(hudEl) {
  if (!hudEl) return;
  function refresh() {
    let pill = hudEl.querySelector('#authHudPill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'authHudPill';
      pill.className = 'pill stat';
      hudEl.appendChild(pill);
    }
    if (isLoggedIn()) {
      const name = getUsername() || '?';
      pill.innerHTML = `<span style="color:#8df">@${escapeHtml(name)}</span> <button class="btn" id="logoutBtn" style="font-size:10px;padding:2px 6px">Logout</button>`;
      pill.querySelector('#logoutBtn').addEventListener('click', () => {
        clearAuth();
        emitLogout();
        refresh();
      });
    } else {
      pill.innerHTML = `<button class="btn" id="loginBtn" style="font-size:10px;padding:2px 6px">Login / Register</button>`;
      pill.querySelector('#loginBtn').addEventListener('click', () => showAuthModal('login'));
    }
  }
  window.addEventListener('starhaul:auth', refresh);
  refresh();
}
