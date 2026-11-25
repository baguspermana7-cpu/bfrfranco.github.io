/*
 * floor-plan.js — window.RZFloorPlan: the data hall floor plan with depth (PRD-CONV-DATAHALL-FLOOR §3).
 *
 *   render(host, model, opts)  builds the SVG ONCE (rebuilt only when the host width changes) and returns the instance.
 *       model = { racks: [{idx, occupied, kw, util}], zones: [{z, heat, rackInletC, hotAisleC, ...}],
 *                 crahUnits: [{n, tag, running, status?}], rackInletFor(idx) -> °C, ratingKw, racksPerZone (20) }
 *               — the page's own `racks`, `zones`, `crahUnits`, `rackInletFor`, RACK_RATING_KW; no engine arithmetic here.
 *       opts  = { rackTag(idx), zoneTag(z), crahTag(n), thresholds, mode, onRack(idx, el), onCrah(n, el), onRow(z),
 *                 ids: {top, bottom}, crahAttrs: {north: {attr: v}, south: {...}},
 *                 measure: element whose clientWidth / clientHeight is the space the drawing may take (default: host),
 *                 height: number | function -> the height bound in px; giving it lets the drawing pick 1, 2 or 3 row BANDS,
 *                 maxBands (1..3), minUnit (px, default 7), watchHeight (false: a height change does not rebuild),
 *                 onBuild(inst): called after every (re)build, so a page can decorate the strips it asked for }
 *       Rows are laid out in bands (band b = rows [b*k, (b+1)*k)), each band stacked below the last ON THE SCREEN with its own
 *       north and south CRAH gallery; the unit u = min(fit to width, fit to height, 22 px) is the largest over the band counts.
 *   paint(mode)                'power' | 'temp' | 'cooling-margin' | 'alarms' | 'space'. Writes ATTRIBUTES (fill, points,
 *                              data-state, display) and the text of nodes that already exist; never adds or removes a node.
 *   select({rack}|{row}|{crah}|null), legend(el, mode), palette(theme), classify(mode, model, idx, thresholds), unit().
 *
 * PRD-DATAHALL-BMS-ISO (owner R185): a BMS floor graphic, not a bar chart. Two projections of one drawing: true isometric
 * 3D (30 deg, the default on a wide stage) and the top view (the default under 600 px), switched by the .fp-proj toggle and
 * remembered under opts.projKey. Every cabinet is one height; load is a value (row tags, tooltip), never a height.
 * Colour is STATE: a normal cabinet is GREY (the neutral faces); only warn / alarm wear --rz-pt-warn/alarm
 * (css/conv-point.css). Each family has three faces (top, front, side) in three OKLCH lightness steps of ONE hue, emitted
 * as discrete hex values per theme onto the stage's custom properties; the drawing code holds no colour literal, only
 * var(--fp-*). No gradient, filter, glow, blink or pulse; the only motion is the air (.fp-air). ES5.
 *   opts.projection 'iso' | 'plan' (forces one), opts.projKey (storage key), opts.tags (true: an empty .fp-crah-tag the
 *   page fills); inst.setProjection(p), inst.projection(), inst.crahTagEl().
 * 2.1.0 (PRD-DATAHALL-BMS-ISO F4, the DC AI hall through its adapter js/datahall-ai/hall-iso.js): the line length follows
 *   model.racksPerZone (GEO stays the 10-a-line Conventional hall); model.cduUnits [{n, tag, running, status?, ref?}] adds a
 *   CDU line between the cabinets and the south gallery (.crah-cell[data-kind=cdu], no fan); racks[i].ref / unit.ref become
 *   data-rz-equipment so the page's own equipment click opens; opts.toggle false (the page owns the 3D / Plan switch);
 *   opts.zoneHead(z) the row tag's head (default the letter).
 */
