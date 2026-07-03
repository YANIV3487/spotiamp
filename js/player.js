// Wraps the Spotify Web Playback SDK (actual audio streaming, requires Premium)
// plus the Web API (search, transfer playback, shuffle/repeat).
const SpotifyPlayer = (() => {
  let player = null;
  let deviceId = null;
  const listeners = {};

  function on(event, cb) {
    (listeners[event] = listeners[event] || []).push(cb);
  }
  function emit(event, data) {
    (listeners[event] || []).forEach(cb => cb(data));
  }

  function loadSdk() {
    return new Promise(resolve => {
      if (window.Spotify) return resolve();
      window.onSpotifyWebPlaybackSDKReady = resolve;
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      document.body.appendChild(script);
    });
  }

  async function init() {
    await loadSdk();
    return new Promise((resolve, reject) => {
      player = new Spotify.Player({
        name: 'Spotiamp',
        getOAuthToken: async cb => cb(await AUTH.getValidToken()),
        volume: 0.5
      });

      player.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        emit('ready', device_id);
        resolve(device_id);
      });

      player.addListener('not_ready', () => emit('not_ready'));
      player.addListener('player_state_changed', state => emit('state_changed', state));
      player.addListener('initialization_error', ({ message }) => { emit('error', message); reject(message); });
      player.addListener('authentication_error', ({ message }) => emit('error', message));
      player.addListener('account_error', ({ message }) => emit('error', 'Spotify Premium is required for playback control.'));

      player.connect();
    });
  }

  async function api(path, options = {}) {
    const token = await AUTH.getValidToken();
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (res.status === 204 || res.status === 202) return null;

    let body = null;
    try { body = await res.json(); } catch { /* empty/non-JSON body */ }

    if (!res.ok) {
      const message = body?.error?.message || `Spotify API error (${res.status})`;
      throw new Error(message);
    }
    return body;
  }

  function requireDevice() {
    if (!deviceId) throw new Error('Player not ready yet — wait a moment and try again.');
    return deviceId;
  }

  async function transferPlaybackHere(play = false) {
    await api('/me/player', {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [requireDevice()], play })
    });
  }

  function togglePlay() { return player && player.togglePlay(); }
  function pause() { return player && player.pause(); }
  function resume() { return player && player.resume(); }
  function nextTrack() { return player && player.nextTrack(); }
  function previousTrack() { return player && player.previousTrack(); }
  function seek(ms) { return player && player.seek(ms); }
  function setVolume(v) { return player && player.setVolume(v); }
  function getCurrentState() { return player ? player.getCurrentState() : Promise.resolve(null); }

  async function playUris(uris) {
    await api(`/me/player/play?device_id=${requireDevice()}`, {
      method: 'PUT',
      body: JSON.stringify({ uris })
    });
  }

  async function search(query) {
    if (!query) return [];
    const data = await api(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
    return data?.tracks?.items || [];
  }

  async function setShuffle(state) {
    await api(`/me/player/shuffle?state=${state}&device_id=${requireDevice()}`, { method: 'PUT' });
  }

  async function setRepeat(state) {
    await api(`/me/player/repeat?state=${state}&device_id=${requireDevice()}`, { method: 'PUT' });
  }

  return {
    init, on, transferPlaybackHere, togglePlay, pause, resume, nextTrack, previousTrack,
    seek, setVolume, getCurrentState, playUris, search, setShuffle, setRepeat,
    getDeviceId: () => deviceId
  };
})();
