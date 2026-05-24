/* Network Hub — IPv4 vs IPv6 (Lane A, Phase 3).
 * Appendix E row 11. Distinctive: sequential two-stage tones (NOT chord).
 * v4 32-bit chip vs v6 128-bit chip rendered side-by-side, visibly larger.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine',     freq: 1000, durationMs: 18 },
    ack:         { waveform: 'sine',     freq: 1700, durationMs: 60 },
    tick:        { waveform: 'square',   freq:  700, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1500, durationMs: 80 },
    tempoMultiplier: 1.0,
    registerCharacter: 'addressing-comparison-didactic',
    byteChip: { shape: 'rect',     sizePx: [10, 6], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'router-diamond', slaveIcon: 'endpoint-circle', tertiaryIcons: [] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'none',
    latencyClass:   'interactive',
    completeFreq:   1500,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -150 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  // Two horizontal tracks — v4 above, v6 below. Each emits a chip whose size
  // reflects address bytes (v4 = 4 B, v6 = 16 B → 4x wider chip).
  var TRACK_Y_V4 = 130, TRACK_Y_V6 = 240;
  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;
  var FPB = 10;

  function decodeFrame(f) {
    var cycleF = 120;
    var cf = f % cycleF;
    var p = cf / cycleF;
    // alternating sequential two-stage tone — v4 emits first 50% of cycle, v6 in last 50%
    var role = cf < cycleF / 2 ? 'master' : 'slave';
    var localProgress = role === 'master' ? (cf / (cycleF / 2)) : ((cf - cycleF / 2) / (cycleF / 2));
    return { phase: role === 'master' ? 'v4' : 'v6', byteIndex: 0, byteProgress: localProgress, role: role, totalFrames: cycleF };
  }

  function bytePosition(decoded) {
    var y = decoded.phase === 'v4' ? TRACK_Y_V4 : TRACK_Y_V6;
    return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: y };
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastPhase = '';
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      // Two tracks
      R.drawWire(ctx, WIRE_LEFT, TRACK_Y_V4, WIRE_RIGHT, TRACK_Y_V4, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawWire(ctx, WIRE_LEFT, TRACK_Y_V6, WIRE_RIGHT, TRACK_Y_V6, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT - 30, TRACK_Y_V4, TIMBRE.node.masterIcon, 'v4 32b');
      R.drawNode(ctx, WIRE_LEFT - 30, TRACK_Y_V6, TIMBRE.node.masterIcon, 'v6 128b');
      R.drawNode(ctx, WIRE_RIGHT + 30, TRACK_Y_V4, TIMBRE.node.slaveIcon, '');
      R.drawNode(ctx, WIRE_RIGHT + 30, TRACK_Y_V6, TIMBRE.node.slaveIcon, '');

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      var chipSize = decoded.phase === 'v4' ? [8, 6] : [16, 6];   // v6 chip 2x wider — visibly larger
      trailStore.push(decoded.phase, pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.phase), TIMBRE.byteChip.shape, chipSize, TIMBRE.byteChip.color);
      R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape, chipSize, TIMBRE.byteChip.color, 1.0);

      if (signals && signals.onSFX && decoded.phase !== lastPhase) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastPhase = decoded.phase;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('frame ' + f + ' · current: ' + decoded.phase.toUpperCase() + ' (chip size ' + (decoded.phase === 'v4' ? '32b' : '128b') + ')', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastPhase = ''; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: null, endToEndLatencyMs: null, frameOverheadBytes: null, pendingInFlight: 0, isEncrypted: false, isAuthenticated: false, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.ipv4VsIpv6 = { _timbre: TIMBRE, init: init };
})();
