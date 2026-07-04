// Stylized visualizer — Spotify's Web Playback SDK streams DRM-protected audio and
// never exposes raw samples or an insertable Web Audio node, so real FFT/waveform
// analysis is impossible here. This draws a classic Winamp-style animation (spectrum
// bars with peak-hold caps, or an oscilloscope line) driven by playback state, not
// actual audio. Click the visualizer to switch modes.
const VIZ = (() => {
  const BARS = 20;
  const SMOOTHING = 0.35;
  const PEAK_DECAY = 0.02;

  let canvas, ctx, dpr = 1;
  let mode = 'bars'; // 'bars' | 'wave'
  let playing = false;
  let raf = null;
  let wavePhase = 0;
  const values = new Array(BARS).fill(0);
  const peaks = new Array(BARS).fill(0);

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  function barColor(t) {
    if (t < 0.6) return '#43e04a';
    if (t < 0.85) return '#d7e043';
    return '#ff5f5f';
  }

  function drawBars() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const gap = 2 * dpr;
    const barW = (w - gap * (BARS - 1)) / BARS;

    for (let i = 0; i < BARS; i++) {
      const target = playing ? Math.random() : 0;
      values[i] += (target - values[i]) * SMOOTHING;
      peaks[i] = values[i] > peaks[i] ? values[i] : Math.max(0, peaks[i] - PEAK_DECAY);

      const barH = Math.max(2 * dpr, values[i] * h);
      const x = i * (barW + gap);

      ctx.shadowColor = 'rgba(67,224,74,.5)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = barColor(values[i]);
      ctx.fillRect(x, h - barH, barW, barH);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#d8d8e8';
      ctx.fillRect(x, Math.max(0, h - peaks[i] * h - dpr), barW, dpr);
    }
  }

  function drawWave() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const amp = playing ? h * 0.35 : 0;
    wavePhase += playing ? 0.25 : 0.05;

    ctx.beginPath();
    ctx.strokeStyle = '#43e04a';
    ctx.shadowColor = 'rgba(67,224,74,.6)';
    ctx.shadowBlur = 4;
    ctx.lineWidth = Math.max(1, 1.5 * dpr);

    const points = 60;
    for (let i = 0; i <= points; i++) {
      const x = (i / points) * w;
      const noise = Math.sin(i * 0.9 + wavePhase) + Math.sin(i * 0.35 + wavePhase * 1.7) * 0.5;
      const y = mid + noise * amp * 0.5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function frame() {
    if (mode === 'bars') drawBars(); else drawWave();
    raf = requestAnimationFrame(frame);
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('click', () => { mode = mode === 'bars' ? 'wave' : 'bars'; });
    if (!raf) frame();
  }

  function setPlaying(isPlaying) {
    playing = !!isPlaying;
  }

  return { init, setPlaying };
})();
