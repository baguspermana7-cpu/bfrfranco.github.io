/* Network Hub — gRPC (Lane E, Phase 5).
 * Appendix E row 24. Distinctive: HTTP/2 multiplex — 4 simultaneous stream chips.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'square',   freq: 1400, durationMs: 10 },
    ack:         { waveform: 'sine',     freq: 2000, durationMs: 40 },
    tick:        { waveform: 'square',   freq: 1000, durationMs:  6 },
    streamChunk: { freqStart:  50, durationMs: 30, pulseRateHz: 50 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1800, durationMs: 80 },
    tempoMultiplier: 1.7,
    registerCharacter: 'http2-multiplexed-streams',
    byteChip: { shape: 'rect',           sizePx: [8, 6], color: 'instrument-cyan' },
    wire:     { style: 'http2-multiplex', widthPx: 1.0 },
    node:     { masterIcon: 'client-circle', slaveIcon: 'server-rack', tertiaryIcons: [] },
    errorSignature: 'frame-loss-trail-cut',
    encryption:     'always',
    latencyClass:   'realtime',
    completeFreq:   1800,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -200 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;
  var LANES = 4;
  var LANE_SPACING = 8;

  function decodeFrame(f) {
    // Each lane has its own chip flowing at different speed/phase
    return { phase: 'multiplex', byteIndex: f % 100, byteProgress: (f % 100) / 100,
             role: 'master', totalFrames: 100 };
  }

  function bytePosition(decoded) {
    return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastEmit = -1;
    var trailStores = [
      window.RZNetAnim.vfx.createTrailStore(),
      window.RZNetAnim.vfx.createTrailStore(),
      window.RZNetAnim.vfx.createTrailStore(),
      window.RZNetAnim.vfx.createTrailStore()
    ];

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'CLIENT');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'SERVER');

      // 4 simultaneous lane streams — each chip at different phase
      for (var lane = 0; lane < LANES; lane++) {
        var phase = (f + lane * 25) % 100;
        var x = WIRE_LEFT + (phase / 100) * WIRE_LEN;
        var y = WIRE_Y + (lane - 1.5) * LANE_SPACING;
        trailStores[lane].push('lane-' + lane, x, y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStores[lane].get('lane-' + lane),
          TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
        R.drawChip(ctx, x, y, TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);
      }

      // SFX: stream-chunk every ~20 frames
      if (signals && signals.onSFX && Math.floor(f / 20) !== lastEmit) {
        signals.onSFX('byte', { role: 'master', state: 'steady' });
        lastEmit = Math.floor(f / 20);
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · 4 simultaneous HTTP/2 streams · multiplexed', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastEmit = -1; trailStores.forEach(function (s) { s.reset(); }); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStores.forEach(function (s) { s.reset(); }); }
    function getNormalized() { return { effectiveThroughputBps: 1e9, endToEndLatencyMs: 5, frameOverheadBytes: 9, pendingInFlight: 4, isEncrypted: true, isAuthenticated: true, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.grpc = { _timbre: TIMBRE, init: init };
})();
