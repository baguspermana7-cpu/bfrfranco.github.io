/* Network Hub — GraphQL (Lane E, Phase 5).
 * Appendix E row 23. Distinctive: one outbound long-rect query + multiple inbound
 * field chips (capped 3 distinct shape classes per response).
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine',     freq: 1200, durationMs: 22 },
    ack:         { waveform: 'sine',     freq: 1600, durationMs: 60 },
    tick:        { waveform: 'square',   freq:  800, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1400, durationMs: 80 },
    tempoMultiplier: 1.0,
    registerCharacter: 'single-declarative-query',
    byteChip: { shape: 'long-rect', sizePx: [12, 6], color: 'instrument-cyan' },
    wire:     { style: 'ethernet',  widthPx: 1.0 },
    node:     { masterIcon: 'broker-diamond', slaveIcon: 'server-rack', tertiaryIcons: ['resource-diamond'] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'progressive',
    latencyClass:   'interactive',
    completeFreq:   1400,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -150 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;
  var QUERY_FRAMES = 60, RESP_FRAMES = 90;

  function decodeFrame(f) {
    var totalF = QUERY_FRAMES + RESP_FRAMES + 30;
    var cf = f % totalF;
    if (cf < QUERY_FRAMES) return { phase: 'query', byteIndex: 0, byteProgress: cf / QUERY_FRAMES, role: 'master', shape: 'long-rect', totalFrames: totalF };
    cf -= QUERY_FRAMES;
    if (cf < RESP_FRAMES) {
      // Multiple field chips with 3 shape classes
      var fieldIdx = Math.floor(cf / 15);
      var shapes = ['square', 'rect', 'hex'];
      return { phase: 'response-field', byteIndex: fieldIdx, byteProgress: (cf % 15) / 15, role: 'slave',
               shape: shapes[fieldIdx % 3], totalFrames: totalF };
    }
    return { phase: 'idle', byteIndex: -1, byteProgress: 0, role: 'master', shape: 'square', totalFrames: totalF };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'query') return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    if (decoded.phase === 'response-field') return { x: WIRE_RIGHT - decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return null;
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastByteIdx = -1, lastPhase = '';
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'CLIENT');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'GRAPHQL');

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      if (pos) {
        var size = decoded.phase === 'query' ? [16, 6] : [8, 6];
        trailStore.push(decoded.phase, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.phase), decoded.shape, size, TIMBRE.byteChip.color);
        R.drawChip(ctx, pos.x, pos.y, decoded.shape, size, TIMBRE.byteChip.color, 1.0);
        if (decoded.phase === 'response-field') {
          ctx.save();
          ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('field ' + decoded.byteIndex, pos.x, pos.y - 14);
          ctx.restore();
        }
      }

      if (signals && signals.onSFX && (decoded.byteIndex !== lastByteIdx || decoded.phase !== lastPhase)) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastByteIdx = decoded.byteIndex; lastPhase = decoded.phase;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · ' + decoded.phase + ' · shape: ' + decoded.shape + ' (3-shape cap)', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastByteIdx = -1; lastPhase = ''; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: 1e7, endToEndLatencyMs: 120, frameOverheadBytes: 200, pendingInFlight: 0, isEncrypted: true, isAuthenticated: false, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.graphql = { _timbre: TIMBRE, init: init };
})();
