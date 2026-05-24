/* Network Hub — TLS handshake (Lane D, Phase 4).
 * Appendix E row 18. Distinctive: scan-line shroud builds progressively across handshake.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine-sweep', freqStart: 800, freqEnd: 1400, durationMs: 18 },
    ack:         { waveform: 'sine',       freq: 1800, durationMs: 70 },
    tick:        { waveform: 'square',     freq:  600, durationMs:  6 },
    handshake:   { freqSteps: [800, 1000, 1200, 1400], stepDurationMs: 35 },
    errorSfx:    { waveform: 'sawtooth',   freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',       freq: 1500, durationMs: 80 },
    tempoMultiplier: 0.7,
    registerCharacter: 'cryptographic-ceremony',
    byteChip: { shape: 'triangle',      sizePx: [10, 10], color: 'instrument-cyan' },
    wire:     { style: 'crypto-shroud', widthPx: 1.0 },
    node:     { masterIcon: 'client-circle', slaveIcon: 'server-rack', tertiaryIcons: ['ca-diamond'] },
    errorSignature: 'cert-mismatch-shroud-breaks',
    encryption:     'progressive',
    latencyClass:   'interactive',
    completeFreq:   1500,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -200 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;
  var STAGES = ['ClientHello', 'ServerHello+Cert', 'KeyExchange', 'Finished'];
  var FPS = 60;

  function decodeFrame(f) {
    var cycleF = STAGES.length * FPS + 90;
    var cf = f % cycleF;
    if (cf < STAGES.length * FPS) {
      var s = Math.floor(cf / FPS);
      return { phase: STAGES[s], byteIndex: s, byteProgress: (cf % FPS) / FPS,
               role: s % 2 === 0 ? 'master' : 'slave', shroudLevel: (s + 1) / STAGES.length, totalFrames: cycleF };
    }
    return { phase: 'application', byteIndex: -1, byteProgress: (cf - STAGES.length * FPS) / 90,
             role: 'master', shroudLevel: 1.0, totalFrames: cycleF };
  }

  function bytePosition(decoded) {
    if (decoded.role === 'master')
      return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return { x: WIRE_RIGHT - decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastStage = -2;
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y, 'ethernet', TIMBRE.wire.widthPx);

      var decoded = decodeFrame(f);
      // Progressive shroud — distinctive trait
      var shroudEnd = WIRE_LEFT + decoded.shroudLevel * WIRE_LEN;
      if (decoded.shroudLevel > 0.05) {
        R.drawScanlineShroud(ctx, WIRE_LEFT, WIRE_Y, shroudEnd, WIRE_Y);
      }

      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'CLIENT');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'SERVER');
      R.drawNode(ctx, (WIRE_LEFT + WIRE_RIGHT) / 2, WIRE_Y - 80, 'ca-diamond', 'CA');

      var pos = bytePosition(decoded);
      if (decoded.phase !== 'application') {
        var shape = decoded.byteIndex < 2 ? 'triangle' : 'token';
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), shape, [10, 10], TIMBRE.byteChip.color);
        R.drawChip(ctx, pos.x, pos.y, shape, [10, 10], TIMBRE.byteChip.color, 1.0);
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(decoded.phase, pos.x, pos.y - 16);
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('oscilloscope-green');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('· encrypted application data ·', (WIRE_LEFT + WIRE_RIGHT) / 2, WIRE_Y - 18);
        ctx.restore();
      }

      if (signals && signals.onSFX && decoded.byteIndex !== lastStage) {
        signals.onSFX(decoded.phase === 'application' ? 'complete' : 'handshake', { role: decoded.role, state: 'handshake' });
        lastStage = decoded.byteIndex;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · stage: ' + decoded.phase + ' · shroud ' + Math.round(decoded.shroudLevel * 100) + '%', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastStage = -2; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: null, endToEndLatencyMs: 100, frameOverheadBytes: 256, pendingInFlight: 0, isEncrypted: true, isAuthenticated: true, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.tlsHandshake = { _timbre: TIMBRE, init: init };
})();
