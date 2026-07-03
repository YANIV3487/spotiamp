// Copy this file to config.js and fill in CLIENT_ID with the Client ID from
// your Spotify Developer Dashboard app (js/config.js is gitignored so your
// own value never gets committed).
// https://developer.spotify.com/dashboard -> Create app
// Add this exact Redirect URI in the app settings (must match what you run locally):
//   http://127.0.0.1:5500/   (if you use a different port, update both here and in the dashboard)
const CONFIG = {
  CLIENT_ID: 'YOUR_SPOTIFY_CLIENT_ID_HERE',
  REDIRECT_URI: window.location.origin + window.location.pathname
};
