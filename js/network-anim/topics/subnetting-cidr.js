/* Network Hub — Subnetting / CIDR (Lane A, Phase 3).
 * Appendix E row 12. Distinctive: subnet boundary line on wire = CIDR prefix.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'square',   freq: 1000, durationMs:  8 },
    ack:         { waveform: 'sine',     freq: 1500, durationMs: 50 },
    tick:        { waveform: 'square',   freq:  600, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1400, durationMs: 80 },
    tempoMultiplier: 1.0,
    registerCharacter: 'subnet-boundary-visualisation',
    byteChip: { shape: 'square',   sizePx: [8, 8], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'endpoint-circle', slaveIcon: 'endpoint-circle', tertiaryIcons: [] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'none',
    latencyClass:   'interactive',
    completeFreq:   1400,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -150 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;

  function decodeFrame(f, prefixLen) {
    prefixLen = prefixLen || 24;
    var cycleF = 120;
    var cf = f % cycleF;
    return { phase: 'host-traffic', byteIndex: 0, byteProgress: cf / cycleF, role: 'master',
             prefixLen: prefixLen, totalFrames: cycleF };
  }

  function bytePosition(decoded) {
    return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
  }

  function init(canvas, params, signals) {
    var _params = Object.assign({ prefixLen: 24 }, params || {});
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastByteIdx = -1;
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      // Subnet boundary line — vertical, position = (prefixLen/32) * wire length
      var boundaryX = WIRE_LEFT + ((_params.prefixLen / 32) * WIRE_LEN);
      ctx.save();
      ctx.strokeStyle = window.RZNetAnim.palette.color('signal-amber');
      ctx.lineWidth = 1.0; ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(Math.round(boundaryX) + 0.5, WIRE_Y - 30);
      ctx.lineTo(Math.round(boundaryX) + 0.5, WIRE_Y + 30);
      ctx.stroke();
      ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('/' + _params.prefixLen + ' boundary', boundaryX, WIRE_Y - 38);
      ctx.fillText('← network bits  |  host bits →', boundaryX, WIRE_Y + 48);
      ctx.restore();

      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'HOST A');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'HOST B');

      var decoded = decodeFrame(f, _params.prefixLen);
      var pos = bytePosition(decoded);
      trailStore.push(decoded.role, pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
      R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);

      if (signals && signals.onSFX && Math.floor(decoded.byteProgress * 12) !== lastByteIdx) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastByteIdx = Math.floor(decoded.byteProgress * 12);
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · /' + _params.prefixLen + ' · hosts = 2^(' + (32 - _params.prefixLen) + ') − 2 = ' + (Math.pow(2, 32 - _params.prefixLen) - 2), 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastByteIdx = -1; trailStore.reset(); render(frame); }
    function setParams(next) { _params = Object.assign({}, _params, next || {}); render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: null, endToEndLatencyMs: null, frameOverheadBytes: null, pendingInFlight: 0, isEncrypted: false, isAuthenticated: false, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.subnettingCidr = { _timbre: TIMBRE, init: init };
})();
