/* RZ DC AI — the Data Hall in 3D (PRD-DATAHALL-BMS-ISO F4, owner R185: "jadi kayak bukan BMS")
 *
 * A geometry ADAPTER, not a second renderer: the hall's engine counts become the model js/conv/floor-plan.js already
 * draws for the Conventional hall, so both cockpits share one BMS floor (grey is normal, a green lamp per cabinet, state
 * colour only on warn / alarm, equal-height cabinets, true isometric 30 deg).
 *
 *   2D       the same floor drawn top-down (the renderer's plan projection) — the DEFAULT at every width
 *            (PRD-DCAI-HALL-DEPTH Amendment 1, owner 2026-11-23: "button flat 2d … default ia 2d")
 *   3D       the isometric floor in #hIso: 20 rows of racks as 10 contained pairs (one hot-aisle roof each), the north
 *            and south fan-wall galleries, the CDU line between the rack field and the south gallery
 *   Drawing  the engineering drawing #hSvg, unchanged (every layer, sensor and dimension); it was called "Plan"
 *
 * In 2D and 3D the floor gets the screen: the drawing (with its IT / liquid / air cards, layer bar and key) is hidden and
 * one summary line beside the switch carries the hall totals. The switch is three buttons (aria-pressed) stored under
 * rz.dcai.view; nothing stored means 2D; ?view=flat|iso|drawing opens a view without storing it. The old key
 * rz.dcai.proj is removed, so every visitor lands on 2D once.
 *
 * No engine arithmetic here: counts come from renderHall's own engine reads (RZHallIso.update), temperatures from the
 * aisle readouts the plan already draws (#C<pair><point>t cold, #H<pair><point>t hot). Every rack and unit carries the
 * plan's equipment reference (rack-unit:Rnn-kk, crah:nn, cdu:n), so a click opens the same HMI the plan opens. ES5.
 */
