/* Network Hub — syslog (Lane C, Phase 6).
 * Appendix E row 17. Distinctive: long-rect chip (suggests text line) + one-way arrow,
 * append-only stream.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sawtooth', freq: 1100, durationMs: 16 },
    ack:         { waveform: 'sine',     freq: 1500, durationMs: 40 },
    tick:        { waveform: 'square',   freq:  800, durationMs:  6 },
    streamChunk: { freqStart:  50, durationMs: 30, pulseRateHz: 50 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1400, durationMs: 60 },
    tempoMultiplier: 1.1,
    registerCharacter: 'append-only-text-stream',
    byteChip: { shape: 'long-rect', sizePx: [12, 4], color: 'instrument-cyan' },
    wire:     { style: 'ethernet',  widthPx: 1.0 },
    node:     { masterIcon: 'server-rack', slaveIcon: 'server-rack', tertiaryIcons: [] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'none',
    latencyClass:   'batch',
    completeFreq:   1400,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -100 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;

  function decodeFrame(f) {
    // Continuous one-way stream — line chips at irregular intervals
    var lineSpacing = 35;   // frames per line
    return { phase: 'log-line', byteIndex: Math.floor(f / lineSpacing) % 100,
             byteProgress: (f % lineSpacing) / lineSpacing, role: 'master', totalFrames: lineSpacing * 100 };
  }

  function bytePosition(decoded) {
    return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastByteIdx = -1;
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'SOURCE');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'COLLECTOR');

      // One-way arrow above wire
      ctx.save();
      ctx.strokeStyle = window.RZNetAnim.palette.color('signal-amber');
      ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(WIRE_LEFT + 60, WIRE_Y - 26);
      ctx.lineTo(WIRE_LEFT + 130, WIRE_Y - 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(WIRE_LEFT + 130, WIRE_Y - 26);
      ctx.lineTo(WIRE_LEFT + 124, WIRE_Y - 29);
      ctx.lineTo(WIRE_LEFT + 124, WIRE_Y - 23);
      ctx.closePath();
      ctx.fill();
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('append-only →', WIRE_LEFT + 32, WIRE_Y - 22);
      ctx.restore();

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      trailStore.push(decoded.role, pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
      R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);

      if (signals && signals.onSFX && decoded.byteIndex !== lastByteIdx) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastByteIdx = decoded.byteIndex;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · log line #' + decoded.byteIndex + ' (one-way · UDP/514 or TCP/6514)', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastByteIdx = -1; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: 5e4, endToEndLatencyMs: 50, frameOverheadBytes: 40, pendingInFlight: 0, isEncrypted: false, isAuthenticated: false, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.syslog = { _timbre: TIMBRE, init: init };
})();
