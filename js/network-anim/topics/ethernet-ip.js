/* Network Visualization Hub — EtherNet/IP (CIP over Ethernet) topic (Phase 2).
 *
 * Appendix E row 8. Distinctive trait: CIP layer indicated by a colored
 * marker stripe at the chip head (NOT inline text — text on an 8 px
 * chip is unreadable).
 *
 * Timbre per audit (max pairwise share = 2):
 *   waveform: sawtooth (unique in Lane B)
 *   chip:     envelope 10×8 (unique)
 *   wire:     ethernet 1.0 px (shared)
 *   master:   master-rectangle (shares with EtherCAT)
 *   tempo:    fast 1.4× (shared)
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sawtooth', freq: 1500, durationMs:  9 },
    ack:         { waveform: 'sine',     freq: 2000, durationMs: 50 },
    tick:        { waveform: 'square',   freq: 1100, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1800, durationMs: 80 },
    tempoMultiplier: 1.4,
    registerCharacter: 'cip-over-ethernet',

    byteChip: { shape: 'envelope', sizePx: [10, 8], color: 'instrument-cyan' },
    wire:     { style: 'ethernet', widthPx: 1.0 },
    node:     { masterIcon: 'master-rectangle', slaveIcon: 'adapter-circle', tertiaryIcons: [] },

    errorSignature: 'collision-stop',
    encryption:     'none',
    latencyClass:   'interactive',
    completeFreq:   1800,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],

    perRole: { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -200 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var FPB = 8;
  var REQUEST_BYTES  = 14;   // CIP Connection + Service Request
  var RESPONSE_BYTES = 16;
  var TURNAROUND_FRAMES = 14;
  var WIRE_LEFT_X = 100, WIRE_RIGHT_X = 700, WIRE_Y = 200;
  var WIRE_LEN = WIRE_RIGHT_X - WIRE_LEFT_X;
  // 4 CIP layer types — chip-head marker stripe colour rotates by byte index modulo 4
  var CIP_LAYER_LABELS = ['ENIP', 'CPF', 'CIP-Conn', 'CIP-Svc'];

  function decodeFrame(f, payloadBytes) {
    var reqF  = REQUEST_BYTES * FPB;
    var respBytes = RESPONSE_BYTES + payloadBytes;
    var respF = respBytes * FPB;
    var ackF = 50;
    var cycleF = reqF + TURNAROUND_FRAMES + respF + ackF;
    var cf = f % cycleF;
    if (cf < reqF) {
      var bi = Math.floor(cf / FPB);
      return { phase: 'request', byteIndex: bi, byteProgress: (cf % FPB) / FPB,
               role: 'master', cipLayer: bi % 4, totalFrames: cycleF };
    }
    cf -= reqF;
    if (cf < TURNAROUND_FRAMES)
      return { phase: 'turnaround', byteIndex: -1, byteProgress: cf / TURNAROUND_FRAMES,
               role: 'master', cipLayer: 0, totalFrames: cycleF };
    cf -= TURNAROUND_FRAMES;
    if (cf < respF) {
      var bi2 = Math.floor(cf / FPB);
      return { phase: 'response', byteIndex: bi2, byteProgress: (cf % FPB) / FPB,
               role: 'slave', cipLayer: bi2 % 4, totalFrames: cycleF };
    }
    cf -= respF;
    return { phase: 'ack', byteIndex: -1, byteProgress: cf / ackF,
             role: 'master', cipLayer: 0, totalFrames: cycleF };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'request')
      return { x: WIRE_LEFT_X + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    if (decoded.phase === 'response')
      return { x: WIRE_RIGHT_X - decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return null;
  }

  function init(canvas, params, signals) {
    var _params = Object.assign({ payloadBytes: 8, connectionType: 'class-1', lineNoise: 0 }, params || {});
    var ctx = canvas.getContext('2d');
    var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastByteIdx = -1, lastPhase = '';
    var ackStore = window.RZNetAnim.vfx.createACKStore();
    var trailStore = window.RZNetAnim.vfx.createTrailStore();
    var ackFiredThisCycle = false;

    function render(f) {
      var R = window.RZNetAnim.renderer;
      R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT_X - 30,  WIRE_Y, TIMBRE.node.masterIcon, 'SCANNER');
      R.drawNode(ctx, WIRE_RIGHT_X + 30, WIRE_Y, TIMBRE.node.slaveIcon,  'ADAPTER');

      var decoded = decodeFrame(f, _params.payloadBytes);
      var pos = bytePosition(decoded);

      if (pos) {
        var alpha = (decoded.role === 'slave') ? 0.85 : 1.0;
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role),
          TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
        R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape,
                   TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, alpha);

        // CIP layer marker stripe — small coloured tick to the right of the chip
        var stripeColours = ['oscilloscope-green', 'signal-amber', 'instrument-cyan', 'fault-red'];
        ctx.save();
        ctx.strokeStyle = window.RZNetAnim.palette.color(stripeColours[decoded.cipLayer]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(Math.round(pos.x) + 6, Math.round(pos.y) - 3);
        ctx.lineTo(Math.round(pos.x) + 6, Math.round(pos.y) + 3);
        ctx.stroke();
        ctx.restore();

        if (decoded.byteIndex === 0 && decoded.role === 'master') {
          ctx.save();
          ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('CIP layer marker stripes', pos.x, pos.y - 16);
          ctx.restore();
        }

        if (signals && signals.onSFX && (decoded.byteIndex !== lastByteIdx || decoded.phase !== lastPhase)) {
          signals.onSFX('byte', { role: decoded.role, state: 'steady' });
          lastByteIdx = decoded.byteIndex; lastPhase = decoded.phase;
        }
        if (decoded.phase !== 'ack') ackFiredThisCycle = false;
      } else if (decoded.phase === 'turnaround') {
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('· ' + _params.connectionType + ' connection ·', (WIRE_LEFT_X + WIRE_RIGHT_X) / 2, WIRE_Y - 18);
        ctx.restore();
        trailStore.reset();
      } else if (decoded.phase === 'ack' && !ackFiredThisCycle) {
        ackStore.trigger('master', performance.now());
        if (signals && signals.onSFX) signals.onSFX('ack', { role: 'master', state: 'steady' });
        ackFiredThisCycle = true;
      }

      var ackProg = ackStore.tick('master', performance.now());
      if (ackProg >= 0) R.drawACKRing(ctx, WIRE_LEFT_X - 30, WIRE_Y, ackProg);

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · phase: ' + decoded.phase +
                   (decoded.byteIndex >= 0 ? ' · CIP layer: ' + CIP_LAYER_LABELS[decoded.cipLayer] : ''),
                   10, 20);
      ctx.restore();
    }

    function tick(ts) {
      if (!running) return;
      if (!startTs) startTs = ts;
      frame = Math.floor((ts - startTs) / (1000 / 60));
      render(frame);
      rafId = window.requestAnimationFrame(tick);
    }

    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastByteIdx = -1; lastPhase = ''; ackFiredThisCycle = false; ackStore.reset(); trailStore.reset(); render(frame); }
    function setParams(next) { _params = Object.assign({}, _params, next || {}); render(frame); }
    function destroy() { pause(); ackStore.reset(); trailStore.reset(); }

    function getNormalized() {
      var noiseFactor = 1 - (_params.lineNoise / 100);
      var headerBytes = 14;
      return {
        effectiveThroughputBps: (100e6 / 8) * noiseFactor * (_params.payloadBytes / (_params.payloadBytes + headerBytes)),
        endToEndLatencyMs:      _params.connectionType === 'class-1' ? 1 : 5,
        frameOverheadBytes:     headerBytes,
        pendingInFlight:        0,
        isEncrypted:            false,
        isAuthenticated:        false,
        errorCount:             0
      };
    }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams,
             getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE,
             _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.ethernetIp = { _timbre: TIMBRE, init: init };
})();