(function () {
  'use strict';
  var doc = document, win = window, KEY = 'rz.dcai.view', OLD_KEY = 'rz.dcai.proj', VIEWS = ['flat', 'iso', 'drawing'];
  var panel = doc.getElementById('p-hall'), svg = doc.getElementById('hSvg');
  if (!panel || !svg) return;

  /* PRD-DCAI-HALL-DEPTH A2 §4.3: one lens bar for 2D and 3D, each lens one floor-plan paint mode */
  var LENS_KEY = 'rz.dcai.lens', LENSES = [['status', 'Status', 'alarms', 'Lamps and alarms only'], ['thermal', 'Thermal', 'temp', 'Rack inlet against the ASHRAE A1 limit'],
    ['cooling', 'Cooling', 'cooling-margin', 'Cooling margin per rack; fan-wall and CDU run / standby'], ['power', 'Power', 'power', 'Rack kW against its rating'],
    ['layout', 'Layout', 'space', 'Occupied and spare positions']];
  function lensMode(l) { for (var i = 0; i < LENSES.length; i++) if (LENSES[i][0] === l) return LENSES[i][2]; return 'alarms'; }
  function lensStored() { try { var v = win.localStorage.getItem(LENS_KEY); return lensMode(v) && LENSES.some(function (d) { return d[0] === v; }) ? v : null; } catch (e) { return null; } }
  var lens = lensStored() || 'status', lensBar = null, legendBox = null, tableBox = null;
  var lastHall = '', geo = null, model = null, inst = null, host = null, wrap = null, bar = null, sum = null, view = null, timer = 0, sig = '';
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function stored() { try { var v = win.localStorage.getItem(KEY); return VIEWS.indexOf(v) >= 0 ? v : null; } catch (e) { return null; } }
  function fromUrl() { var m = /[?&]view=(flat|iso|drawing)(?:&|$)/.exec(win.location.search || ''); return m ? m[1] : null; }
  try { win.localStorage.removeItem(OLD_KEY); } catch (e) { /* storage blocked */ }
  function store(p) { try { win.localStorage.setItem(KEY, p); } catch (e) { /* storage blocked: the choice holds for this page */ } }
  function num(id) { var el = doc.getElementById(id), v = el ? parseFloat(el.textContent) : NaN; return isFinite(v) ? v : null; }

  /* ---- the switch and the host, built once ---- */
  function css() {
    if (doc.getElementById('dh-proj-css')) return;
    var st = doc.createElement('style'); st.id = 'dh-proj-css';
    st.textContent = [
      '.dh-proj{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px}',
      '.dh-sum{min-width:0;color:var(--t2);font:500 12px/1.3 "IBM Plex Mono",ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dh-sum b{color:var(--t1);font-weight:600}',
      '#p-hall[data-dh-view="drawing"] .dh-sum{visibility:hidden}',
      /* a phone: summary (one line, full text in its tooltip) and the view switch share row one, the lens bar is row two */
      '@media (max-width:600px){.dh-proj{flex-wrap:wrap;gap:6px}.dh-sum{flex:1 1 0;order:1}.dh-proj [role=group]{order:2;margin-left:auto}}',
      '.dh-proj [role=group]{display:inline-flex;border:1px solid var(--bd);border-radius:4px;overflow:hidden}',
      '.dh-proj button{appearance:none;margin:0;min-width:48px;height:26px;padding:0 12px;border:0;background:transparent;color:var(--t2);font:600 11px/26px "IBM Plex Sans",system-ui,sans-serif;letter-spacing:.04em;cursor:pointer}',
      '.dh-proj button+button{border-left:1px solid var(--bd)}',
      '.dh-proj button[aria-pressed="true"]{color:var(--t1);background:var(--bg3)}',
      '.dh-proj [role=toolbar]{display:inline-flex;margin-left:auto;border:1px solid var(--bd);border-radius:4px;overflow:hidden}',
      '#p-hall[data-dh-view="drawing"] .dh-proj [role=toolbar]{visibility:hidden}',
      /* the lens legend: one column beside the stage (the floor is height-bound, the room to its right is free) */
      '#p-hall[data-dh-view="drawing"] .dh-units{display:none}.dh-units{margin:6px 0 0;font:12px/1.4 "IBM Plex Sans",system-ui,sans-serif;color:var(--t2)}',
      '.dh-units summary{cursor:pointer;color:var(--t2);padding:4px 0}.dh-units summary:focus-visible{outline:2px solid var(--c);outline-offset:2px}',
      '.dh-units table{width:100%;border-collapse:collapse;font:11px/1.4 "IBM Plex Mono",ui-monospace,monospace}.dh-units caption{text-align:left;color:var(--t3);padding:2px 0}',
      '.dh-units th,.dh-units td{text-align:left;padding:2px 8px 2px 0;border-bottom:1px solid var(--bd);color:var(--t1);font-weight:400}',
      '#hIsoWrap .dh-legend{flex-direction:column;align-items:flex-start;gap:6px;padding-top:4px}',
      '@media (max-width:600px){.dh-proj [role=toolbar]{order:3;flex:1 1 100%;margin-left:0}.dh-proj [role=toolbar] button{flex:1 1 0;min-width:0;padding:0 4px}}',
      '.dh-proj button:focus-visible{outline:2px solid var(--c);outline-offset:-2px}',
      '@media (max-width:600px){.dh-proj button{height:40px;line-height:40px;min-width:56px}}',
      /* HV-F2: the head shrink-wraps its text and centres on its row pair (a fixed 20 px box let 'R01/02' run off to the right) */
      '#hIso .fp-root[data-proj="plan"] .zone-head{display:table;width:auto;min-width:20px;padding:1px 3px;margin:0 auto}',
      /* HV-F2b: on a phone a row pair is ~37 px wide; the head '01/02' at 10 px keeps >= 3 px of air to its neighbour */
      '@media (max-width:600px){#hIso .fp-root[data-proj="plan"] .zone-head{font-size:10px;letter-spacing:-.02em;padding:1px 0;min-width:0}}',
      /* D7: on a phone the row-pair foot stacks its unit under the value ('6.2' over 'MW'), three characters wide */
      '@media (max-width:600px){#hIso .fp-root[data-proj="plan"] .zone-foot{font-size:10px;letter-spacing:-.02em;padding:1px 0}#hIso .fp-root[data-proj="plan"] .zf-kw{display:inline-block;width:3.2ch;white-space:normal;text-align:center;line-height:1.1}}',
      /* A8f: a banded phone plan grows down the page (no inner scroller cap) and each tag has a pair's width, one line */
      '@media (max-width:600px){.svg-zi:has(#hIso .fp-root[data-proj="plan"]:not([data-bands="1"])){max-height:none}#hIso .fp-root[data-proj="plan"]:not([data-bands="1"]) .zf-kw{width:auto;white-space:nowrap}}',
      /* Amendment 3 D4: flags, ink on the panel with a 1 px state hairline and the state glyph; no wash, no motion */
      '#hIso{position:relative}.dh-flags{position:absolute;inset:0;pointer-events:none}',
      '.dh-flag,.dh-flag-more{position:absolute;white-space:nowrap;padding:1px 5px;border:1px solid var(--rz-pt-warn,#d97706);border-radius:2px;background:var(--bg2);color:var(--t1);font:600 11px/16px "IBM Plex Mono",ui-monospace,monospace}',
      '.dh-flag[data-sev="alarm"]{border-color:var(--rz-pt-alarm,#dc2626)}',
      '.dh-flag-more{right:6px;top:6px;border-color:var(--bd);color:var(--t2)}',
      /* A5c: a flag is a button that opens the alarms it stands for; the hit area grows outside the hairline box, so the
         placed box (and the overlap laws) stay as drawn */
      'button.dh-flag,button.dh-flag-more{pointer-events:auto;cursor:pointer;margin:0;text-align:left}',
      'button.dh-flag::before,button.dh-flag-more::before{content:"";position:absolute;inset:-5px -2px}',
      'button.dh-flag:focus-visible,button.dh-flag-more:focus-visible{outline:2px solid var(--t1);outline-offset:2px}',
      '@media (max-width:600px){.dh-flag,.dh-flag-more{font-size:10px;line-height:14px;padding:0 3px}}',
      '#hIsoWrap{display:none;margin:0}#p-hall:not([data-dh-view="drawing"]) #hIsoWrap{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px 16px}',
      '#hIso{display:none;box-sizing:content-box;background:var(--bg2);border:1px solid var(--bd);border-radius:4px;overflow:hidden}',
      '#p-hall:not([data-dh-view="drawing"]) #hIso{display:block}',
      /* 2D / 3D: the drawing, its legibility note, layer bar and key speak of the drawing — out of the way */
      '#p-hall[data-dh-view] .dh-draw-hide{display:none!important}',
      '#p-hall[data-dh-view="drawing"] .dh-draw-hide{display:revert!important}',
      '#p-hall[data-dh-view]:not([data-dh-view="drawing"]) [data-rz-legible-note]{display:none!important}',
      /* a phone: the KPI strip is one row that scrolls inside itself, so the floor starts on the first screen (HV-F1) */
      /* Amendment 7 (A6a): each lens draws its own layer; nothing of it shows in another lens */
      '#hIso{--fp-liq-sup:#5fb0c6;--fp-liq-ret:#c48c68}[data-theme="light"] #hIso{--fp-liq-sup:#1d6b80;--fp-liq-ret:#87502e}',
      '#hIso .fp-ovl{pointer-events:none}#hIso .fp-ovl [data-lens]{display:none}',
      '#hIso[data-lens-on="cooling"] .fp-ovl [data-lens~="cooling"],#hIso[data-lens-on="thermal"] .fp-ovl [data-lens~="thermal"],#hIso[data-lens-on="power"] .fp-ovl [data-lens~="power"],#hIso[data-lens-on="status"] .fp-ovl [data-lens~="status"],#hIso[data-lens-on="layout"] .fp-ovl [data-lens~="layout"]{display:inline}',
      '#hIso .ovl-pipe{fill:none;stroke-width:2;stroke-linecap:round;stroke-dasharray:5 7}',
      '#hIso .ovl-pipe[data-loop="sup"]{stroke:var(--fp-liq-sup)}#hIso .ovl-pipe[data-loop="ret"]{stroke:var(--fp-liq-ret)}',
      '@keyframes dh-ovl-flow{to{stroke-dashoffset:-12}}',
      '@media (prefers-reduced-motion:no-preference){#hIso .ovl-pipe{animation:dh-ovl-flow 1s linear infinite}}',
      '#hIso .fp-root.fp-offscreen .ovl-pipe{animation-play-state:paused}',
      '#hIso .cr-valve{display:none}#hIso[data-lens-on="cooling"] .cr-valve{display:inline}#hIso .ovl-st[data-hot="1"]{stroke:var(--fp-ink,#e8edf5);stroke-width:1.5}',
      '#hIso .ovl-st{stroke:var(--bg2);stroke-width:1}#hIso .ovl-st[data-state="stale"]{fill:none;stroke:var(--t3);stroke-dasharray:1.5 1.5}#hIso .ovl-st[data-state="ok"]{fill:var(--rz-pt-ok,#16a34a)}#hIso .ovl-st[data-state="warn"]{fill:var(--rz-pt-warn,#d97706)}#hIso .ovl-st[data-state="alarm"]{fill:var(--rz-pt-alarm,#dc2626)}#hIso .ovl-st[data-side="hot"]{fill:var(--fp-ink,#e8edf5)}',
      '#hIso .ovl-bw-track{stroke:var(--bd);stroke-width:3;stroke-linecap:butt}#hIso .ovl-bw{stroke:var(--fp-ink,#e8edf5);stroke-width:3;stroke-linecap:butt}',
      '#hIso .ovl-corr{fill:var(--t3);font:500 9px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.06em}',
      '.dh-hallops{display:flex;flex-direction:column;gap:6px;margin-top:10px;font:500 11px/1.35 "IBM Plex Mono",ui-monospace,monospace;color:var(--t2)}',
      '.dh-hallops{width:150px;max-width:150px}.dh-hallchip{padding:4px 6px;border:1px solid var(--bd);border-radius:2px;background:var(--bg2);white-space:normal}.dh-hallchip b{color:var(--t1);font-weight:600}',
      '#hIsoWrap .dh-hallops[hidden]{display:none}',
      '@media (max-width:600px){.dh-hallops{flex-direction:row;flex-wrap:wrap;margin-top:0;width:auto;max-width:none}}',
      '@media (max-width:600px){#p-hall[data-dh-view] > .kpi{display:flex;flex-direction:row;flex-wrap:nowrap;grid-template-columns:none;overflow-x:auto;gap:6px;scrollbar-width:thin}#p-hall[data-dh-view] > .kpi > .k{flex:0 0 104px}}'
    ].join('\n');
    doc.head.appendChild(st);
  }
  function ui() {
    if (host) return;
    css();
    bar = doc.createElement('div'); bar.className = 'dh-proj';
    sum = doc.createElement('div'); sum.className = 'dh-sum'; sum.title = 'Hall totals from the engine; the full cards are on the Drawing view';
    bar.appendChild(sum);
    /* the lens bar (role toolbar, so the view switch stays the panel's one role=group) */
    lensBar = doc.createElement('div'); lensBar.setAttribute('role', 'toolbar'); lensBar.setAttribute('aria-label', 'Floor lens'); bar.appendChild(lensBar);
    LENSES.forEach(function (d) {
      var b = doc.createElement('button'); b.type = 'button'; b.setAttribute('data-lens', d[0]); b.textContent = d[1]; b.title = d[3];
      b.setAttribute('aria-pressed', d[0] === lens ? 'true' : 'false');
      b.addEventListener('click', function () { setLens(d[0], true); });
      lensBar.appendChild(b);
    });
    var g = doc.createElement('div'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Hall view'); bar.appendChild(g);
    [['flat', '2D', 'Top view of the floor, one symbol per unit'], ['iso', '3D', 'Isometric floor'],
     ['drawing', 'Drawing', 'Engineering drawing with every layer, sensor and dimension']].forEach(function (d) {
      var b = doc.createElement('button'); b.type = 'button'; b.setAttribute('data-view', d[0]); b.textContent = d[1]; b.title = d[2];
      b.addEventListener('click', function () { set(d[0], true); });
      g.appendChild(b);
    });
    /* keyboard: Left / Right move between the three (one key = one view, no animation) */
    g.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var bs = [].slice.call(g.querySelectorAll('button')), i = bs.indexOf(doc.activeElement);
      if (i < 0) return;
      e.preventDefault(); i = (i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length; bs[i].focus(); set(bs[i].getAttribute('data-view'), true);
    });
    /* the drawing and everything that speaks only of it */
    var pane = svg.closest('[data-rz-legible-pane]') || svg;
    [pane, doc.getElementById('hallLayers')].concat([].slice.call(panel.querySelectorAll('.hp-key'))).forEach(function (el) { if (el) el.classList.add('dh-draw-hide'); });
    pane.parentNode.insertBefore(bar, pane);
    host = doc.createElement('div'); host.id = 'hIso'; host.setAttribute('data-rz-hall', String(win.currentDH || 1));
    /* Amendment 5 (A5d): the unit the operator opened (click or Enter) stays selected after its HMI closes */
    host.addEventListener('rz-equipment-activate', function (e) { selectRef(e.detail && e.detail.ref); });
    /* DC AI traceability (test-dcai-coverage): every number the 3D floor prints comes from here */
    host.setAttribute('data-rz-authored-basis', 'row-pair heat = racks per pair x design rack kW (engine counts multiplied, not a reading); ' +
      'rack inlet and hot-aisle values are the plan\'s simulated aisle readouts, or the engine design supply / return air before the first readout');
    /* the floor measures this wrapper, never #hIso itself: the renderer sets the host's width from what it measures, so
       measuring the bordered host shrank it 2 px per resize, for ever, until the hall vanished (owner, 2026-11-22) */
    wrap = doc.createElement('div'); wrap.id = 'hIsoWrap'; wrap.appendChild(host);
    bar.parentNode.insertBefore(wrap, bar.nextSibling);   /* right under the switch: the floor is the first thing below it */
    /* HV-A1: every unit of the floor as rows (racks, fan-wall modules, CDUs), built when opened */
    tableBox = doc.createElement('details'); tableBox.className = 'dh-units';
    var smy = doc.createElement('summary'); smy.textContent = 'Show as table'; tableBox.appendChild(smy);
    tableBox.addEventListener('toggle', function () { if (tableBox.open) unitTable(); });
    wrap.parentNode.insertBefore(tableBox, wrap.nextSibling);
  }

  /* Amendment 2 P2: each unit's body in metres, by the same formulas the Drawing view uses (law HV-G2 compares the two):
     fan-wall modules, north gallery first, at the module pitch, the body on the hall face of the gallery; CDUs grouped
     under the containment pair they serve (the first pairs take one more when the count does not divide), centred on it */
  function placeUnits(crah, cdu, pairs) {
    var M = geo.m, P = M && M.place, i, k, n, p;
    if (!P) return;
    var pitchFw = M.hallLength / M.modsPer, rowPitch = M.rackDepth + M.coldAisle + M.hotAisle;
    var yC1 = M.galleryDepth + geo.perRow * M.rackPitch + M.crossAisle, yS0 = M.hallWidth - M.galleryDepth;
    for (i = 0; i < crah.length; i++) {
      var north = i < M.modsPer, q = north ? i : i - M.modsPer;
      crah[i].box = { x: q * pitchFw + pitchFw * (1 - P.fanFill) / 2, w: pitchFw * P.fanFill, y: north ? M.galleryDepth - P.fanD : yS0, d: P.fanD };
    }
    var base = Math.floor(cdu.length / pairs), extra = cdu.length % pairs;
    for (p = 0, n = 0; p < pairs; p++) {
      var cnt = base + (p < extra ? 1 : 0), x0 = p * 2 * rowPitch + rowPitch - cnt * P.cduPitch / 2;
      for (k = 0; k < cnt && n < cdu.length; k++, n++) cdu[n].box = { x: x0 + k * P.cduPitch, w: P.cduW, y: yC1 + P.cduOff, d: P.cduD };
    }
  }

  /* ---- the model the floor renderer reads ---- */
  function build() {
    var G = geo, perZone = 2 * G.perRow, Z = G.rows / 2, racks = [], zones = [], crah = [], cdu = [], i, z;
    for (i = 0; i < Z * perZone; i++) {
      z = Math.floor(i / perZone);
      var r = i % perZone, line = r < G.perRow ? 0 : 1, j = r % G.perRow;
      /* the plan numbers racks from the corridor (south) end: k = 1 is the southernmost; the renderer counts j from north */
      racks.push({ idx: i, occupied: true, kw: G.kwRack, ref: 'rack-unit:R' + pad2(2 * z + line + 1) + '-' + pad2(G.perRow - j) });
    }
    for (z = 0; z < Z; z++) zones.push({ z: z, heat: perZone * G.kwRack, rackInletC: 0, hotAisleC: 0 });
    for (i = 1; i <= G.crahInst; i++) crah.push(withOps({ n: i, tag: 'CRAH-' + pad2(i), running: G.crahAct == null || i <= G.crahAct, ref: 'crah:' + pad2(i), kind: 'crah' }));
    for (i = 1; i <= G.cduInst; i++) cdu.push(withOps({ n: 1000 + i, tag: 'CDU-' + pad2(i), running: G.cduRun == null || i <= G.cduRun, ref: 'cdu:' + i, kind: 'cdu' }));
    placeUnits(crah, cdu, Z);
    model = {
      racks: racks, zones: zones, crahUnits: crah, cduUnits: cdu, racksPerZone: perZone,
      /* Power lens: rack kW against the rack's installed power-shelf rating (engine power.shelf_installed_kw); no rating, no colour */
      ratingKw: G.rackRatedKw || 0,
      rackInletFor: function (idx) {
        var zz = Math.floor(idx / perZone), j = (idx % perZone) % G.perRow, si = Math.min(G.sp - 1, Math.floor(j * G.sp / G.perRow));
        var v = num('C' + zz + si + 't'); return v != null ? v : zones[zz].rackInletC;
      },
      /* Amendment 8 (A8d): what one rack is doing, in one tooltip — its inlet NAMED by the station it reads (never
         interpolated), its liquid loop and its feed, all engine fields; replaces the floor's bare inlet line */
      rackLines: function (idx) {
        var zz = Math.floor(idx / perZone), j = (idx % perZone) % G.perRow, si = Math.min(G.sp - 1, Math.floor(j * G.sp / G.perRow)), v = num('C' + zz + si + 't');
        return ['inlet ' + (v != null ? v.toFixed(1) + ' °C' : '—') + ' · cold aisle point ' + (si + 1) + ' of ' + G.sp,
          'TCS ' + f0(geo.tcsRackLpm) + ' L/min · ' + f1(geo.tcsSupC) + ' → ' + f1(geo.tcsRetC) + ' °C', 'feed A ' + f0(geo.feedA) + ' A'];
      }
    };
    readSensors();
    unitStates();
  }

  /* PRD-DCAI-HALL-DEPTH Amendment 3 (A5a): what the cooling scenario did to each unit, read from the SAME HMI payload a
     click opens (one source, law HV-S1); the floor holds no state rule of its own. D2: a critical alarm or a wet rack
     manifold is red (alarm); any other active alarm or a fault chip is amber (warn). Rotors are untouched (D3: a
     standby pump takes duty at the same speed; the leak auto-shutoff is armed, not tripped). ~30 ms, once per change. */
  function sevOf(p) {
    var al = (p && p.tabs && p.tabs.alarms) || [], i;
    for (i = 0; i < al.length; i++) if (al[i].severity === 'critical') return 'alarm';
    return al.length || (p && p.statusChip && p.statusChip.state === 'fault') ? 'warn' : null;
  }
  /* A5b B1: the hall's scenario alarms — every alarm of the CDU and fan-wall payloads plus the leak payload's zones (a
     wet rack row is that same leak event, never a second alarm). The strip counts them, the workspace journals them. */
  var hallAlarms = [], journalled = {}, journalSeq = 0, pendingJournal = [];
  function noSample(p) {
    var t = (p && p.tabs) || {}, k, i, r;
    for (k in t) if (Object.prototype.hasOwnProperty.call(t, k) && Array.isArray(t[k])) for (i = 0; i < t[k].length; i++) {
      r = t[k][i]; if (r && r.quality === 'replay' && (r.value == null || r.text === '\u2014')) return true;
    }
    return false;
  }
  function staleCount() { return model ? model.crahUnits.concat(model.cduUnits).filter(function (u) { return u.running !== false && u.stale; }).length : 0; }
  function unitStates() {
    if (!model) return;
    var P = win.RZDatahallAIHmiPayloads, ctx = null, i, rows = {}, set = [], seen = {};
    function collect(p) { ((p && p.tabs && p.tabs.alarms) || []).forEach(function (a) { var k = a.tag + '|' + a.point; if (!seen[k]) { seen[k] = true; set.push(a); } }); }
    try { ctx = P && P.buildContext ? P.buildContext(win, { hall: win.currentDH || 1, noTrend: true }) : null; } catch (e) { ctx = null; }
    function pay(cls, id) { try { return ctx ? P.payload(cls, id, ctx) : null; } catch (e) { return null; } }
    model.crahUnits.concat(model.cduUnits).forEach(function (u) {
      var m = /^(crah|cdu):(\d+)$/.exec(u.ref), p = m ? pay(m[1], m[2]) : null, s = sevOf(p), al = p && p.tabs && p.tabs.alarms && p.tabs.alarms[0];
      collect(p);
      /* Amendment 6 (A5e): a replayed reading without a sample makes the unit stale — its lamp, tooltip and table say so */
      u.stale = noSample(p);
      u.staleNote = u.stale ? 'no sample at the replay time' : null;
      u.status = s; u.point = s ? (al ? al.point : 'STATE') : null;
      u.note = s ? (al ? al.point + ' · ' + al.message : (p.statusChip && p.statusChip.label) || '') : null;
      if (u.baseLines == null) u.baseLines = u.lines.slice();
      u.lines = u.note ? u.baseLines.concat([(s === 'alarm' ? '◆ ' : '▲ ') + u.note]) : u.baseLines.slice();
    });
    for (i = 0; i < model.racks.length; i++) {
      var rk = model.racks[i], mm = /^rack-unit:R(\d\d)-/.exec(rk.ref), row = mm ? mm[1] : null;
      if (row && !(row in rows)) {
        var p = pay('rack-unit', 'R' + row + '-01'), wet = p && p.state && p.state('manifold') === 'wet', s2 = wet ? 'alarm' : sevOf(p);
        rows[row] = s2 ? { s: s2, point: wet ? 'manifold' : ((p.tabs.alarms[0] || {}).point || 'STATE'), note: wet ? 'manifold wet (cooling scenario leak zone)' : ((p.tabs.alarms[0] || {}).message || '') } : null;
      }
      var st = row ? rows[row] : null;
      rk.status = st ? st.s : null; rk.point = st ? st.point : null; rk.note = st ? (st.s === 'alarm' ? '◆ ' : '▲ ') + st.note : null;
    }
    collect(pay('leak', '1'));
    hallAlarms = set;
    journal();
    try { doc.dispatchEvent(new CustomEvent('rz-hall-alarms', { detail: { count: set.length } })); } catch (e) { /* old engine: no event */ }
  }
  /* A5b B3: the Alarms workspace is append-only (the fire workstation's pattern). A new alarm is journalled active, an
     alarm the scenario clears is journalled returned; its scenario is the one that raised it. */
  function journal() {
    var scen = (doc.getElementById('coolingScenario') || {}).value || 'normal', now = {}, recs = [], k, hall = 'DH-' + pad2(win.currentDH || 1), t = new Date().toISOString();
    function rec(a, active, sc) {
      journalSeq++;
      return { id: 'SCN-' + Date.now().toString(36) + '-' + journalSeq, timestamp: t, sequence: 1000000 + journalSeq, tag: String(a.tag), point: String(a.point),
        location: hall + '/' + a.tag, system: a.system || 'cooling', severity: a.severity || 'high', lifecycle: active ? 'active_unack' : 'returned_unack',
        kind: 'discrete', quality: 'simulated', event: active ? 'alarm' : 'return-to-normal', action: active ? 'acknowledge' : 'acknowledge-return',
        scenario: sc, operator: 'system', message: active ? String(a.message) : 'Returned to normal: ' + a.message, incidentId: 'SCN-' + sc,
        previousState: active ? 'normal' : 'alarm', currentState: active ? 'alarm' : 'normal' };
    }
    hallAlarms.forEach(function (a) { var key = a.tag + '|' + a.point; now[key] = true; if (!journalled[key]) { journalled[key] = { a: a, sc: scen }; recs.push(rec(a, true, scen)); } });
    for (k in journalled) if (Object.prototype.hasOwnProperty.call(journalled, k) && !now[k]) { recs.push(rec(journalled[k].a, false, journalled[k].sc)); delete journalled[k]; }
    pendingJournal = pendingJournal.concat(recs);
    flushJournal();
  }
  function flushJournal() {
    var W = win.RZDatahallAIAlarmWorkspace;
    if (!pendingJournal.length || !W || !W.appendEvents) return;
    try { W.appendEvents(pendingJournal); pendingJournal = []; }
    catch (e) { if (!/unavailable/.test(e.message)) { if (win.console) win.console.warn('[hall-iso] ' + e.message); pendingJournal = []; } }
  }
  /* D4: flags group neighbouring units with one point and severity (a rack row, the CDU line, one gallery); <= 8 flags,
     red first then the larger group; the units left over are counted on a "+n" chip at the stage corner */
  var flagBox = null;
  function groups() {
    var g = {}, out = [], k;
    function add(key, sev, point, tag, ref, note) { if (!g[key]) { g[key] = { sev: sev, point: point, tags: [], refs: [], note: note }; out.push(g[key]); } g[key].tags.push(tag); g[key].refs.push(ref); }
    model.racks.forEach(function (rk) { if (rk.status) { var row = rk.ref.replace(/^rack-unit:(R\d\d)-.*$/, '$1'); add('r' + row + rk.point + rk.status, rk.status, rk.point, rk.ref.replace('rack-unit:', ''), rk.ref, rk.point === 'manifold' ? 'wet' : ''); g['r' + row + rk.point + rk.status].row = row; } });
    var mods = geo.m && geo.m.modsPer;
    model.crahUnits.forEach(function (u, i) { if (u.status) add('f' + (mods && i >= mods ? 's' : 'n') + u.point + u.status, u.status, u.point, u.tag, u.ref, 'fault'); });
    model.cduUnits.forEach(function (u) { if (u.status) add('c' + u.point + u.status, u.status, u.point, u.tag, u.ref, 'fault'); });
    for (k = 0; k < out.length; k++) out[k].tags.sort(function (a, b) { return a.localeCompare(b, 'en', { numeric: true }); });
    for (k = 0; k < out.length; k++) out[k].label = (out[k].sev === 'alarm' ? '◆ ' : '▲ ') + (out[k].row ? 'Row ' + out[k].row + (out[k].tags.length > 1 ? ' ×' + out[k].tags.length : '') : out[k].tags.length > 1 ? out[k].tags[0] + '…' + out[k].tags[out[k].tags.length - 1] + ' ×' + out[k].tags.length : out[k].tags[0]) +
      ' · ' + out[k].point + (out[k].note ? ' ' + out[k].note : '');
    return out.sort(function (a, b) { return (a.sev === b.sev ? 0 : (a.sev === 'alarm' ? -1 : 1)) || b.refs.length - a.refs.length; });
  }
  /* A5c: the alarm records a flag stands for, from the same set that drew it. A wet row is its leak zone's event
     (LEAK-Zrr, A5b B1); every other group is its units' alarms of the group's point. */
  function alarmsOf(g) {
    if (g.point === 'manifold') {
      var zone = 'LEAK-Z' + String(g.tags[0] || '').replace(/^R(\d\d).*$/, '$1');
      return hallAlarms.filter(function (a) { return a.tag === zone; });
    }
    return hallAlarms.filter(function (a) { return a.point === g.point && g.tags.indexOf(a.tag) >= 0; });
  }
  /* opens Alarms & Events on the active alarms of this hall, narrowed to one point when given (Amendment 4 C2, C3) */
  function openAlarms(point) {
    var hall = 'DH-' + pad2(win.currentDH || 1), tab = doc.querySelector('#tabs [data-t="alarms"]');
    if (tab) tab.click();
    var tries = 0;
    (function apply() {
      var form = doc.getElementById('alarmFilterForm'), view = doc.getElementById('alarmSavedView');
      if (!form || !view) { if (++tries < 40) win.setTimeout(apply, 50); return; }
      form.reset();
      view.value = 'active';
      doc.getElementById('alarmPoint').value = point || '';
      doc.getElementById('alarmText').value = hall + '/';
      view.dispatchEvent(new Event('change', { bubbles: true }));
      var n = doc.getElementById('alarmResultCount');
      if (n) { n.setAttribute('tabindex', '-1'); n.focus(); }
    })();
  }
  function drawFlags() {
    if (!wrap || !host) return;
    if (!flagBox) { flagBox = doc.createElement('div'); flagBox.className = 'dh-flags'; flagBox.setAttribute('aria-live', 'polite'); }
    if (flagBox.parentNode !== host) host.appendChild(flagBox);
    flagBox.innerHTML = '';
    var root = host.querySelector('.fp-root');
    if (!model || !root || view === 'drawing') return;
    var gs = groups(); if (!gs.length) return;
    var hb0 = host.getBoundingClientRect(), hb = { left: hb0.left + host.clientLeft, top: hb0.top + host.clientTop }, sb = root.getBoundingClientRect(), placed = [], left = 0, i;
    var stage = { l: sb.left - hb.left + 2, t: sb.top - hb.top + 2, r: sb.right - hb.left - 2, b: sb.bottom - hb.top - 2 };
    [].forEach.call(root.querySelectorAll('.zone-head'), function (h) { var b = h.getBoundingClientRect(); if (b.width) placed.push({ l: b.left - hb.left, t: b.top - hb.top, r: b.right - hb.left, b: b.bottom - hb.top }); });
    function cut(a, b) { return Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0; }
    /* the "+n" chip first, so no flag lands on it */
    var more = doc.createElement('button'); more.type = 'button'; more.className = 'dh-flag-more';
    more.addEventListener('click', function () { openAlarms(''); }); more.textContent = '+000'; flagBox.appendChild(more);
    var mb = more.getBoundingClientRect(); placed.push({ l: mb.left - hb.left, t: mb.top - hb.top, r: mb.right - hb.left, b: mb.bottom - hb.top });
    var shown = 0;
    for (i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (shown >= 8) { left += g.refs.length; continue; }
      var mid = host.querySelector('[data-rz-equipment="' + g.refs[Math.floor(g.refs.length / 2)] + '"]'), ab = mid && mid.getBoundingClientRect();
      if (!ab || !ab.width) { left += g.refs.length; continue; }
      var recs = alarmsOf(g), ap = recs.length ? recs[0].point : null;
      var f = doc.createElement(ap ? 'button' : 'span'); f.className = 'dh-flag'; f.setAttribute('data-sev', g.sev); f.setAttribute('data-point', g.point); f.setAttribute('data-units', String(g.refs.length));
      f.textContent = g.label; flagBox.appendChild(f);
      if (ap) {
        f.type = 'button'; f.setAttribute('data-alarm-point', ap); f.setAttribute('data-alarms', String(recs.length));
        f.setAttribute('aria-label', g.label + ' — ' + recs.length + (recs.length === 1 ? ' alarm' : ' alarms') + ' ' + ap + ', open in Alarms & Events');
        f.title = g.label + ' — ' + recs.length + (recs.length === 1 ? ' alarm' : ' alarms') + ' · open in Alarms & Events';
        f.addEventListener('click', (function (pt) { return function () { openAlarms(pt); }; })(ap));
      } else f.title = g.label + ' — open a unit for its HMI';
      var w = f.offsetWidth, h = f.offsetHeight, a = { l: ab.left - hb.left, t: ab.top - hb.top, r: ab.right - hb.left, b: ab.bottom - hb.top }, cx = (a.l + a.r) / 2, cy = (a.t + a.b) / 2;
      var cand = [[cx - w / 2, a.t - h - 4], [cx - w / 2, a.b + 4], [a.r + 4, cy - h / 2], [a.l - w - 4, cy - h / 2], [cx - w / 2, a.t - 2 * h - 8], [cx - w / 2, a.b + h + 8]], best = null, c, j;
      for (c = 0; c < cand.length && !best; c++) {
        var x = Math.min(Math.max(cand[c][0], stage.l), stage.r - w), y = cand[c][1];
        var bx = { l: x, t: y, r: x + w, b: y + h };
        if (y < stage.t || y + h > stage.b || x < stage.l) continue;
        for (j = 0; j < placed.length && !cut(bx, placed[j]); j++) { /* scan */ }
        if (j === placed.length) best = bx;
      }
      if (!best) { flagBox.removeChild(f); left += g.refs.length; continue; }
      f.style.left = best.l + 'px'; f.style.top = best.t + 'px'; placed.push(best); shown++;
    }
    if (left) {
      more.textContent = '+' + left; more.setAttribute('data-n', String(left)); more.title = left + ' more alarmed units without a flag — open the active alarms of this hall'; more.setAttribute('aria-label', more.title);
    } else more.parentNode.removeChild(more);
  }
  /* the operating point of one unit (PRD-DCAI-HALL-DEPTH A3 §6): a running unit carries its share of the hall load, as the
     engine publishes it; a standby unit carries nothing. Values only from the engine; a missing key prints as a dash. */
  function f0(v) { return v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US'); }
  function f1(v) { return v == null || !isFinite(v) ? '—' : v.toFixed(1); }
  function withOps(u) {
    var o = (geo && geo.ops) || {}, on = u.running !== false;
    if (u.kind === 'crah') {
      u.ops = { kw: on ? o.crahKw : 0, airM3h: on ? o.crahAir : 0, fanPct: on ? o.crahFan : 0, supplyC: on ? geo.supplyC : null };
      u.rotorPct = u.ops.fanPct; u.rotorRefS = 1.0;   /* §7.1: fan rotor T_ref 1.0 s at 100 % */
      u.valvePct = on ? o.crahValve : 0;   /* Amendment 8 A8a: modelled CHW valve stroke (engine 1.8.0) */
      u.lines = ['fan ' + f1(u.ops.fanPct) + ' % · ' + f0(u.ops.airM3h) + ' of ' + f0(o.crahAirRated) + ' m³/h', 'duty ' + f0(u.ops.kw) + ' kWth' + (on ? ' · supply ' + f1(geo.supplyC) + ' °C' : ''),
        on ? 'return air ' + f1(geo.returnC) + ' °C · CHW valve ' + f1(u.valvePct) + ' % (modelled)' : 'CHW valve shut (standby)'];
    } else {
      u.ops = { kw: on ? o.cduKw : 0, loadPct: on ? o.cduLoad : 0, lpm: on ? o.cduLpm : 0, pumpPct: on ? o.cduPump : 0 };
      u.rotorPct = u.ops.pumpPct; u.rotorRefS = 0.8;  /* §7.1: pump rotor T_ref 0.8 s at 100 % */
      u.valvePct = on ? o.cduValve : 0;   /* Amendment 8 A8a: modelled facility-water valve stroke (engine 1.8.0) */
      u.lines = ['duty ' + f0(u.ops.kw) + ' of ' + f0(o.cduRated) + ' kWth (' + f1(u.ops.loadPct) + ' %)', 'TCS ' + f0(u.ops.lpm) + ' of ' + f0(o.cduLpmRated) + ' L/min · pump ' + f1(u.ops.pumpPct) + ' %',
        on ? 'FWS valve ' + f1(u.valvePct) + ' % (modelled)' : 'FWS valve shut (standby)'];
    }
    return u;
  }
  function readSensors() {   /* the zone values the row tags and air speed read: the plan's own aisle readouts */
    if (!model) return;
    for (var z = 0; z < model.zones.length; z++) {
      var c = 0, h = 0, nc = 0, nh = 0, si, v;
      for (si = 0; si < geo.sp; si++) { v = num('C' + z + si + 't'); if (v != null) { c += v; nc++; } v = num('H' + z + si + 't'); if (v != null) { h += v; nh++; } }
      /* before the first readout the engine's design air planes stand in (supply = inlet, return = hot aisle) */
      model.zones[z].rackInletC = nc ? c / nc : (geo.supplyC != null ? geo.supplyC : 0);
      model.zones[z].hotAisleC = nh ? h / nh : (geo.returnC != null ? geo.returnC : 0);
    }
  }

  function metric(m) {
    var k = ['rackPitch', 'rackDepth', 'coldAisle', 'hotAisle', 'crossAisle', 'cduDepth', 'galleryDepth', 'hallWidth', 'hallLength'], o = {}, i;
    if (!m) return null;
    for (i = 0; i < k.length; i++) { if (!(typeof m[k[i]] === 'number' && isFinite(m[k[i]]) && m[k[i]] > 0)) return null; o[k[i]] = m[k[i]]; }
    /* Amendment 2 P1: the Drawing view's unit placement (HALL_PLACE); without it the units fill their allotments */
    var pk = ['fanFill', 'fanD', 'cduW', 'cduD', 'cduOff', 'cduPitch'], pl = m.place, ok = pl && m.modsPer > 0;
    for (i = 0; ok && i < pk.length; i++) ok = typeof pl[pk[i]] === 'number' && isFinite(pl[pk[i]]) && pl[pk[i]] > 0;
    if (ok) { o.modsPer = m.modsPer; o.place = {}; for (i = 0; i < pk.length; i++) o.place[pk[i]] = pl[pk[i]]; }
    return o;
  }
  /* Amendment 5 (A5d). A pointer click never reaches the floor: equipment-inspector.js takes it in the capture phase and
     reports it with rz-equipment-activate. Enter on the floor cursor reaches the floor's own handler, which calls this:
     the unit gets the same click, so a key opens the same HMI a click opens. */
  function openUnit(i, g) {
    if (!g || !g.getAttribute('data-rz-equipment')) return;
    var ev; try { ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: win }); } catch (x) { return; }
    g.dispatchEvent(ev);
  }
  function selectRef(ref) {
    if (!inst || !host || !ref) return;
    var g = host.querySelector('[data-rz-equipment="' + String(ref).replace(/["\\]/g, '') + '"]');
    if (!g) return;
    if (g.getAttribute('data-idx') != null) inst.select({ rack: +g.getAttribute('data-idx') });
    else if (g.getAttribute('data-crah') != null) inst.select({ crah: +g.getAttribute('data-crah') });
  }
  /* ---- Amendment 7 (A6a): each lens draws what it is about ---- */
  function pairLpm() { var o = (geo && geo.ops) || {}; return o.cduLpm != null && geo.cduRun != null && geo.rows ? o.cduLpm * geo.cduRun / (geo.rows / 2) : null; }
  function pairName(z) { return 'R' + pad2(2 * z + 1) + '/' + pad2(2 * z + 2); }
  /* the row tag speaks the lens: Thermal = mean inlet / hot aisle of the pair's stations, Cooling = the pair's TCS flow */
  function lensTag(zn, z) {
    var phone = (win.innerWidth || 1440) < 600, kw = zn.heat || 0;
    if (lens === 'thermal') return f1(zn.rackInletC) + ' / ' + f1(zn.hotAisleC) + ' °C';
    if (lens === 'cooling') return f0(pairLpm()) + ' L/min';
    if (lens === 'layout') return '';
    return phone ? (kw / 1000).toFixed(1) + ' MW' : Math.round(kw).toLocaleString('en-US') + ' kW';
  }
  function retag() {
    if (!inst || !model || !host) return;
    [].forEach.call(host.querySelectorAll('.zone'), function (zd) { var z = +zd.getAttribute('data-z'), t = zd.querySelector('.zf-kw'); if (t && model.zones[z]) t.textContent = lensTag(model.zones[z], z); });
    /* 3D: a tag whose new text runs past the stage's right edge slides left along its own screen row (as the floor does
       at build, HV-U1) */
    if (inst.projection && inst.projection() === 'iso') {
      var cw = host.clientWidth || 0;
      [].forEach.call(host.querySelectorAll('.zone'), function (zd) {
        if (zd.hasAttribute('data-x0')) zd.style.left = zd.getAttribute('data-x0') + 'px'; else zd.setAttribute('data-x0', String(parseFloat(zd.style.left) || 0));
        var l = parseFloat(zd.style.left) || 0, w = zd.offsetWidth;
        if (cw && w && l + w > cw - 4) zd.style.left = Math.max(4, Math.round(cw - 4 - w)) + 'px';
      });
    }
  }
  /* Amendment 8 (A8f): on a phone the 2D plan stacks in up to 3 bands and grows down the page (the first-screen fit
     squeezed a rack to 3.5 px); 3D and wide stages keep one band that fits the first screen */
  function phoneFlat() { return view === 'flat' && (win.innerWidth || 1440) < 600; }
  function svgEl(api, tag, a, parent, title) { var e = api.el(tag, a, parent); if (title) { var t = doc.createElementNS('http://www.w3.org/2000/svg', 'title'); t.textContent = title; e.appendChild(t); } return e; }
  function drawOverlay(api) {
    var G = api.G, g = api.g, b, k, z, s, o = (geo && geo.ops) || {};
    var dash = win.RZConvVfx && o.cduLoad != null ? win.RZConvVfx.dashSeconds(Math.max(0, o.cduLoad) / 100) : null;
    var lpm = pairLpm(), tS = geo.tcsSupC, tR = geo.tcsRetC, hPipe = api.iso ? G.capH + 0.6 : 0, hBr = api.iso ? G.capH + 0.3 : 0, hBus = api.iso ? G.capH + 0.35 : 0, sp = geo.sp || 3;
    var cy0 = G.cabY1, cy1 = G.cduY0 != null ? G.cduY0 : G.cabY1 + 1, ySup = cy0 + (cy1 - cy0) * 0.35, yRet = cy0 + (cy1 - cy0) * 0.65;
    var rSt = Math.max(2, Math.min(4, 0.28 * api.u));
    /* A8c: in 3D the liquid runs overhead (header capH + 0.6 m, branches capH + 0.3 m over the hot aisle, a drop at the
       row end) so no pipe is painted across a rack face; data-h is the height it is drawn at (2D: 0, the plan) */
    g.setAttribute('data-cap', String(api.iso ? G.capH : 0));
    function pipe(d, kind, loop, z, title, h) {
      var e = svgEl(api, 'path', { 'class': 'ovl-pipe', d: d, 'data-kind': kind, 'data-loop': loop, 'data-lens': 'cooling', 'data-h': String(h) }, g, title);
      if (z != null) e.setAttribute('data-z', String(z));
      if (dash) e.style.animationDuration = dash + 's';
      return e;
    }
    for (b = 0; b < api.nb; b++) {
      var r0 = b * api.kRows, rn = api.rowsIn(b), xW = G.ox - G.cold / 2 + 0.2, xE = G.ox + rn * G.rowW - G.cold / 2 - 0.2;
      /* D1 the TCS headers in the service corridor: supply runs out from the CDU line, return runs back */
      pipe('M' + api.P(xW, ySup, hPipe, b) + 'L' + api.P(xE, ySup, hPipe, b), 'header', 'sup', null, 'TCS supply header · ' + f1(tS) + ' °C', hPipe);
      pipe('M' + api.P(xE, yRet, hPipe, b) + 'L' + api.P(xW, yRet, hPipe, b), 'header', 'ret', null, 'TCS return header · ' + f1(tR) + ' °C', hPipe);
      if (!api.iso && G.cduY0 != null) {   /* D6: the corridor reads as a place in every other lens */
        var lp = api.XY(xW + 0.3, (cy0 + cy1) / 2, 0, b), tx = svgEl(api, 'text', { 'class': 'ovl-corr', x: lp[0].toFixed(1), y: (lp[1] + 3).toFixed(1), 'data-lens': 'status thermal power layout' }, g);
        tx.textContent = 'SERVICE CORRIDOR · ' + f1(cy1 - cy0) + ' m';
      }
      for (k = 0; k < rn; k++) {
        z = r0 + k;
        var x0 = G.ox + k * G.rowW, xh = x0 + G.cabW + G.hot / 2, dx = Math.min(0.3, G.hot / 4), name = pairName(z);
        /* D1 a supply and a return branch up the pair's contained hot aisle (the rack manifolds sit at the rear doors) */
        pipe('M' + api.P(xh - dx, ySup, hPipe, b) + (api.iso ? 'L' + api.P(xh - dx, G.cabY1, hBr, b) : '') + 'L' + api.P(xh - dx, G.cabY0 + 0.3, hBr, b), 'branch', 'sup', z, name + ' TCS supply branch · ' + f0(lpm) + ' L/min · ' + f1(tS) + ' °C', hBr);
        pipe('M' + api.P(xh + dx, G.cabY0 + 0.3, hBr, b) + (api.iso ? 'L' + api.P(xh + dx, G.cabY1, hBr, b) : '') + 'L' + api.P(xh + dx, yRet, hPipe, b), 'branch', 'ret', z, name + ' TCS return branch · ' + f0(lpm) + ' L/min · ' + f1(tR) + ' °C', hBr);
        /* D2 the stations the Drawing view reads: SENS_PTS per aisle, evenly along the rack line */
        for (s = 0; s < sp; s++) {
          var y = G.cabY0 + (s + 0.5) * (G.cabY1 - G.cabY0) / sp;
          var pc = api.XY(x0 - G.cold / 4, y, api.iso ? 1.0 : 0, b), ph = api.XY(xh, y, api.iso ? G.capH : 0, b);
          svgEl(api, 'circle', { 'class': 'ovl-st', cx: pc[0].toFixed(1), cy: pc[1].toFixed(1), r: rSt, 'data-lens': 'thermal', 'data-side': 'cold', 'data-z': z, 'data-s': s }, g, ' ');
          svgEl(api, 'circle', { 'class': 'ovl-st', cx: ph[0].toFixed(1), cy: ph[1].toFixed(1), r: rSt, 'data-lens': 'thermal', 'data-side': 'hot', 'data-z': z, 'data-s': s }, g, ' ');
        }
        /* D3 the busway over the pair: neutral, its length = loading (no limit is registered, so no state is claimed) */
        if (o.buswayPct != null) {
          var bg = svgEl(api, 'g', { 'data-lens': 'power', 'data-z': z }, g), xb = xh, yA = G.cabY0 + 0.2, yB = G.cabY1 - 0.2, yP = yA + (yB - yA) * Math.min(1, Math.max(0, o.buswayPct / 100));
          svgEl(api, 'path', { 'class': 'ovl-bw-track', d: 'M' + api.P(xb, yA, hBus, b) + 'L' + api.P(xb, yB, hBus, b) }, bg);
          svgEl(api, 'path', { 'class': 'ovl-bw', d: 'M' + api.P(xb, yA, hBus, b) + 'L' + api.P(xb, yP, hBus, b) }, bg, name + ' busway · ' + f1(o.buswayPct) + ' % of trunk rating (no limit registered)');
        }
      }
    }
  }
  /* D2 each station shows its reading; called after a build and whenever the page writes new readings (rz-hall-readings).
     A station without a reading claims no state (stale: dotted, as A5e) */
  /* Magnus dew point (a 17.62, b 243.12 degC; Alduchov & Eskridge 1996), from a station's dry bulb and RH */
  function dewPoint(t, rh) { if (!(rh > 0)) return null; var g = Math.log(rh / 100) + 17.62 * t / (243.12 + t); return 243.12 * g / (17.62 - g); }
  function stations() {
    if (!host) return;
    var hot = {};
    [].forEach.call(host.querySelectorAll('.fp-ovl .ovl-st'), function (c) {
      var z = +c.getAttribute('data-z'), s = +c.getAttribute('data-s'), cold = c.getAttribute('data-side') === 'cold', v = num((cold ? 'C' : 'H') + z + s + 't');
      if (v == null) { c.removeAttribute('data-v'); c.setAttribute('data-state', 'stale'); }
      else { c.setAttribute('data-v', String(v)); if (cold) c.setAttribute('data-state', v > 30 ? 'alarm' : (v > 27 ? 'warn' : 'ok')); else c.removeAttribute('data-state'); }
      if (cold && v != null && (hot[z] == null || v > hot[z].v)) hot[z] = { v: v, el: c };
      c.removeAttribute('data-hot');
      var rhRaw = cold ? (win.__hallRH || {})[z + '-' + s] : null, rh = rhRaw != null && isFinite(parseFloat(rhRaw)) ? parseFloat(rhRaw) : null, dew = v != null && rh != null ? dewPoint(v, rh) : null;
      if (dew != null) c.setAttribute('data-dew', dew.toFixed(1)); else c.removeAttribute('data-dew');
      if (rh != null) c.setAttribute('data-rh', String(rh)); else c.removeAttribute('data-rh');
      var t = c.querySelector('title'); if (t) t.textContent = pairName(z) + (cold ? ' cold aisle · point ' : ' hot aisle · point ') + (s + 1) + ' of ' + (geo.sp || 4) + ' · ' + (v == null ? '— (no reading)' : v.toFixed(1) + ' °C ' + (cold ? 'inlet' : 'return')) + (rh != null ? ' · ' + Math.round(rh) + ' % RH' : '') + (dew != null ? ' · dew ' + dew.toFixed(1) + ' °C' : '') + (v != null ? ' · simulated about the engine air plane' : '');
    });
    /* A8b: the warmest inlet point of each row pair carries a 1 px ink ring — a pointer, not a state */
    Object.keys(hot).forEach(function (z) { hot[z].el.setAttribute('data-hot', '1'); });
  }
  doc.addEventListener('rz-hall-readings', function () {
    if (!inst || view === 'drawing' || !model) return;
    readSensors(); stations();
    /* A8d: in Thermal each rack takes the state of the point it reads, so a warm point repaints only its own racks */
    if (lens === 'thermal') { inst.paint(lensMode(lens)); retag(); }
  });
  /* D5 the hall's operating point beside the floor (Thermal and Cooling), from the adapter's engine numbers only */
  var opsBox = null;
  function drawOps() {
    if (!wrap) return;
    if (!opsBox) { opsBox = doc.createElement('div'); opsBox.className = 'dh-hallops'; opsBox.setAttribute('aria-label', 'Hall operating point'); }
    /* in the legend's column, under the legend (drawLegend rebuilds the legend, so the box is re-attached each time) */
    if (legendBox) legendBox.appendChild(opsBox); else if (!opsBox.parentNode) wrap.appendChild(opsBox);
    opsBox.hidden = !(lens === 'thermal' || lens === 'cooling') || !geo;
    if (opsBox.hidden) return;
    var o = geo.ops || {}, runN = host ? host.querySelectorAll('[data-gallery="north"] .crah-cell:not(.stby)').length : 0, runS = host ? host.querySelectorAll('[data-gallery="south"] .crah-cell:not(.stby)').length : 0;
    function chip(h, t) { return '<div class="dh-hallchip"><b>' + h + '</b> · ' + t + '</div>'; }
    opsBox.innerHTML = chip('FW-N', runN + ' run · fan ' + f1(o.crahFan) + ' % · ' + f0(o.crahAir) + ' m³/h each') +
      chip('FW-S', runS + ' run · fan ' + f1(o.crahFan) + ' % · ' + f0(o.crahAir) + ' m³/h each') +
      chip('CDU', geo.cduRun + ' run · pump ' + f1(o.cduPump) + ' % · TCS ' + f1(geo.tcsSupC) + ' → ' + f1(geo.tcsRetC) + ' °C');
  }
  function lensOn() { if (host) host.setAttribute('data-lens-on', lens); readSensors(); stations(); retag(); drawOps(); }
  function render() {
    if (!geo || !host || !win.RZFloorPlan) return;
    /* HV-V3: a switch between 2D and 3D keeps the selected unit and the paint mode (one model, two projections) */
    var hallKey = geo ? [geo.rows, geo.perRow, geo.crahInst, geo.cduInst, win.currentDH].join('|') : '';
    var sameHall = !!inst && hallKey === lastHall, keepSel = inst ? inst.sel : null, keepMode = inst ? inst.mode : null;
    lastHall = hallKey;
    if (inst && inst.destroy) inst.destroy();
    host.setAttribute('data-rz-hall', String(win.currentDH || 1));
    inst = win.RZFloorPlan.render(host, model, {
      projection: view === 'flat' ? 'plan' : 'iso', toggle: false, mode: lensMode(lens), maxBands: function () { return phoneFlat() ? 3 : 1; }, projKey: 'rz.dcai.fp', measure: wrap,
      /* the whole hall on the first screen, both axes, at every width: the stage takes what is left of the viewport below
         its own top (HV-F1); fitAll lets the unit shrink below the plan's label floor (labels live in tooltips) */
      height: function () { if (phoneFlat()) return null; var t = wrap.getBoundingClientRect().top + (win.pageYOffset || 0); return Math.max(260, (win.innerHeight || 900) - bottomInset() - t - 12); },
      watchHeight: false, fitAll: true, overlay: drawOverlay, tagFit: true, stbyLamp: true, selInk: true, onRack: openUnit, onCrah: openUnit, rotors: true, valves: true, geo: geo.m || null, airModes: ['temp', 'cooling-margin'],
      rackTag: function (i) { return model.racks[i].ref.replace('rack-unit:', ''); },
      zoneTag: function (z) { return 'Rows R' + pad2(2 * z + 1) + ' and R' + pad2(2 * z + 2) + ', one contained hot aisle'; },
      /* a phone gives a row pair about 34 px: 'R01/02' (6 chars) would touch its neighbour, '01/02' keeps a gap; the full name stays in the tooltip */
      zoneHead: function (z) { return ((win.innerWidth || 1440) < 600 ? '' : 'R') + pad2(2 * z + 1) + '/' + pad2(2 * z + 2); },
      /* D7: the row-pair heat with its unit; a phone (~37 px per pair) gets MW to one decimal, keeping HV-F2b's gap */
      stripH: function () { return (win.innerWidth || 1440) < 600 ? 46 : 0; },
      footText: function (zn, z) { return lensTag(zn, z); },
      crahTag: function (n, c) { return (c && c.tag) || ('CRAH-' + pad2(n)); }
    });
    if (keepMode && keepMode !== inst.mode) inst.paint(keepMode);
    if (keepSel && sameHall) inst.select(keepSel);
    drawLegend(); drawFlags(); lensOn();
    if (tableBox && tableBox.open) unitTable();
  }

  /* the legend of the lens, beside the floor (HV-L1); run / standby lamps on every lens but Layout */
  function drawLegend() {
    if (!wrap || !win.RZFloorPlan) return;
    if (!legendBox) { legendBox = doc.createElement('div'); legendBox.setAttribute('aria-label', 'Lens legend'); wrap.appendChild(legendBox); }
    win.RZFloorPlan.legend(legendBox, lensMode(lens));
    if (lens !== 'layout') [['run', 'run'], ['stby', 'standby']].concat(staleCount() ? [['stale', 'stale']] : []).forEach(function (d) {
      var it = doc.createElement('span'); it.className = 'lg-item';
      var sw = doc.createElement('span'); sw.className = 'fp-sw'; sw.setAttribute('data-state', d[0]); it.appendChild(sw);
      it.appendChild(doc.createTextNode(d[1])); legendBox.appendChild(it);
    });
    legendBox.className = 'fp-legend dh-legend';
  }
  function unitTable() {
    if (!model || !tableBox) return;
    var old = tableBox.querySelector('table'); if (old) old.parentNode.removeChild(old);
    var t = doc.createElement('table'); t.setAttribute('data-hall-units', String(win.currentDH || 1));
    t.innerHTML = '<caption>Units on the floor of this hall (engine design point)</caption><thead><tr><th scope="col">Unit</th><th scope="col">State</th><th scope="col">Operating point</th></tr></thead>';
    var tb = doc.createElement('tbody'), i, rows = [];
    function row(a, b, c) { var tr = doc.createElement('tr'), th = doc.createElement('th'); th.scope = 'row'; th.textContent = a; tr.appendChild(th);
      [b, c].forEach(function (x) { var td = doc.createElement('td'); td.textContent = x; tr.appendChild(td); }); rows.push(tr); }
    for (i = 0; i < model.racks.length; i++) row(model.racks[i].ref.replace('rack-unit:', 'Rack '), model.racks[i].status ? (model.racks[i].status === 'alarm' ? 'alarm: ' : 'warning: ') + model.racks[i].note.slice(2) : 'running', f1(model.racks[i].kw) + ' kW · inlet ' + f1(model.rackInletFor(i)) + ' °C');
    function word(u) { return u.running !== false && u.stale ? 'stale: ' + u.staleNote : u.status ? (u.status === 'alarm' ? 'alarm: ' : 'warning: ') + u.note : (u.running === false ? 'standby' : 'running'); }
    model.crahUnits.forEach(function (u) { row(u.tag, word(u), (u.baseLines || u.lines).join(' · ')); });
    model.cduUnits.forEach(function (u) { row(u.tag, word(u), (u.baseLines || u.lines).join(' · ')); });
    rows.forEach(function (r) { tb.appendChild(r); });
    t.appendChild(tb); tableBox.appendChild(t);
  }
  function setLens(l, user) {
    if (!LENSES.some(function (d) { return d[0] === l; })) return;
    lens = l;
    if (user) { try { win.localStorage.setItem(LENS_KEY, l); } catch (e) { /* storage blocked */ } }
    if (lensBar) [].forEach.call(lensBar.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lens') === l ? 'true' : 'false'); });
    if (inst) { inst.paint(lensMode(l)); drawLegend(); drawFlags(); lensOn(); }
  }

  function set(v, user) {
    if (VIEWS.indexOf(v) < 0) return;
    if (user) store(v);
    view = v;
    panel.setAttribute('data-dh-view', v);
    if (bar) [].forEach.call(bar.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === v ? 'true' : 'false'); });
    if (v !== 'drawing') { if (!inst || sig !== key()) { render(); sig = key(); } else { inst.paint(inst.mode); drawFlags(); } tick(); }
    else stop();
  }
  /* the floor is rebuilt when the hall or the projection changes; a switch between 2D and 3D redraws, never re-runs the engine */
  function key() { return geo ? [geo.rows, geo.perRow, geo.crahInst, geo.crahAct, geo.cduInst, geo.cduRun, geo.kwRack, geo.rackRatedKw, geo.ops && geo.ops.crahFan, geo.ops && geo.ops.cduLoad, geo.m ? JSON.stringify(geo.m) : '', win.currentDH, view].join('|') : ''; }
  /* whatever covers the bottom of the viewport and is not the floor's own column — a fixed or sticky bar, or on a phone
     the hall sidebar that precedes the main column in the DOM but is laid over its bottom (flex order) — leaves the
     floor less height: measure it, never assume it. Content that merely FOLLOWS the floor in the flow is not a cover
     (counting it fed back: a shorter floor uncovered more of it, 900 -> 884 px after one resize round). */
  function bottomInset() {
    var vh = win.innerHeight || 0, el = doc.elementFromPoint((win.innerWidth || 0) / 2, vh - 2), top = null, cover = false;
    if (!el || wrap.contains(el)) return 0;
    for (; el && el !== doc.body; el = el.parentElement) {
      if (el.contains(wrap)) break;
      var pos = win.getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky' || (wrap.compareDocumentPosition(el) & 2 /* PRECEDING */)) cover = true;
      top = el.getBoundingClientRect().top;
    }
    return cover && top != null ? Math.max(0, vh - top) : 0;
  }
  function grp(v) { return v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US'); }
  function summary() {
    if (!sum || !geo) return;
    sum.innerHTML = 'IT <b>' + grp(geo.itKw) + ' kW</b> · Liquid <b>' + grp(geo.liqKw) + ' kWth</b>' + (geo.liqPct != null ? ' (' + grp(geo.liqPct) + ' %)' : '') +
      ' · Air <b>' + grp(geo.airKw) + ' kWth</b>';
    sum.title = sum.textContent + ' (engine design values; the full cards are on the Drawing view)';
  }

  /* live: the aisle readouts move every few seconds; paint() writes attributes only */
  var hadReplay = false;
  function tick() {
    stop();
    timer = win.setInterval(function () {
      if (doc.hidden || view === 'drawing' || !inst) return;
      readSensors();
      /* A5e: under a replay the samples move with the scrubber, so the unit states are read again (and once more when it ends) */
      var T = win.RZDatahallAISimTelemetry, rp = !!(T && T.hasProvider && T.hasProvider());
      if (rp || hadReplay) { unitStates(); drawLegend(); if (tableBox && tableBox.open) unitTable(); }
      hadReplay = rp;
      inst.paint(inst.mode);
    }, 3000);
  }
  function stop() { if (timer) { win.clearInterval(timer); timer = 0; } }

  /* a cooling scenario change repaints the floor states and flags (never re-runs the engine) */
  doc.addEventListener('change', function (ev) {
    if (!ev.target || ev.target.id !== 'coolingScenario' || !model) return;
    unitStates();
    if (inst && view !== 'drawing') { inst.paint(inst.mode); drawLegend(); drawFlags(); }
    if (tableBox && tableBox.open) unitTable();
  }, true);
  /* a resize redraws the floor; the flags follow it */
  win.addEventListener('resize', function () { win.setTimeout(drawFlags, 260); });
  win.RZHallIso = {
    version: '2.0.0',
    /* renderHall calls this after every plan build, with the engine counts it read */
    update: function (g) {
      if (!g || !(g.rows > 0) || !(g.perRow > 0) || g.rows % 2) return;
      geo = { rows: g.rows, perRow: g.perRow, kwRack: g.kwRack || 0, rackRatedKw: g.rackRatedKw, crahInst: g.crahInst || 0, crahAct: g.crahAct, cduInst: g.cduInst || 0, cduRun: g.cduRun, sp: g.sp || 3, supplyC: g.supplyC, returnC: g.returnC,
        itKw: g.itKw, liqKw: g.liqKw, liqPct: g.liqPct, airKw: g.airKw,
        /* PRD-DCAI-HALL-DEPTH A3: one running unit's operating point from the engine (1.7.0); standby units read 0 */
        ops: { crahKw: g.crahKw, crahAir: g.crahAir, crahAirRated: g.crahAirRated, crahFan: g.crahFan, cduKw: g.cduKw, cduRated: g.cduRated,
          cduLoad: g.cduLoad, cduLpm: g.cduLpm, cduLpmRated: g.cduLpmRated, cduPump: g.cduPump, crahValve: g.crahValve, cduValve: g.cduValve, rowKw: g.rowKw, buswayPct: g.buswayPct },
        tcsSupC: g.tcsSupC, tcsRetC: g.tcsRetC, tcsRackLpm: g.tcsRackLpm, feedA: g.feedA,
        /* the hall to scale (HV-G1): every length from the engine geometry, or none at all (the schematic stays) */
        m: metric(g.m) };
      ui(); summary();
      var changed = sig !== key();
      if (changed || !model) build(); else readSensors();
      var want = view || fromUrl() || stored() || 'flat';
      if (changed) { sig = ''; }
      set(want, false);
    },
    view: function () { return view; },
    setView: function (v) { set(v, true); },
    model: function () { return model; },
    /* A5b: the hall's scenario alarms as alarm records (tag, point, severity, message, system); read by the status strip */
    stale: function () { return staleCount(); },
    alarms: function () { flushJournal(); return hallAlarms.map(function (a) { return { tag: a.tag, point: a.point, severity: a.severity, message: a.message, system: a.system }; }); },
    repaint: function () { if (inst) inst.paint(inst.mode); }
  };
  /* renderHall ran before this deferred script: draw what it left */
  if (win.__hallIsoGeo) win.RZHallIso.update(win.__hallIsoGeo);
})();
