// UI orchestration: wires DOM controls to AUTH + SpotifyPlayer, and renders playback state.
(() => {
  const loginScreen = document.getElementById('login-screen');
  const loginErrorEl = document.getElementById('login-error');
  const app = document.getElementById('app');

  const clientIdSetup = document.getElementById('client-id-setup');
  const clientIdReady = document.getElementById('client-id-ready');
  const clientIdForm = document.getElementById('client-id-form');
  const clientIdInput = document.getElementById('client-id-input');
  const redirectUriDisplay = document.getElementById('redirect-uri-display');
  const clientIdSuffix = document.getElementById('client-id-suffix');
  const changeClientIdLink = document.getElementById('change-client-id');

  const marqueeText = document.getElementById('marquee-text');
  const timeInline = document.getElementById('time-inline');
  const metaQuality = document.getElementById('meta-quality');
  const vizBars = Array.from(document.getElementById('viz-bars').children);
  const bgVizCanvas = document.getElementById('bg-viz-canvas');

  const seekBar = document.getElementById('seek-bar');
  const volumeBar = document.getElementById('volume-bar');

  const btnPrev = document.getElementById('btn-prev');
  const btnPlay = document.getElementById('btn-play');
  const btnPause = document.getElementById('btn-pause');
  const btnStop = document.getElementById('btn-stop');
  const btnNext = document.getElementById('btn-next');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnRepeat = document.getElementById('btn-repeat');
  const btnLogout = document.getElementById('btn-logout');

  const playlistWin = document.getElementById('playlist-win');
  const btnPlToggle = document.getElementById('btn-pl-toggle');
  const btnPlClose = document.getElementById('btn-pl-close');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const resultsList = document.getElementById('results-list');
  const plStatus = document.getElementById('pl-status');

  const lyricsOverlay = document.getElementById('lyrics-overlay');
  const lyricsLineEl = document.getElementById('lyrics-line');
  const btnLyricsToggle = document.getElementById('btn-lyrics-toggle');

  let latestState = null;
  let isSeeking = false;
  let repeatMode = 0; // 0 off, 1 context, 2 track
  let currentPlayingUri = null;
  let vizTimer = null;
  let tickTimer = null;
  let lastLyricsUri = null;
  let lyricsToken = 0;
  let lyricsLines = [];
  let lyricsLineIdx = 0;
  let lyricsCycleTimer = null;
  const lyricsCache = new Map(); // track uri -> array of lyric lines

  function fmtTime(ms) {
    if (!ms || ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function makeDraggable(winEl, handleEl) {
    let dragging = false, startX, startY, origX, origY;
    handleEl.addEventListener('mousedown', e => {
      if (e.target.closest('.tb-btn')) return;
      dragging = true;
      const rect = winEl.getBoundingClientRect();
      winEl.style.position = 'fixed';
      winEl.style.left = rect.left + 'px';
      winEl.style.top = rect.top + 'px';
      winEl.style.margin = '0';
      origX = rect.left; origY = rect.top;
      startX = e.clientX; startY = e.clientY;
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      winEl.style.left = (origX + (e.clientX - startX)) + 'px';
      winEl.style.top = (origY + (e.clientY - startY)) + 'px';
    });
    window.addEventListener('mouseup', () => dragging = false);
  }

  function startViz() {
    if (vizTimer) return;
    vizTimer = setInterval(() => {
      const playing = latestState && !latestState.paused;
      vizBars.forEach(bar => {
        const target = playing ? 4 + Math.random() * 36 : 4;
        bar.style.height = target + 'px';
      });
    }, 140);
  }

  function showLyricsLine(text) {
    lyricsLineEl.classList.remove('show');
    void lyricsLineEl.offsetWidth; // force reflow so the fade transition restarts
    lyricsLineEl.textContent = text || '';
    if (text) lyricsLineEl.classList.add('show');
  }

  function stopLyricsCycle() {
    if (lyricsCycleTimer) {
      clearInterval(lyricsCycleTimer);
      lyricsCycleTimer = null;
    }
  }

  function startLyricsCycle() {
    if (lyricsCycleTimer || lyricsLines.length === 0) return;
    lyricsLineIdx = 0;
    showLyricsLine(lyricsLines[0]);
    lyricsCycleTimer = setInterval(() => {
      lyricsLineIdx = (lyricsLineIdx + 1) % lyricsLines.length;
      showLyricsLine(lyricsLines[lyricsLineIdx]);
    }, 4500);
  }

  async function loadLyricsFor(track) {
    if (!track) {
      lastLyricsUri = null;
      lyricsLines = [];
      stopLyricsCycle();
      showLyricsLine('');
      return;
    }
    if (track.uri === lastLyricsUri) return;
    lastLyricsUri = track.uri;
    stopLyricsCycle();

    const cached = lyricsCache.get(track.uri);
    if (cached) {
      lyricsLines = cached;
      if (latestState && !latestState.paused) startLyricsCycle();
      return;
    }

    const myToken = ++lyricsToken;
    lyricsLines = [];
    showLyricsLine('Loading lyrics…');
    try {
      const text = await LYRICS.fetch(track.artists[0].name, track.name);
      if (myToken !== lyricsToken) return; // a newer track superseded this lookup
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      lyricsLines = lines.length ? lines : [text.trim()];
      lyricsCache.set(track.uri, lyricsLines);
      if (latestState && !latestState.paused) startLyricsCycle();
    } catch (err) {
      if (myToken !== lyricsToken) return;
      lyricsLines = [];
      showLyricsLine(err.message);
    }
  }

  function startTicker() {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      if (!latestState || latestState.paused || isSeeking) return;
      const elapsed = latestState.position + (Date.now() - latestState.fetchedAt);
      const duration = latestState.duration || 1;
      updateTimeUI(elapsed, duration);
    }, 500);
  }

  function updateTimeUI(elapsed, duration) {
    elapsed = Math.min(elapsed, duration);
    timeInline.textContent = `${fmtTime(elapsed)} / ${fmtTime(duration)}`;
    if (!isSeeking) {
      seekBar.value = duration ? Math.floor((elapsed / duration) * 1000) : 0;
      seekBar.style.setProperty('--fill', (seekBar.value / 10) + '%');
    }
  }

  function renderTrack(track, paused) {
    if (!track) {
      marqueeText.textContent = 'Nothing playing — pick a track from the playlist window';
      return;
    }
    const glyph = paused ? '❚❚ ' : '▶ ';
    const artists = track.artists.map(a => a.name).join(', ');
    marqueeText.textContent = `${glyph}${track.name} — ${artists}    •••    `;
    metaQuality.textContent = track.explicit ? 'EXPLICIT' : 'PREMIUM';
  }

  function handleStateChanged(state) {
    if (!state) {
      renderTrack(null);
      currentPlayingUri = null;
      highlightPlayingResult();
      BGVIZ.setPlaying(false);
      loadLyricsFor(null);
      return;
    }
    latestState = {
      paused: state.paused,
      position: state.position,
      duration: state.duration,
      fetchedAt: Date.now()
    };

    const track = state.track_window && state.track_window.current_track;
    renderTrack(track, state.paused);
    currentPlayingUri = track ? track.uri : null;
    highlightPlayingResult();
    BGVIZ.setPlaying(!state.paused);
    loadLyricsFor(track);
    if (state.paused) stopLyricsCycle();
    else if (lyricsLines.length && !lyricsCycleTimer) startLyricsCycle();

    updateTimeUI(state.position, state.duration);

    btnShuffle.classList.toggle('active', !!state.shuffle);
    repeatMode = state.repeat_mode || 0;
    btnRepeat.classList.toggle('active', repeatMode !== 0);
  }

  function highlightPlayingResult() {
    resultsList.querySelectorAll('.result-item').forEach(el => {
      el.classList.toggle('playing', el.dataset.uri === currentPlayingUri);
    });
  }

  function setStatus(message, isError = false) {
    plStatus.textContent = message || '';
    plStatus.classList.toggle('error', isError);
  }

  function renderResults(tracks) {
    resultsList.innerHTML = '';

    if (tracks.length === 0) {
      const li = document.createElement('li');
      li.className = 'result-empty';
      li.textContent = 'No tracks found.';
      resultsList.appendChild(li);
      return;
    }

    tracks.forEach(track => {
      const li = document.createElement('li');
      li.className = 'result-item';
      li.dataset.uri = track.uri;
      const art = track.album.images[track.album.images.length - 1]?.url || '';
      li.innerHTML = `
        <img src="${art}" alt="">
        <div class="result-text">
          <div class="result-title">${track.name}</div>
          <div class="result-artist">${track.artists.map(a => a.name).join(', ')}</div>
        </div>`;
      li.addEventListener('click', async () => {
        setStatus(`Starting "${track.name}"…`);
        try {
          await SpotifyPlayer.playUris([track.uri]);
          currentPlayingUri = track.uri;
          highlightPlayingResult();
          setStatus('');
        } catch (err) {
          setStatus(err.message, true);
        }
      });
      resultsList.appendChild(li);
    });
  }

  // ---- Control wiring ----
  btnPlay.addEventListener('click', async () => {
    if (latestState) await SpotifyPlayer.resume();
    else marqueeText.textContent = 'Search and pick a track from the playlist window first…';
  });
  btnPause.addEventListener('click', () => SpotifyPlayer.pause());
  btnStop.addEventListener('click', async () => {
    await SpotifyPlayer.pause();
    await SpotifyPlayer.seek(0);
  });
  btnNext.addEventListener('click', () => SpotifyPlayer.nextTrack());
  btnPrev.addEventListener('click', () => SpotifyPlayer.previousTrack());

  btnShuffle.addEventListener('click', async () => {
    const next = !btnShuffle.classList.contains('active');
    try {
      await SpotifyPlayer.setShuffle(next);
      btnShuffle.classList.toggle('active', next);
    } catch (err) {
      marqueeText.textContent = `Error: ${err.message}`;
    }
  });

  btnRepeat.addEventListener('click', async () => {
    const nextMode = (repeatMode + 1) % 3;
    try {
      await SpotifyPlayer.setRepeat(['off', 'context', 'track'][nextMode]);
      repeatMode = nextMode;
      btnRepeat.classList.toggle('active', repeatMode !== 0);
    } catch (err) {
      marqueeText.textContent = `Error: ${err.message}`;
    }
  });

  seekBar.addEventListener('input', () => {
    isSeeking = true;
    seekBar.style.setProperty('--fill', (seekBar.value / 10) + '%');
    if (latestState) {
      const ms = (seekBar.value / 1000) * latestState.duration;
      timeInline.textContent = `${fmtTime(ms)} / ${fmtTime(latestState.duration)}`;
    }
  });
  seekBar.addEventListener('change', async () => {
    if (latestState) {
      const ms = Math.floor((seekBar.value / 1000) * latestState.duration);
      await SpotifyPlayer.seek(ms);
    }
    isSeeking = false;
  });

  volumeBar.addEventListener('input', () => {
    volumeBar.style.setProperty('--fill', volumeBar.value + '%');
    SpotifyPlayer.setVolume(volumeBar.value / 100);
  });
  volumeBar.style.setProperty('--fill', volumeBar.value + '%');

  btnPlToggle.addEventListener('click', () => playlistWin.classList.toggle('hidden'));
  btnPlClose.addEventListener('click', () => playlistWin.classList.add('hidden'));

  const eqWin = document.getElementById('eq-win');
  const btnEqToggle = document.getElementById('btn-eq-toggle');
  const btnEqClose = document.getElementById('btn-eq-close');
  btnEqToggle.addEventListener('click', () => eqWin.classList.toggle('hidden'));
  btnEqClose.addEventListener('click', () => eqWin.classList.add('hidden'));

  btnLyricsToggle.addEventListener('click', () => {
    const nowHidden = lyricsOverlay.classList.toggle('hidden');
    btnLyricsToggle.classList.toggle('active', !nowHidden);
  });

  btnLogout.addEventListener('click', () => AUTH.logout());

  const mainWin = document.getElementById('main-win');
  document.getElementById('btn-shade').addEventListener('click', () => mainWin.classList.toggle('shaded'));

  document.getElementById('btn-eject').addEventListener('click', () => {
    playlistWin.classList.remove('hidden');
    searchInput.focus();
  });

  searchForm.addEventListener('submit', async e => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    setStatus('Searching…');
    resultsList.innerHTML = '';
    try {
      const tracks = await SpotifyPlayer.search(query);
      setStatus('');
      renderResults(tracks);
    } catch (err) {
      setStatus(err.message, true);
    }
  });

  // ---- Client ID setup (lets one hosted deployment be reused with anyone's own Spotify app) ----
  function refreshClientIdUI() {
    redirectUriDisplay.textContent = AUTH.REDIRECT_URI;
    if (AUTH.hasClientId()) {
      clientIdSuffix.textContent = AUTH.getClientId().slice(-6);
      clientIdSetup.classList.add('hidden');
      clientIdReady.classList.remove('hidden');
    } else {
      clientIdSetup.classList.remove('hidden');
      clientIdReady.classList.add('hidden');
    }
  }

  clientIdForm.addEventListener('submit', e => {
    e.preventDefault();
    const value = clientIdInput.value.trim();
    if (!value) return;
    AUTH.setClientId(value);
    clientIdInput.value = '';
    refreshClientIdUI();
  });

  changeClientIdLink.addEventListener('click', e => {
    e.preventDefault();
    AUTH.clearClientId();
    refreshClientIdUI();
    clientIdInput.focus();
  });

  // ---- Boot ----
  async function boot() {
    refreshClientIdUI();

    const redirectResult = await AUTH.handleRedirect();
    if (redirectResult && redirectResult.error) {
      loginErrorEl.textContent = `Spotify login error: ${redirectResult.error}`;
    }

    if (!AUTH.isLoggedIn()) {
      loginScreen.classList.remove('hidden');
      app.classList.add('hidden');
      return;
    }

    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');

    SpotifyPlayer.on('state_changed', handleStateChanged);
    SpotifyPlayer.on('error', msg => { marqueeText.textContent = `Error: ${msg}`; });

    try {
      await SpotifyPlayer.init();
      await SpotifyPlayer.transferPlaybackHere(false);
    } catch (e) {
      marqueeText.textContent = 'Could not start Spotify player — is Premium active?';
    }

    startViz();
    startTicker();
  }

  makeDraggable(document.getElementById('main-win'), document.querySelector('[data-drag="main"]'));
  makeDraggable(document.getElementById('playlist-win'), document.querySelector('[data-drag="playlist"]'));
  makeDraggable(document.getElementById('eq-win'), document.querySelector('[data-drag="eq"]'));
  EQ.init();
  BGVIZ.init(bgVizCanvas);

  document.getElementById('login-btn').addEventListener('click', () => AUTH.redirectToAuthorize());

  boot();
})();
