/* Network Hub — TCP handshake (Lane A, Phase 3).
 * Appendix E row 13. Distinctive: SYN / SYN-ACK / ACK as 3 distinct chip shapes.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine-sweep', freqStart: 800, freqEnd: 1200, durationMs: 18 },
    ack:         { waveform: 'sine',       freq: 1600, durationMs: 60 },
    tick:        { waveform: 'square',     freq:  600, durationMs:  6 },
    handshake:   { freqSteps: [800, 1000, 1200], stepDurationMs: 40 },
    errorSfx:    { waveform: 'sawtooth',   freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',       freq: 1500, durationMs: 80 },
    tempoMultiplier: 1.2,
    registerCharacter: 'three-way-ceremony',
    byteChip: { shape: 'triangle', sizePx: [10, 10], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'client-circle', slaveIcon: 'server-rack', tertiaryIcons: [] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'none',
    latencyClass:   'interactive',
    completeFreq:   1500,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -200 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;
  var PHASE_FRAMES = 50;

  function decodeFrame(f) {
    var totalF = PHASE_FRAMES * 3;
    var cf = f % totalF;
    var stage = Math.floor(cf / PHASE_FRAMES);
    var stagePhases = ['SYN', 'SYN-ACK', 'ACK'];
    var role = stage === 1 ? 'slave' : 'master';
    return { phase: stagePhases[stage], byteIndex: stage, byteProgress: (cf % PHASE_FRAMES) / PHASE_FRAMES,
             role: role, totalFrames: totalF };
  }

  function bytePosition(decoded) {
    if (decoded.role === 'master')
      return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return { x: WIRE_RIGHT - decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastStage = -1;
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'CLIENT');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'SERVER');

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      // 3 distinct chip shapes — distinctive trait
      var shapes = { 'SYN': 'triangle', 'SYN-ACK': 'hex', 'ACK': 'square' };
      var sizes  = { 'SYN': [10, 10], 'SYN-ACK': [12, 10], 'ACK': [8, 8] };
      var shape = shapes[decoded.phase];
      var size  = sizes[decoded.phase];
      trailStore.push(decoded.phase, pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.phase), shape, size, TIMBRE.byteChip.color);
      R.drawChip(ctx, pos.x, pos.y, shape, size, TIMBRE.byteChip.color, 1.0);

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(decoded.phase, pos.x, pos.y - 16);
      ctx.restore();

      if (signals && signals.onSFX && decoded.byteIndex !== lastStage) {
        signals.onSFX('byte', { role: decoded.role, state: 'handshake' });
        lastStage = decoded.byteIndex;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · stage: ' + decoded.phase + ' · ' + (decoded.role === 'master' ? 'client→server' : 'server→client'), 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastStage = -1; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: 0, endToEndLatencyMs: 1.5, frameOverheadBytes: 40, pendingInFlight: 0, isEncrypted: false, isAuthenticated: false, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.tcpHandshake = { _timbre: TIMBRE, init: init };
})();