(function (global) {
  'use strict';
  if (global.RZFloorPlan) return;

  var NS = 'http://www.w3.org/2000/svg';
  /* PRD-DATAHALL-BMS-ISO: true isometric (30 deg) or a top view of the same plan. iso: X = (x - y) cos30 u,
     Y = (x + y) sin30 u - h u; plan: X = x u, Y = y u. Every cabinet is one height (CAB_H, ~42U); load is a value, never a height. */
  var ISO_C = Math.cos(Math.PI / 6), ISO_S = 0.5, CAB_H = 2.0;
  var GEO = { rowW: 3.4, cabW: 1, hot: 0.8, cold: 0.6, kd: 1.5, nY0: 0.6, gD: 1.6, gap: 0.7, perLine: 10, wall: 2, capH: CAB_H, crahH: 1.6, ox: 0.5, pad: 1.0 };
  GEO.cabY0 = GEO.nY0 + GEO.gD + GEO.gap;                       // 2.9
  GEO.cabY1 = GEO.cabY0 + GEO.perLine * GEO.kd;                 // 17.9
  GEO.sY0 = GEO.cabY1 + GEO.gap;                                // 18.6
  GEO.slabY = GEO.sY0 + GEO.gD + 0.6;                           // 20.8
  /* one drawing's geometry: GEO for the Conventional hall (10 cabinets a line); another page's hall changes the line length
     and may add a CDU line between the cabinets and the south gallery (PRD-DATAHALL-BMS-ISO F4, the DC AI adapter) */
  function geoFor(perLine, cduLine, m) {
    var g = {}, k;
    for (k in GEO) g[k] = GEO[k];
    g.perLine = perLine;
    if (m) {
      /* opts.geo (DC AI, PRD-DCAI-HALL-DEPTH arrangement law HV-G1): the hall to scale, one unit = 1 m, every length from
         the engine's geometry. Across a row pair: cabinet depth, the shared hot aisle, cabinet depth, the cold aisle.
         North to south: gallery, the rack line, the service corridor, the CDU line, gallery, then whatever the hall
         width leaves (the engine places no equipment there). */
      /* The engine allows each row its rack depth + one cold-aisle share + one hot-aisle share (row pitch 3.1 m). Drawn
         as the alternating pattern that allowance pays for: two rows back to back around one contained hot aisle of two
         hot shares, pairs separated by a cold aisle of two cold shares, half a cold aisle at each end wall. */
      g.cabW = m.rackDepth; g.hot = 2 * m.hotAisle; g.cold = 2 * m.coldAisle; g.rowW = 2 * (m.rackDepth + m.hotAisle + m.coldAisle);
      g.ox = m.coldAisle; g.pad = 0;
      g.kd = m.rackPitch; g.gD = m.galleryDepth; g.cduD = m.cduDepth; g.nY0 = 0; g.gap = 0;
      g.cabY0 = g.gD; g.cabY1 = g.cabY0 + perLine * g.kd;
      g.cduY0 = g.cabY1 + m.crossAisle;
      /* the south gallery stands on the south wall; whatever the width leaves (the engine places nothing there) lies
         between the CDU line and that gallery */
      g.slabY = Math.max(g.cduY0 + m.cduDepth + g.gD, m.hallWidth || 0); g.sY0 = g.slabY - g.gD;
      g.metric = true;
      return g;
    }
    g.cabY1 = g.cabY0 + perLine * g.kd;
    if (cduLine) { g.cduY0 = g.cabY1 + 2 * g.gap; g.sY0 = g.cduY0 + g.gD + g.gap; } else g.sY0 = g.cabY1 + g.gap;
    g.slabY = g.sY0 + g.gD + 0.6;
    return g;
  }
  var U_MIN = 7, U_MIN_PLAN = 9, U_MAX = 22, PAD = 8, STRIP_H = 34, STRIP_ISO = 24, TOP_H = 32, TOP_H_PHONE = 48;
  var MODES = ['power', 'temp', 'cooling-margin', 'alarms', 'space'];
  var DEFAULT_T = { utilWarn: 0.85, utilAlarm: 0.95, utilCap: 1.05, inletMin: 18, inletMax: 27, inletAlarm: 30, marginAlarm: -3 };

  /* OKLCH arithmetic: js/conv/floor-plan-color.js (load it first) */
  var COL = global.RZFloorPlanColor;
  if (!COL) throw new Error('floor-plan: load js/conv/floor-plan-color.js before js/conv/floor-plan.js');
  var parseColor = COL.parseColor, rgbToOklch = COL.rgbToOklch, oklchHex = COL.oklchHex;

  /* PRD 3.2: face lightness per theme, and the magnitude step on the top face. */
  var FACE_L = { dark: { top: 0.62, front: 0.50, side: 0.42 }, light: { top: 0.55, front: 0.45, side: 0.38 } };
  var MAG_DL = [-0.066, 0, 0.066];   // PRD 3.2 says 0.06; 8-bit hex rounding lands a step under 0.06 apart, and the data-viz validator wants >= 0.06 between adjacent steps
  var CHROMA_K = { ok: 0.6, warn: 0.85, alarm: 0.85 };   // a calm green: a little under the token's chroma
  /* the grey of NORMAL equipment (PRD-DATAHALL-BMS-ISO): on a light page it sits light, so a warn / alarm cabinet is the
     darkest, most saturated thing on the floor; on a dark page the state families' own lightness works */
  var NEUTRAL_L = { dark: FACE_L.dark, light: { top: 0.86, front: 0.76, side: 0.68 } };
  function family(tokenRgb, theme, k, maxC, faceL) {
    var o = rgbToOklch(tokenRgb), L = (faceL || FACE_L)[theme], C = Math.min(o.C * k, maxC == null ? 1 : maxC), i, top = [];
    for (i = 0; i < 3; i++) top.push(oklchHex(L.top + MAG_DL[i], C, o.h));
    return { top: top, front: oklchHex(L.front, C, o.h), side: oklchHex(L.side, C, o.h) };
  }
  function buildPalette(tokens, ink, theme) {
    return {
      ok: family(tokens.ok, theme, CHROMA_K.ok), warn: family(tokens.warn, theme, CHROMA_K.warn), alarm: family(tokens.alarm, theme, CHROMA_K.alarm),
      neutral: family(ink, theme, 1, 0.012, NEUTRAL_L)
    };
  }
  function themeOf() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function readTokens(el) {
    var cs = global.getComputedStyle(el);
    function t(n) { var c = parseColor(cs.getPropertyValue(n)); if (!c) throw new Error('floor-plan: custom property ' + n + ' is not defined (load css/conv-point.css)'); return c; }
    return { tokens: { ok: t('--rz-pt-ok'), warn: t('--rz-pt-warn'), alarm: t('--rz-pt-alarm') }, ink: t('--fp-ink') };
  }

  /* ---------- the stage's own stylesheet: custom properties and the few rules the SVG attributes cannot hold ------- */
  var CSS = [
    '.fp-root,.fp-legend{--fp-ink:#e8edf5;--fp-muted:#9aa3b0;--fp-surface:#121316;--fp-accent:#e8b563;position:relative;color:var(--fp-ink);font:12px/1.35 "IBM Plex Sans",system-ui,sans-serif}',
    '[data-theme="light"] .fp-root,[data-theme="light"] .fp-legend{--fp-ink:#1b2430;--fp-muted:#4b5563;--fp-surface:#ffffff;--fp-accent:#7a4800}',
    '.fp-scroll{overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;overscroll-behavior-x:contain;max-width:100%}',
    '.fp-canvas{position:relative}',
    '.fp-snap{position:absolute;top:0;width:1px;height:1px;scroll-snap-align:start;pointer-events:none}',
    '.fp-svg{display:block;outline:none}',
    '.fp-svg:focus-visible{outline:1.5px solid var(--fp-accent);outline-offset:2px}',
    '.fp-svg polygon,.fp-svg path{vector-effect:none}',
    '.fp-slab{fill:var(--fp-ink);fill-opacity:.03;stroke:none}',
    '.fp-slab-face{fill:var(--fp-ink);fill-opacity:.08;stroke:none}',
    '.fp-tiles{fill:none;stroke:var(--fp-ink);stroke-opacity:.05;stroke-width:1}',
    '.fp-aisle-hot{fill:var(--fp-ink);fill-opacity:.1;stroke:none}',
    '.wall-edge{fill:none;stroke:var(--fp-ink);stroke-opacity:.2;stroke-width:1}',
    '.rack polygon,.crah-cell polygon{stroke:var(--fp-surface);stroke-width:.6;stroke-linejoin:round}',
    '.rack[data-state="spare"] .rk-top{stroke:var(--fp-ink);stroke-opacity:.22;stroke-width:1}',
    '.rack{cursor:pointer}',
    '.rack[data-state="spare"] .rk-top{pointer-events:all}',
    '.crah-cell{cursor:pointer}',
    '.crah-cell.stby polygon{stroke:var(--fp-ink);stroke-opacity:.35;stroke-width:1}',
    '.cr-fan{fill:none!important;stroke:var(--fp-surface);stroke-width:1;stroke-opacity:.8}',
    '.crah-cell.stby .cr-fan{stroke:var(--fp-ink);stroke-opacity:.35}',
    '.hot-cap{pointer-events:none}',
    '.hot-cap .cap-top{fill:var(--fp-ink);fill-opacity:.1;stroke:var(--fp-ink);stroke-opacity:.35;stroke-width:1}',
    /* PRD-DATAHALL-BMS-ISO: equipment detail, perforated tiles, CRAH lamp, the projection toggle and the value tags */
    '.rk-detail{fill:none;stroke:var(--fp-surface);stroke-opacity:.55;stroke-width:.8;pointer-events:none}',
    '.fp-perf{fill:none;stroke:var(--fp-ink);stroke-opacity:.16;stroke-width:1}',
    '.cr-lamp,.rk-lamp{stroke:none;fill:none;pointer-events:none}.cr-lamp[data-lamp="run"],.rk-lamp[data-lamp="run"]{fill:var(--rz-pt-ok)}',
    '.cr-lamp[data-lamp="warn"],.rk-lamp[data-lamp="warn"]{fill:var(--rz-pt-warn)}.cr-lamp[data-lamp="alarm"],.rk-lamp[data-lamp="alarm"]{fill:var(--rz-pt-alarm)}',
    /* opts.stbyLamp (DC AI, PRD-DCAI-HALL-DEPTH A2 / HV-S0): a standby unit's lamp is a hollow grey ring, never green */
    '.cr-lamp[data-lamp="stby"]{fill:none;stroke:var(--fp-muted);stroke-width:1px;vector-effect:non-scaling-stroke}',
    /* unit.stale (DC AI, PRD-DCAI-HALL-DEPTH Amendment 6 / ST1): telemetry without a sample — a dotted muted ring, never run green */
    '.cr-lamp[data-lamp="stale"]{fill:none;stroke:var(--fp-muted);stroke-width:1px;stroke-dasharray:1.5 1.5;vector-effect:non-scaling-stroke}',
    '.fp-sw[data-state="stale"]{background:transparent;border:1px dotted var(--fp-muted);border-radius:50%}',
    '.fp-sw[data-state="stby"]{background:transparent;border-color:var(--fp-muted);border-radius:50%}.fp-sw[data-state="run"]{background:var(--rz-pt-ok);border-radius:50%}',
    '.fp-proj{position:absolute;z-index:3;top:4px;left:4px;display:inline-flex;border:1px solid var(--fp-ink);border-color:color-mix(in srgb,var(--fp-ink) 24%,transparent);border-radius:3px;background:var(--fp-surface)}',
    '.fp-proj-btn{appearance:none;margin:0;min-width:44px;height:24px;padding:0 10px;border:0;border-radius:0;background:transparent;color:var(--fp-muted);font:600 11px/24px "IBM Plex Sans",system-ui,sans-serif;cursor:pointer}',
    '.fp-proj-btn+.fp-proj-btn{border-left:1px solid var(--fp-ink);border-left-color:color-mix(in srgb,var(--fp-ink) 24%,transparent)}',
    '.fp-proj-btn[aria-pressed="true"]{color:var(--fp-ink);background:var(--fp-ink);background:color-mix(in srgb,var(--fp-ink) 14%,transparent)}',
    '.fp-proj-btn:focus-visible{outline:1.5px solid var(--fp-accent);outline-offset:1px}',
    '@media (max-width:600px){.fp-proj-btn{height:40px;line-height:40px}}',
    '.fp-crah-tag{position:absolute;z-index:3;top:4px;right:8px;padding:2px 6px;border:1px solid var(--fp-ink);border-color:color-mix(in srgb,var(--fp-ink) 24%,transparent);border-radius:2px;background:var(--fp-surface);color:var(--fp-ink);font:10px/1.5 "JetBrains Mono","IBM Plex Mono",monospace;white-space:nowrap}',
    '.fp-crah-tag:empty{display:none}',
    '.fp-tag{display:inline-block;padding:0 3px;border:1px solid var(--fp-ink);border-color:color-mix(in srgb,var(--fp-ink) 22%,transparent);border-radius:2px;background:var(--fp-surface);color:var(--fp-ink)}',
    '.fp-root[data-proj="iso"] .zone{display:flex;align-items:center;gap:3px;width:auto;padding:0 0 0 4px;white-space:nowrap;border:1px solid var(--fp-ink);border-color:color-mix(in srgb,var(--fp-ink) 22%,transparent);border-radius:2px;background:var(--fp-surface)}',
    '.fp-root[data-proj="iso"] .fp-tag{border:0;border-left:1px solid var(--fp-ink);border-left-color:color-mix(in srgb,var(--fp-ink) 22%,transparent);border-radius:0}',
    '.fp-root[data-proj="iso"] .zone-head{display:inline-block;margin:0;width:auto;min-width:14px;font-weight:600}',
    '.fp-root[data-proj="iso"] .zone-foot{display:inline-block}',
    '.fp-doors{pointer-events:none}',
    '.hot-door{fill:none;stroke:var(--fp-ink);stroke-opacity:.3;stroke-width:1}',
    '.hot-cap .cap-post{fill:none;stroke:var(--fp-ink);stroke-opacity:.2;stroke-width:1}',
    '.fp-ring{fill:none;pointer-events:none}',
    /* L4 (PRD-CONV-BMS-LIVE): air that moves. Supply in the chilled-water supply tone, exhaust by hot-aisle temperature */
    '.fp-root{--fp-air-cold:#78a2d6;--fp-air-h1:#c8925a;--fp-air-h2:#cf7a6a;--fp-air-h3:#e0604f}',
    '[data-theme="light"] .fp-root{--fp-air-cold:#2f5e96;--fp-air-h1:#8a5a24;--fp-air-h2:#8f4335;--fp-air-h3:#a3281c}',
    '.fp-air{pointer-events:none}',
    '.fp-air path{fill:none;stroke-width:2.6;stroke-linecap:round;stroke-dasharray:6 10;stroke-opacity:.95}',
    '.fp-air .air-cold{stroke:var(--fp-air-cold)}',
    '.fp-air .air-hot[data-t="1"]{stroke:var(--fp-air-h1)}.fp-air .air-hot[data-t="2"]{stroke:var(--fp-air-h2)}.fp-air .air-hot[data-t="3"]{stroke:var(--fp-air-h3)}',
    '.fp-air path[data-off]{display:none}',
    /* opts.airModes (DC AI, PRD-DCAI-HALL-DEPTH Amendment 3 D6): the air shows and moves only in the lenses that read it */
    '.fp-root[data-air="0"] .fp-air{display:none}.fp-root[data-air="0"] .fp-air path{animation:none}',
    '@keyframes fp-air{to{stroke-dashoffset:-16}}',
    '@media (prefers-reduced-motion:no-preference){.fp-air path{animation:fp-air 1.4s linear infinite}}',
    '.fp-root.fp-offscreen .fp-air path{animation-play-state:paused}',
    /* rotors (opts.rotors): physical, at the unit's own speed; still when standby or 0 %, off screen, or reduced motion */
    '.fp-rotor{fill:none;stroke:var(--fp-surface);stroke-width:1;stroke-linecap:round;transform-box:view-box;pointer-events:none}',
    '.crah-cell.stby .fp-rotor{stroke:var(--fp-ink);stroke-opacity:.35}',
    '@keyframes fp-rot{to{transform:rotate(360deg)}}',
    '@media (prefers-reduced-motion:no-preference){.fp-rotor[data-turning="1"]{animation:fp-rot 1s linear infinite}}',
    '.fp-root.fp-offscreen .fp-rotor{animation-play-state:paused}',
    '.fp-ring-sel{stroke:var(--fp-accent);stroke-width:1.5}',
    /* opts.selInk (DC AI, PRD-DCAI-HALL-DEPTH Amendment 5 / SL1): the selection is an ink outline, 2 px, never the warning amber */
    '.fp-root[data-sel-ink] .fp-ring-sel{stroke:var(--fp-ink);stroke-width:2}',
    '.fp-root[data-sel-ink] .zone[data-sel] .zone-head{border-color:var(--fp-ink)}',
    '.fp-ring-hover{stroke:var(--fp-ink);stroke-width:1}',
    '.fp-ring-row{stroke:var(--fp-accent);stroke-width:1.5}',
    '.fp-root:not(.fp-labels) .rk-id,.fp-root:not(.fp-labels) .rk-val,.fp-root .cr-n{display:none}',
    '.fp-svg text{fill:var(--fp-ink);font:9px "JetBrains Mono","IBM Plex Mono",monospace}',
    '.zone-strip{position:absolute;left:0;right:0;height:' + STRIP_H + 'px}',
    '.zone{position:absolute;top:2px;text-align:center;font-family:"JetBrains Mono","IBM Plex Mono",monospace;font-size:10px;line-height:1.3}',
    '.zone-head{display:block;margin:0 auto;width:20px;padding:1px 0;border:1px solid transparent;border-radius:2px;color:var(--fp-ink);cursor:pointer;font-size:11px}',
    '.zone[data-sel] .zone-head{border-color:var(--fp-accent);outline:0}',
    '.zone-foot{display:block;width:max-content;margin:0 auto;color:var(--fp-ink);cursor:pointer}',
    '.zone-foot .sr-only,.fp-root .sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '.fp-tip{position:absolute;z-index:5;pointer-events:none;max-width:240px;padding:6px 8px;border:1px solid var(--fp-ink);border-color:color-mix(in srgb,var(--fp-ink) 24%,transparent);border-radius:3px;background:var(--fp-surface);color:var(--fp-ink);font-size:11px;line-height:1.4}',
    '.fp-tip[hidden]{display:none}',
    '.fp-tip b{font-weight:600}',
    '.fp-tip .tp-hint{color:var(--fp-muted)}',
    '.fp-legend{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;color:var(--fp-muted);font-size:11px}',
    '.fp-legend .lg-item{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}',
    '.fp-sw{display:inline-block;width:10px;height:10px;border-radius:1px;border:1px solid transparent}',
    '.fp-sw[data-state="ok"]{background:var(--fp-ok-t2)}.fp-sw[data-state="warn"]{background:var(--fp-warn-t2)}',
    '.fp-sw[data-state="alarm"]{background:var(--fp-alarm-t2)}.fp-sw[data-state="neutral"]{background:var(--fp-neutral-t2)}',
    '.fp-sw[data-state="neutral"]{position:relative}.fp-sw[data-state="neutral"]::after{content:"";position:absolute;right:1px;bottom:1px;width:3px;height:3px;background:var(--rz-pt-ok)}',
    '.fp-sw[data-state="spare"]{background:transparent;border-color:var(--fp-ink);border-color:color-mix(in srgb,var(--fp-ink) 40%,transparent)}'
  ].join('\n');
  function injectCss() {
    if (document.getElementById('rz-floor-plan-css')) return;
    var st = document.createElement('style'); st.id = 'rz-floor-plan-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* ---------- state per mode (PRD 3.2 threshold table) -------------------------------------------------------- */
  function clamp01(f) { return f < 0 ? 0 : (f > 1 ? 1 : f); }
  function third(f) { f = clamp01(f); return f >= 2 / 3 ? 2 : (f >= 1 / 3 ? 1 : 0); }
  function utilOf(model, rk) { return rk.util != null ? rk.util : (model.ratingKw ? rk.kw / model.ratingKw : 0); }
  function powerState(u, T, strict) {
    var warn = strict ? u > T.utilWarn : u >= T.utilWarn, alarm = strict ? u > T.utilAlarm : u >= T.utilAlarm;
    if (alarm) return { s: 'alarm', f: (u - T.utilAlarm) / (T.utilCap - T.utilAlarm) };
    if (warn) return { s: 'warn', f: (u - T.utilWarn) / (T.utilAlarm - T.utilWarn) };
    return { s: 'ok', f: u / T.utilWarn };
  }
  function inletState(t, T) {
    if (t > T.inletAlarm) return { s: 'alarm', f: (t - T.inletAlarm) / 5 };
    if (t > T.inletMax) return { s: 'warn', f: (t - T.inletMax) / (T.inletAlarm - T.inletMax) };
    if (t < T.inletMin) return { s: 'warn', f: (T.inletMin - t) / 6 };
    return { s: 'ok', f: (t - T.inletMin) / (T.inletMax - T.inletMin) };
  }
  var RANK = { ok: 0, warn: 1, alarm: 2 };
  /* -> { state: ok|warn|alarm|neutral|spare, step: 0..2 (-1 for spare), text } */
  function classify(mode, model, idx, T) {
    T = T || DEFAULT_T;
    var rk = model.racks[idx];
    if (!rk.occupied) return { state: 'spare', step: -1, v: 0, text: mode === 'space' ? 'spare' : '—' };
    var u = utilOf(model, rk), t = model.rackInletFor(idx), r;
    if (mode === 'space') return { state: 'neutral', step: 1, v: u, text: 'IT' };
    r = classifyMode(mode, model, rk, idx, T, u, t);
    /* rk.status (DC AI, PRD-DCAI-HALL-DEPTH Amendment 3 D5): an alarm the unit's HMI payload raises outranks the lens
       state in every lens but Layout; the lens value stays the text. The Conventional model sets no status. */
    if ((rk.status === 'warn' || rk.status === 'alarm') && RANK[rk.status] > (RANK[r.state] || 0)) return { state: rk.status, step: 2, v: r.v, text: r.text };
    return r;
  }
  function classifyMode(mode, model, rk, idx, T, u, t) {
    var r, a, b;
    if (mode === 'power') { r = powerState(u, T, false); return { state: r.s, step: third(r.f), v: u, text: rk.kw.toFixed(1) }; }
    if (mode === 'temp') { r = inletState(t, T); return { state: r.s, step: third(r.f), v: t, text: t.toFixed(1) }; }
    if (mode === 'cooling-margin') {
      var m = T.inletMax - t;
      r = inletState(t, T);
      return { state: m >= 0 ? 'ok' : (m >= T.marginAlarm ? 'warn' : 'alarm'), step: third(t < T.inletMin ? 0 : r.f), v: t, text: m.toFixed(1) };
    }
    a = powerState(u, T, true);                          // alarms: the page's own evaluateAlarms (strict >)
    b = inletState(t, T);
    r = RANK[b.s] > RANK[a.s] && b.s !== 'ok' && t > T.inletMax ? b : a;
    return { state: r.s, step: third(r.f), v: u, text: String(Math.round(u * 100)) };
  }
  var STATE_WORD = { ok: 'normal', warn: '▲ warning', alarm: '◆ alarm', neutral: 'occupied', spare: 'spare' };

  /* ---------- the instance --------------------------------------------------------------------------------------- */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag), k;
    if (attrs) for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function html(tag, cls, parent, text) {
    var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; if (parent) parent.appendChild(n); return n;
  }
  function setAttr(n, k, v) { if (n.getAttribute(k) !== v) n.setAttribute(k, v); }

  function create(host, model, opts) {
    injectCss();
    opts = opts || {};
    var T = {}, k;
    for (k in DEFAULT_T) T[k] = DEFAULT_T[k];
    if (opts.thresholds) for (k in opts.thresholds) T[k] = opts.thresholds[k];
    var perZone = model.racksPerZone || 20, Z = Math.floor(model.racks.length / perZone), perLine = perZone / 2;
    var cdus = model.cduUnits || [], G = geoFor(perLine, cdus.length > 0, opts.geo);
    var inst = { model: model, mode: opts.mode || 'temp', host: host, sel: null, u: 0, bands: 1 };
    var u, ox, topPx, wallPx, bodyPx, pitch, nb = 1, kRows = Z, root, scroll, canvas, svg, tip, ringSel, ringHover, ringRow, rackEls = [], crahEls = [], zoneEls = [], cache = [], cursor = null, airEls = [], crahTagEl = null;
    var ids = opts.ids || { top: 'crah-top', bottom: 'crah-bottom' };
    var meas = opts.measure || host;
    var rackTag = opts.rackTag || function (i) { return 'R-' + i; };
    var zoneTag = opts.zoneTag || function (z) { return 'Row ' + String.fromCharCode(65 + z); };
    var zoneHead = opts.zoneHead || function (z) { return String.fromCharCode(65 + z); };
    /* opts.stripH (DC AI, Amendment 3 D7): a taller top-view tag strip when the foot stacks its unit (number or function) */
    function stripH() { var h = typeof opts.stripH === 'function' ? opts.stripH() : opts.stripH; return h > 0 ? h : STRIP_H; }
    var crahTag = opts.crahTag || function (n, c) { return (c && c.tag) || ('CRAH-' + n); };

    /* PRD-DATAHALL-BMS-ISO: the projection. A stored choice wins; otherwise 3D (iso) on a wide stage, the top view (plan) on a
       phone. The choice is remembered under opts.projKey (try/catch: storage can be blocked). */
    var projKey = opts.projKey || 'rz.fp.proj';
    function storedProj() { try { var v = global.localStorage.getItem(projKey); return v === 'iso' || v === 'plan' ? v : null; } catch (e) { return null; } }
    var proj = opts.projection || storedProj() || ((opts.width || meas.clientWidth || host.clientWidth || 1100) < 600 ? 'plan' : 'iso');
    function isIso() { return proj === 'iso'; }

    /* One band is a run of rows drawn by itself, stacked one pitch below the last ON THE SCREEN with its own galleries. */
    function XY(x, y, h, b) {
      var y0 = topPx + (b || 0) * pitch + wallPx;
      if (isIso()) return [ox + (x - y + G.slabY) * ISO_C * u, y0 + (x + y) * ISO_S * u - (h || 0) * u];
      return [ox + x * u, y0 + y * u];
    }
    function P(x, y, h, b) { var p = XY(x, y, h, b); return p[0].toFixed(3) + ',' + p[1].toFixed(3); }
    function pts(a, b) { var s = [], i; for (i = 0; i < a.length; i++) s.push(P(a[i][0], a[i][1], a[i][2], b)); return s.join(' '); }
    function cell(idx) {
      var z = Math.floor(idx / perZone), r = idx % perZone, line = r < perLine ? 0 : 1, b = Math.floor(z / kRows), zl = z - b * kRows;
      return { z: z, b: b, zl: zl, line: line, j: r % perLine, x0: G.ox + zl * G.rowW + (line ? G.cabW + G.hot : 0), y0: G.cabY0 + (r % perLine) * G.kd };
    }
    /* the three faces a viewer from the south-east sees: top, south (front) and east (side) */
    function boxPts(x0, y0, w, d, h, b) {
      return {
        top: pts([[x0, y0, h], [x0 + w, y0, h], [x0 + w, y0 + d, h], [x0, y0 + d, h]], b),
        front: pts([[x0, y0 + d, 0], [x0 + w, y0 + d, 0], [x0 + w, y0 + d, h], [x0, y0 + d, h]], b),
        side: pts([[x0 + w, y0, 0], [x0 + w, y0 + d, 0], [x0 + w, y0 + d, h], [x0 + w, y0, h]], b)
      };
    }
    /* opts.tagFit (DC AI, PRD-DCAI-HALL-DEPTH A1/HV-F2): a row tag (head + value) that would overlap a tag already
       shown is hidden — its value stays in the row's tooltip — so no two tags ever overlap, in either projection;
       default unchanged (every tag shown) */
    function fitTags() {
      if (!opts.tagFit) return;
      var shown = [], box = root.getBoundingClientRect();
      for (var z = 0; z < zoneEls.length; z++) {
        var t = zoneEls[z]; if (!t) continue;
        t.style.visibility = '';
        var r = null;   /* the ink of the tag (head + value), not the column-wide box the top view gives it */
        [].forEach.call(t.querySelectorAll('.zone-head,.zone-foot'), function (c) { var q = c.getBoundingClientRect(); if (!q.width) return;
          r = r ? { left: Math.min(r.left, q.left), right: Math.max(r.right, q.right), top: Math.min(r.top, q.top), bottom: Math.max(r.bottom, q.bottom) } : q; });
        if (!r) continue;
        if (r.left < box.left || r.right > box.right) { t.style.visibility = 'hidden'; continue; }   /* cut by the stage edge */
        if (shown.some(function (q) { return r.left < q.right + 2 && r.right > q.left - 2 && r.top < q.bottom + 1 && r.bottom > q.top - 1; })) { t.style.visibility = 'hidden'; continue; }
        shown.push(r);
      }
    }
    function rowsIn(b) { return Math.min(kRows, Z - b * kRows); }
    function slabW(b) { return rowsIn(b) * G.rowW + G.pad; }
    function spans(k) { var sw = k * G.rowW + G.pad; return isIso() ? { x: (sw + G.slabY) * ISO_C, y: (sw + G.slabY) * ISO_S + G.wall + 0.3 } : { x: sw, y: G.slabY }; }

    /* PRD-CONV-DATAHALL-SPACE 3.1: pick 1, 2 or 3 bands so the unit u = min(fit to the width, fit to the height) is the
       largest. Height is bounded only when the page says so (opts.height). Below the minimum unit one band scrolls sideways
       inside the stage (the phone pattern), never the page. */
    function layout() {
      var W = opts.width || meas.clientWidth || host.clientWidth || 1100;
      var Hh = typeof opts.height === 'function' ? opts.height() : opts.height;
      var bounded = Hh != null && isFinite(Hh) && Hh > 0;
      var maxB = Math.max(1, Math.min(3, opts.maxBands != null ? opts.maxBands : (Hh != null ? 3 : 1)));
      /* opts.fitAll (DC AI 2D/3D, PRD-DCAI-HALL-DEPTH A1): the whole hall fits the stage on both axes, so the legibility
         floor of the plan's per-rack labels does not apply (those labels move to tooltips); default unchanged */
      var uMin = opts.fitAll ? (opts.minUnit || 2) : Math.max(opts.minUnit || U_MIN, isIso() ? 0 : U_MIN_PLAN), best = null, b, kk, sp, fitW, fitH, uu, strip = isIso() ? STRIP_ISO : stripH();
      topPx = W < 600 ? TOP_H_PHONE : TOP_H;
      for (b = 1; b <= maxB; b++) {
        kk = Math.ceil(Z / b); sp = spans(kk);
        fitW = (W - 2 * PAD) / sp.x;
        fitH = bounded ? (((Hh - topPx - 2) / b) - strip - 6) / sp.y : Infinity;
        uu = Math.min(fitW, fitH, U_MAX);
        if (!best || uu > best.u + 1e-6) best = { b: b, k: kk, u: uu };
      }
      if (best.u < uMin) best = { b: 1, k: Z, u: uMin };
      nb = best.b; kRows = best.k;
      u = Math.max(uMin, Math.floor(best.u * 100) / 100);
      ox = PAD;
      sp = spans(kRows);
      wallPx = isIso() ? Math.ceil(G.wall * u) + 2 : 4;
      bodyPx = Math.ceil((isIso() ? (kRows * G.rowW + G.pad + G.slabY) * ISO_S + 0.3 : G.slabY) * u) + 2;
      pitch = wallPx + bodyPx + strip + 6;
      inst.u = u; inst.bands = nb;
    }

    function build() {
      layout();
      var i, j, z, n, c, b, iso = isIso();
      /* a rebuild (resize, relayout, projection) replaces the svg: a keyboard user keeps focus and cursor */
      var hadFocus = !!(svg && document.activeElement === svg), projFocus = document.activeElement && root && root.contains(document.activeElement) && document.activeElement.getAttribute('data-proj');
      host.innerHTML = '';
      rackEls = []; crahEls = []; zoneEls = []; cache = [];
      var svgW = Math.ceil(2 * PAD + spans(kRows).x * u), svgH = topPx + nb * pitch + 2;
      if (opts.height != null) { host.style.width = Math.min(svgW, meas.clientWidth || svgW) + 'px'; host.style.height = svgH + 'px'; }
      root = html('div', 'fp-root', host);
      root.setAttribute('data-fp', '1'); root.setAttribute('data-u', u.toFixed(2)); root.setAttribute('data-bands', String(nb));
      root.setAttribute('data-proj', proj); root.setAttribute('data-proj-key', projKey); if (opts.selInk) root.setAttribute('data-sel-ink', '1');
      /* the 3D / Plan toggle: two buttons, aria-pressed, outside the scroller so it never scrolls away */
      var tg = opts.toggle === false ? null : html('div', 'fp-proj', root);   /* toggle false: the page owns the switch */
      if (tg) { tg.setAttribute('role', 'group'); tg.setAttribute('aria-label', 'Projection'); }
      if (tg) [['iso', '3D', 'Isometric 3D view'], ['plan', 'Plan', 'Top view']].forEach(function (d) {
        var bt = html('button', 'fp-proj-btn', tg, d[1]); bt.type = 'button'; bt.setAttribute('data-proj', d[0]); bt.title = d[2];
        bt.setAttribute('aria-pressed', d[0] === proj ? 'true' : 'false');
        bt.addEventListener('click', function () { inst.setProjection(d[0]); });
      });
      if (opts.tags) { crahTagEl = html('div', 'fp-crah-tag num', root); crahTagEl.setAttribute('aria-label', 'CRAH air temperatures'); }
      scroll = html('div', 'fp-scroll', root);
      canvas = html('div', 'fp-canvas', scroll); canvas.style.width = svgW + 'px'; canvas.style.height = svgH + 'px';
      for (i = 0; i < kRows; i += 5) { var sn = html('span', 'fp-snap', canvas); sn.style.left = Math.max(0, Math.floor(XY(G.ox + i * G.rowW, iso ? G.slabY : G.cabY0, 0, 0)[0] - 6)) + 'px'; }
      svg = el('svg', { 'class': 'fp-svg', width: svgW, height: svgH, viewBox: '0 0 ' + svgW + ' ' + svgH, role: 'group', tabindex: '0',
        'aria-label': 'Data hall floor plan, ' + (iso ? 'isometric 3D view' : 'top view') + '. Arrow keys move between cabinets and CRAH units, Enter opens the focused one.' }, canvas);

      /* floor: slab, tile grid, perforated cold-aisle tiles, the two back walls (north, west) per band */
      var g = el('g', { 'class': 'fp-floor' }, svg), wall = el('g', { 'class': 'fp-wall' }, svg), x, y, wS, d, da, dp, sf = 0.3, wh = G.wall, k;
      for (b = 0; b < nb; b++) {
        wS = slabW(b); d = ''; da = ''; dp = '';
        el('polygon', { 'class': 'fp-slab', points: pts([[0, 0, 0], [wS, 0, 0], [wS, G.slabY, 0], [0, G.slabY, 0]], b) }, g);
        for (x = 2; x < wS; x += 2) d += 'M' + P(x, 0, 0, b) + 'L' + P(x, G.slabY, 0, b);
        for (y = 2; y < G.slabY; y += 2) d += 'M' + P(0, y, 0, b) + 'L' + P(wS, y, 0, b);
        el('path', { 'class': 'fp-tiles', d: d }, g);
        for (z = b * kRows; z < b * kRows + rowsIn(b); z++) { var ha = G.ox + (z - b * kRows) * G.rowW + G.cabW; da += 'M' + P(ha, G.cabY0, 0, b) + 'L' + P(ha + G.hot, G.cabY0, 0, b) + 'L' + P(ha + G.hot, G.cabY1, 0, b) + 'L' + P(ha, G.cabY1, 0, b) + 'Z'; }
        el('path', { 'class': 'fp-aisle-hot', d: da }, g);
        for (k = 0; k <= rowsIn(b); k++) {   /* perforated tiles: one seam per cabinet depth along each cold aisle */
          var xa0 = G.ox + k * G.rowW - G.cold + 0.05; if (G.metric) xa0 = Math.max(0.05, xa0); var xa1 = G.ox + k * G.rowW - 0.05; if (G.metric) xa1 = Math.min(slabW(b) - 0.05, xa1);
          for (y = G.cabY0; y <= G.cabY1 + 1e-6; y += G.kd) dp += 'M' + P(xa0, y, 0, b) + 'L' + P(xa1, y, 0, b);
          dp += 'M' + P(xa0, G.cabY0, 0, b) + 'L' + P(xa0, G.cabY1, 0, b) + 'M' + P(xa1, G.cabY0, 0, b) + 'L' + P(xa1, G.cabY1, 0, b);
        }
        el('path', { 'class': 'fp-perf', d: dp }, g);
        if (iso) {
          el('polygon', { 'class': 'fp-slab-face', points: pts([[0, G.slabY, 0], [wS, G.slabY, 0], [wS, G.slabY, -sf], [0, G.slabY, -sf]], b) }, g);
          el('polygon', { 'class': 'fp-slab-face', points: pts([[wS, 0, 0], [wS, G.slabY, 0], [wS, G.slabY, -sf], [wS, 0, -sf]], b) }, g);
        }
        el('polygon', { 'class': 'wall-edge', 'data-edge': 'north', 'data-band': b, points: pts([[0, 0, 0], [wS, 0, 0], [wS, 0, wh], [0, 0, wh]], b) }, wall);
        el('polygon', { 'class': 'wall-edge', 'data-edge': 'west', 'data-band': b, points: pts([[0, 0, 0], [0, G.slabY, 0], [0, G.slabY, wh], [0, 0, wh]], b) }, wall);
      }

      /* CRAH galleries: ONE <g id> per side holding one gallery per band; north units and south units split across the bands
         in order, so a row sits between the CRAHs that serve it. North first (far), south last (near). */
      var units = model.crahUnits || [], split = Math.ceil(units.length / 2), nSouth = units.length - split;
      function side(id, name) {
        var gw = el('g', { 'class': 'fp-crah', id: id, 'data-gallery': name }, svg), at = opts.crahAttrs && opts.crahAttrs[name], a;
        if (at) for (a in at) if (Object.prototype.hasOwnProperty.call(at, a)) gw.setAttribute(a, at[a]);
        return gw;
      }
      function gallery(wrap, name, from, to, y0, band, list, kind) {
        list = list || units; kind = kind || 'crah';
        var gD = kind === 'cdu' && G.cduD ? G.cduD : G.gD;   /* metric (opts.geo): the CDU line has its own depth */
        var gg = el('g', { 'class': 'fp-crah-band', 'data-gallery': name, 'data-band': band }, wrap), cnt = to - from, slot = (slabW(band) - G.pad) / Math.max(1, cnt);
        for (var q = 0; q < cnt; q++) {
          var cu = list[from + q], nn = cu.n != null ? cu.n : from + q + 1, bx = G.pad / 2 + q * slot + 0.12, bw = slot - 0.24, hh = G.crahH;
          /* Amendment 2 P2 (opts.geo): the unit's own body in metres from the page (unit.box), not its allotment */
          var uy = y0, ud = gD;
          if (G.metric && cu.box) { bx = cu.box.x; bw = cu.box.w; uy = cu.box.y; ud = cu.box.d; }
          var cg = el('g', { 'class': 'crah-cell', 'data-crah': nn, 'data-kind': kind, id: 'fp-cr-' + nn }, gg), bp = boxPts(bx, uy, bw, ud, hh, band);
          if (cu.ref) cg.setAttribute('data-rz-equipment', cu.ref);
          var cell3 = { side: el('polygon', { 'class': 'cr-side', points: bp.side }, cg), front: el('polygon', { 'class': 'cr-front', points: bp.front }, cg), top: el('polygon', { 'class': 'cr-top', points: bp.top }, cg) };
          /* fan grille: on the face toward the cabinets in 3D (the south face), on the roof in the top view */
          var fan = [], rr = Math.min(bw, ud, hh) * 0.3, a;
          for (a = 0; a < 20; a++) fan.push(iso ? [bx + bw / 2 + rr * Math.cos(a * Math.PI / 10), uy + ud, hh * 0.5 + rr * Math.sin(a * Math.PI / 10)] : [bx + bw / 2 + rr * Math.cos(a * Math.PI / 10), uy + ud / 2 + rr * Math.sin(a * Math.PI / 10), hh]);
          if (kind === 'crah') el('polygon', { 'class': 'cr-fan', points: pts(fan, band) }, cg);   /* a CDU has no fan */
          /* opts.rotors (DC AI, PRD-DCAI-HALL-DEPTH A4 §7.1), top view only: three blades on the fan (fan-wall module) or on a
             pump circle (CDU), turned by a CSS animation whose period paint() sets from the unit's speed; no JS loop */
          var rot = null;
          if (opts.rotors && !iso) {
            var rc = XY(bx + bw / 2, uy + ud / 2, hh, band), re = XY(bx + bw / 2 + rr, uy + ud / 2, hh, band), rp = Math.max(1, Math.abs(re[0] - rc[0]) * 0.9), bl = '', ang;
            if (kind !== 'crah') el('circle', { 'class': 'cr-fan cr-pump', cx: rc[0].toFixed(2), cy: rc[1].toFixed(2), r: (rp / 0.9).toFixed(2) }, cg);
            for (ang = 0; ang < 3; ang++) bl += 'M' + rc[0].toFixed(2) + ' ' + rc[1].toFixed(2) + 'L' + (rc[0] + rp * Math.cos(ang * 2.0944 - 1.5708)).toFixed(2) + ' ' + (rc[1] + rp * Math.sin(ang * 2.0944 - 1.5708)).toFixed(2);
            rot = el('path', { 'class': 'fp-rotor', d: bl }, cg);
            rot.style.transformOrigin = rc[0].toFixed(2) + 'px ' + rc[1].toFixed(2) + 'px';
          }
          /* status lamp: a small square on the roof's south-east corner, filled by paint() */
          var lamp = el('polygon', { 'class': 'cr-lamp', points: pts([[bx + bw - 0.45, uy + ud - 0.45, hh], [bx + bw - 0.15, uy + ud - 0.45, hh], [bx + bw - 0.15, uy + ud - 0.15, hh], [bx + bw - 0.45, uy + ud - 0.15, hh]], band) }, cg);
          var tp = XY(bx + bw / 2, uy + ud, 0, band);
          var tx = el('text', { 'class': 'cr-n', x: tp[0].toFixed(1), y: (tp[1] + 9).toFixed(1), 'text-anchor': 'middle' }, cg);
          tx.textContent = String(nn);
          crahEls.push({ g: cg, p: cell3, lamp: lamp, rot: rot, n: nn, u: cu, top: bp.top, gal: name, band: band, i: q, cx: bx + bw / 2 });
        }
      }
      var wrapN = side(ids.top, 'north');
      for (b = 0; b < nb; b++) gallery(wrapN, 'north', Math.round(b * split / nb), Math.round((b + 1) * split / nb), G.nY0, b);

      /* painter's order, far to near: row by row west to east; in a row the west line north to south, the containment roof,
         then the east line. Rows apart on the floor never overlap on the screen, so this is exact for both projections. */
      var field = el('g', { 'class': 'fp-field' }, svg);
      function drawRack(i) {
        var c = cell(i);
        var rg = el('g', { 'class': 'rack', 'data-idx': i, id: 'fp-rk-' + i, 'data-state': 'ok', role: 'img' }, field);
        if (model.racks[i].ref) rg.setAttribute('data-rz-equipment', model.racks[i].ref);   /* the page's own equipment reference */
        var bpR = boxPts(c.x0, c.y0, G.cabW, G.kd, CAB_H, c.b), bpS = boxPts(c.x0, c.y0, G.cabW, G.kd, 0, c.b);
        var rp = { side: el('polygon', { 'class': 'rk-side', points: bpR.side }, rg), front: el('polygon', { 'class': 'rk-front', points: bpR.front }, rg), top: el('polygon', { 'class': 'rk-top', points: bpR.top }, rg) };
        /* equipment detail in 3D: a door frame on the east face and a vent line on the roof */
        var det = null;
        if (iso) {
          var xe = c.x0 + G.cabW, ya = c.y0 + 0.18, yb = c.y0 + G.kd - 0.18;
          det = el('path', { 'class': 'rk-detail', d: 'M' + P(xe, ya, 0.15, c.b) + 'L' + P(xe, ya, CAB_H - 0.15, c.b) + 'L' + P(xe, yb, CAB_H - 0.15, c.b) + 'L' + P(xe, yb, 0.15, c.b) + 'Z' +
            'M' + P(c.x0 + 0.2, c.y0 + G.kd * 0.5, CAB_H, c.b) + 'L' + P(c.x0 + G.cabW - 0.2, c.y0 + G.kd * 0.5, CAB_H, c.b) }, rg);
        }
        /* status lamp (owner C8: colour by condition): a small square on the roof's south-east corner */
        var lmp = el('polygon', { 'class': 'rk-lamp', points: pts([[c.x0 + G.cabW - 0.38, c.y0 + G.kd - 0.42, CAB_H], [c.x0 + G.cabW - 0.1, c.y0 + G.kd - 0.42, CAB_H], [c.x0 + G.cabW - 0.1, c.y0 + G.kd - 0.12, CAB_H], [c.x0 + G.cabW - 0.38, c.y0 + G.kd - 0.12, CAB_H]], c.b) }, rg);
        var cp = XY(c.x0 + 0.5, c.y0 + G.kd / 2, CAB_H, c.b);
        var tid = el('text', { 'class': 'rk-id', x: cp[0].toFixed(1), y: (cp[1] - 2).toFixed(1), 'text-anchor': 'middle' }, rg);
        tid.textContent = String(rackTag(i)).replace(/^R-/, '');
        var tv = el('text', { 'class': 'rk-val', x: tid.getAttribute('x'), y: (cp[1] + 7).toFixed(1), 'text-anchor': 'middle' }, rg);
        tv.textContent = '';
        rackEls[i] = { g: rg, p: rp, det: det, lamp: lmp, val: tv, c: c, full: bpR, flat: bpS };
        cache[i] = {};
      }
      for (z = 0; z < Z; z++) {
        b = Math.floor(z / kRows);
        for (j = 0; j < perLine; j++) drawRack(z * perZone + j);
        /* hot-aisle containment: a translucent roof at cabinet height with its north posts */
        var zl = z - b * kRows, xa = G.ox + zl * G.rowW + G.cabW - 0.04, xb = G.ox + zl * G.rowW + G.cabW + G.hot + 0.04;
        var cg2 = el('g', { 'class': 'hot-cap', 'data-z': z }, field);
        el('polygon', { 'class': 'cap-top', points: pts([[xa, G.cabY0, G.capH], [xb, G.cabY0, G.capH], [xb, G.cabY1, G.capH], [xa, G.cabY1, G.capH]], b) }, cg2);
        el('path', { 'class': 'cap-post', d: 'M' + P(xa, G.cabY0, G.capH, b) + 'L' + P(xa, G.cabY0, 0, b) + 'M' + P(xb, G.cabY0, G.capH, b) + 'L' + P(xb, G.cabY0, 0, b) }, cg2);
        for (j = 0; j < perLine; j++) drawRack(z * perZone + perLine + j);
      }
      var doors = el('g', { 'class': 'fp-doors' }, svg);
      for (z = 0; z < Z; z++) {
        b = Math.floor(z / kRows);
        var zl2 = z - b * kRows, da2 = G.ox + zl2 * G.rowW + G.cabW - 0.04, db = G.ox + zl2 * G.rowW + G.cabW + G.hot + 0.04, dm = (da2 + db) / 2;
        el('polygon', { 'class': 'hot-door', 'data-z': z, points: pts([[da2, G.cabY1, 0], [db, G.cabY1, 0], [db, G.cabY1, G.capH], [da2, G.cabY1, G.capH]], b) }, doors);
        if (iso) el('path', { 'class': 'hot-door', d: 'M' + P(dm, G.cabY1, 0, b) + 'L' + P(dm, G.cabY1, G.capH, b) }, doors);
      }
      if (cdus.length) {   /* the CDU line: one unit line across the hall between the cabinets and the south gallery */
        var wrapC = el('g', { 'class': 'fp-crah fp-cdu', 'data-gallery': 'cdu' }, svg);
        for (b = 0; b < nb; b++) gallery(wrapC, 'cdu', Math.round(b * cdus.length / nb), Math.round((b + 1) * cdus.length / nb), G.cduY0, b, cdus, 'cdu');
      }
      var wrapS = side(ids.bottom, 'south');
      for (b = 0; b < nb; b++) gallery(wrapS, 'south', split + Math.round(b * nSouth / nb), split + Math.round((b + 1) * nSouth / nb), G.sY0, b);

      /* L4 (PRD-CONV-BMS-LIVE): the air moves. Supply leaves each gallery along every cold aisle toward the middle of the
         rows; exhaust runs along each hot-aisle roof from the middle back to both galleries. paint() sets speed (row heat),
         colour (hot-aisle temperature) and whether a CRAH feeds it. */
      var air = el('g', { 'class': 'fp-air', 'aria-hidden': 'true' }, svg), yMid = (G.cabY0 + G.cabY1) / 2, AIR_H = iso ? 0.3 : 0;
      airEls = [];
      for (b = 0; b < nb; b++) {
        var r0 = b * kRows, rn = rowsIn(b);
        for (k = 0; k <= rn; k++) {
          var xc = Math.min(Math.max(0.1, G.ox + k * G.rowW - G.cold / 2), slabW(b) - 0.1), rows = [];
          if (k > 0) rows.push(r0 + k - 1); if (k < rn) rows.push(r0 + k);
          airEls.push({ kind: 'cold', end: 'north', band: b, x: xc, rows: rows,
            el: el('path', { 'class': 'air-cold', 'data-air': 'cold', d: 'M' + P(xc, G.nY0 + G.gD, AIR_H, b) + 'L' + P(xc, yMid, AIR_H, b) }, air) });
          airEls.push({ kind: 'cold', end: 'south', band: b, x: xc, rows: rows,
            el: el('path', { 'class': 'air-cold', 'data-air': 'cold', d: 'M' + P(xc, G.sY0, AIR_H, b) + 'L' + P(xc, yMid, AIR_H, b) }, air) });
        }
        for (k = 0; k < rn; k++) {
          var xh = G.ox + k * G.rowW + G.cabW + G.hot / 2, hH = iso ? G.capH + 0.15 : 0;
          airEls.push({ kind: 'hot', band: b, x: xh, rows: [r0 + k],
            el: el('path', { 'class': 'air-hot', 'data-air': 'hot', 'data-z': r0 + k,
              d: 'M' + P(xh, yMid, hH, b) + 'L' + P(xh, G.cabY0, hH, b) + 'M' + P(xh, yMid, hH, b) + 'L' + P(xh, G.cabY1, hH, b) }, air) });
        }
      }
      if (global.IntersectionObserver) {   /* off screen the air stands still (B7 P4) */
        if (inst.airIo) inst.airIo.disconnect();
        inst.airIo = new global.IntersectionObserver(function (es) { es.forEach(function (e) { root.classList.toggle('fp-offscreen', !e.isIntersecting); }); });
        inst.airIo.observe(svg);
      }

      ringRow = el('polygon', { 'class': 'fp-ring fp-ring-row', points: '', display: 'none' }, svg);
      ringSel = el('polygon', { 'class': 'fp-ring fp-ring-sel', points: '', display: 'none' }, svg);
      ringHover = el('polygon', { 'class': 'fp-ring fp-ring-hover', points: '', display: 'none' }, svg);

      /* row tags: one per row, the letter and the row's value (the page fills .zf-kw). Top view: a strip under each band.
         3D: each tag at the row's south end, along the slab's front edge. */
      var strips = [];
      for (b = 0; b < nb; b++) {
        var strip = html('div', 'zone-strip', canvas); if (!iso && stripH() !== STRIP_H) strip.style.height = stripH() + 'px'; strip.style.top = (iso ? 0 : topPx + b * pitch + wallPx + bodyPx) + 'px'; strips.push(strip);
        for (z = b * kRows; z < b * kRows + rowsIn(b); z++) {
          var zn = model.zones[z], zx = G.ox + (z - b * kRows) * G.rowW + G.cabW + G.hot / 2, cw = G.rowW * u, zp = iso ? XY(zx, G.cabY0, CAB_H, b) : XY(zx, G.slabY, 0, b);
          var zd = html('div', 'zone', strip); zd.setAttribute('data-z', z);
          /* 3D: the tag stands in the screen column of its row's head, its foot 2.15 u above the head's roof: clear of
             the north CRAH gallery behind (whose roof edge rises 1.9 u above the head in that column), so it hides no
             unit and takes no click from it, and still nearer its own row than the next (2.9 u across) */
          if (iso) { zd.style.left = Math.round(zp[0] - 7) + 'px'; zd.style.top = Math.round(zp[1] - 2.15 * u - 17) + 'px'; }
          else { zd.style.left = Math.round(zp[0] - cw / 2) + 'px'; zd.style.width = Math.round(cw) + 'px'; }
          var zh = html('span', 'zone-head', zd, zoneHead(z)); zh.title = zoneTag(z);
          var zf = html('span', 'zone-foot fp-tag num', zd);
          /* opts.footText (DC AI, Amendment 3 D7): the value with its unit on the floor; the Conventional page fills it itself */
          html('span', 'zf-kw', zf, opts.footText ? opts.footText(zn, z) : zn.heat.toFixed(0)).title = 'row heat, kW';
          html('span', 'zf-in sr-only', zf, zn.rackInletC.toFixed(1));
          html('span', 'zf-hot sr-only', zf, zn.hotAisleC.toFixed(1));
          html('span', 'zf-stats sr-only', zf, '');
          zoneEls[z] = zd;
        }
      }
      /* 3D: a tag that would run past the stage's right edge slides left along its own screen row, staying wholly on the
         floor (HV-U1: the last row's tag was cut once its value carried a unit) */
      if (iso) {
        var cwid = canvas.clientWidth || root.clientWidth || 0;
        for (z = 0; z < zoneEls.length && cwid; z++) {
          var ze = zoneEls[z]; if (!ze) continue;
          var zl = parseFloat(ze.style.left) || 0, zw = ze.offsetWidth;
          if (zw && zl + zw > cwid - 4) ze.style.left = Math.max(4, Math.round(cwid - 4 - zw)) + 'px';
        }
      }
      tip = html('div', 'fp-tip', root); tip.hidden = true; tip.setAttribute('role', 'tooltip');
      host.setAttribute('data-fp-host', '1');
      applyTheme();
      wire(strips);
      inst.paint(inst.mode);
      fitTags();
      if (inst.sel) inst.select(inst.sel);
      if (hadFocus) { try { svg.focus({ preventScroll: true }); } catch (e) { svg.focus(); } showCursor(); }
      if (projFocus) { var pb = root.querySelector('.fp-proj-btn[data-proj="' + projFocus + '"]'); if (pb) pb.focus(); }
      if (typeof opts.onBuild === 'function') opts.onBuild(inst);
    }
    inst.projection = function () { return proj; };
    inst.setProjection = function (p) {
      if (p !== 'iso' && p !== 'plan') return;
      try { global.localStorage.setItem(projKey, p); } catch (e) { /* storage blocked: the choice holds for this page only */ }
      if (p === proj) return;
      proj = p; build();
    };
    inst.crahTagEl = function () { return crahTagEl; };
    /* ---- theme: the discrete hex steps, emitted once per theme onto the stage's custom properties ---- */
    function applyTheme() {
      if (!root) return;
      var th = themeOf(), tk = readTokens(root), p = buildPalette(tk.tokens, tk.ink, th), names = ['ok', 'warn', 'alarm', 'neutral'], i, f;
      for (i = 0; i < names.length; i++) {
        f = p[names[i]];
        root.style.setProperty('--fp-' + names[i] + '-t1', f.top[0]); root.style.setProperty('--fp-' + names[i] + '-t2', f.top[1]); root.style.setProperty('--fp-' + names[i] + '-t3', f.top[2]);
        root.style.setProperty('--fp-' + names[i] + '-f', f.front); root.style.setProperty('--fp-' + names[i] + '-s', f.side);
      }
      root.setAttribute('data-fp-theme', th);
    }
    inst.retheme = applyTheme;

    function fillFor(state) {
      var s = 'var(--fp-' + state + '-';
      return { top: s + 't2)', front: s + 'f)', side: s + 's)' };
    }

    /* ---- paint: attributes and existing text only ---- */
    inst.paint = function (mode) {
      mode = MODES.indexOf(mode) >= 0 ? mode : 'temp';
      inst.mode = mode; tipKey = '';   /* a repaint may change a unit's state: the next hover rebuilds its tooltip */
      var i, r, c, e, f, bp, ch, res = [];
      for (i = 0; i < model.racks.length; i++) {
        r = classify(mode, model, i, T); res[i] = r;
      }
      /* PRD-DATAHALL-BMS-ISO rule 1: grey is normal. A cabinet in the ok state wears the neutral faces; only warn and alarm
         wear their state token. Magnitude is a value (row tags, tooltip, row panel), never a colour step or a height. */
      for (i = 0; i < model.racks.length; i++) {
        e = rackEls[i]; if (!e) continue;
        r = res[i]; c = cache[i];
        e.g.setAttribute('data-state', r.state); setAttr(e.g, 'data-step', String(r.step)); setAttr(e.g, 'data-kw', String(model.racks[i].kw));
        if (e.val.textContent !== r.text) e.val.textContent = r.text;
        var spare = r.state === 'spare';
        if (c.spare !== spare) {   /* a spare slot is its footprint outline on the floor; occupancy changes only on a hall swap */
          bp = spare ? e.flat : e.full;
          e.p.top.setAttribute('points', bp.top); e.p.front.setAttribute('points', bp.front); e.p.side.setAttribute('points', bp.side);
          if (spare) { e.p.front.setAttribute('display', 'none'); e.p.side.setAttribute('display', 'none'); e.lamp.setAttribute('display', 'none'); if (e.det) e.det.setAttribute('display', 'none'); }
          else { e.p.front.removeAttribute('display'); e.p.side.removeAttribute('display'); e.lamp.removeAttribute('display'); if (e.det) e.det.removeAttribute('display'); }
          c.spare = spare;
        }
        if (spare) setAttr(e.p.top, 'fill', 'none');
        else {
          f = fillFor(r.state === 'ok' || r.state === 'neutral' ? 'neutral' : r.state);
          setAttr(e.p.top, 'fill', f.top); setAttr(e.p.front, 'fill', f.front); setAttr(e.p.side, 'fill', f.side);
          setAttr(e.lamp, 'data-lamp', r.state === 'warn' || r.state === 'alarm' ? r.state : 'run');
        }
      }
      for (i = 0; i < crahEls.length; i++) {
        ch = crahEls[i]; var run = ch.u.running !== false, stale = run && !!ch.u.stale, st = ch.u.status === 'alarm' ? 'alarm' : (ch.u.status === 'warn' ? 'warn' : 'neutral');
        ch.g.setAttribute('class', 'crah-cell' + (run ? '' : ' stby')); ch.g.setAttribute('data-state', !run ? 'standby' : (stale ? 'stale' : st));
        if (run) {
          f = fillFor(st);
          setAttr(ch.p.top, 'fill', 'var(--fp-' + st + '-t1)'); setAttr(ch.p.front, 'fill', f.front); setAttr(ch.p.side, 'fill', f.side);
          setAttr(ch.lamp, 'data-lamp', stale ? 'stale' : (st === 'neutral' ? 'run' : st));
        } else { setAttr(ch.p.top, 'fill', 'none'); setAttr(ch.p.front, 'fill', 'none'); setAttr(ch.p.side, 'fill', 'none'); setAttr(ch.lamp, 'data-lamp', opts.stbyLamp ? 'stby' : 'off'); }
        /* rotor period = T_ref / (speed / 100): T_ref 1.0 s for a fan, 0.8 s for a pump (§7.1); still at 0 % or standby */
        if (ch.rot) {
          var sp = run && !stale ? ch.u.rotorPct : 0, per = sp > 0 ? (ch.u.rotorRefS || 1) / (sp / 100) : 0;
          setAttr(ch.rot, 'data-turning', per > 0 ? '1' : '0');
          var pd = per > 0 ? per.toFixed(3) + 's' : '';
          if (ch.rot.style.animationDuration !== pd) ch.rot.style.animationDuration = pd;
        }
      }
      host.setAttribute('data-unit', { power: 'kW', temp: '°C', 'cooling-margin': 'K', alarms: '%' }[mode] || '');
      root.setAttribute('data-mode', mode);
      root.setAttribute('data-air', !opts.airModes || opts.airModes.indexOf(mode) >= 0 ? '1' : '0');
      paintAir();
      if (inst.sel) refreshRings();
    };
    function paintAir() {
      var zs = model.zones || [], sum = 0, cnt = 0, i, a, heat, z, near, best, q, cu;
      for (i = 0; i < zs.length; i++) if (zs[i] && zs[i].heat > 0) { sum += zs[i].heat; cnt++; }
      var mean = cnt ? sum / cnt : 0;
      for (i = 0; i < airEls.length; i++) {
        a = airEls[i]; heat = 0;
        for (z = 0; z < a.rows.length; z++) heat += (zs[a.rows[z]] && zs[a.rows[z]].heat) || 0;
        heat = a.rows.length ? heat / a.rows.length : 0;
        var off = !(heat > 0) || !mean;
        if (a.kind === 'cold' && !off) {   /* the nearest CRAH of that gallery feeds this aisle end; off -> no supply from it */
          near = null; best = 1e9;
          for (q = 0; q < crahEls.length; q++) { cu = crahEls[q]; if (cu.gal === a.end && cu.band === a.band && Math.abs(cu.cx - a.x) < best) { best = Math.abs(cu.cx - a.x); near = cu; } }
          if (near && near.u && near.u.running === false) off = true;
        }
        if (a.kind === 'hot') {
          var t = zs[a.rows[0]] && zs[a.rows[0]].hotAisleC;
          setAttr(a.el, 'data-t', t == null ? '1' : (t > 40 ? '3' : (t > 35 ? '2' : '1')));
        }
        if (off) { setAttr(a.el, 'data-off', ''); continue; }
        if (a.el.hasAttribute('data-off')) a.el.removeAttribute('data-off');
        /* 1.4 s per dash period at the mean row heat; a hotter row moves its air faster (0.6 .. 3 s) */
        var sec = Math.max(0.6, Math.min(3, 1.4 * mean / heat));
        var dur = sec.toFixed(2) + 's';
        if (a.el.style.animationDuration !== dur) a.el.style.animationDuration = dur;
        a.el.setAttribute('data-air-s', sec.toFixed(2));
      }
    }

    /* ---- selection, rings ---- */
    function ringPts(sel) {
      if (sel.rack != null) { var e = rackEls[sel.rack]; return (cache[sel.rack].spare ? e.flat : e.full).top; }
      if (sel.crah != null) { for (var i = 0; i < crahEls.length; i++) if (crahEls[i].n === sel.crah) return crahEls[i].top; }
      return null;
    }
    function rowPts(z) { var b = Math.floor(z / kRows), x0 = G.ox + (z - b * kRows) * G.rowW - 0.1, xw = 2 * G.cabW + G.hot + 0.2, h = isIso() ? CAB_H + 0.02 : 0; return pts([[x0, G.cabY0 - 0.15, h], [x0 + xw, G.cabY0 - 0.15, h], [x0 + xw, G.cabY1 + 0.15, h], [x0, G.cabY1 + 0.15, h]], b); }
    function refreshRings() {
      var s = inst.sel, p;
      for (var i = 0; i < model.racks.length; i++) if (rackEls[i]) { rackEls[i].g.removeAttribute('data-sel'); rackEls[i].g.classList.remove('sel'); }
      for (var z = 0; z < Z; z++) zoneEls[z].removeAttribute('data-sel');
      ringRow.setAttribute('display', 'none'); ringSel.setAttribute('display', 'none');
      if (!s) return;
      if (s.row != null) { ringRow.setAttribute('points', rowPts(s.row)); ringRow.removeAttribute('display'); zoneEls[s.row].setAttribute('data-sel', '1'); return; }
      p = ringPts(s);
      if (p) { ringSel.setAttribute('points', p); ringSel.removeAttribute('display'); }
      if (s.rack != null) { rackEls[s.rack].g.setAttribute('data-sel', '1'); rackEls[s.rack].g.classList.add('sel'); zoneEls[rackEls[s.rack].c.z].setAttribute('data-sel', '1'); }
    }
    inst.select = function (sel) {
      var was = inst.sel; inst.sel = sel || null; refreshRings();
      /* PRD-CONV-BMS-MOTION M6: a NEW selection made with the pointer fades its ring in (160 ms, opacity); a repaint or a
         keyboard selection stays instant */
      var M = window.RZConvMotion;
      if (sel && M && M.byPointer() && JSON.stringify(sel) !== JSON.stringify(was)) M.fade(sel.row != null ? ringRow : ringSel);
    };

    /* ---- tooltip ---- */
    var tipKey = '';
    function showTip(target, ev) {
      var key = target.getAttribute('data-idx') != null ? 'r' + target.getAttribute('data-idx') : 'c' + target.getAttribute('data-crah');
      if (key !== tipKey) {
        tip.innerHTML = '';
        if (key.charAt(0) === 'r') {
          var i = +target.getAttribute('data-idx'), rk = model.racks[i], r = classify(inst.mode, model, i, T), u0 = utilOf(model, rk);
          html('div', '', tip, rackTag(i) + ' · ' + zoneTag(rackEls[i].c.z)).style.fontWeight = '600';
          if (rk.occupied) {
            html('div', '', tip, rk.kw.toFixed(1) + ' kW · ' + Math.round(u0 * 100) + ' % of ' + (model.ratingKw || 0).toFixed(0) + ' kW rating');
            html('div', '', tip, 'inlet ' + model.rackInletFor(i).toFixed(1) + ' °C');
          }
          html('div', '', tip, STATE_WORD[r.state]);
          if (rk.note) html('div', '', tip, rk.note);
          html('div', 'tp-hint', tip, 'Click for detail');
        } else {
          var n = +target.getAttribute('data-crah'), cu = null, q;
          for (q = 0; q < crahEls.length; q++) if (crahEls[q].n === n) cu = crahEls[q].u;
          html('div', '', tip, crahTag(n, cu)).style.fontWeight = '600';
          html('div', '', tip, cu && cu.running === false ? 'standby' : (cu && cu.stale ? 'stale · ' + (cu.staleNote || 'no sample') : 'running' + (cu && cu.leavingAirC != null ? ' · leaving air ' + cu.leavingAirC.toFixed(1) + ' °C' : '')));
          /* unit.lines (DC AI, PRD-DCAI-HALL-DEPTH A3): the adapter's operating-point lines, already formatted with units; a stale unit prints none */
          if (cu && cu.lines && !cu.stale) for (q = 0; q < cu.lines.length; q++) html('div', '', tip, cu.lines[q]);
          html('div', 'tp-hint', tip, 'Click for detail');
        }
        tipKey = key;
      }
      var rr = root.getBoundingClientRect(), left = ev.clientX - rr.left + 14, top = ev.clientY - rr.top + 14;
      tip.hidden = false;
      if (left + tip.offsetWidth > rr.width) left = Math.max(0, ev.clientX - rr.left - tip.offsetWidth - 10);
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    }
    function hideTip() { tip.hidden = true; tipKey = ''; }
    function hoverRing(target) {
      var p = null;
      if (target) {
        if (target.getAttribute('data-idx') != null) p = ringPts({ rack: +target.getAttribute('data-idx') });
        else p = ringPts({ crah: +target.getAttribute('data-crah') });
      }
      if (p) { ringHover.setAttribute('points', p); ringHover.removeAttribute('display'); } else ringHover.setAttribute('display', 'none');
    }
    function up(t, sel) { while (t && t !== svg) { if (t.matches && t.matches(sel)) return t; t = t.parentNode; } return null; }

    /* ---- keyboard cursor over the spatial grid: 2 lines x rows across, 10 cabinets deep, galleries north and south ---- */
    function cursorEl() { return cursor.k === 'r' ? rackEls[cursor.idx].g : crahEls[cursor.ci].g; }
    function showCursor() {
      var t = cursorEl(); hoverRing(t);
      svg.setAttribute('aria-activedescendant', t.getAttribute('id'));
      t.setAttribute('aria-label', t.classList && t.classList.contains('rack') ? rackTag(+t.getAttribute('data-idx')) + ', ' + STATE_WORD[t.getAttribute('data-state')] : crahTag(+t.getAttribute('data-crah')));
    }
    function colOf(idx) { var c = rackEls[idx].c; return c.z * 2 + c.line; }
    function idxOf(col, j) { return Math.floor(col / 2) * perZone + (col % 2) * perLine + j; }
    function centerOfCol(col) { return G.ox + (Math.floor(col / 2) % kRows) * G.rowW + (col % 2 ? G.cabW + G.hot : 0) + G.cabW / 2; }
    function bandOfCol(col) { return Math.floor(Math.floor(col / 2) / kRows); }
    function nearestCrah(gal, x, band) {
      var best = -1, bd = 1e9, i, dd;
      for (i = 0; i < crahEls.length; i++) { if (crahEls[i].gal !== gal || crahEls[i].band !== band) continue; dd = Math.abs(crahEls[i].cx - x); if (dd < bd) { bd = dd; best = i; } }
      return best;
    }
    function move(key) {
      if (!cursor) { cursor = { k: 'r', idx: 0 }; return; }
      var i, ci, c;
      if (cursor.k === 'r') {
        var col = colOf(cursor.idx), j = rackEls[cursor.idx].c.j;
        if (key === 'ArrowRight') col = Math.min(Z * 2 - 1, col + 1);
        else if (key === 'ArrowLeft') col = Math.max(0, col - 1);
        else if (key === 'ArrowDown') { if (j === perLine - 1) { ci = nearestCrah('south', centerOfCol(col), bandOfCol(col)); if (ci >= 0) { cursor = { k: 'c', ci: ci }; return; } } else j++; }
        else if (key === 'ArrowUp') { if (j === 0) { ci = nearestCrah('north', centerOfCol(col), bandOfCol(col)); if (ci >= 0) { cursor = { k: 'c', ci: ci }; return; } } else j--; }
        cursor = { k: 'r', idx: idxOf(col, j) };
      } else {
        c = crahEls[cursor.ci];
        if (key === 'ArrowRight' || key === 'ArrowLeft') {
          i = cursor.ci + (key === 'ArrowRight' ? 1 : -1);
          if (crahEls[i] && crahEls[i].gal === c.gal) cursor = { k: 'c', ci: i };
        } else if ((key === 'ArrowDown' && c.gal === 'north') || (key === 'ArrowUp' && c.gal === 'south')) {
          var best = 0, bd = 1e9, cc;
          for (cc = c.band * kRows * 2; cc < Math.min(Z * 2, (c.band + 1) * kRows * 2); cc++) { var dd = Math.abs(centerOfCol(cc) - c.cx); if (dd < bd) { bd = dd; best = cc; } }
          cursor = { k: 'r', idx: idxOf(best, c.gal === 'north' ? 0 : perLine - 1) };
        }
      }
    }
    function activate() {
      if (!cursor) return;
      if (cursor.k === 'r') { inst.select({ rack: cursor.idx }); if (opts.onRack) opts.onRack(cursor.idx, rackEls[cursor.idx].g); }
      else { var ch = crahEls[cursor.ci]; inst.select({ crah: ch.n }); if (opts.onCrah) opts.onCrah(ch.n, ch.g); }
    }

    function wire(strips) {
      svg.addEventListener('pointermove', function (ev) {
        var t = up(ev.target, '.rack,.crah-cell');
        if (!t) { hideTip(); hoverRing(null); return; }
        hoverRing(t); showTip(t, ev);
      });
      svg.addEventListener('pointerleave', function () { hideTip(); if (!cursor || document.activeElement !== svg) hoverRing(null); else showCursor(); });
      svg.addEventListener('click', function (ev) {
        var t = up(ev.target, '.rack,.crah-cell');
        if (!t) return;
        if (t.getAttribute('data-idx') != null) {
          var i = +t.getAttribute('data-idx'); cursor = { k: 'r', idx: i }; inst.select({ rack: i }); if (opts.onRack) opts.onRack(i, t);
        } else {
          var n = +t.getAttribute('data-crah'); for (var q = 0; q < crahEls.length; q++) if (crahEls[q].n === n) cursor = { k: 'c', ci: q };
          inst.select({ crah: n }); if (opts.onCrah) opts.onCrah(n, t);
        }
      });
      svg.addEventListener('focus', function () { if (!cursor) cursor = { k: 'r', idx: 0 }; showCursor(); });
      svg.addEventListener('blur', function () { hoverRing(null); });
      svg.addEventListener('keydown', function (ev) {
        var k = ev.key;
        if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ArrowUp' || k === 'ArrowDown') { ev.preventDefault(); move(k); showCursor(); hideTip(); }
        else if (k === 'Enter' || k === ' ') { ev.preventDefault(); activate(); }
        else if (k === 'Escape') { inst.select(null); }
      });
      strips.forEach(function (strip) {
        strip.addEventListener('click', function (ev) {
          var t = ev.target, zd = null;
          while (t && t !== strip) { if (t.getAttribute && t.getAttribute('data-z') != null && t.className.indexOf('zone') === 0) { zd = t; break; } t = t.parentNode; }
          if (!zd) return;
          var z = +zd.getAttribute('data-z'); inst.select({ row: z }); if (opts.onRow) opts.onRow(z, zd);
        });
      });
    }

    /* ---- resize: rebuilt only when the host's width moved by more than a pixel; selection and mode survive ---- */
    var lastW = meas.clientWidth, lastH = meas.clientHeight, raf = 0;
    if (global.ResizeObserver && !opts.width) {
      inst.ro = new global.ResizeObserver(function () {
        var w = meas.clientWidth, h = meas.clientHeight, hMoved = (opts.height != null) && opts.watchHeight !== false && Math.abs(h - lastH) >= 2;
        if ((Math.abs(w - lastW) < 2 && !hMoved) || !w) return;
        lastW = w; lastH = h;
        if (raf) global.cancelAnimationFrame(raf);
        raf = global.requestAnimationFrame(function () { raf = 0; build(); });
      });
      inst.ro.observe(meas);
    }
    inst.relayout = function () { lastW = meas.clientWidth; lastH = meas.clientHeight; build(); };
    function onTheme() { applyTheme(); }
    global.addEventListener('rz-theme-change', onTheme);
    if (global.MutationObserver) { inst.mo = new global.MutationObserver(onTheme); inst.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); }
    inst.destroy = function () {
      if (inst.ro) inst.ro.disconnect(); if (inst.mo) inst.mo.disconnect();
      global.removeEventListener('rz-theme-change', onTheme); host.innerHTML = ''; if (RZFloorPlan.current === inst) RZFloorPlan.current = null;
    };
    inst.focus = function (idx) { cursor = { k: 'r', idx: idx == null ? 0 : idx }; svg.focus(); showCursor(); };
    inst.thresholds = T;
    inst.rackEl = function (i) { return rackEls[i] && rackEls[i].g; };
    build();
    return inst;
  }

  /* ---------- legend: discrete keys, no bar (PRD 3.3) ---------------------------------------------------------- */
  function legend(box, mode, ratingKw, T) {   /* ratingKw: kept for callers; load is no longer a height */
    T = T || DEFAULT_T;
    var cur = RZFloorPlan.current, ps = cur && cur.host.querySelector('.fp-root'), nm = ['ok', 'warn', 'alarm', 'neutral'], q, w;
    if (ps) for (q = 0; q < nm.length; q++) for (w = 0; w < 3; w++) box.style.setProperty('--fp-' + nm[q] + '-t' + (w + 1), ps.style.getPropertyValue('--fp-' + nm[q] + '-t' + (w + 1)));
    box.innerHTML = '';
    box.className = (box.className.replace(/\bfp-legend\b/g, '') + ' fp-legend').replace(/^\s+/, '');
    function item(state, text) { var s = html('span', 'lg-item', box); html('span', 'fp-sw', s).setAttribute('data-state', state); s.appendChild(document.createTextNode(text)); }
    /* grey is normal (PRD-DATAHALL-BMS-ISO): the normal key is the neutral swatch; colour is only ever a warning or an alarm */
    if (mode === 'space') { item('neutral', 'occupied'); item('spare', 'spare'); }
    else if (mode === 'temp') { item('neutral', 'normal'); item('warn', 'warning > ' + T.inletMax + ' °C'); item('alarm', 'alarm > ' + T.inletAlarm + ' °C'); item('spare', 'spare'); }
    else if (mode === 'cooling-margin') { item('neutral', 'normal'); item('warn', 'warning < 0 K'); item('alarm', 'alarm < −' + Math.abs(T.marginAlarm) + ' K'); item('spare', 'spare'); }
    else { item('neutral', 'normal'); item('warn', 'warning'); item('alarm', 'alarm'); item('spare', 'spare'); }
  }

  var RZFloorPlan = {
    version: '2.1.0',
    MODES: MODES,
    current: null,
    render: function (host, model, opts) { var i = create(host, model, opts); RZFloorPlan.current = i; return i; },
    paint: function (mode) { if (RZFloorPlan.current) RZFloorPlan.current.paint(mode); },
    select: function (sel) { if (RZFloorPlan.current) RZFloorPlan.current.select(sel); },
    legend: legend,
    classify: classify,
    unit: function () { return RZFloorPlan.current ? RZFloorPlan.current.u : 0; },
    /* the steps of one theme as discrete hex values, computed in OKLCH from the stage's own state tokens */
    palette: function (theme) {
      var root = (RZFloorPlan.current && RZFloorPlan.current.host.querySelector('.fp-root')) || document.documentElement;
      var tk = readTokens(root);
      return buildPalette(tk.tokens, tk.ink, theme || themeOf());
    },
    oklch: function (hex) { var c = parseColor(hex); return c ? rgbToOklch(c) : null; },
    FACE_L: FACE_L, MAG_DL: MAG_DL, GEOMETRY: GEO, DEFAULT_THRESHOLDS: DEFAULT_T
  };
  global.RZFloorPlan = RZFloorPlan;
})(window);
