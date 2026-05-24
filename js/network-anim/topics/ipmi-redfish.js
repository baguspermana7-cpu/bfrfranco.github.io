/* Network Hub — IPMI / Redfish (Lane C, Phase 6).
 * Appendix E row 16. Distinctive: out-of-band management — sideband-dashed wire
 * style (NOT amber chip — palette discipline).
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine',     freq: 1000, durationMs: 20 },
    ack:         { waveform: 'sine',     freq: 1500, durationMs: 60 },
    tick:        { waveform: 'square',   freq:  700, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1400, durationMs: 80 },
    tempoMultiplier: 0.7,
    registerCharacter: 'out-of-band-management',
    byteChip: { shape: 'rect',             sizePx: [12, 6], color: 'instrument-cyan' },
    wire:     { style: 'sideband-dashed',  widthPx: 1.0 },
    node:     { masterIcon: 'bmc-square', slaveIcon: 'server-rack', tertiaryIcons: [] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'progressive',
    latencyClass:   'batch',
    completeFreq:   1400,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -150 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y_DATA = 280, WIRE_Y_OOB = 150;
  var WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;
  var REQ_FRAMES = 50, GAP_FRAMES = 20, RESP_FRAMES = 50;

  function decodeFrame(f) {
    var totalF = REQ_FRAMES + GAP_FRAMES + RESP_FRAMES + 40;
    var cf = f % totalF;
    if (cf < REQ_FRAMES) return { phase: 'mgmt-request', byteIndex: 0, byteProgress: cf / REQ_FRAMES, role: 'master', totalFrames: totalF };
    cf -= REQ_FRAMES;
    if (cf < GAP_FRAMES) return { phase: 'bmc-processing', byteIndex: -1, byteProgress: cf / GAP_FRAMES, role: 'master', totalFrames: totalF };
    cf -= GAP_FRAMES;
    if (cf < RESP_FRAMES) return { phase: 'mgmt-response', byteIndex: 1, byteProgress: cf / RESP_FRAMES, role: 'slave', totalFrames: totalF };
    return { phase: 'idle', byteIndex: -1, byteProgress: 0, role: 'master', totalFrames: totalF };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'mgmt-request') return { x: WIRE_LEFT + decoded.byteProgress * WIRE_LEN, y: WIRE_Y_OOB };
    if (decoded.phase === 'mgmt-response') return { x: WIRE_RIGHT - decoded.byteProgress * WIRE_LEN, y: WIRE_Y_OOB };
    return null;
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastPhase = '';
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      // Data wire (in-band, normal Ethernet — drawn but not used by OOB)
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y_DATA, WIRE_RIGHT, WIRE_Y_DATA, 'ethernet', 1.0);
      // OOB sideband wire — distinctive trait (dashed)
      R.drawWire(ctx, WIRE_LEFT, WIRE_Y_OOB, WIRE_RIGHT, WIRE_Y_OOB, TIMBRE.wire.style, TIMBRE.wire.widthPx);

      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y_OOB, TIMBRE.node.masterIcon, 'MGMT');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y_OOB, TIMBRE.node.slaveIcon, 'BMC');
      // Tertiary: in-band data path label
      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('· in-band data path (irrelevant) ·', (WIRE_LEFT + WIRE_RIGHT) / 2, WIRE_Y_DATA + 18);
      ctx.fillText('· out-of-band management (sideband) ·', (WIRE_LEFT + WIRE_RIGHT) / 2, WIRE_Y_OOB + 18);
      ctx.restore();

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      if (pos) {
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
        R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);
      }

      if (signals && signals.onSFX && decoded.phase !== lastPhase) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastPhase = decoded.phase;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · ' + decoded.phase + ' · OOB sideband (data plane independent)', 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastPhase = ''; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: 1e6, endToEndLatencyMs: 200, frameOverheadBytes: 128, pendingInFlight: 0, isEncrypted: true, isAuthenticated: true, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.ipmiRedfish = { _timbre: TIMBRE, init: init };
})();
