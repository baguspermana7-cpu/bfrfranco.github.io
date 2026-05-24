/* Network Hub — REST API (Lane E, Phase 5).
 * Appendix E row 22. Distinctive: envelope chip + header/body distinction +
 * visible gap between request and response.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sawtooth', freq: 1000, durationMs: 20 },
    ack:         { waveform: 'sine',     freq: 1500, durationMs: 60 },
    tick:        { waveform: 'square',   freq:  700, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1400, durationMs: 80 },
    tempoMultiplier: 1.0,
    registerCharacter: 'http-request-response',
    byteChip: { shape: 'envelope', sizePx: [12, 8], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'client-circle', slaveIcon: 'server-rack', tertiaryIcons: [] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'progressive',
    latencyClass:   'interactive',
    completeFreq:   1400,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -150 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;
  var REQ_FRAMES = 60, GAP_FRAMES = 30, RESP_HEAD_FRAMES = 30, RESP_BODY_FRAMES = 60;

  function decodeFrame(f, bodyBytes) {
    var totalF = REQ_FRAMES + GAP_FRAMES + RESP_HEAD_FRAMES + RESP_BODY_FRAMES + 40;
    var cf = f % totalF;
    if (cf < REQ_FRAMES) return { phase: 'request', byteIndex: 0, byteProgress: cf / REQ_FRAMES, role: 'master', isHeader: true, totalFrames: totalF };
    cf -= REQ_FRAMES;
    if (cf < GAP_FRAMES) return { phase: 'server-processing', byteIndex: -1, byteProgress: cf / GAP_FRAMES, role: 'master', isHeader: false, totalFrames: totalF };
    cf -= GAP_FRAMES;
    if (cf < RESP_HEAD_FRAMES) return { phase: 'response-header', byteIndex: 0, byteProgress: cf / RESP_HEAD_FRAMES, role: 'slave', isHeader: true, totalFrames: totalF };
    cf -= RESP_HEAD_FRAMES;
    if (cf < RESP_BODY_FRAMES) return { phase: 'response-body', byteIndex: 1, byteProgress: cf / RESP_BODY_FRAMES, role: 'slave', isHeader: false, totalFrames: totalF };
    return { phase: 'idle', byteIndex: -1, byteProgress: 0, role: 'master', isHeader: false, totalFrames: totalF };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'request') return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    if (decoded.phase === 'response-header' || decoded.phase === 'response-body') return { x: WIRE_RIGHT - decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return null;
  }

  function init(canvas, params, signals) {
    var _params = Object.assign({ bodyBytes: 256, headerBytes: 350 }, params || {});
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastPhase = '';
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'CLIENT');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'SERVER');

      var decoded = decodeFrame(f, _params.bodyBytes);
      var pos = bytePosition(decoded);
      if (pos) {
        var size = decoded.isHeader ? [10, 8] : [16, 8];
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), 'envelope', size, TIMBRE.byteChip.color);
        R.drawChip(ctx, pos.x, pos.y, 'envelope', size, TIMBRE.byteChip.color, 1.0);
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(decoded.isHeader ? 'header' : 'body', pos.x, pos.y - 16);
        ctx.restore();
      } else if (decoded.phase === 'server-processing') {
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('· server processing ·', (WIRE_LEFT + WIRE_RIGHT) / 2, WIRE_Y - 18);
        ctx.restore();
        trailStore.reset();
      }

      if (signals && signals.onSFX && decoded.phase !== lastPhase) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastPhase = decoded.phase;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · ' + decoded.phase + ' · header ' + _params.headerBytes + ' B · body ' + _params.bodyBytes + ' B', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastPhase = ''; trailStore.reset(); render(frame); }
    function setParams(next) { _params = Object.assign({}, _params, next || {}); render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() {
      return { effectiveThroughputBps: (100e6 / 8) * (_params.bodyBytes / (_params.bodyBytes + _params.headerBytes)),
               endToEndLatencyMs: 80, frameOverheadBytes: _params.headerBytes, pendingInFlight: 0,
               isEncrypted: true, isAuthenticated: false, errorCount: 0 };
    }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.restApi = { _timbre: TIMBRE, init: init };
})();
