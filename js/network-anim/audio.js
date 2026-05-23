/* Network Visualization Hub — Audio (Web Audio synth, 8 canonical events).
 *
 * Per plan §5.4 v2.3. Synth-only (no samples). Every event decays to silence
 * by 250 ms. Mobile audio is gesture-gated. Default muted.
 *
 * The canonical event defaults below are TEMPLATES — topic modules override
 * via their `timbre` profile (§5.6). Engine composes:
 *   defaults < timbre.byte < perRole < perState < tempo (top × state)
 * Final freq clamped to [400, 3000] Hz; duration clamped to [6, 25] ms for
 * byte-class events; other events use their canonical windows.
 *
 * Public surface:
 *   RZNetAnim.audio.init()      — get/create the audio context (gesture-gated)
 *   RZNetAnim.audio.play(spec)  — synth a single event from a composed spec
 *   RZNetAnim.audio.setMuted(b) — mute toggle
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var ctx = null;
  var muted = true;

  // Canonical event defaults (§5.4 v2.3)
  var DEFAULTS = Object.freeze({
    tick:         { waveform: 'square',   freq: 800,  durationMs:  6 },
    byte:         { waveform: 'square-sweep', freqStart: 1200, freqEnd: 1600, durationMs: 12 },
    ack:          { waveform: 'sine',     freq: 1800, durationMs: 60 },
    error:        { waveform: 'sawtooth', freq: 220,  durationMs: 80, bezelFlashMs: 120 },
    complete:     { waveform: 'sine',     freq: 1500, durationMs: 80 },
    handshake:    { freqSteps: [800, 1000, 1200], stepDurationMs: 40 },
    streamChunk:  { freqStart:  50, durationMs: 30, pulseRateHz: 50 },
    tokenIssue:   { waveform: 'sine', freq: 2400, durationMs: 100 }
  });

  // Hard clamps (defence in depth — timbre.audit also enforces at lint time)
  var FREQ_MIN = 400, FREQ_MAX = 3000;
  var BYTE_DUR_MIN = 6, BYTE_DUR_MAX = 25;
  var DECAY_HARD_CAP_MS = 250;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function init() {
    if (ctx) return ctx;
    if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return null;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    return ctx;
  }

  function setMuted(b) { muted = !!b; }

  /**
   * Compose canonical default + topic timbre override + perRole + perState +
   * apply tempo (top × state, multiplicative) for tempo-sensitive events.
   *
   * Returns the final synth spec. Pure function — no side effects.
   *
   * Order (plan §5.6 v2.3):
   *   1. defaults
   *   2. topic timbre (e.g. timbre.byte)
   *   3. perRole modifier
   *   4. perState modifier
   *   5. tempo = topLevelTempoMultiplier * perState.tempoMultiplier (clamped)
   *   6. clamp freq + duration
   *   7. byte event: apply byteFreqShift from perRole
   */
  function compose(eventName, timbre, role, state) {
    var def  = DEFAULTS[eventName] || {};
    var t    = (timbre && timbre[eventName === 'error' ? 'errorSfx' : eventName === 'complete' ? 'completeSfx' : eventName]) || {};
    var pr   = (timbre && timbre.perRole && timbre.perRole[role]) || {};
    var ps   = (timbre && timbre.perState && timbre.perState[state]) || {};

    var topTempo   = (timbre && typeof timbre.tempoMultiplier === 'number') ? timbre.tempoMultiplier : 1.0;
    var stateTempo = (typeof ps.tempoMultiplier === 'number') ? ps.tempoMultiplier : 1.0;
    var tempo = clamp(topTempo * stateTempo, 0.7, 1.7);

    var spec = {};
    // shallow merge order: def -> t -> pr -> ps  (later wins)
    var src;
    for (src of [def, t, pr, ps]) {
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) spec[k] = src[k];
      }
    }

    // Per-role freq shift (byte only)
    if (eventName === 'byte' && typeof pr.byteFreqShift === 'number') {
      if (typeof spec.freqStart === 'number') spec.freqStart += pr.byteFreqShift;
      if (typeof spec.freqEnd   === 'number') spec.freqEnd   += pr.byteFreqShift;
      if (typeof spec.freq      === 'number') spec.freq      += pr.byteFreqShift;
    }

    // Clamp frequency to canonical instrumentation band
    if (typeof spec.freq === 'number')      spec.freq      = clamp(spec.freq, FREQ_MIN, FREQ_MAX);
    if (typeof spec.freqStart === 'number') spec.freqStart = clamp(spec.freqStart, FREQ_MIN, FREQ_MAX);
    if (typeof spec.freqEnd === 'number')   spec.freqEnd   = clamp(spec.freqEnd, FREQ_MIN, FREQ_MAX);

    // Clamp duration: byte event uses [6, 25] ms; others honor their canonical default
    if (eventName === 'byte' && typeof spec.durationMs === 'number') {
      spec.durationMs = clamp(spec.durationMs, BYTE_DUR_MIN, BYTE_DUR_MAX);
    }

    // Universal hard cap — no SFX exceeds 250 ms decay window
    if (typeof spec.durationMs === 'number') {
      spec.durationMs = clamp(spec.durationMs, 1, DECAY_HARD_CAP_MS);
    }

    spec._tempo = tempo;
    return spec;
  }

  /**
   * Synth a single event from a composed spec.
   * No-op if muted or if Web Audio is unavailable.
   */
  function play(spec) {
    if (muted) return;
    var c = init();
    if (!c) return;
    if (!spec) return;

    var now = c.currentTime;
    var durSec = (spec.durationMs || 12) / 1000;

    var osc = c.createOscillator();
    osc.type = spec.waveform === 'square-sweep' || spec.waveform === 'sine-sweep'
      ? spec.waveform.replace('-sweep', '')
      : (spec.waveform || 'sine');

    if (typeof spec.freqStart === 'number' && typeof spec.freqEnd === 'number') {
      osc.frequency.setValueAtTime(spec.freqStart, now);
      osc.frequency.linearRampToValueAtTime(spec.freqEnd, now + durSec);
    } else {
      osc.frequency.setValueAtTime(spec.freq || 1000, now);
    }

    var gain = c.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durSec);

    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + Math.min(durSec, DECAY_HARD_CAP_MS / 1000));
  }

  window.RZNetAnim.audio = Object.freeze({
    init: init,
    play: play,
    compose: compose,
    setMuted: setMuted,
    defaults: DEFAULTS
  });
})();
