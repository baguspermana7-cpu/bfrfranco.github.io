/* Network Hub — DHCP / DNS (Lane A, Phase 3).
 * Appendix E row 14. Distinctive: 4-stage DORA monotonic ascending pitch.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'triangle', freq: 1000, durationMs: 15 },
    ack:         { waveform: 'sine',     freq: 1500, durationMs: 70 },
    tick:        { waveform: 'square',   freq:  600, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1500, durationMs: 80 },
    tempoMultiplier: 1.0,
    registerCharacter: 'discovery-resolution-broadcast',
    byteChip: { shape: 'envelope', sizePx: [10, 8], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'broadcast-fan', slaveIcon: 'server-rack', tertiaryIcons: ['client-circle'] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'none',
    latencyClass:   'human-paced',
    completeFreq:   1500,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -100 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  // DORA = Discover (broadcast) → Offer → Request (broadcast) → Ack
  var STAGES = [
    { label: 'DISCOVER', role: 'master', freq: 600 },
    { label: 'OFFER',    role: 'slave',  freq: 900 },
    { label: 'REQUEST',  role: 'master', freq: 1200 },
    { label: 'ACK',      role: 'slave',  freq: 1500 }
  ];
  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;
  var FPS = 50;  // frames per stage

  function decodeFrame(f) {
    var cycleF = STAGES.length * FPS + 60;  // 4 stages + idle
    var cf = f % cycleF;
    if (cf < STAGES.length * FPS) {
      var stage = Math.floor(cf / FPS);
      return { phase: STAGES[stage].label, byteIndex: stage, byteProgress: (cf % FPS) / FPS,
               role: STAGES[stage].role, totalFrames: cycleF };
    }
    return { phase: 'idle', byteIndex: -1, byteProgress: (cf - STAGES.length * FPS) / 60,
             role: 'master', totalFrames: cycleF };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'idle') return null;
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
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, TIMBRE.node.slaveIcon, 'DHCP/DNS');

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      if (pos) {
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
        R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(decoded.phase, pos.x, pos.y - 16);
        ctx.restore();
      } else if (decoded.phase === 'idle') {
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('· DORA complete · lease held ·', (WIRE_LEFT + WIRE_RIGHT) / 2, WIRE_Y - 18);
        ctx.restore();
        trailStore.reset();
      }

      if (signals && signals.onSFX && decoded.byteIndex >= 0 && decoded.byteIndex !== lastStage) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastStage = decoded.byteIndex;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · stage: ' + decoded.phase + ' · pitch ascending 600→900→1200→1500 Hz', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastStage = -1; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: null, endToEndLatencyMs: 50, frameOverheadBytes: 240, pendingInFlight: 0, isEncrypted: false, isAuthenticated: false, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.dhcpDns = { _timbre: TIMBRE, init: init };
})();
