# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Spotiamp** — a retro Winamp-styled web player that drives **real** Spotify playback via the Spotify Web Playback SDK + Web API, using the Authorization Code + PKCE OAuth flow (no server, no client secret). Plain HTML/CSS/JS — no build step, no package manager, no test suite.

## Running it

There is no build/lint/test tooling. To preview:

```bash
npx serve -l 5500        # or: python -m http.server 5500
```

Then open the page at whatever URL is registered as the Redirect URI (see below) — **not** via `file://`, since Spotify's OAuth redirect requires `http://`.

Real playback requires:
- A Spotify Premium account (the Web Playback SDK refuses to stream on free accounts).
- A Client ID from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). No file editing needed — the login screen's "Enter your Spotify Client ID" form saves it to `localStorage` on first visit (see `AUTH.getClientId/setClientId` in `js/auth.js`). This is what lets one deployment (local or hosted) be reused by anyone with their own Spotify app.
- The dashboard's Redirect URI configured to match `AUTH.REDIRECT_URI` (`window.location.origin + window.location.pathname`, computed at runtime — never a config file value) exactly, including the port used to serve the app. The login screen displays this value live so there's nothing to hardcode.

Headless-browser testing (e.g. Playwright) can render and smoke-test the UI, but cannot exercise actual audio playback — the Web Playback SDK needs Widevine DRM (EME), which headless Chromium doesn't support.

## Architecture

Five scripts loaded as plain `<script>` tags in `index.html`, in dependency order, each attaching a single global:

1. **`js/config.js`** — optional, gitignored `CONFIG.CLIENT_ID` override for a single machine's convenience only. Not loaded at all in a fresh clone or hosted deploy — everything degrades gracefully to the in-app form if it's absent (see `AUTH.getClientId()`'s `typeof CONFIG !== 'undefined'` guard). `js/config.example.js` is the committed template; never commit a real Client ID into `config.js` itself even though it isn't a secret — the whole point is that visitors bring their own.
2. **`js/auth.js`** — `AUTH` IIFE. Computes `REDIRECT_URI` itself from `window.location` (never from a file, so it's always correct wherever it's served) and implements the PKCE flow end-to-end: generates the code verifier/challenge, redirects to Spotify's `/authorize`, exchanges the returned `code` for tokens, and silently refreshes via `getValidToken()`. Client ID resolution (`getClientId`/`setClientId`/`clearClientId`/`hasClientId`) checks `localStorage['spotify_client_id']` first, falling back to `CONFIG.CLIENT_ID` if present. Tokens live in `localStorage` under `spotify_access_token` / `spotify_refresh_token` / `spotify_token_expires` / `spotify_code_verifier`. `app.js` calls `AUTH.handleRedirect()` once on load to catch the OAuth callback (the `?code=...` query param).
3. **`js/player.js`** — `SpotifyPlayer` IIFE. Two responsibilities in one module: (a) wraps the Web Playback SDK (`Spotify.Player`) for in-browser audio streaming and transport controls (`togglePlay`, `seek`, `setVolume`, etc.), and (b) a thin `api()` fetch wrapper around the Spotify Web API for everything the SDK doesn't cover (search, shuffle/repeat, transferring playback to this browser tab's device). `api()` checks `res.ok` and throws with Spotify's own error message on failure — every caller must let that propagate to the UI rather than swallowing it (see "Error handling" below). `requireDevice()` guards the calls that need an active `deviceId` (play/transfer/shuffle/repeat) and throws a clear "not ready yet" error if the SDK hasn't connected. Emits events (`ready`, `state_changed`, `error`) via a minimal pub/sub (`on`/`emit`) that `app.js` subscribes to.
4. **`js/eq.js`** — `EQ` IIFE. Purely cosmetic graphic equalizer: wires the ON toggle and preset `<select>` to the 11 vertical sliders (preamp + 10 bands, built with the standard "rotate a horizontal `<input type=range>`" CSS trick). Does not touch playback in any way — see constraints below.
5. **`js/lyrics.js`** — `LYRICS` IIFE. Looks up plain-text lyrics from `api.lyrics.ovh` (a free public lyrics database — Spotify's own Web API has no lyrics endpoint for third-party apps) by artist/title. `fetch(artist, title)` tries the raw title first, then a version with common suffixes stripped (`stripExtras`: parentheticals, `feat.`/`remix`/`live`/`remaster` etc.) as a fallback for better hit rates, and throws a plain `Error` on a miss or network failure for the caller to display.
6. **`js/app.js`** — DOM orchestration only. Wires buttons/sliders to `SpotifyPlayer` methods, renders `player_state_changed` events into the LCD display (marquee track title, elapsed/total time, shuffle/repeat toggle state), feeds `LYRICS.fetch()` off the same events (with a cache and a monotonic token in `loadLyricsFor()` to discard stale lookups if the track changes again before a fetch resolves), and runs a local `setInterval` ticker to interpolate the seek bar between SDK state updates (the SDK doesn't push position continuously). Also implements titlebar dragging for all four windows (`makeDraggable`), the playlist/search panel (queries `/v1/search`, click-to-play, status/error line via `setStatus()`), and the login screen's two-state Client ID UI (`refreshClientIdUI()` toggles `#client-id-setup` vs `#client-id-ready` based on `AUTH.hasClientId()`).

Data flow for a track selection: playlist window search → `SpotifyPlayer.search()` (Web API) → click result → `SpotifyPlayer.playUris()` (Web API, targets this tab's `deviceId`) → SDK fires `player_state_changed` → `app.js` re-renders the LCD/seek bar/highlighted result row, and kicks off a lyrics lookup if the track URI changed.

## Error handling

Every `SpotifyPlayer` call that hits the Web API (`search`, `playUris`, `transferPlaybackHere`, `setShuffle`, `setRepeat`) can throw — `app.js`'s handlers all wrap these in `try/catch` and surface `err.message` to the user (the playlist window's `#pl-status` line, or the main window's marquee) rather than failing silently. If you add a new control that calls one of these, wire it the same way: don't optimistically update UI state (e.g. marking a track "now playing") until the underlying call has actually resolved.

## Known constraints (by design, not bugs)

- The visualizer bars and the equalizer are both stylized/state-driven, not real audio processing — Spotify's Web Playback SDK streams DRM-protected audio through a sandboxed decoder and never exposes raw samples or an insertable Web Audio node. There is no way for any browser-based app to do real FFT visualization or real EQ filtering on Spotify playback.
- Lyrics come from a third-party public lookup (`lyrics.ovh`), not Spotify — its Web API doesn't expose lyrics to third-party apps at all. Treat misses as expected (obscure tracks, non-Latin titles, live/remix naming mismatches) rather than bugs to "fix" with more fallback heuristics; the existing `stripExtras()` pass in `js/lyrics.js` is already a best-effort compromise. Lyrics are plain text, never time-synced to playback.
- The kbps/kHz readout in the LCD meta row is a static `—`, not a live reading, for the same reason: Spotify doesn't expose per-track bitrate or sample rate to any web app. Don't "fix" this by hardcoding a plausible-looking number (e.g. 256/44) — it would misrepresent a setting-dependent value as measured data. The balance slider is decorative for the same class of reason (no stereo-pan API).
- This app only controls playback on its own Spotify Connect device (this browser tab). Switching devices from another Spotify client elsewhere moves playback away from it.
- All auth state is client-side `localStorage`; there is no backend component anywhere in this project.
