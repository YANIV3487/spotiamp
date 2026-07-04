// Lyrics lookup — Spotify's Web API doesn't expose lyrics to third-party apps
// (only its own first-party clients get them), so this queries lyrics.ovh, a free
// public lyrics database, by artist/title instead. Results are plain text, not
// time-synced, and matching is best-effort: remix/live/remaster suffixes in a track
// title often cause misses, so a stripped-down title is tried as a fallback.
const LYRICS = (() => {
  const API = 'https://api.lyrics.ovh/v1';

  function stripExtras(title) {
    return title
      .replace(/\s*[\(\[][^)\]]*\)?[\)\]]/g, '')
      .replace(/\s*-\s*(feat\.?|ft\.?|with)\b.*$/i, '')
      .replace(/\s*-\s*(remaster(ed)?|remix|live|mono|stereo|single|radio edit|acoustic)\b.*$/i, '')
      .trim();
  }

  async function tryFetch(artist, title) {
    const url = `${API}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    let res;
    try {
      res = await fetch(url);
    } catch {
      throw new Error('Could not reach the lyrics service.');
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lyrics service error (${res.status}).`);
    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error('Lyrics service returned an unexpected response.');
    }
    return body && body.lyrics ? body.lyrics.trim() : null;
  }

  async function fetchLyrics(artist, title) {
    const stripped = stripExtras(title);
    const attempts = [title, stripped].filter((t, i, arr) => t && arr.indexOf(t) === i);

    for (const attempt of attempts) {
      const lyrics = await tryFetch(artist, attempt);
      if (lyrics) return lyrics;
    }
    throw new Error('No lyrics found for this track.');
  }

  return { fetch: fetchLyrics };
})();
