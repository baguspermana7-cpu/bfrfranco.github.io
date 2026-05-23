/* Network Visualization Hub — Modbus RTU topic module (Phase 0 reference).
 *
 * Reference topic for the timbre system + canonical Phase 1 starting point.
 * See docs/plans/2026-05-24-network-visualization-hub-v2.md §5.6 + Appendix E.
 *
 * STATE: Phase 0 scaffold — `_timbre` is the canonical reference. `init()`
 * is a stub that returns a contract-shaped instance for the audit to walk.
 * Full animation logic ships in Phase 1.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  // ════════════════════════════════════════════════════════════════════
  //  TIMBRE PROFILE (Phase 0 reference for all 24 follow-on topics)
  //  Per plan §5.6 + Appendix E row 1.
  // ════════════════════════════════════════════════════════════════════
  var TIMBRE = Object.freeze({
    // ─── AUDIO personality ────────────────────────────────
    byte:        { waveform: 'square-sweep', freqStart: 1200, freqEnd: 1600, durationMs: 12 },
    ack:         { waveform: 'sine',          freq: 1800,     durationMs: 60 },
    tick:        { waveform: 'square',        freq:  800,     durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth',      freq:  220,     durationMs: 80 },
    completeSfx: { waveform: 'sine',          freq: 1500,     durationMs: 80 },
    // handshake / streamChunk / tokenIssue: undefined — Modbus RTU doesn't use them.
    tempoMultiplier: 1.0,
    registerCharacter: 'modem-v21',   // documentation tag only

    // ─── VISUAL personality ───────────────────────────────
    byteChip: { shape: 'square',       sizePx: [8, 8],   color: 'instrument-cyan' },
    wire:     { style: 'serial-thin',  widthPx: 0.7 },
    node:     { masterIcon: 'plc-rectangle', slaveIcon: 'sensor-circle', tertiaryIcons: [] },

    // ─── ERROR / ENCRYPTION / LATENCY / COMPLETE / DEGRADE ───
    errorSignature:    'crc-fail-bytes-corrupt',
    encryption:        'none',
    latencyClass:      'interactive',
    completeFreq:      1500,
    compareDegrade:    ['drop-shroud', 'drop-trail', 'drop-pulse'],

    // ─── PER-ROLE MODIFIERS (read as data, not personality) ──
    perRole: {
      master: { byteFreqShift:    0, waveform: 'square-sweep' },
      slave:  { byteFreqShift: -200, waveform: 'square-sweep' }   // slave bytes pitched lower
    },

    // ─── PER-STATE MODIFIERS ────────────────────────────────
    perState: {
      handshake: { tempoMultiplier: 0.7, ackToneShift: +200 },
      steady:    { tempoMultiplier: 1.0 },
      error:     { tempoMultiplier: 1.0 }   // LOCKED — no slow-on-error
    }
  });

  /**
   * Instantiate a Modbus RTU animation on the given canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} params  — { baudRate, parity, stopBits, slaveAddr, fcCode, ... }
   * @param {Object} signals — { onSFX, onError, onComplete }
   * @returns {Object} instance with play/pause/seek/setParams/getNormalized/destroy + timbre
   */
  function init(canvas, params, signals) {
    var _params = Object.assign({
      baudRate: 9600,
      parity: 'even',
      stopBits: 1,
      slaveAddr: 1,
      fcCode: 3,
      payloadBytes: 8,
      turnaroundMs: 5,
      lineNoise: 0
    }, params || {});

    // Phase 0 stub: animation logic lands in Phase 1.
    // The contract surface is implemented so the audit + integration tests
    // can walk it.
    var playing = false;
    var frame = 0;

    function play()  { playing = true; }
    function pause() { playing = false; }
    function seek(targetFrame) {
      // Strategy A (preferred) — purely derivable state.
      // Phase 1 implementation will compute byte positions as pure functions
      // of (i, targetFrame, baudRate, frameRate); no accumulated velocity.
      frame = targetFrame;
    }
    function setParams(next) {
      _params = Object.assign({}, _params, next || {});
    }
    function destroy() {
      playing = false;
      frame = 0;
    }

    /**
     * Normalised metrics for compare-mode chip strip (§6.3 + Appendix B).
     */
    function getNormalized() {
      var noiseFactor = 1 - (_params.lineNoise / 100);
      var payload = _params.payloadBytes;
      var frameBytes = payload + 5;   // 1 addr + 1 fc + 2 crc + 1 stop
      return {
        effectiveThroughputBps: (_params.baudRate / 10) * noiseFactor * (payload / frameBytes),
        endToEndLatencyMs:      (payload * 8 + 80) / _params.baudRate * 1000 + _params.turnaroundMs,
        frameOverheadBytes:     5,
        pendingInFlight:        0,
        isEncrypted:            false,
        isAuthenticated:        false,
        errorCount:             0
      };
    }

    return {
      play: play,
      pause: pause,
      seek: seek,
      setParams: setParams,
      getNormalized: getNormalized,
      destroy: destroy,
      timbre: TIMBRE
    };
  }

  // Public surface
  window.RZNetAnim.modbusRtu = {
    _timbre: TIMBRE,   // engine reads this for compose; same object as instance.timbre
    init: init
  };
})();
