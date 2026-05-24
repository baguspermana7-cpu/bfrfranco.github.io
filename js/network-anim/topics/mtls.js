/* Network Hub — mTLS (Lane D, Phase 4).
 * Appendix E row 20. Distinctive: bilateral TLS — handshake echoes both ways,
 * both nodes cert-badged.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'square-sweep', freqStart: 900, freqEnd: 1500, durationMs: 18 },
    ack:         { waveform: 'sine',         freq: 1700, durationMs: 70 },
    tick:        { waveform: 'square',       freq:  600, durationMs:  6 },
    handshake:   { freqSteps: [900, 1100, 1300, 1500], stepDurationMs: 35 },
    errorSfx:    { waveform: 'sawtooth',     freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',         freq: 1500, durationMs: 80 },
    tempoMultiplier: 1.0,
    registerCharacter: 'bilateral-tls-ceremony',
    byteChip: { shape: 'triangle',      sizePx: [10, 10], color: 'instrument-cyan' },
    wire:     { style: 'crypto-shroud', widthPx: 1.0 },
    node:     { masterIcon: 'server-rack', slaveIcon: 'server-rack', tertiaryIcons: [] },
    errorSignature: 'cert-mismatch-shroud-breaks',
    encryption:     'bilateral',
    latencyClass:   'interactive',
    completeFreq:   1500,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -200 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var STAGES = [
    { label: 'ClientHello+ClientCert', role: 'master' },
    { label: 'ServerHello+ServerCert', role: 'slave' },
    { label: 'CertVerify (client)',    role: 'master' },
    { label: 'CertVerify (server)',    role: 'slave' },
    { label: 'Finished (mutual)',      role: 'master' }
  ];
  var FPS = 50;
  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;

  function decodeFrame(f) {
    var cycleF = STAGES.length * FPS + 60;
    var cf = f % cycleF;
    if (cf < STAGES.length * FPS) {
      var s = Math.floor(cf / FPS);
      return { phase: STAGES[s].label, byteIndex: s, byteProgress: (cf % FPS) / FPS, role: STAGES[s].role, totalFrames: cycleF };
    }
    return { phase: 'mutual-tunnel', byteIndex: -1, byteProgress: (cf - STAGES.length * FPS) / 60, role: 'master', totalFrames: cycleF };
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
      R.drawScanlineShroud(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y);
      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'CLIENT⊕CERT');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'SERVER⊕CERT');

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      if (decoded.phase !== 'mutual-tunnel') {
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), 'triangle', [10, 10], TIMBRE.byteChip.color);
        R.drawChip(ctx, pos.x, pos.y, 'triangle', [10, 10], TIMBRE.byteChip.color, 1.0);
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
        ctx.fillText('· mutual-authenticated tunnel ·', (WIRE_LEFT + WIRE_RIGHT) / 2, WIRE_Y - 18);
        ctx.restore();
      }

      if (signals && signals.onSFX && decoded.byteIndex !== lastStage) {
        signals.onSFX('handshake', { role: decoded.role, state: 'handshake' });
        lastStage = decoded.byteIndex;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · ' + decoded.phase, 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastStage = -2; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: null, endToEndLatencyMs: 150, frameOverheadBytes: 512, pendingInFlight: 0, isEncrypted: true, isAuthenticated: true, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.mtls = { _timbre: TIMBRE, init: init };
})();
