/* Network Hub — OSI / TCP-IP models (Lane A, Phase 3).
 * Appendix E row 10. Distinctive: byte chip ascends layer stack vertically.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine',     freq: 1000, durationMs: 15 },
    ack:         { waveform: 'sine',     freq: 1500, durationMs: 80 },
    tick:        { waveform: 'square',   freq:  500, durationMs:  8 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1400, durationMs: 100 },
    tempoMultiplier: 0.7,
    registerCharacter: 'didactic-conceptual',
    byteChip: { shape: 'layered',  sizePx: [12, 10], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'server-rack', slaveIcon: 'server-rack', tertiaryIcons: [] },
    errorSignature: 'frame-loss-trail-cut',
    encryption:     'none',
    latencyClass:   'human-paced',
    completeFreq:   1400,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -100 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  // 7 OSI layers (Physical → Application). Byte chip ascends across them.
  var LAYERS = ['Physical', 'Data Link', 'Network', 'Transport', 'Session', 'Presentation', 'Application'];
  var FPL = 30;     // frames per layer
  var WIRE_X_LEFT = 200, WIRE_X_RIGHT = 600, BASE_Y = 320;

  function decodeFrame(f) {
    var totalF = LAYERS.length * FPL * 2;       // ascend then descend
    var cf = f % totalF;
    var ascending = cf < LAYERS.length * FPL;
    var layerIdx = ascending ? Math.floor(cf / FPL) : (LAYERS.length - 1 - Math.floor((cf - LAYERS.length * FPL) / FPL));
    return { phase: ascending ? 'encode' : 'decode', byteIndex: layerIdx, byteProgress: (cf % FPL) / FPL,
             role: ascending ? 'master' : 'slave', totalFrames: totalF, layer: LAYERS[layerIdx] };
  }

  function bytePosition(decoded) {
    var y = BASE_Y - decoded.byteIndex * 36 - decoded.byteProgress * 36;
    var x = decoded.phase === 'encode' ? WIRE_X_LEFT : WIRE_X_RIGHT;
    return { x: x, y: Math.max(60, y) };
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastByteIdx = -1, lastPhase = '';
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      // Draw 7 layer rectangles vertically
      for (var i = 0; i < LAYERS.length; i++) {
        var ly = BASE_Y - i * 36;
        ctx.save();
        ctx.strokeStyle = window.RZNetAnim.palette.color('wire-default');
        ctx.lineWidth = 0.6;
        ctx.strokeRect(160 + 0.5, ly - 14 + 0.5, 480, 28);
        ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText('L' + (i + 1) + ' · ' + LAYERS[i], 155, ly + 4);
        ctx.restore();
      }
      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      trailStore.push(decoded.role, pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role),
        TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
      R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape,
                 TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);
      if (signals && signals.onSFX && (decoded.byteIndex !== lastByteIdx || decoded.phase !== lastPhase)) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastByteIdx = decoded.byteIndex; lastPhase = decoded.phase;
      }
      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · ' + decoded.phase + ' · L' + (decoded.byteIndex + 1) + ' ' + decoded.layer, 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastByteIdx = -1; lastPhase = ''; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: null, endToEndLatencyMs: null, frameOverheadBytes: null, pendingInFlight: 0, isEncrypted: false, isAuthenticated: false, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.osiTcpIpModels = { _timbre: TIMBRE, init: init };
})();
