const AUDIO_RE = /\.(mp3|ogg|oga|wav|m4a|aac|flac|webm)$/i;

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function baseDocumentUrl(){
  if(typeof document !== 'undefined' && document.baseURI) return document.baseURI;
  if(typeof location !== 'undefined' && location.href) return location.href;
  return 'http://localhost/';
}

function resolveUrl(value, base = 'assets/music/'){
  try {
    return new URL(value, new URL(base, baseDocumentUrl())).toString();
  } catch {
    return value;
  }
}

function titleFromFile(file){
  const clean = decodeURIComponent(String(file || '').split(/[/?#]/)[0].split('/').pop() || 'Untitled Signal');
  return clean.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled Signal';
}

function tagsFrom(value){
  if(Array.isArray(value)) return value.map(v => String(v).toLowerCase().trim()).filter(Boolean);
  if(typeof value === 'string') return value.split(/[,\s]+/).map(v => v.toLowerCase().trim()).filter(Boolean);
  return [];
}

function normalizeTrack(entry, base = 'assets/music/'){
  if(typeof entry === 'string') {
    return {
      title: titleFromFile(entry),
      src: resolveUrl(entry, base),
      moods: [],
      locations: []
    };
  }
  const file = entry.file || entry.src || entry.url || '';
  return {
    title: entry.title || titleFromFile(file),
    src: resolveUrl(file, base),
    moods: tagsFrom(entry.moods || entry.mood || entry.tags),
    locations: tagsFrom(entry.locations || entry.location || entry.regions || entry.region)
  };
}

async function fetchJson(url){
  if(typeof fetch !== 'function') return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchDirectoryTracks(directoryUrl){
  if(typeof fetch !== 'function' || typeof DOMParser === 'undefined') return [];
  try {
    const res = await fetch(directoryUrl, { cache: 'no-store' });
    if(!res.ok) return [];
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('a'))
      .map(a => a.getAttribute('href') || '')
      .filter(href => AUDIO_RE.test(href))
      .map(href => normalizeTrack(href, directoryUrl));
  } catch {
    return [];
  }
}

export async function discoverMusicTracks(options = {}){
  const directoryUrl = options.directoryUrl || 'assets/music/';
  const manifestUrl = options.manifestUrl || 'assets/music/manifest.json';
  const manifest = await fetchJson(manifestUrl);
  const manifestBase = manifest?.base || directoryUrl;
  const manifestTracks = Array.isArray(manifest)
    ? manifest
    : Array.isArray(manifest?.tracks)
      ? manifest.tracks
      : [];
  const fromManifest = manifestTracks
    .map(track => normalizeTrack(track, manifestBase))
    .filter(track => track.src && AUDIO_RE.test(track.src));
  const fromDirectory = await fetchDirectoryTracks(directoryUrl);
  const seen = new Set();
  return [...fromManifest, ...fromDirectory].filter(track => {
    if(seen.has(track.src)) return false;
    seen.add(track.src);
    return true;
  });
}

function distance(a, b){
  if(!a || !b) return Infinity;
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}

function nearestWithin(items, ship, padding){
  let best = null;
  let bestD = Infinity;
  for(const item of items || []){
    const d = distance(ship, item) - (item.r || 0);
    if(d <= padding && d < bestD){
      best = item;
      bestD = d;
    }
  }
  return best;
}

export function getMusicContext(state){
  if(!state || !state.ship) return { mood: 'standby', location: 'unknown', label: 'STANDBY' };
  const ship = state.ship;
  if(state.gameOver) return { mood: 'danger', location: 'distress', label: 'DISTRESS' };
  if(state.docked){
    const type = String(state.docked.type || 'dock').toLowerCase();
    return { mood: 'dock', location: type, region: 'dock', label: `DOCK / ${String(state.docked.name || type).toUpperCase()}` };
  }

  const hullPct = ship.hullMax ? ship.hull / ship.hullMax : 1;
  const pirate = nearestWithin(state.pirates, ship, 680);
  const enemyShot = (state.bullets || []).some(b => b && b.friendly === false && distance(ship, b) < 620);
  if(pirate || enemyShot) return { mood: 'combat', location: 'pirate', label: 'COMBAT' };
  if(hullPct <= 0.34) return { mood: 'danger', location: 'hull', label: 'HULL WARNING' };

  const blackhole = nearestWithin(state.blackholes, ship, 1100);
  if(blackhole) return { mood: 'hazard', location: 'blackhole', label: 'BLACK HOLE' };
  const star = nearestWithin(state.stars, ship, 900);
  if(star) return { mood: 'hazard', location: 'star', label: 'STAR HEAT' };
  const nebula = nearestWithin(state.nebulae, ship, 260);
  if(nebula) return { mood: 'drift', location: 'nebula', label: 'NEBULA' };
  const planet = nearestWithin(state.planets, ship, 620);
  if(planet){
    const type = String(planet.type || 'planet').toLowerCase();
    return { mood: 'orbit', location: type, region: 'planet', label: `ORBIT / ${type.toUpperCase()}` };
  }
  return { mood: 'cruise', location: 'deep_space', label: 'DEEP SPACE' };
}

export function scoreTrackForContext(track, context){
  const moods = tagsFrom(track?.moods);
  const locations = tagsFrom(track?.locations);
  let score = 1;
  if(!moods.length && !locations.length) score += 2;
  if(moods.includes(context.mood)) score += 8;
  if(context.mood === 'hazard' && moods.includes('danger')) score += 3;
  if(context.mood === 'drift' && moods.includes('ambient')) score += 2;
  if(context.mood === 'cruise' && moods.includes('ambient')) score += 2;
  if(locations.includes(context.location)) score += 5;
  if(context.region && locations.includes(context.region)) score += 3;
  return score;
}

export function pickNextTrack(tracks, context, currentIndex = -1, shuffle = true){
  if(!tracks?.length) return -1;
  if(tracks.length === 1) return 0;
  if(!shuffle) return (currentIndex + 1 + tracks.length) % tracks.length;
  const scored = tracks
    .map((track, index) => ({ index, score: scoreTrackForContext(track, context) }))
    .filter(item => item.index !== currentIndex);
  const best = Math.max(...scored.map(item => item.score));
  const candidates = scored.filter(item => item.score >= best - 2);
  const total = candidates.reduce((sum, item) => sum + Math.max(1, item.score), 0);
  let roll = Math.random() * total;
  for(const item of candidates){
    roll -= Math.max(1, item.score);
    if(roll <= 0) return item.index;
  }
  return candidates[0]?.index ?? 0;
}

export function initMusicPlayer(options = {}){
  if(typeof document === 'undefined') return null;
  const root = document.getElementById('musicPlayer');
  if(!root) return null;
  const titleTrack = document.getElementById('musicTitleTrack');
  const moodEl = document.getElementById('musicMood');
  const statusEl = document.getElementById('musicStatus');
  const playBtn = document.getElementById('musicPlayBtn');
  const nextBtn = document.getElementById('musicNextBtn');
  const shuffleBtn = document.getElementById('musicShuffleBtn');
  const audio = typeof Audio !== 'undefined' ? new Audio() : null;
  let tracks = [];
  let currentIndex = -1;
  let shuffle = true;
  let active = false;
  let started = false;
  let lastContextKey = '';
  let lastUpdateAt = 0;
  let lastSwitchAt = 0;

  if(audio){
    audio.preload = 'metadata';
    audio.volume = 0.65;
  }

  const setStatus = text => {
    if(statusEl) statusEl.textContent = text;
  };

  const setTitle = text => {
    const safe = escapeHtml(text || 'NO SIGNAL');
    if(titleTrack) titleTrack.innerHTML = `<span>${safe}</span><span>${safe}</span>`;
  };

  const setControlsReady = ready => {
    if(playBtn) playBtn.disabled = !ready;
    if(nextBtn) nextBtn.disabled = !ready;
  };

  const currentContext = () => getMusicContext(options.getState ? options.getState() : null);

  const updateButtons = () => {
    const isPlaying = audio && !audio.paused;
    if(playBtn) playBtn.textContent = isPlaying ? 'PAUSE' : 'PLAY';
    if(shuffleBtn){
      shuffleBtn.setAttribute('aria-pressed', shuffle ? 'true' : 'false');
      shuffleBtn.classList.toggle('is-on', shuffle);
    }
  };

  const loadTrack = index => {
    if(!audio || index < 0 || !tracks[index]) return;
    currentIndex = index;
    const track = tracks[currentIndex];
    audio.src = track.src;
    audio.load();
    setTitle(track.title);
    setStatus('CUED');
  };

  const startAudio = async () => {
    if(!audio || currentIndex < 0) return;
    try {
      await audio.play();
      started = true;
      setStatus('ON AIR');
      lastSwitchAt = performance.now();
    } catch {
      setStatus('PRESS PLAY');
    }
    updateButtons();
  };

  const playTrack = async index => {
    loadTrack(index);
    await startAudio();
  };

  const playNext = async () => {
    if(!tracks.length){
      setTitle('NO MUSIC IN /music');
      setStatus('NO FILES');
      return;
    }
    const next = pickNextTrack(tracks, currentContext(), currentIndex, shuffle);
    await playTrack(next);
  };

  const refreshMood = force => {
    const now = performance.now();
    if(!force && now - lastUpdateAt < 1000) return;
    lastUpdateAt = now;
    const context = currentContext();
    const key = `${context.mood}/${context.location}/${context.region || ''}`;
    if(moodEl) moodEl.textContent = context.label;
    if(started && key !== lastContextKey && tracks.length > 1 && currentIndex >= 0 && now - lastSwitchAt > 28000){
      const currentScore = scoreTrackForContext(tracks[currentIndex], context);
      let bestIndex = currentIndex;
      let bestScore = currentScore;
      tracks.forEach((track, index) => {
        if(index === currentIndex) return;
        const score = scoreTrackForContext(track, context);
        if(score > bestScore){
          bestScore = score;
          bestIndex = index;
        }
      });
      if(bestIndex !== currentIndex && bestScore - currentScore >= 4) playTrack(bestIndex);
    }
    lastContextKey = key;
  };

  playBtn?.addEventListener('click', async () => {
    if(!audio) return;
    if(!tracks.length){
      setTitle('NO MUSIC IN /music');
      setStatus('NO FILES');
      return;
    }
    if(currentIndex < 0){
      await playNext();
      return;
    }
    if(audio.paused) await startAudio();
    else {
      audio.pause();
      setStatus('PAUSED');
      updateButtons();
    }
  });

  nextBtn?.addEventListener('click', playNext);

  shuffleBtn?.addEventListener('click', () => {
    shuffle = !shuffle;
    setStatus(shuffle ? 'SHUFFLE' : 'SEQUENCE');
    updateButtons();
  });

  audio?.addEventListener('ended', playNext);
  audio?.addEventListener('error', () => {
    setStatus('BAD FILE');
    updateButtons();
  });

  setTitle('SCANNING /music');
  setStatus('SCAN');
  setControlsReady(false);
  updateButtons();
  discoverMusicTracks(options).then(found => {
    tracks = found;
    if(!tracks.length){
      setTitle('NO MUSIC IN /music');
      setStatus('NO FILES');
      setControlsReady(false);
      return;
    }
    setTitle(`${tracks.length} TRACK${tracks.length === 1 ? '' : 'S'} READY`);
    setStatus('READY');
    setControlsReady(true);
    loadTrack(pickNextTrack(tracks, currentContext(), -1, shuffle));
  });

  return {
    setActive(on){
      const next = !!on;
      if(active === next){
        if(active) refreshMood(true);
        return;
      }
      active = next;
      root.classList.toggle('hidden', !active);
      if(!active && audio && !audio.paused){
        audio.pause();
        setStatus('PAUSED');
        updateButtons();
      }
      refreshMood(true);
    },
    update(state){
      if(!active) return;
      if(options.getState || state) refreshMood(false);
    },
    playNext
  };
}
