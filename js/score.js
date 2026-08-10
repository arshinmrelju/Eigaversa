/* ==========================================================
   EIGAVERSA — Cinematic Score
   Web Audio API ambient soundtrack.
   Dark orchestral pads (Dm → F → C → Am) with reverb.
   Auto-starts on first user gesture (browser policy).
   ========================================================== */
(function () {
  'use strict';

  /* ── Chord progression (D minor — cinematic / dramatic) ── */
  const CHORDS = [
    { bass: 36.71, mid: [73.42, 110.00, 146.83], high: [220.00, 293.66] }, // Dm
    { bass: 43.65, mid: [87.31, 130.81, 174.61], high: [261.63, 349.23] }, // F
    { bass: 32.70, mid: [65.41, 98.00,  130.81], high: [196.00, 261.63] }, // C
    { bass: 27.50, mid: [55.00, 82.41,  110.00], high: [164.81, 220.00] }, // Am
  ];
  const CHORD_DUR   = 6.0; // seconds per chord
  const FADE        = 1.4; // attack / release seconds
  const MASTER_VOL  = 0.42;

  let ctx, masterGain, reverb;
  let started  = false;
  let muted    = false;
  let schedTimer = null;

  /* ── Build a synthetic reverb impulse ── */
  function buildReverb() {
    const conv = ctx.createConvolver();
    const sr   = ctx.sampleRate;
    const len  = Math.floor(sr * 3.2);
    const buf  = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
    }
    conv.buffer = buf;
    return conv;
  }

  /* ── Single oscillator node helper ── */
  function makeOsc(type, freq, detuneCents, vol, when, dur, toReverb) {
    const osc    = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();

    osc.type          = type;
    osc.frequency.value = freq;
    osc.detune.value  = detuneCents;

    filter.type             = 'lowpass';
    filter.frequency.value  = 900;
    filter.Q.value          = 0.6;

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + FADE);
    gain.gain.setValueAtTime(vol, when + dur - FADE);
    gain.gain.linearRampToValueAtTime(0, when + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    if (toReverb) gain.connect(reverb);

    osc.start(when);
    osc.stop(when + dur + 0.1);
  }

  /* ── Play one chord at 'when' (Web Audio clock) ── */
  function playChord(chord, when) {
    const d = CHORD_DUR;

    // Sub-bass sine
    makeOsc('sine', chord.bass, 0, 0.22, when, d, false);

    // Mid-register sawtooth pads (slightly detuned pairs for width)
    chord.mid.forEach(f => {
      makeOsc('sawtooth', f,  0,   0.04, when, d, true);
      makeOsc('sawtooth', f,  9,   0.03, when, d, true);
      makeOsc('sawtooth', f, -9,   0.03, when, d, true);
    });

    // High shimmer — triangle, quieter
    chord.high.forEach(f => {
      makeOsc('triangle', f,  0,  0.025, when, d, true);
      makeOsc('triangle', f,  5,  0.015, when, d, true);
    });
  }

  /* ── Lookahead scheduler (runs every 300 ms, looks 1.8 s ahead) ── */
  function startScheduler() {
    let idx       = 0;
    let nextTime  = ctx.currentTime + 0.15;

    function tick() {
      while (nextTime < ctx.currentTime + 1.8) {
        playChord(CHORDS[idx % CHORDS.length], nextTime);
        nextTime += CHORD_DUR;
        idx++;
      }
      schedTimer = setTimeout(tick, 300);
    }
    tick();
  }

  /* ── Boot the engine on first user gesture ── */
  async function boot() {
    if (started) return;
    started = true;

    ctx        = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    reverb     = buildReverb();

    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(MASTER_VOL, ctx.currentTime + 3.5);

    reverb.connect(masterGain);
    masterGain.connect(ctx.destination);

    if (ctx.state === 'suspended') await ctx.resume();

    startScheduler();
    updateBtn(false);
  }

  /* ── Mute / Unmute ── */
  function toggleMute() {
    if (!started) { boot(); return; }
    muted = !muted;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : MASTER_VOL, now + 0.8);
    updateBtn(muted);
  }

  /* ── Update button icon ── */
  function updateBtn(isMuted) {
    const btn = document.getElementById('score-toggle');
    if (!btn) return;
    btn.setAttribute('aria-label', isMuted ? 'Unmute soundtrack' : 'Mute soundtrack');
    btn.classList.toggle('is-muted', isMuted);
    btn.querySelector('.score-icon-on').style.display  = isMuted ? 'none'   : 'block';
    btn.querySelector('.score-icon-off').style.display = isMuted ? 'block'  : 'none';
  }

  /* ── Wire up events ── */
  window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('score-toggle');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMute();
      });
    }

    // Start on first interaction anywhere on the page
    const startOnce = () => {
      boot();
      window.removeEventListener('click',      startOnce);
      window.removeEventListener('touchstart', startOnce);
      window.removeEventListener('keydown',    startOnce);
      window.removeEventListener('scroll',     startOnce);
    };
    window.addEventListener('click',      startOnce, { once: true });
    window.addEventListener('touchstart', startOnce, { once: true, passive: true });
    window.addEventListener('keydown',    startOnce, { once: true });
    window.addEventListener('scroll',     startOnce, { once: true, passive: true });
  });
})();
