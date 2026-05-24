/* Network Visualization Hub — DNP3 topic (Phase 2).
 *
 * Appendix E row 6. Distinctive trait: UNSOLICITED responses — slave
 * emits without master poll first. The animation cycles through a
 * normal poll-response, then a spontaneous unsolicited push.
 *
 * Timbre per audit (max pairwise share = 2):
 *   waveform: sine-sweep 600→900 Hz (shares with OPC-UA + BACnet MS/TP)
 *   chip:     rect 10×6 (shares with Modbus TCP)
 *   wire:     serial-thin 0.7 px (shares with Modbus RTU)
 *   master:   rtu-square (distinct)
 *   tempo:    medium 0.9× (shares with RTU, BACnet/IP, OPC-UA)
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine-sweep', freqStart: 600, freqEnd: 900, durationMs: 16 },
    ack:         { waveform: 'sine',       freq: 1500, durationMs: 60 },
    tick:        { waveform: 'square',     freq:  700, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth',   freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',       freq: 1400, durationMs: 80 },
    tempoMultiplier: 0.9,
    registerCharacter: 'telemetry-scada-deliberate',

    byteChip: { shape: 'rect',        sizePx: [10, 6], color: 'instrument-cyan' },
    wire:     { style: 'serial-thin', widthPx: 0.7 },
    node:     { masterIcon: 'rtu-square', slaveIcon: 'sensor-circle', tertiaryIcons: [] },

    errorSignature: 'crc-fail-bytes-corrupt',
    encryption:     'none',
    latencyClass:   'batch',
    completeFreq:   1400,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],

    perRole: {
      master: { byteFreqShift:    0 },
      slave:  { byteFreqShift: -150 }
    },
    perState: {
      handshake:    { tempoMultiplier: 0.7 },
      steady:       { tempoMultiplier: 1.0 },
      error:        { tempoMultiplier: 1.0 }
    }
  });

  var FPB = 14;
  var POLL_REQUEST_BYTES  = 7;
  var POLL_RESPONSE_BYTES = 12;
  var UNSOLICITED_BYTES   = 10;
  var TURNAROUND_FRAMES   = 30;
  var WIRE_LEFT_X  = 100, WIRE_RIGHT_X = 700, WIRE_Y = 200;
  var WIRE_LEN     = WIRE_RIGHT_X - WIRE_LEFT_X;

  function decodeFrame(f, includeUnsolicited) {
    var pollReqF  = POLL_REQUEST_BYTES * FPB;
    var pollRespF = POLL_RESPONSE_BYTES * FPB;
    var unsolF    = UNSOLICITED_BYTES * FPB;
    var ackF      = 50;
    // Cycle: poll-request → turnaround → poll-response → ackF →
    // (optional gap → unsolicited push)
    var gap = includeUnsolicited ? 60 : 0;
    var unsolPart = includeUnsolicited ? (gap + unsolF + ackF) : 0;
    var cycleF = pollReqF + TURNAROUND_FRAMES + pollRespF + ackF + unsolPart;
    var cf = f % cycleF;

    if (cf < pollReqF) {
      var bi = Math.floor(cf / FPB);
      return { phase: 'poll-request', byteIndex: bi, byteProgress: (cf % FPB) / FPB,
               role: 'master', totalFrames: cycleF };
    }
    cf -= pollReqF;
    if (cf < TURNAROUND_FRAMES)
      return { phase: 'turnaround', byteIndex: -1, byteProgress: cf / TURNAROUND_FRAMES,
               role: 'master', totalFrames: cycleF };
    cf -= TURNAROUND_FRAMES;
    if (cf < pollRespF) {
      var bi2 = Math.floor(cf / FPB);
      return { phase: 'poll-response', byteIndex: bi2, byteProgress: (cf % FPB) / FPB,
               role: 'slave', totalFrames: cycleF };
    }
    cf -= pollRespF;
    if (cf < ackF)
      return { phase: 'ack-poll', byteIndex: -1, byteProgress: cf / ackF,
               role: 'master', totalFrames: cycleF };
    cf -= ackF;
    if (!includeUnsolicited) return { phase: 'idle', byteIndex: -1, byteProgress: 0,
                                      role: 'master', totalFrames: cycleF };
    if (cf < gap)
      return { phase: 'gap', byteIndex: -1, byteProgress: cf / gap,
               role: 'slave', totalFrames: cycleF };
    cf -= gap;
    if (cf < unsolF) {
      var bi3 = Math.floor(cf / FPB);
      return { phase: 'unsolicited', byteIndex: bi3, byteProgress: (cf % FPB) / FPB,
               role: 'slave', totalFrames: cycleF };
    }
    cf -= unsolF;
    return { phase: 'ack-unsolicited', byteIndex: -1, byteProgress: cf / ackF,
             role: 'master', totalFrames: cycleF };
  }

  function bytePosition(decoded) {
    if (decoded.phase === 'poll-request')
      return { x: WIRE_LEFT_X + decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    if (decoded.phase === 'poll-response' || decoded.phase === 'unsolicited')
      return { x: WIRE_RIGHT_X - decoded.byteProgress * WIRE_LEN, y: WIRE_Y };
    return null;
  }

  function init(canvas, params, signals) {
    var _params = Object.assign({ enableUnsolicited: true, payloadBytes: 8, lineNoise: 0 }, params || {});
    var ctx = canvas.getContext('2d');
    var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastByteIdx = -1, lastPhase = '';
    var ackStore = window.RZNetAnim.vfx.createACKStore();
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer;
      R.clear(ctx);
      R.drawWire(ctx, WIRE_LEFT_X, WIRE_Y, WIRE_RIGHT_X, WIRE_Y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, WIRE_LEFT_X - 30,  WIRE_Y, TIMBRE.node.masterIcon, 'MASTER');
      R.drawNode(ctx, WIRE_RIGHT_X + 30, WIRE_Y, TIMBRE.node.slaveIcon,  'OUTSTATION');

      var decoded = decodeFrame(f, _params.enableUnsolicited);
      var pos = bytePosition(decoded);

      if (pos) {
        var alpha = (decoded.role === 'slave') ? 0.85 : 1.0;
        trailStore.push(decoded.role, pos.x, pos.y);
        window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role),
          TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
        R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape,
                   TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, alpha);

        // Highlight unsolicited bytes with amber underline (distinctive trait)
        if (decoded.phase === 'unsolicited') {
          ctx.save();
          ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('UNSOLICITED', pos.x, pos.y - 16);
          ctx.restore();
        }

        if (signals && signals.onSFX && (decoded.byteIndex !== lastByteIdx || decoded.phase !== lastPhase)) {
          signals.onSFX('byte', { role: decoded.role, state: 'steady' });
          lastByteIdx = decoded.byteIndex; lastPhase = decoded.phase;
        }
      } else if (decoded.phase === 'turnaround' || decoded.phase === 'gap') {
        ctx.save();
        ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(decoded.phase === 'gap' ? '· quiet · slave will push spontaneously ·' : '· turnaround ·',
                     (WIRE_LEFT_X + WIRE_RIGHT_X) / 2, WIRE_Y - 18);
        ctx.restore();
        trailStore.reset();
      } else if (decoded.phase === 'ack-poll' || decoded.phase === 'ack-unsolicited') {
        if (!ackStore.tick('master', performance.now()) && decoded.byteProgress < 0.1) {
          ackStore.trigger('master', performance.now());
          if (signals && signals.onSFX) signals.onSFX('ack', { role: 'master', state: 'steady' });
        }
      }

      var ackProg = ackStore.tick('master', performance.now());
      if (ackProg >= 0) R.drawACKRing(ctx, WIRE_LEFT_X - 30, WIRE_Y, ackProg);

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('wire-default');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · phase: ' + decoded.phase, 10, 20);
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
    function seek(t) { frame = t; lastByteIdx = -1; lastPhase = ''; ackStore.reset(); trailStore.reset(); render(frame); }
    function setParams(next) { _params = Object.assign({}, _params, next || {}); render(frame); }
    function destroy() { pause(); ackStore.reset(); trailStore.reset(); }

    function getNormalized() {
      var noiseFactor = 1 - (_params.lineNoise / 100);
      return {
        effectiveThroughputBps: (9600 / 10) * noiseFactor * (_params.payloadBytes / (_params.payloadBytes + 10)),
        endToEndLatencyMs:      ((_params.payloadBytes + 10) * 8 + 80) / 9600 * 1000,
        frameOverheadBytes:     10,
        pendingInFlight:        _params.enableUnsolicited ? 1 : 0,
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

  window.RZNetAnim.dnp3 = { _timbre: TIMBRE, init: init };
})();
