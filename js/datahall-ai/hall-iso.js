/* RZ DC AI — the Data Hall in 3D (PRD-DATAHALL-BMS-ISO F4, owner R185: "jadi kayak bukan BMS")
 *
 * A geometry ADAPTER, not a second renderer: the hall's engine counts become the model js/conv/floor-plan.js already
 * draws for the Conventional hall, so both cockpits share one BMS floor (grey is normal, a green lamp per cabinet, state
 * colour only on warn / alarm, equal-height cabinets, true isometric 30 deg).
 *
 *   3D    the isometric floor in #hIso: 20 rows of racks as 10 contained pairs (one hot-aisle roof each), the north and
 *         south fan-wall galleries, the CDU line between the rack field and the south gallery
 *   Plan  the engineering drawing #hSvg, unchanged (every layer, sensor and dimension)
 *
 * In 3D the plan keeps only its header (hall line, IT / liquid / air cards): its viewBox is cut to that band, and the
 * plan's layer bar and key, which speak of the plan, are hidden. The switch is two buttons (aria-pressed) stored under
 * rz.dcai.proj; with nothing stored, 3D on a stage of 600 px or more, Plan on a phone.
 *
 * No engine arithmetic here: counts come from renderHall's own engine reads (RZHallIso.update), temperatures from the
 * aisle readouts the plan already draws (#C<pair><point>t cold, #H<pair><point>t hot). Every rack and unit carries the
 * plan's equipment reference (rack-unit:Rnn-kk, crah:nn, cdu:n), so a click opens the same HMI the plan opens. ES5.
 */
