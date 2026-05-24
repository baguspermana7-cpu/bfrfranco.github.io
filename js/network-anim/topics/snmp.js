/* Network Hub — SNMP (Lane C, Phase 6).
 * Appendix E row 15. Distinctive: polling cadence visible as metronome on wire.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'square',   freq: 1200, durationMs: 12 },
    ack:         { waveform: 'sine',     freq: 1500, durationMs: 50 },
    tick:        { waveform: 'square',   freq:  700, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1400, durationMs: 80 },
    tempoMultiplier: 0.7,
    registerCharacter: 'polled-monitoring-metronome',
    byteChip: { shape: 'square',   sizePx: [6, 6], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'server-rack', slaveIcon: 'sensor-circle', tertiaryIcons: [] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'none',
    latencyClass:   'batch',
    completeFreq:   1400,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -150 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;
  var POLL_FRAMES = 30, RESP_FRAMES = 30, IDLE_FRAMES = 60;  // metronome cycle

  function decodeFrame(f) {
    var totalF = POLL_FRAMES + RESP_FRAMES + IDLE_FRAMES;
    var cf = f % totalF;
    if (cf < POLL_FRAMES) return { phase: 'poll', byteIndex: 0, byteProgress: cf / POLL_FRAMES, role: 'master', totalFrames: totalF };
    cf -= POLL_FRAMES;
    if (cf < RESP_FRAMES) return { phase: 'response', byteIndex: 1, byteProgress: cf / RESP_FRAMES, role: 'slave', totalFrames: totalF };
    return { phase: 'idle', byteIndex: -1, byteProgress: (cf - RESP_FRAMES) / IDLE_FRAMES, role: 'master', totalFrames: totalF };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'poll') return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    if (decoded.phase === 'response') return { x: WIRE_RIGHT - decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return null;
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastPhase = '';
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'NMS');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'AGENT');

      // Metronome dots — distinctive trait
      var dotCount = 5;
      for (var i = 0; i < dotCount; i++) {
        var dotX = WIRE_LEFT + ((i + 1) / (dotCount + 1)) * WIRE_LEN;
        var active = (f % 120) < 6;
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color(active ? 'signal-amber' : 'wire-default');
        ctx.beginPath();
        ctx.arc(dotX, WIRE_Y - 14, active ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      if (pos) {
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
        R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);
      }

      if (signals && signals.onSFX && decoded.phase !== lastPhase) {
        signals.onSFX(decoded.phase === 'idle' ? 'tick' : 'byte', { role: decoded.role, state: 'steady' });
        lastPhase = decoded.phase;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · ' + decoded.phase + ' · 2 s polling interval', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastPhase = ''; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: 500, endToEndLatencyMs: 2000, frameOverheadBytes: 60, pendingInFlight: 0, isEncrypted: false, isAuthenticated: false, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.snmp = { _timbre: TIMBRE, init: init };
})();
