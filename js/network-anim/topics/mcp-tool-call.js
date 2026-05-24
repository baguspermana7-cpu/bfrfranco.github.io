/* Network Hub — MCP tool-call (Lane E, Phase 5).
 * Appendix E row 25. Distinctive: 3-actor RPC over MCP transport (caller, tool, resource).
 * Industrial register HELD per v2.3 lock (no "soft + warm" exception).
 */
(function () {
  'use strict';
  window.RZNetAnim = window.RZNetAnim || {};

  var TIMBRE = Object.freeze({
    byte:        { waveform: 'sine',     freq: 1300, durationMs: 18 },
    ack:         { waveform: 'sine',     freq: 1700, durationMs: 70 },
    tick:        { waveform: 'square',   freq:  900, durationMs:  6 },
    errorSfx:    { waveform: 'sawtooth', freq:  220, durationMs: 80 },
    completeSfx: { waveform: 'sine',     freq: 1600, durationMs: 80 },
    tempoMultiplier: 0.9,
    registerCharacter: 'rpc-over-mcp-transport',
    byteChip: { shape: 'rect',         sizePx: [12, 6], color: 'instrument-cyan' },
    wire:     { style: 'mesh-tunnel',  widthPx: 1.0 },
    node:     { masterIcon: 'agent-circle', slaveIcon: 'tool-rectangle', tertiaryIcons: ['resource-diamond'] },
    errorSignature: 'timeout-grey-fade',
    encryption:     'progressive',
    latencyClass:   'human-paced',
    completeFreq:   1600,
    compareDegrade: ['drop-shroud', 'drop-trail', 'drop-pulse'],
    perRole:  { master: { byteFreqShift: 0 }, slave: { byteFreqShift: -100 } },
    perState: { handshake: { tempoMultiplier: 0.7 }, steady: { tempoMultiplier: 1.0 }, error: { tempoMultiplier: 1.0 } }
  });

  // 3 actors arranged in a triangle
  var AGENT = { x: 150, y: 280, label: 'AGENT' };
  var TOOL  = { x: 650, y: 280, label: 'TOOL'  };
  var RES   = { x: 400, y: 130, label: 'RESOURCE' };
  var STAGES = [
    { from: AGENT, to: TOOL, label: '1. tool-call', role: 'master' },
    { from: TOOL,  to: RES,  label: '2. resource read', role: 'slave' },
    { from: RES,   to: TOOL, label: '3. resource data',  role: 'slave' },
    { from: TOOL,  to: AGENT, label: '4. tool-result',   role: 'slave' }
  ];
  var FPS = 40;

  function decodeFrame(f) {
    var cycleF = STAGES.length * FPS;
    var cf = f % cycleF;
    var s = Math.floor(cf / FPS);
    return { phase: STAGES[s].label, byteIndex: s, byteProgress: (cf % FPS) / FPS,
             role: STAGES[s].role, totalFrames: cycleF, stageIdx: s };
  }

  function bytePosition(decoded) {
    var stage = STAGES[decoded.stageIdx];
    return { x: stage.from.x + (stage.to.x - stage.from.x) * decoded.byteProgress,
             y: stage.from.y + (stage.to.y - stage.from.y) * decoded.byteProgress };
  }

  function init(canvas, params, signals) {
    var ctx = canvas.getContext('2d'); var rafId = 0, running = false, startTs = 0, frame = 0;
    var lastStage = -1;
    var trailStore = window.RZNetAnim.vfx.createTrailStore();

    function render(f) {
      var R = window.RZNetAnim.renderer; R.clear(ctx);
      // Wires (3 edges of triangle)
      R.drawWire(ctx, AGENT.x, AGENT.y, TOOL.x, TOOL.y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawWire(ctx, TOOL.x, TOOL.y, RES.x, RES.y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawWire(ctx, RES.x, RES.y, AGENT.x, AGENT.y, TIMBRE.wire.style, TIMBRE.wire.widthPx);
      R.drawNode(ctx, AGENT.x, AGENT.y, TIMBRE.node.masterIcon, AGENT.label);
      R.drawNode(ctx, TOOL.x,  TOOL.y,  TIMBRE.node.slaveIcon,  TOOL.label);
      R.drawNode(ctx, RES.x,   RES.y,   'resource-diamond',     RES.label);

      var decoded = decodeFrame(f);
      var pos = bytePosition(decoded);
      trailStore.push(decoded.role, pos.x, pos.y);
      window.RZNetAnim.vfx.drawTrail(ctx, trailStore.get(decoded.role), TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color);
      R.drawChip(ctx, pos.x, pos.y, TIMBRE.byteChip.shape, TIMBRE.byteChip.sizePx, TIMBRE.byteChip.color, 1.0);

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('signal-amber');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(decoded.phase, pos.x, pos.y - 14);
      ctx.restore();

      if (signals && signals.onSFX && decoded.byteIndex !== lastStage) {
        signals.onSFX('byte', { role: decoded.role, state: 'steady' });
        lastStage = decoded.byteIndex;
      }

      ctx.save();
      ctx.fillStyle = window.RZNetAnim.palette.color('instrument-cyan');
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('frame ' + f + ' · 3-actor RPC: ' + decoded.phase, 10, 20);
      ctx.restore();
    }

    function tick(ts) { if (!running) return; if (!startTs) startTs = ts; frame = Math.floor((ts - startTs) / (1000 / 60)); render(frame); rafId = window.requestAnimationFrame(tick); }
    function play()  { if (running) return; running = true; startTs = 0; rafId = window.requestAnimationFrame(tick); }
    function pause() { running = false; if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; } }
    function seek(t) { frame = t; lastStage = -1; trailStore.reset(); render(frame); }
    function setParams() { render(frame); }
    function destroy() { pause(); trailStore.reset(); }
    function getNormalized() { return { effectiveThroughputBps: null, endToEndLatencyMs: 500, frameOverheadBytes: null, pendingInFlight: 0, isEncrypted: true, isAuthenticated: true, errorCount: 0 }; }

    render(0);
    return { play: play, pause: pause, seek: seek, setParams: setParams, getNormalized: getNormalized, destroy: destroy, timbre: TIMBRE, _decodeFrame: decodeFrame, _bytePosition: bytePosition };
  }

  window.RZNetAnim.mcpToolCall = { _timbre: TIMBRE, init: init };
})();