(function () {
  'use strict';
  var doc = document, win = window, KEY = 'rz.dcai.proj', HEAD_VB = 136, PLAN_VB = null;
  var panel = doc.getElementById('p-hall'), svg = doc.getElementById('hSvg');
  if (!panel || !svg) return;

  var geo = null, model = null, inst = null, host = null, wrap = null, bar = null, proj = null, timer = 0, sig = '';
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function stored() { try { var v = win.localStorage.getItem(KEY); return v === 'iso' || v === 'plan' ? v : null; } catch (e) { return null; } }
  function store(p) { try { win.localStorage.setItem(KEY, p); } catch (e) { /* storage blocked: the choice holds for this page */ } }
  function num(id) { var el = doc.getElementById(id), v = el ? parseFloat(el.textContent) : NaN; return isFinite(v) ? v : null; }

  /* ---- the switch and the host, built once ---- */
  function css() {
    if (doc.getElementById('dh-proj-css')) return;
    var st = doc.createElement('style'); st.id = 'dh-proj-css';
    st.textContent = [
      '.dh-proj{display:flex;justify-content:flex-end;margin:0 0 6px}',
      '.dh-proj [role=group]{display:inline-flex;border:1px solid var(--bd);border-radius:4px;overflow:hidden}',
      '.dh-proj button{appearance:none;margin:0;min-width:48px;height:26px;padding:0 12px;border:0;background:transparent;color:var(--t2);font:600 11px/26px "IBM Plex Sans",system-ui,sans-serif;letter-spacing:.04em;cursor:pointer}',
      '.dh-proj button+button{border-left:1px solid var(--bd)}',
      '.dh-proj button[aria-pressed="true"]{color:var(--t1);background:var(--bg3)}',
      '.dh-proj button:focus-visible{outline:2px solid var(--c);outline-offset:-2px}',
      '@media (max-width:600px){.dh-proj button{height:40px;line-height:40px;min-width:56px}}',
      '#hIsoWrap{display:none;margin:6px 0 0}#p-hall[data-dh-proj="iso"] #hIsoWrap{display:block}',
      '#hIso{display:none;box-sizing:content-box;background:var(--bg2);border:1px solid var(--bd);border-radius:4px;overflow:hidden}',
      '#p-hall[data-dh-proj="iso"] #hIso{display:block}',
      '#hSvg[data-dh-cropped] [data-dh-off]{display:none}',
      '#p-hall[data-dh-proj="iso"] #hallLayers,#p-hall[data-dh-proj="iso"] .hp-key{display:none}'
    ].join('\n');
    doc.head.appendChild(st);
  }
  function ui() {
    if (host) return;
    css();
    bar = doc.createElement('div'); bar.className = 'dh-proj';
    var g = doc.createElement('div'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Hall view'); bar.appendChild(g);
    [['iso', '3D', 'Isometric 3D view of the hall'], ['plan', 'Plan', 'Engineering plan at one scale']].forEach(function (d) {
      var b = doc.createElement('button'); b.type = 'button'; b.setAttribute('data-proj', d[0]); b.textContent = d[1]; b.title = d[2];
      b.addEventListener('click', function () { set(d[0], true); });
      g.appendChild(b);
    });
    svg.parentNode.insertBefore(bar, svg);
    host = doc.createElement('div'); host.id = 'hIso'; host.setAttribute('data-rz-hall', String(win.currentDH || 1));
    /* DC AI traceability (test-dcai-coverage): every number the 3D floor prints comes from here */
    host.setAttribute('data-rz-authored-basis', 'row-pair heat = racks per pair x design rack kW (engine counts multiplied, not a reading); ' +
      'rack inlet and hot-aisle values are the plan\'s simulated aisle readouts, or the engine design supply / return air before the first readout');
    /* the floor measures this wrapper, never #hIso itself: the renderer sets the host's width from what it measures, so
       measuring the bordered host shrank it 2 px per resize, for ever, until the hall vanished (owner, 2026-11-22) */
    wrap = doc.createElement('div'); wrap.id = 'hIsoWrap'; wrap.appendChild(host);
    svg.parentNode.insertBefore(wrap, svg.nextSibling);   /* right under the plan's header band; the layer bar follows */
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
    for (i = 1; i <= G.crahInst; i++) crah.push({ n: i, tag: 'CRAH-' + pad2(i), running: G.crahAct == null || i <= G.crahAct, ref: 'crah:' + pad2(i) });
    for (i = 1; i <= G.cduInst; i++) cdu.push({ n: 1000 + i, tag: 'CDU-' + pad2(i), running: G.cduRun == null || i <= G.cduRun, ref: 'cdu:' + i });
    model = {
      racks: racks, zones: zones, crahUnits: crah, cduUnits: cdu, racksPerZone: perZone, ratingKw: G.kwRack,
      rackInletFor: function (idx) {
        var zz = Math.floor(idx / perZone), j = (idx % perZone) % G.perRow, si = Math.min(G.sp - 1, Math.floor(j * G.sp / G.perRow));
        var v = num('C' + zz + si + 't'); return v != null ? v : zones[zz].rackInletC;
      }
    };
    readSensors();
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

  function render() {
    if (!geo || !host || !win.RZFloorPlan) return;
    if (inst && inst.destroy) inst.destroy();
    host.setAttribute('data-rz-hall', String(win.currentDH || 1));
    inst = win.RZFloorPlan.render(host, model, {
      projection: 'iso', toggle: false, mode: 'temp', maxBands: 1, projKey: KEY, measure: wrap,
      /* the whole hall in one screen on a wide stage; a phone keeps the minimum unit and pans inside the stage */
      height: function () { return Math.max(420, (win.innerHeight || 900) - 40); }, watchHeight: false,
      rackTag: function (i) { return model.racks[i].ref.replace('rack-unit:', ''); },
      zoneTag: function (z) { return 'Rows R' + pad2(2 * z + 1) + ' and R' + pad2(2 * z + 2) + ', one contained hot aisle'; },
      zoneHead: function (z) { return 'R' + pad2(2 * z + 1) + '/' + pad2(2 * z + 2); },
      crahTag: function (n, c) { return (c && c.tag) || ('CRAH-' + pad2(n)); }
    });
  }

  function cropPlan(on) {
    if (on) {
      if (PLAN_VB == null) PLAN_VB = svg.getAttribute('viewBox');
      var w = (svg.getAttribute('viewBox') || '0 0 1200 804').split(/\s+/)[2] || '1200';
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + HEAD_VB);
      svg.setAttribute('data-dh-cropped', '1');
      hideBelow();
    } else if (svg.getAttribute('data-dh-cropped')) {
      svg.removeAttribute('data-dh-cropped');
      showAll();
      if (PLAN_VB) svg.setAttribute('viewBox', PLAN_VB);
    }
  }
  /* the cut plan must not paint past its frame (test-conv-geometry G2): what lies below the header band is
     taken out of the render, not clipped. Measured on screen, so a hidden tab waits until the plan has a size. */
  var OFF = 'data-dh-off', ro = null;
  function showAll() { [].forEach.call(svg.querySelectorAll('[' + OFF + ']'), function (el) { el.removeAttribute(OFF); }); }
  function hideBelow() {
    var frame = svg.getBoundingClientRect();
    if (!frame.height) {
      if (!ro && win.ResizeObserver) { ro = new win.ResizeObserver(function () { if (svg.getBoundingClientRect().height && svg.getAttribute('data-dh-cropped')) { ro.disconnect(); ro = null; hideBelow(); } }); ro.observe(svg); }
      return;
    }
    showAll();
    var els = svg.querySelectorAll('text,rect,circle,ellipse,path,line,polyline,polygon,image,use'), i, b;
    for (i = 0; i < els.length; i++) {
      b = els[i].getBoundingClientRect();
      if ((b.width || b.height) && (b.bottom > frame.bottom + 0.5 || b.top < frame.top - 0.5)) els[i].setAttribute(OFF, '');
    }
  }

  function set(p, user) {
    if (p !== 'iso' && p !== 'plan') return;
    if (user) store(p);
    proj = p;
    panel.setAttribute('data-dh-proj', p);
    if (bar) [].forEach.call(bar.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-proj') === p ? 'true' : 'false'); });
    cropPlan(p === 'iso');
    if (p === 'iso') { if (!inst || sig !== key()) { render(); sig = key(); } else inst.paint(inst.mode); tick(); }
    else stop();
  }
  function key() { return geo ? [geo.rows, geo.perRow, geo.crahInst, geo.crahAct, geo.cduInst, geo.cduRun, geo.kwRack, win.currentDH].join('|') : ''; }

  /* live: the aisle readouts move every few seconds; paint() writes attributes only */
  function tick() {
    stop();
    timer = win.setInterval(function () {
      if (doc.hidden || proj !== 'iso' || !inst) return;
      readSensors(); inst.paint(inst.mode);
    }, 3000);
  }
  function stop() { if (timer) { win.clearInterval(timer); timer = 0; } }

  win.RZHallIso = {
    version: '1.0.0',
    /* renderHall calls this after every plan build, with the engine counts it read */
    update: function (g) {
      if (!g || !(g.rows > 0) || !(g.perRow > 0) || g.rows % 2) return;
      geo = { rows: g.rows, perRow: g.perRow, kwRack: g.kwRack || 0, crahInst: g.crahInst || 0, crahAct: g.crahAct, cduInst: g.cduInst || 0, cduRun: g.cduRun, sp: g.sp || 3, supplyC: g.supplyC, returnC: g.returnC };
      PLAN_VB = svg.getAttribute('viewBox');   /* renderHall has just set the plan's own viewBox */
      svg.removeAttribute('data-dh-cropped');
      ui();
      var changed = sig !== key();
      if (changed || !model) build(); else readSensors();
      var want = proj || stored() || ((panel.clientWidth || win.innerWidth) < 600 ? 'plan' : 'iso');
      if (changed) { sig = ''; }
      set(want, false);
    },
    projection: function () { return proj; },
    setProjection: function (p) { set(p, true); },
    model: function () { return model; },
    repaint: function () { if (inst) inst.paint(inst.mode); }
  };
  /* renderHall ran before this deferred script: draw what it left */
  if (win.__hallIsoGeo) win.RZHallIso.update(win.__hallIsoGeo);
})();
