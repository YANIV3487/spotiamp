// Spotify Authorization Code + PKCE flow (no client secret needed, safe for a static site).
const AUTH = (() => {
  const SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
  ].join(' ');

  function base64UrlEncode(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));
    let result = '';
    randomValues.forEach(v => result += chars[v % chars.length]);
    return result;
  }

  async function sha256(plain) {
    const data = new TextEncoder().encode(plain);
    return crypto.subtle.digest('SHA-256', data);
  }

  async function redirectToAuthorize() {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      response_type: 'code',
      redirect_uri: CONFIG.REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });

    window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  function storeTokens(json) {
    localStorage.setItem('spotify_access_token', json.access_token);
    localStorage.setItem('spotify_token_expires', String(Date.now() + json.expires_in * 1000));
    if (json.refresh_token) {
      localStorage.setItem('spotify_refresh_token', json.refresh_token);
    }
  }

  async function exchangeCodeForToken(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: CONFIG.REDIRECT_URI,
      code_verifier: codeVerifier
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const json = await res.json();
    if (json.access_token) storeTokens(json);
    return json;
  }

  async function refreshToken() {
    const refresh_token = localStorage.getItem('spotify_refresh_token');
    if (!refresh_token) return null;

    const params = new URLSearchParams({
      client_id: CONFIG.CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const json = await res.json();
    if (json.access_token) storeTokens(json);
    return json;
  }

  async function getValidToken() {
    const token = localStorage.getItem('spotify_access_token');
    const expires = Number(localStorage.getItem('spotify_token_expires') || 0);
    if (token && Date.now() < expires - 5000) return token;
    const refreshed = await refreshToken();
    return refreshed?.access_token || null;
  }

  function isLoggedIn() {
    return !!localStorage.getItem('spotify_refresh_token');
  }

  function logout() {
    ['spotify_access_token', 'spotify_refresh_token', 'spotify_token_expires', 'spotify_code_verifier']
      .forEach(k => localStorage.removeItem(k));
    window.location.href = CONFIG.REDIRECT_URI;
  }

  async function handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    if (error) {
      window.history.replaceState({}, document.title, CONFIG.REDIRECT_URI);
      return { error };
    }
    if (code) {
      const result = await exchangeCodeForToken(code);
      window.history.replaceState({}, document.title, CONFIG.REDIRECT_URI);
      return result;
    }
    return null;
  }

  return { redirectToAuthorize, handleRedirect, getValidToken, isLoggedIn, logout };
})();
