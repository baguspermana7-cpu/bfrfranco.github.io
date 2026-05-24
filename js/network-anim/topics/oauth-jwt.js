/* Network Hub — OAuth 2.0 / JWT (Lane D, Phase 4).
 * Appendix E row 19. Distinctive: 4-actor dance + amber→cyan flow-stage tint on token issuance.
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine',     freq: 1200, durationMs: 15 },
    ack:         { waveform: 'sine',     freq: 1800, durationMs: 60 },
    tick:        { waveform: 'square',   freq:  700, durationMs:  6 },
    tokenIssue:  { waveform: 'sine',     freq: 2400, durationMs: 100 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1900, durationMs: 80 },
    tempoMultiplier: 1.0,
    registerCharacter: 'redirect-and-token-ceremony',
    byteChip: { shape: 'token',         sizePx: [12, 8], color: 'signal-amber' },
    wire:     { style: 'ethernet',      widthPx: 1.0 },
    node:     { masterIcon: 'client-circle', slaveIcon: 'as-diamond', tertiaryIcons: ['server-rack', 'as-diamond'] },
    errorSignature: 'token-rejected-amber-flash',
    encryption:     'always',
    latencyClass:   'human-paced',
    completeFreq:   1900,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -200 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  var STAGES = [
    { label: '1. redirect to AS',    role: 'master', tint: 'signal-amber' },
    { label: '2. user authn',        role: 'slave',  tint: 'signal-amber' },
    { label: '3. auth code',         role: 'master', tint: 'signal-amber' },
    { label: '4. token exchange',    role: 'master', tint: 'signal-amber' },
    { label: '5. JWT issued',        role: 'slave',  tint: 'instrument-cyan' },
    { label: '6. resource access',   role: 'master', tint: 'instrument-cyan' }
  ];
  var FPS = 35;
  var WIRE_LEFT = 100, WIRE_RIGHT = 700, WIRE_Y = 200, WIRE_LEN = WIRE_RIGHT - WIRE_LEFT;

  function decodeFrame(f) {
    var cycleF = STAGES.length * FPS;
    var cf = f % cycleF;
    var s = Math.floor(cf / FPS);
    return { phase: STAGES[s].label, byteIndex: s, byteProgress: (cf % FPS) / FPS,
             role: STAGES[s].role, tint: STAGES[s].tint, totalFrames: cycleF };
  }

  function bytePosition(decoded) {
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
      R.drawScanlineShroud(ctx, WIRE_LEFT, WIRE_Y, WIRE_RIGHT, WIRE_Y);
      R.drawNode(ctx, WIRE_LEFT - 30, WIRE_Y, TIMBRE.node.masterIcon, 'USER');
      R.drawNode(ctx, WIRE_RIGHT + 30, WIRE_Y, 'as-diamond', 'AUTH SERVER');
      R.drawNode(ctx, (WIRE_LEFT + WIRE_RIGHT) / 2, WIRE_Y + 80, 'server-rack', 'RESOURCE');

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      // Chip size grows after token issuance (post-JWT chips carry claims)
      var size = decoded.byteIndex >= 4 ? [16, 10] : [12, 8];
      trailStore.push(decoded.role, pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), 'token', size, decoded.tint);
      R.drawChip(ctx, pos.x, pos.y, 'token', size, decoded.tint, 1.0);

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color(decoded.tint);
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(decoded.phase, pos.x, pos.y - 16);
      ctx.restore();

      if (signals && signals.onSFX && decoded.byteIndex !== lastStage) {
        signals.onSFX(decoded.byteIndex === 4 ? 'complete' : 'byte', { role: decoded.role, state: 'steady' });
        lastStage = decoded.byteIndex;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · ' + decoded.phase + ' · tint ' + decoded.tint, 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastStage = -1; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: null, endToEndLatencyMs: 350, frameOverheadBytes: null, pendingInFlight: 0, isEncrypted: true, isAuthenticated: true, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.oauthJwt = { _timbre: TIMBRE, init: init };
})();
