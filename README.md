# Spotiamp

A retro Winamp-styled player that controls real Spotify playback in your browser (Authorization Code + PKCE, no server/secret needed).

## Requirements

- **Spotify Premium** — the Web Playback SDK refuses to stream for free accounts.
- A Spotify Developer app (free to create).
- Any static file server (this is plain HTML/CSS/JS, no build step).

## Setup

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create an app.
2. In the app settings, add a **Redirect URI** that matches exactly how you'll serve this folder locally, e.g.:
   ```
   http://127.0.0.1:5500/
   ```
3. Copy `js/config.example.js` to `js/config.js` (gitignored, so your own Client ID never gets committed) and paste in the app's **Client ID**:
   ```js
   CLIENT_ID: 'paste-your-client-id-here',
   ```
4. Serve the folder over that same origin/port, e.g. with VS Code's Live Server extension, or:
   ```
   npx serve -l 5500
   ```
   (Opening `index.html` directly via `file://` will not work — Spotify's OAuth redirect requires `http://`.)
5. Open the page at the exact redirect URI, click **Connect to Spotify**, and log in.

## Using it

- **EQ** / **PL** (next to the volume slider) open the graphic equalizer and Playlist/Search windows. Search failures (expired token, no active device yet, etc.) are reported as text under the search box instead of failing silently.
- The eject button (▲, bottom row) opens the Playlist/Search window and focuses the search box.
- Transport buttons, seek bar, and volume behave like classic Winamp; the balance slider is present for looks (see limitations below).
- **SHUFFLE** / the loop-icon button toggle Spotify's shuffle and repeat (off → context → track) modes.
- The orange circle button shades the main window (collapses it to just the titlebar).
- Drag any window by its titlebar.
- **X** on the main window logs you out.

## Known limitations

- The visualizer bars and the equalizer are both stylized, not real audio processing — Spotify's Web Playback SDK streams DRM-protected audio through a sandboxed decoder and never exposes raw samples or an insertable Web Audio node. The visualizer bars react to play/pause state instead of an FFT, and moving the EQ sliders doesn't change the actual sound.
- The kbps/kHz readout shows `—` rather than real numbers — Spotify doesn't expose per-track bitrate or sample rate to any web app, official or third-party. The balance slider is decorative for the same reason (no stereo-pan API).
- Access tokens are stored in `localStorage` and refreshed automatically; logging out clears them.
- This app only controls playback on **this** browser tab's Spotify Connect device — switching devices from the Spotify app elsewhere will move playback away from it.
