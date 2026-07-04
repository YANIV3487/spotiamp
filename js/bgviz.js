// Ambient full-page background visualizer — same honesty caveat as the LCD analyzer:
// Spotify's Web Playback SDK never exposes raw audio, so this is a playback-state-driven
// animation (a soft glow strip along the bottom edge + drifting embers), not real audio
// analysis. Runs behind all windows via a fixed, pointer-events:none canvas.
const BGVIZ = (() => {
  const BAR_COUNT = 40;
  const PARTICLE_MAX = 50;
  const SMOOTHING = 0.12;

  let canvas, ctx, dpr = 1;
  let playing = false;
  let raf = null;
  const barValues = new Array(BAR_COUNT).fill(0);
  let particles = [];

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }

  function spawnParticle() {
    particles.push({
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      r: (1 + Math.random() * 2.5) * dpr,
      speed: (0.3 + Math.random() * 0.9) * dpr,
      drift: (Math.random() - 0.5) * 0.3 * dpr,
      life: 1,
      gold: Math.random() < 0.3
    });
  }

  function drawBars() {
    const w = canvas.width, h = canvas.height;
    const gap = 3 * dpr;
    const barW = (w - gap * (BAR_COUNT - 1)) / BAR_COUNT;
    const baseH = 70 * dpr;

    for (let i = 0; i < BAR_COUNT; i++) {
      const target = playing ? Math.random() : 0;
      barValues[i] += (target - barValues[i]) * SMOOTHING;
      const barH = barValues[i] * baseH;
      if (barH < 1) continue;
      const x = i * (barW + gap);
      const grad = ctx.createLinearGradient(0, h, 0, h - barH);
      grad.addColorStop(0, 'rgba(67,224,74,.32)');
      grad.addColorStop(1, 'rgba(67,224,74,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, h - barH, barW, barH);
    }
  }

  function drawParticles() {
    if (playing && particles.length < PARTICLE_MAX && Math.random() < 0.5) spawnParticle();

    particles.forEach(p => {
      p.y -= p.speed;
      p.x += p.drift;
      p.life -= 0.0025;
    });
    particles = particles.filter(p => p.life > 0 && p.y > -20);

    particles.forEach(p => {
      const alpha = Math.max(0, p.life) * 0.5;
      ctx.beginPath();
      ctx.fillStyle = p.gold ? `rgba(205,176,106,${alpha})` : `rgba(67,224,74,${alpha})`;
      ctx.shadowColor = p.gold ? 'rgba(205,176,106,.8)' : 'rgba(67,224,74,.8)';
      ctx.shadowBlur = 6 * dpr;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBars();
    drawParticles();
    raf = requestAnimationFrame(frame);
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    if (!raf) frame();
  }

  function setPlaying(isPlaying) {
    playing = !!isPlaying;
  }

  return { init, setPlaying };
})();
