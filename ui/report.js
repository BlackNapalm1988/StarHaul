const REPORT_CACHE_KEY = 'starhaul:playtestReports';

function reportContext(state, running) {
  const ship = state?.ship || {};
  return {
    url: typeof location !== 'undefined' ? location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    running: !!running,
    timestamp: new Date().toISOString(),
    game: state ? {
      seed: state.seed ?? null,
      credits: Math.floor(state.credits || 0),
      reputation: state.reputation || 0,
      fuel: Math.floor(state.fuel || 0),
      ammo: Math.floor(state.ammo || 0),
      cargo: `${state.cargo || 0}/${state.cargoMax || 0}`,
      docked: state.docked?.name || null,
      gameOver: !!state.gameOver,
      gameOverCause: state.gameOverCause || null,
      ship: {
        x: Math.round(ship.x || 0),
        y: Math.round(ship.y || 0),
        hull: Math.ceil(ship.hull || 0),
        hullMax: ship.hullMax || 0
      }
    } : null
  };
}

function loadCachedReports() {
  try {
    return JSON.parse(localStorage.getItem(REPORT_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
}

function cacheReport(report) {
  try {
    const reports = loadCachedReports();
    reports.push(report);
    localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(reports.slice(-50)));
  } catch {}
}

async function submitReport(report) {
  if (typeof fetch !== 'function') return { saved: false };
  try {
    const res = await fetch('/playtest-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    if (!res.ok) return { saved: false };
    return await res.json();
  } catch {
    return { saved: false };
  }
}

export function initPlaytestReporter(options = {}) {
  const root = document.getElementById('reportPanel');
  if (!root) return null;

  const typeEl = document.getElementById('reportType');
  const commentEl = document.getElementById('reportComment');
  const submitBtn = document.getElementById('reportSubmitBtn');
  const closeBtn = document.getElementById('reportCloseBtn');
  const statusEl = document.getElementById('reportStatus');

  const setStatus = text => {
    if (statusEl) statusEl.textContent = text || '';
  };

  const open = () => {
    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-reporting');
    setStatus('');
    requestAnimationFrame(() => commentEl?.focus());
  };

  const close = () => {
    root.classList.add('hidden');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-reporting');
    setStatus('');
  };

  const toggle = () => {
    if (root.classList.contains('hidden')) open();
    else close();
  };

  window.addEventListener('keydown', e => {
    if (e.code !== 'Backquote') return;
    if (!(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }, true);

  closeBtn?.addEventListener('click', close);
  root.addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      e.preventDefault();
      close();
    }
    e.stopPropagation();
  });
  root.addEventListener('keyup', e => {
    e.stopPropagation();
  });
  root.addEventListener('keypress', e => {
    e.stopPropagation();
  });

  submitBtn?.addEventListener('click', async () => {
    const comment = (commentEl?.value || '').trim();
    if (!comment) {
      setStatus('Add a comment before submitting.');
      commentEl?.focus();
      return;
    }
    const report = {
      id: `SH-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      type: typeEl?.value === 'Feature Request' ? 'Feature Request' : 'Bug',
      comment,
      context: reportContext(options.getState?.(), options.isRunning?.())
    };

    submitBtn.disabled = true;
    setStatus('Submitting...');
    const result = await submitReport(report);
    submitBtn.disabled = false;

    if (result.saved) {
      if (commentEl) commentEl.value = '';
      setStatus(`Saved to ${result.path || 'reports/playtest-reports.jsonl'}.`);
      options.onSaved?.(report);
      return;
    }

    cacheReport(report);
    setStatus('Saved in this browser. Run npm start to append reports to the project folder.');
    options.onCached?.(report);
  });

  return { open, close, toggle };
}
