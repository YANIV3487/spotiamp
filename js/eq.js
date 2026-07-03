// Graphic equalizer window.
//
// IMPORTANT: this is stylized only. Spotify's Web Playback SDK streams
// DRM-protected audio through a sandboxed decoder and never exposes raw
// samples or an insertable Web Audio node, so there is no way for a
// browser-based app to actually filter the sound. Moving these sliders
// changes only their own visual position and the (also cosmetic) preset
// selection — it does not touch playback.
const EQ = (() => {
  const PRESETS = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Rock: [4, 3, -2, -3, -1, 2, 4, 5, 5, 5],
    Pop: [-1, 2, 3, 3, 1, -1, -2, -2, -1, -1],
    Jazz: [3, 2, 1, 2, -2, -2, 0, 1, 2, 3],
    'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
    'Treble Boost': [0, 0, 0, 0, 0, 1, 3, 4, 5, 6]
  };

  function init() {
    const onBtn = document.getElementById('btn-eq-on');
    const presetSelect = document.getElementById('eq-preset');
    const preamp = document.getElementById('eq-preamp');
    const bandEls = Array.from(document.querySelectorAll('.eq-band[data-freq] .eq-slider'));

    onBtn.addEventListener('click', () => onBtn.classList.toggle('active'));

    presetSelect.addEventListener('change', () => {
      const values = PRESETS[presetSelect.value];
      if (!values) return;
      bandEls.forEach((el, i) => { el.value = values[i]; });
    });

    presetSelect.value = 'Flat';
    preamp.value = 0;
  }

  return { init };
})();
