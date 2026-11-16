/*
 * hmi-v2.js — datahallAI redraw, MOCK layer (R128–R134, PRD §12). Loaded only by dh-drawings-mock.html.
 * 1. shell: one nav row in the RZ register; reference actions in a Docs menu; "SIMULATED · ENGINE BASIS" → SIM chip
 * 2. sidebar: pinned / auto-hide / hidden, remembered per viewer
 * 3. drawings: Cooling (DH-M-103), Electrical DH-01 (DH-E-101), Rack (DH-R-101) from js/datahall-ai/hmi-sheets.js
 *    through js/rz-hmi-sheet.js; every number from RZDatahallAIHmiPayloads / the DCAI snapshot
 * 4. equipment modal (ISA-101 L3) for the CDU class, with Trace on the parent sheet
 * Existing ids and listeners are MOVED, never re-created, so every gate that binds them keeps working.
 */
(function (win, doc) {
  'use strict';
  if (!win || !doc || win.__rzDhHmiV2) return;
  win.__rzDhHmiV2 = true;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  function el(tag, attrs, html) { var e = doc.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  /* ── 1. shell ─────────────────────────────────────────────────────────────────────────────────────── */
  function shell() {
    var hdr = $('header.hdr'); if (!hdr || hdr.getAttribute('data-dh2')) return;
    hdr.setAttribute('data-dh2', '1');
    var nav = el('nav', { class: 'dh2-nav', 'data-rz-shell-nav': '', 'aria-label': 'AI Data Hall' });
    var back = el('a', { class: 'dh2-back', href: 'datacenter-solutions.html', 'aria-label': 'Back to DC Solutions', title: 'Back to DC Solutions' }, '&#8592;');
    var title = el('span', { class: 'dh2-title' }, 'AI Data Hall');
    var chip = $('#datahallAuthorityChip');
    var sim = el('span', { class: 'dh2-sim', tabindex: '0', role: 'note',
      title: 'Simulated data on the engine basis: every value is computed by the DCAI engine from a locked set of inputs, not read from a live site. Independent personal research for education and estimation; not professional advice.' }, 'SIM');
    var ask = $('[data-rz-ask-slot]');
    var replay = $('#rzReplayTrig');
    var docs = el('details', { class: 'dh2-docs' });
    docs.appendChild(el('summary', { 'aria-label': 'Documents', title: 'PRD, manual, basis of design, FAQ, design pack' }, 'Docs'));
    var menu = el('div', { class: 'dh2-menu', role: 'menu' });
    $$('.hdr-main a.bbtn:not(.rz-public-contract-link)').forEach(function (a) { a.textContent = a.textContent.replace(/^\s*\u2190\s*/, ''); a.className = 'dh2-mi'; a.setAttribute('role', 'menuitem'); menu.appendChild(a); });
    ['#bodTrig', '#faqTrig', '#genDesignTrig'].forEach(function (s) { var b = $(s); if (b) { b.className = 'dh2-mi'; b.setAttribute('role', 'menuitem'); menu.appendChild(b); } });
    docs.appendChild(menu);
    var clk = $('#clk'), theme = $('#themeToggle');
    var sp = el('span', { class: 'dh2-sp' });
    var user = el('span', { class: 'dh2-user' });
    /* the provenance banner (SIMULATED · ENGINE BASIS, with its 44 px dismiss) stays the page's own component: its slot moves
       into the nav row in place of the SIM chip — the hidden .hdr-main had made it 0 x 0 (gates conv-alarm-runtime, cockpit
       regressions) */
    var slot = $('[data-rz-telemetry-banner-slot]'); if (slot) sim = slot;
    [back, title, chip, sim, sp, ask, replay, docs, clk, user, theme].forEach(function (n) { if (n) nav.appendChild(n); });
    hdr.insertBefore(nav, hdr.firstChild);
    var main = $('.hdr-main', hdr), right = $('.hdr-r', hdr);
    if (main) main.hidden = true;
    if (right) {
      right.hidden = true;
      // auth.js injects the account button into .hdr-r, before or after this runs: keep it in the nav row
      var adopt = function () { Array.prototype.slice.call(right.children).forEach(function (c) { user.appendChild(c); }); };
      adopt();
      if (win.MutationObserver) new MutationObserver(adopt).observe(right, { childList: true });
    }
    doc.addEventListener('click', function (e) { if (!docs.contains(e.target)) docs.removeAttribute('open'); });
    contractLinks(nav, docs, menu);
  }
  /* PRD and Manual stay public while the cockpit is locked: auth.js lifts them into a fixed layer placed over
     hidden slots in the header. Unlocked, they are ordinary items of the Docs menu; locked, their slots sit in
     the nav row at the nav's own size, so the lifted links land inside the bar instead of below it. */
  function contractLinks(nav, docs, menu) {
    function sync() {
      var locked = doc.body.classList.contains('locked');
      var slots = $$('.rz-public-contract-slot'), links = $$('a.rz-public-contract-link');
      slots.forEach(function (sl) { if (sl.parentNode !== nav) nav.insertBefore(sl, docs); sl.classList.add('dh2-slot'); sl.hidden = !locked; });
      var layer = $('.rz-public-contract-layer');
      links.forEach(function (a, i) {
        if (!locked) {
          if (a.parentNode !== menu) { a.removeAttribute('style'); a.className = 'dh2-mi rz-public-contract-link'; a.setAttribute('role', 'menuitem'); menu.insertBefore(a, menu.children[i] || null); }
        } else if (layer && a.parentNode !== layer) {
          a.className = 'dh2-slot-link rz-public-contract-link';
          a.style.cssText = 'position:fixed;z-index:1;pointer-events:auto';
          layer.appendChild(a);
          var r = slots[i] && slots[i].getBoundingClientRect(); if (r) { a.style.left = r.left + 'px'; a.style.top = r.top + 'px'; }
        }
      });
    }
    sync();
    new MutationObserver(sync).observe(doc.body, { attributes: true, attributeFilter: ['class'], childList: true });
  }

  /* ── 2. sidebar: pinned / auto-hide / hidden ─────────────────────────────────────────────────────── */
  var MODES = [['pinned', 'Keep the sidebar shown', '&#9646;&#9647;'], ['auto', 'Auto-hide the sidebar: it opens on hover or focus', '&#9647;&#9647;'], ['hidden', 'Hide the sidebar', '&#9647;']];
  function sidebar() {
    var head = $('aside.side .dh-head'); if (!head || $('[data-side-mode]')) return;
    var grp = el('div', { class: 'dh2-sidemodes', role: 'group', 'aria-label': 'Sidebar' });
    MODES.forEach(function (m) {
      var b = el('button', { type: 'button', class: 'dh2-sm', 'data-side-mode': m[0], 'aria-label': m[1], title: m[1], 'aria-pressed': 'false' }, '<span aria-hidden="true">' + m[2] + '</span>');
      b.addEventListener('click', function () { setSide(m[0]); if (m[0] === 'auto' && b.blur) b.blur(); });
      grp.appendChild(b);
    });
    var tog = $('#sideTog'); if (tog) tog.classList.add('dh2-legacy-tog');
    head.parentNode.insertBefore(grp, head.nextSibling);
    var reopen = $('#sideReopen');
    if (reopen) { reopen.addEventListener('click', function (e) { e.stopImmediatePropagation(); setSide('pinned'); }, true); }
    doc.addEventListener('keydown', function (e) {
      if (e.key !== '[' || /input|select|textarea/i.test((e.target.tagName || ''))) return;
      var cur = doc.body.getAttribute('data-side') || 'pinned';
      setSide(cur === 'pinned' ? 'auto' : cur === 'auto' ? 'hidden' : 'pinned');
    });
    setSide(store('dh_side_mode') || (win.matchMedia && win.matchMedia('(max-width: 860px)').matches ? 'auto' : 'pinned'), true);
  }
  function setSide(mode, quiet) {
    if (['pinned', 'auto', 'hidden'].indexOf(mode) < 0) mode = 'pinned';
    doc.body.setAttribute('data-side', mode);
    $$('[data-side-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-side-mode') === mode)); });
    if (!quiet) store('dh_side_mode', mode);
    win.dispatchEvent(new Event('resize'));
  }

  /* ── 3. values from the engine payloads ─────────────────────────────────────────────────────────── */
  var P = win.RZDatahallAIHmiPayloads, cache = {}, tickSeen = null;
  /* the payload context is built once per (tick, cooling scenario, electrical scenario, replay) — it evaluates the whole
     electrical topology, and a repaint reads ~600 nodes: rebuilding it per node cost 2-3 s per repaint (O11 profile) */
  var ctxKey = null, ctxVal = null;
  /* the fire workstation's snapshot changes on an isolation, a restore or a training run without a tick passing: its
     identity is part of the context key, so a zone driven below two means repaints at once (DH-F-104 gate F17) */
  var fireSnapRef = null, fireRev = 0;
  function fireRevision() {
    var W = win.RZDatahallAIFireWorkstation, sn = W && W.snapshot ? W.snapshot() : null;
    if (sn !== fireSnapRef) { fireSnapRef = sn; fireRev++; }
    return fireRev;
  }
  function ctx() {
    if (!P || !P.buildContext) return null;
    var sim = win.RZDatahallAISimTelemetry, cs = doc.getElementById('coolingScenario'), es = doc.getElementById('electricalScenario');
    var k = (sim && sim.tickNow ? sim.tickNow() : '') + '|' + (cs ? cs.value : '') + '|' + (es ? es.value : '') + '|' + (sim && sim.hasProvider && sim.hasProvider() ? 'r' : 's') + '|f' + fireRevision();
    if (k !== ctxKey || !ctxVal) { ctxVal = P.buildContext(win, { hall: 1, noTrend: true }); ctxKey = ctxVal ? k : null; }
    return ctxVal;
  }
  function payload(cls, id) {
    var c = ctx(); if (!c || !P) return null;
    var key = ctxKey;   // the context key already holds tick, both scenarios, replay and the fire revision
    if (key !== tickSeen) { cache = {}; tickSeen = key; }
    var k = cls + ':' + id;
    if (!cache[k]) { try { cache[k] = P.safePayload(cls, id, c); } catch (e) { cache[k] = null; } }
    return cache[k];
  }
  function rows(p) {
    if (!p || !p.tabs) return [];
    var out = [];
    Object.keys(p.tabs).forEach(function (t) { (Array.isArray(p.tabs[t]) ? p.tabs[t] : []).forEach(function (r) { out.push(r); }); });
    return out;
  }
  function text(r) {
    if (!r) return '—';
    var t = r.text != null ? String(r.text) : (r.value != null ? String(r.value) : '—');
    return r.unit && t !== '—' && t.indexOf(r.unit) < 0 ? t + ' ' + r.unit : t;
  }
  function find(p, re) { var rs = rows(p); for (var i = 0; i < rs.length; i++) if (re.test(rs[i].label || '') || re.test(rs[i].point || '')) return rs[i]; return null; }
  var CLS_PAYLOAD = { cdu: 'cdu', 'cdu-pump': 'cdu', chiller: 'chiller', stp: 'stp', ahu: 'ahu', 'battery-a': 'battery-a', 'battery-b': 'battery-b', 'dry-cooler': 'dry-cooler', 'fws-pump-station': 'fws-pump-station', 'cw-pump-station': 'cw-pump-station', chem: 'chem', 'tcs-manifold': 'tcs-manifold', 'net-wan': 'net-wan', 'net-zone': 'net-zone', 'sld-tx': 'sld-tx', 'sld-mv-sub': 'sld-mv-sub', 'sld-msb': 'sld-msb', 'sld-ups-a': 'sld-ups-a', 'sld-ups-b': 'sld-ups-b',
    'sld-rack-psu': 'sld-rack-psu', 'rack-ct': 'rack-ct', 'rack-ns': 'rack-ns', 'rack-psu': 'rack-psu', 'rack-busbar': 'rack-busbar', 'rack-manifold': 'rack-manifold', 'rack-leak': 'rack-leak',
    'fire-facp': 'fire-facp', 'fire-zone': 'fire-zone', 'fire-vesda': 'fire-vesda', 'fire-mcp': 'fire-mcp', 'fire-epo': 'fire-epo', 'fire-point': 'fire-point',
    'sld-main-tx': 'sld-main-tx', 'site-genset-yard': 'site-genset-yard', 'net-core': 'net-core', 'net-spine': 'net-spine', 'net-leaf': 'net-leaf', 'rack-unit': 'rack-unit', crah: 'crah', 'bms-server': 'bms-server', 'bms-controller': 'bms-controller', 'bms-network': 'bms-network', 'bms-gateway': 'bms-gateway', 'bms-field': 'bms-field', 'bms-ldc': 'bms-ldc', 'bms-app': 'bms-app' };
  /* fire points keep their full inventory id (DH-01-Z05-SD1-02); the point state comes from the workstation snapshot through the payload */
  function fireStateOf(p) {
    if (!p) return { state: 'unknown' };
    var r = find(p, /^(state|panel|stage|point|zone)$/i) || find(p, /state|stage|panel/i), t = r ? text(r).toLowerCase() : 'normal';
    if (/alarm|fire|discharg|released|activated|^active/.test(t) && !/pre-?alarm/.test(t)) return { state: 'fault', alarm: '1' };
    if (/pre-?alarm|armed|trouble|impaired|fault|watch/.test(t)) return { state: 'normal', alarm: '2' };
    if (/isolated|expired|disabled|out of service/.test(t)) return { state: 'standby', alarm: '3' };
    return { state: 'normal' };
  }
  /* ONE state model (owner brief O1/O2): a node's state comes only from its payload — the pump's own state row, the
     unit's status chip, a scenario state row. A node with no payload is "na" (not instrumented): drawn neutral, never
     guessed as running / open / closed / energized. */
  var STATE_WORD = { run: 'running', running: 'running', online: 'running', energized: 'running', normal: 'running', closed: 'closed',
    open: 'open', fault: 'fault', trip: 'fault', critical: 'fault', alarm: 'fault', stby: 'standby', standby: 'standby', bypass: 'standby',
    off: 'stopped', stopped: 'stopped', isolated: 'standby', warning: 'running', 'float': 'running', discharge: 'fault' };
  function liveRows(p) { return p && p.tabs && Array.isArray(p.tabs.live) ? p.tabs.live : []; }
  function stateOf(n, p) {
    if (!p) return 'na';
    var live = liveRows(p), r;
    if (n.pump) { r = live.filter(function (x) { return x.point === 'pump_state_' + n.pump; })[0]; if (r) return STATE_WORD[r.state] || 'na'; }   // a CDU pump: its own state row
    if (n.pumpState) { r = live.filter(function (x) { return x.point === n.pumpState; })[0]; if (r) return STATE_WORD[r.state] || 'na'; }   // a named mover state row (STP blowers)
    if (n.standby) return 'standby';
    if (p.statusChip && STATE_WORD[String(p.statusChip.state).toLowerCase()]) return STATE_WORD[String(p.statusChip.state).toLowerCase()];
    r = live.filter(function (x) { return x.quality === 'state' && STATE_WORD[x.state]; })[0];
    return r ? STATE_WORD[r.state] : 'na';
  }
  /* electrical evidence (owner brief O7): SLD devices take their state from the electrical scenario engine
     (RZDatahallAIElectrical.evaluateScenario on the page's scenario) — breaker position from its controller, a
     transformer energized only when the edge into it is, ATS / UPS from their own state. Not a device the engine models
     → no claim (na). */
  var BRK = { closed: 'closed', open: 'open', tripped: 'fault', maintenance: 'open', racked_out: 'open', test: 'open', disabled: 'open' };
  var UPSW = { online: 'running', bypass: 'standby', fault: 'fault', maintenance: 'standby' }, ATSW = { normal: 'running', transfer_failed: 'fault', maintenance: 'standby' };
  function elecState(n, sheet) {
    var c = ctx(), ev = c && c.scenario; if (!ev || !ev.state || !/^dh-e-/.test(sheet || '')) return null;
    var S = ev.state, m = /^([a-z-]+?)([AB])(01)?$/.exec(n.id), L, k, edgeTo = function (to) { var e = ev.edges.filter(function (x) { return x.to === to; })[0]; return e ? (e.semanticState === 'energized' ? 'running' : e.semanticState === 'fault' ? 'fault' : 'stopped') : null; };
    if (!m) { if (n.id === 'mv-tie' || n.id === 'tie') return 'open'; if (/^gen\d$/.test(n.id)) { var g = S.sources && S.sources['SRC-GENSET-POOL']; return g ? (g.state === 'running' ? 'running' : g.state === 'failed' ? 'fault' : 'standby') : null; } return null; }
    k = m[1]; L = m[2];
    var br = function (id) { var v = S.breakers && S.breakers[id + '-' + L]; return v ? BRK[v] || 'na' : null; };
    if (sheet === 'dh-e-001') {
      if (k === 'cb-mv') return br('BR-MV-INCOMER'); if (k === 'cb-tx') return br('BR-HV-TX'); if (k === 'tx-main') return edgeTo('MAIN-TX-' + L);
      return null;
    }
    switch (k) {
      case 'cb-mv': return br('BR-TX');
      case 'tx': return edgeTo('TX-' + L);
      case 'cb-lv': return br('BR-MSB');
      case 'ats': var a = S.ats && S.ats['ATS-' + L]; return a ? ATSW[a.state] || 'na' : null;
      case 'qi': return br('BR-UPS');
      case 'rec': case 'inv': var u = S.ups && S.ups['UPS-' + L]; return u ? UPSW[u] || UPSW[u.state] || 'na' : null;
      case 'ss': var u2 = S.ups && S.ups['UPS-' + L], us = u2 && (u2.state || u2); return us ? (us === 'bypass' ? 'closed' : 'open') : null;
      case 'mb': var u3 = S.ups && S.ups['UPS-' + L], ms = u3 && (u3.state || u3); return ms ? (ms === 'maintenance' ? 'closed' : 'open') : null;
      case 'qbw': return br('BR-BUSWAY');
      default: return null;
    }
  }

  /* data quality of a node (owner brief O4): over the telemetry rows it shows — every row missing = nosample, some = partial */
  function qualityOf(p) {
    if (!p) return 'none';
    var tel = liveRows(p).filter(function (r) { return r.quality === 'simulated' || r.quality === 'replay'; });
    if (!tel.length) return 'design';
    var miss = tel.filter(function (r) { return r.missing || r.value == null; }).length;
    if (miss === tel.length) return 'nosample';
    if (miss) return 'partial';
    return tel.some(function (r) { return r.quality === 'replay'; }) ? 'replay' : 'simulated';
  }
  /* alarm of a node (owner brief O5): the payload's own alarm list, ISA priority 1 / 2 / 3, acknowledged kept apart */
  var PRIO = { critical: '1', high: '1', medium: '2', low: '3', info: '3' };
  function alarmOf(p) {
    var al = p && p.tabs && p.tabs.alarms ? p.tabs.alarms.filter(function (a) { return a.lifecycle !== 'returned' && a.lifecycle !== 'returned_ack'; }) : [];
    if (!al.length) return null;
    var best = al.map(function (a) { return PRIO[a.severity] || '2'; }).sort()[0];
    return { prio: best, ack: al.every(function (a) { return /ack/.test(String(a.lifecycle || '')) && !/unack/.test(String(a.lifecycle || '')); }) };
  }
  /* the systems the cause-and-effect matrix commands, in matrix order (one control module each on DH-F-103) */
  function ceSystems(CE) {
    var seen = {}, out = [];
    CE.BASE_ROWS.forEach(function (r) { r.outputs.forEach(function (x) { if (!seen[x.system]) { seen[x.system] = 1; out.push(x.system); } }); });
    return out;
  }
  /* an interlock's state (DH-F-103): the `command` row of its fire-output payload (hmi-payloads.js evaluates the C&E
     matrix for the running training event) — blocked P1, due P2, pending P3, none = normal: the panel commands
     nothing at rest */
  var ILK = { blocked: ['fault', '1'], due: ['running', '2'], pending: ['standby', '3'] };
  function interlockOf(n) {
    var p = payload('fire-output', String(n.eqId)), r = find(p, /^command$/i), m = r && ILK[r.state], tip = [];
    rows(p).slice(0, 6).forEach(function (x) { tip.push([x.label, text(x)]); });
    return { state: m ? m[0] : 'normal', alarm: m ? m[1] : null, values: {}, rows: tip };
  }
  /* a node's reading is a function of the payload context (tick, both scenarios, replay, fire revision) and the node:
     while that key holds, a repaint returns the same object and the renderer skips the node — a repaint with nothing new
     cost 25 ms of script at 4x CPU throttle on DH-A-101 (O11 mobile p95 66 ms during a zoom) */
  var readMemo = {}, readKey = null;
  function read(n, sheet) {
    ctx(); if (ctxKey !== readKey) { readMemo = {}; readKey = ctxKey; }
    var mk = (sheet || '') + '|' + n.id + '|' + (n.cls || '') + '|' + (n.eqId || '');   // node ids repeat across the items one modal slot draws in turn (zone Z11 then Z12): the item is part of the key (gate M4)
    if (readKey != null && readMemo[mk]) return readMemo[mk];
    var d = readNow(n, sheet); if (readKey != null) readMemo[mk] = d;
    return d;
  }
  function readNow(n, sheet) {
    if (n.sym === 'junction') return {};
    if (n.cls === 'fire-output') return interlockOf(n);
    var cls = n.cls && CLS_PAYLOAD[n.cls], id = n.eqId || n.id, fire = !!cls && cls.indexOf('fire-') === 0;
    var fullId = fire || cls === 'net-zone';   // fire points and security zones keep their full id (DH-01-Z05-SD1-02, Z-EXT)
    var p = cls ? payload(cls, fullId ? String(id) : String(id).replace(/^[A-Z]+-?/, '').replace(/-\d+$/, '') || '1') : null;
    var tip = [];
    if (fire) {
      var fs = fireStateOf(p), fv = {};
      rows(p).slice(0, 6).forEach(function (r) { tip.push([r.label, text(r)]); });
      (n.values || []).forEach(function (x) {   // a zone's detection means available of total (DH-F-104), from the isolation register
        if (x.k !== 'means') return; var r = find(p, /^means available$/i), m = r && /^(\d+) of (\d+)$/.exec(text(r));
        fv.means = { text: m ? m[1] + '/' + m[2] + ' MEANS' : '—', alarm: m && +m[1] < 2 ? '1' : null };
      });
      var fal = alarmOf(p), prio = [fs.alarm, fal && fal.prio].filter(Boolean).sort()[0] || null;   // O5: the payload's own alarm list counts too (an impaired zone is a high alarm)
      return { state: fs.state, alarm: prio, ack: fal ? fal.ack : false, values: fv, rows: tip };
    }
    var es = elecState(n, sheet), st = (n.sym === 'offSheet') ? undefined : (es || stateOf(n, p)), v = {}, al = alarmOf(p);
    // a pump carries only its own alarm (point PUMP-n); the unit-level alarm belongs to the unit's main symbol
    if (n.pump) al = alarmOf(p && { tabs: { alarms: (p.tabs.alarms || []).filter(function (a) { return a.point === 'PUMP-' + n.pump; }) } });
    (n.values || []).forEach(function (x) {
      var r = null;
      if (x.k === 'duty') r = find(p, /duty|heat/i);
      else if (x.k === 'flow') r = find(p, /flow/i);
      else if (x.k === 'tcsS') r = find(p, /supply.*t|tcs.*supply|supply temp/i);
      else if (x.k === 'tcsR') r = find(p, /return.*t|tcs.*return|return temp/i);
      else if (x.k === 'pos') r = find(p, /valve|position/i);
      else if (/^p\d$/.test(x.k)) r = st === 'running' ? find(p, /pump.*speed|speed/i) : { text: String(st || '').toUpperCase() };   // a pump that is not running shows its state, not a speed
      else if (x.k === 'load' || x.k === 'ups') r = find(p, /load/i);
      else if (x.k === 'rack') r = find(p, /current|feed/i);
      else if (x.k === 'util') r = find(p, /utilis|util/i);
      else if (x.k === 'pts') r = find(p, /points?/i);
      v[x.k] = { text: text(r) };
    });
    rows(p).slice(0, 6).forEach(function (r) { tip.push([r.label, text(r)]); });
    return { state: st, quality: n.sym === 'offSheet' ? undefined : qualityOf(p), alarm: al ? al.prio : null, ack: al ? al.ack : false, values: v, rows: tip };
  }

  /* ── flow only with evidence (owner brief O3) ─────────────────────────────────────────────────────────────
     Edges are joined into branches through passive items (junction bends, valves, strainers — no payload, degree ≤ 2).
     A branch flows when its mover (pump / fan) runs; without a mover, when the equipment it joins runs; a plain header
     between tees inherits "running" from a running neighbour branch. Missing samples make a branch "unknown" (no
     motion); a stopped / tripped mover makes it "stopped". Signal and instrument lines never flow. */
  var EQUIP = { running: 1, stopped: 1, fault: 1, standby: 1, open: 1 };   // an open breaker / closed-off device is evidence: it blocks its branch
  function isMover(n) { return n && /^pump|^fan/.test(n.sym || ''); }
  function flowMap(graph, st) {
    var deg = {}, out = {}, proc = graph.filter(function (e) { return !/^(signal|inst)$/.test(e.w) && !/^(line|signal)$/.test(e.m); });
    graph.forEach(function (e) { if (proc.indexOf(e) < 0) out[e.id] = 'na'; });
    proc.forEach(function (e) { [e.a, e.b].forEach(function (k) { if (k) deg[k] = (deg[k] || 0) + 1; }); });
    var par = {}; proc.forEach(function (e) { par[e.id] = e.id; });
    var find = function (x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    var passive = function (k) { var n = st[k]; return !n || !EQUIP[n.state]; };
    var byNode = {};
    proc.forEach(function (e) { [e.a, e.b].forEach(function (k) { if (k) (byNode[k] = byNode[k] || []).push(e); }); });
    Object.keys(byNode).forEach(function (k) {   // join edges of one medium through a passive item with no branching
      if (!passive(k) || deg[k] > 2) return;
      var es = byNode[k]; for (var i = 1; i < es.length; i++) if (es[i].m === es[0].m) par[find(es[i].id)] = find(es[0].id);
    });
    var br = {};
    proc.forEach(function (e) {
      var b = find(e.id), B = br[b] = br[b] || { edges: [], ev: [], tees: [], movers: [] };
      B.edges.push(e);
      [e.a, e.b].forEach(function (k) {
        if (!k) return;
        var n = st[k];
        if (n && EQUIP[n.state]) { (isMover(n) ? B.movers : B.ev).push(n); }
        else if (deg[k] > 2) B.tees.push(k);
      });
      if (e.flowOf && st[e.flowOf]) B.movers.push(st[e.flowOf]);
    });
    var res = {};
    Object.keys(br).forEach(function (b) {
      var B = br[b], all = B.movers.concat(B.ev), r;
      if (all.some(function (n) { return n.quality === 'nosample'; })) r = 'unknown';
      else if (B.movers.length) r = B.movers.some(function (n) { return n.state === 'running'; }) ? 'running' : 'stopped';
      else if (B.ev.length) r = B.ev.some(function (n) { return n.state === 'running' || n.state === 'fault'; }) ? 'running' : 'stopped';   // a fault on a heat exchanger / chiller does not prove zero flow; only a mover's stop does
      res[b] = r || null;
    });
    for (var pass = 0; pass < 4; pass++) {   // headers between tees take "running" from a running neighbour branch
      Object.keys(br).forEach(function (b) {
        if (res[b]) return;
        var on = br[b].tees.some(function (t) { return (byNode[t] || []).some(function (e) { return res[find(e.id)] === 'running'; }); });
        if (on) res[b] = 'running';
      });
    }
    proc.forEach(function (e) { out[e.id] = res[find(e.id)] || 'unknown'; });
    return out;
  }
  /* the options every sheet render gets: read() records each node's state for the flow pass of the same repaint */
  function sheetOpts(extra) {
    var st = {}, dirty = true, map = null;
    var o = {
      read: function (n) { var d = read(n, extra && extra.sheet), o = st[n.id]; if (!o || o.state !== d.state || o.quality !== d.quality) { st[n.id] = { state: d.state, quality: d.quality, sym: n.sym, cls: n.cls }; dirty = true; } return d; },   // the flow pass re-runs only when a state changed
      flow: function (e, graph) { if (dirty) { map = flowMap(graph, st); dirty = false; } return map[e.id]; }
    };
    for (var k in extra || {}) if (k !== 'sheet') o[k] = extra[k];
    return o;
  }

  /* ── 4. the sheets on their tabs ────────────────────────────────────────────────────────────────── */
  var sheets = {};
  function fireInventory() {
    var W = win.RZDatahallAIFireWorkstation, inv = W && W.inventory ? W.inventory() : null;
    if (!inv && typeof win.fireInv === 'function') inv = win.fireInv();
    return inv || null;
  }
  /* a sheet is drawn only once its tab panel is shown: the cockpit builds no panel a visitor never opens (v3.11.7,
     gate test-dcai-deferred-panels D6), and 14 sheets drawn into hidden panels at boot also landed inside that window */
  function panelHidden(node) { var pn = node.closest && node.closest('.pn'); return !!pn && !pn.getClientRects().length; }
  function mount(svgId, sheetId, svgNewId, o) {
    var old = doc.getElementById(svgId), S = win.RZDatahallAISheets, R = win.RZHmiSheet, snap = win.DCAI_CALC && win.DCAI_CALC.snapshot;
    if (!old || !S || !R || !snap || panelHidden(old)) return;
    var bx = old.closest('.bx'); if (!bx || bx.querySelector('.hmi-host[data-hmi-sheet="' + sheetId + '"]')) return;
    var host = el('div', { class: 'hmi-host', 'data-hmi-sheet': sheetId });
    var h3 = bx.querySelector('h3');
    if (o && o.keep) {   // keep mode: the sheet joins the box right after the drawing it complements; nothing is retired
      var sib = old; while (sib.parentElement && sib.parentElement !== bx) sib = sib.parentElement;
      sib.insertAdjacentElement('afterend', host);
    } else {
      Array.prototype.slice.call(bx.children).forEach(function (c) { if (c !== h3) c.setAttribute('data-dh2-retired', ''); });
      bx.appendChild(host);
    }
    var sheet;
    try { sheet = S.build(sheetId, snap, o); }
    catch (e) {   // a builder that cannot draw (missing engine path) must never leave a blank box: restore the old drawing
      host.remove(); Array.prototype.slice.call(bx.querySelectorAll('[data-dh2-retired]')).forEach(function (c) { c.removeAttribute('data-dh2-retired'); });
      if (win.console) console.warn('hmi-v2: ' + sheetId + ' not drawn — ' + e.message); return;
    }
    sheet.svgId = svgNewId;
    sheets[sheetId] = R.render(host, sheet, sheetOpts({ open: open, sheet: sheetId }));
  }
  /* a sheet with no legacy drawing to replace: its own box, inserted right after the box of an anchor drawing */
  function mountNew(anchorSvgId, sheetId, svgNewId, o) {
    var a = doc.getElementById(anchorSvgId), S = win.RZDatahallAISheets, R = win.RZHmiSheet, snap = win.DCAI_CALC && win.DCAI_CALC.snapshot;
    if (!a || !S || !R || !snap || panelHidden(a) || sheets[sheetId] || doc.querySelector('.bx[data-hmi-box="' + sheetId + '"]')) return;
    var ab = a.closest('.bx') || (o && o.loose && a.getClientRects().length ? a : null); if (!ab) return;   // loose: the anchor is a plain block (no drawing box), drawn only once that block shows
    var sheet; try { sheet = S.build(sheetId, snap, o); } catch (e) { if (win.console) console.warn('hmi-v2: ' + sheetId + ' not drawn — ' + e.message); return; }
    var bx = el('div', { class: 'bx', 'data-hmi-box': sheetId }), host = el('div', { class: 'hmi-host', 'data-hmi-sheet': sheetId });
    bx.appendChild(host);
    if (o && o.before) ab.insertAdjacentElement('beforebegin', bx); else (o && o.after ? doc.querySelector(o.after) || ab : ab).insertAdjacentElement('afterend', bx);
    sheet.svgId = svgNewId;
    sheets[sheetId] = R.render(host, sheet, sheetOpts({ open: open, sheet: sheetId }));
  }
  function mountAll() {
    var OP = win.RZDatahallAIHmiOpeners = win.RZDatahallAIHmiOpeners || {}; if (!OP.fire) OP.fire = openFireZone;   // tier-2 of the fire-zone payload
    mount('coolSvg', 'dh-m-103', 'hmiCoolSvg');
    mountNew('coolSvg', 'dh-m-101', 'hmiCoolOverSvg', { before: true });                         // overview first: where every item sits
    mountNew('coolSvg', 'dh-m-102', 'hmiCoolPlantSvg');                                          // heat rejection, after the CDU line
    mountNew('coolSvg', 'dh-m-104', 'hmiCoolRowsSvg', { after: '.bx[data-hmi-box="dh-m-102"]' });   // TCS to the rack rows, after it
    mount('elecDH1Svg', 'dh-e-101', 'hmiElecDH1Svg');
    for (var h = 2; h <= 16; h++) if (doc.getElementById('elecDH' + h + 'Svg')) mount('elecDH' + h + 'Svg', 'dh-e-1' + (h < 10 ? '0' : '') + h, 'hmiElecDH' + h + 'Svg', { hall: h });   // drawn lazily per hall sub-tab
    mount('rackSvg', 'dh-r-101', 'hmiRackSvg');
    mount('elecOvSvg', 'dh-e-001', 'hmiElecOvSvg');
    mount('netSvg', 'dh-n-101', 'hmiNetSvg');
    var fi = fireInventory();
    if (fi) mount('fireSvg', 'dh-f-101', 'hmiFireSvg', { fire: fi });
    if (fi) mountNew('fireSvg', 'dh-f-102', 'hmiFireRelSvg', { fire: fi });   // clean-agent release, under the detection sheet
    var CE = win.RZDatahallAIFireCauseEffect;
    if (fi) mountNew('fireZonesGrid', 'dh-f-104', 'hmiFireZoneSvg', { fire: fi, loose: true, before: true });   // zone map above the zone tiles (the tiles keep the per-zone detail)
    if (fi && CE && CE.BASE_ROWS) mountNew('fireCauseEffectSummary', 'dh-f-103', 'hmiFireIlkSvg', { fire: fi, loose: true, before: true, systems: ceSystems(CE) });   // interlocks, above the C&E matrix they draw
    if (fi) mount('floorSvg', 'dh-a-101', 'hmiFloorPlanSvg', { fire: fi, keep: true });   // Room Layout: the to-scale hall plan joins the building isometric and the per-level plans (kept — their reveal gates stay)
    if (win.BMS_MODEL) mount('bmsSvg', 'dh-b-101', 'hmiBmsSvg', { bms: win.BMS_MODEL });
    if (win.WAN_NODES) mount('wanSvg', 'dh-n-102', 'hmiWanSvg', { wan: win.WAN_NODES });
    if (win.ZONES) mount('secSvg', 'dh-n-104', 'hmiSecSvg', { zones: win.ZONES });
    /* the CDU tier-2 opener stays the PAGE's (openCduHmi: the dh-modal contract — focus trap, inert background,
       aria-modal, timers cleared on close); the CDU-nn L3 sheet is drawn inside that modal's body and the legacy
       720 x 440 mimic in it is retired, not deleted. Only without the page opener does the bare sheet modal open. */
    wrapOpener('chiller', function (id) { drawInPageModal('chHmi', 'chHmiSvg', 'chiller-l3', 'chiller', { id: id }); });
    wrapOpener('crah', function (id) { drawInPageModal('crahHmi', 'crahHmiSvg', 'crah-l3', 'crah', { id: id }); });
    wrapOpener('eq', function (type) {
      var t = String(type || ''), map = { 'CW Pump Station': ['pump-station', { loop: 'cw' }], 'FWS Pump Station': ['pump-station', { loop: 'fws' }], 'TCS Manifold': ['tcs-manifold', {}], 'Chemical Dosing': ['chem-dosing', {}] };
      if (map[t]) drawInPageModal('eqHmi', 'eqHmiSvg', 'eq-l3', map[t][0], map[t][1]);
    });
    wrapOpener('net', function (kind, id) { if (/^(core|spine|leaf)$/.test(String(kind))) drawAtBodyTop('netModalBody', 'net-l3', 'switch', { kind: kind, id: id }); });
    wrapOpener('bms', function (kind, id) {
      if (!win.BMS_MODEL) return;
      if (kind === 'controller') drawAtBodyTop('bmsModalBody', 'bms-l3', 'bms-controller', { bms: win.BMS_MODEL, id: id });
      else if (/^(server|network|gateway|ldc)$/.test(String(kind || 'server'))) drawAtBodyTop('bmsModalBody', 'bms-l3', 'bms-node', { bms: win.BMS_MODEL, kind: String(kind || 'server'), id: id });   // the spec tables stay below the schematic
    });
    wrapOpener('rack', function (type) {
      if (/psu|power|shelf/.test(String(type))) { drawRackPower('rack-power'); return; }
      if (String(type) === 'ct') { drawRackPower('tray', { id: arguments[1] }); return; }
      if (String(type) === 'ns') { drawRackPower('nvswitch-tray', { id: arguments[1] }); return; }
      var RCLS = { manifold: 'rack-manifold', busbar: 'rack-busbar', leak: 'rack-leak', backplane: 'rack-busbar' };
      if (RCLS[String(type)]) { drawRackPower('dh-r-101', { focusCls: RCLS[String(type)] }); return; }   // the rack elevation with the opened item selected (was text cards)
      // compute / switch tray block diagrams still draw in the legacy svg: bring it back, drop the shelf sheet
      var svg0 = doc.getElementById('rackModalSvg'), h = svg0 && svg0.parentNode.querySelector('.hmi-host[data-hmi-sheet="rack-l3"]');
      if (svg0) svg0.removeAttribute('data-dh2-retired'); if (h) h.remove(); if (pageSheets['rack-l3']) { pageSheets['rack-l3'].destroy(); pageSheets['rack-l3'] = null; }
    });
    wrapOpener('mimic', function (type, dh) { drawMimic(type, dh); });
    wrapOpener('stp', function () { drawInPageModal('eqHmi', 'eqHmiSvg', 'eq-l3', 'stp', {}); });
    wrapOpener('ahu', function () { drawInPageModal('eqHmi', 'eqHmiSvg', 'eq-l3', 'ahu', {}); });
    wrapOpener('dryCooler', function (id) { drawInPageModal('ctHmiModal', 'ctHmiSvg', 'dc-l3', 'dry-cooler', { id: id }); });
    /* ONE wrapper per opener: wrapOpener skips an opener it already wrapped, so a second wrapOpener('bat') — the L3 draw —
       was never installed and the battery modal kept its legacy mimic (found by the honest H3 count, v3.63.0) */
    wrapOpener('bat', function (feed) {
      var t = doc.getElementById('batHmiTitle'); if (t && !t.hasAttribute('data-rz-authored-basis')) t.setAttribute('data-rz-authored-basis', 'battery system nameplate label (lithium-titanate SCiB string, 480 VDC) authored with the page UPS battery design; the engine publishes energy, not the string voltage');
      drawInPageModal('batHmi', 'batHmiSvg', 'bat-l3', 'battery', { side: String(feed || 'A').toUpperCase().charAt(0), unit: 1 });
    });
    {   // the CDU opener does not need the cooling sheet (openCdu builds a stand-in node), so it is wired on every tab
      var O = win.RZDatahallAIHmiOpeners = win.RZDatahallAIHmiOpeners || {}, prev = O.cdu;
      if (prev && !prev.__hmiL3) {
        var wrapped = function (num) { prev(num); drawCduInPageModal(num); };
        wrapped.__hmiL3 = true; O.cdu = wrapped;
      } else if (!prev) O.cdu = function (num) { openCdu(num); };
    }
  }
  function repaintNow() {
    Object.keys(sheets).forEach(function (k) { if (sheets[k] && sheets[k].svg.getBoundingClientRect().width) sheets[k].update(); });
    if (pageCduSheet && pageCduSheet.svg.getBoundingClientRect().width) pageCduSheet.update();
    Object.keys(pageSheets).forEach(function (k) { var p = pageSheets[k]; if (p && p.svg.getBoundingClientRect().width) p.update(); });   // L3 sheets inside page modals, only while shown
  }
  setInterval(repaintNow, 4000);   // telemetry tick
  /* an alarm reaches the sheet when its source changes, not on the next 4 s poll (owner brief: alarm status follows the
     source event as the UI receives it) — a scenario change or an alarm-workspace event repaints at once */
  doc.addEventListener('change', function (ev) { if (ev.target && /^(coolingScenario|electricalScenario)$/.test(ev.target.id)) repaintNow(); }, true);
  ['rz-replay-change', 'rz-alarm-ack', 'rz-alarms-changed'].forEach(function (t) { doc.addEventListener(t, repaintNow); });

  /* ── 5. equipment modal (L3) ─────────────────────────────────────────────────────────────────────── */
  var back = null, lastFocus = null, modalSheet = null, pageCduSheet = null;
  /* chiller / CRAH / battery: same pattern as the CDU — the page's modal keeps its contract, the L3 sheet replaces the
     legacy mimic in its body (retired, not deleted); a builder that throws leaves the legacy mimic showing */
  var pageSheets = {};
  function drawInPageModal(modalId, legacyId, key, sheetId, o) {
    var body = doc.querySelector('#' + modalId + ' [class$="-hmi-body"]'), snap = win.DCAI_CALC && win.DCAI_CALC.snapshot;
    if (!body || !snap || !win.RZHmiSheet || !win.RZDatahallAISheets) return;
    var legacy = doc.getElementById(legacyId), sheet;
    try { sheet = win.RZDatahallAISheets.build(sheetId, snap, o); } catch (e) { if (win.console) console.warn('hmi-v2: ' + sheetId + ' — ' + e.message); return; }
    if (legacy) legacy.setAttribute('data-dh2-retired', '');
    var host = body.querySelector('.hmi-host[data-hmi-sheet="' + key + '"]');
    if (!host) { host = el('div', { class: 'hmi-host', 'data-hmi-sheet': key }); body.appendChild(host); }
    if (pageSheets[key]) { pageSheets[key].destroy(); pageSheets[key] = null; }
    host.innerHTML = '';
    pageSheets[key] = win.RZHmiSheet.render(host, sheet, sheetOpts());
  }
  /* a text modal keeps its detail; the L3 sheet goes on top of its body */
  function drawAtBodyTop(bodyId, key, sheetId, o) {
    var body = doc.getElementById(bodyId), snap = win.DCAI_CALC && win.DCAI_CALC.snapshot;
    if (!body || !snap || !win.RZHmiSheet || !win.RZDatahallAISheets) return;
    var sheet; try { sheet = win.RZDatahallAISheets.build(sheetId, snap, o); } catch (e) { if (win.console) console.warn('hmi-v2: ' + sheetId + ' — ' + e.message); return; }
    var host = body.querySelector('.hmi-host[data-hmi-sheet="' + key + '"]');
    if (!host) { host = el('div', { class: 'hmi-host', 'data-hmi-sheet': key }); body.insertBefore(host, body.firstChild); }
    if (pageSheets[key]) { pageSheets[key].destroy(); pageSheets[key] = null; }
    host.innerHTML = '';
    pageSheets[key] = win.RZHmiSheet.render(host, sheet, sheetOpts());
  }
  /* SLD mimic: the feed one-line replaces the legacy four-panel mimic in its body (retired, not deleted); states from the
     scenario engine (sheet id dh-e-*), zoomed to and selecting the device that was opened; the results panel stays */
  function drawRackPower(which, o) {   // rack modal: the shelf one-line replaces the text-card mimic (retired, not deleted)
    var svg0 = doc.getElementById('rackModalSvg'), snap = win.DCAI_CALC && win.DCAI_CALC.snapshot; if (!svg0 || !snap) return;
    var sheet; try { sheet = win.RZDatahallAISheets.build(which || 'rack-power', snap, o || {}); } catch (e) { if (win.console) console.warn('hmi-v2: ' + (which || 'rack-power') + ' — ' + e.message); return; }
    var par = svg0.parentNode, host = par.querySelector('.hmi-host[data-hmi-sheet="rack-l3"]');
    if (!host) { host = el('div', { class: 'hmi-host', 'data-hmi-sheet': 'rack-l3' }); par.insertBefore(host, svg0); }
    svg0.setAttribute('data-dh2-retired', '');
    if (pageSheets['rack-l3']) { pageSheets['rack-l3'].destroy(); pageSheets['rack-l3'] = null; }
    if (which === 'dh-r-101') sheet.svgId = 'rackL3Svg';   // the Rack tab draws the same sheet as hmiRackSvg: no duplicate id
    host.innerHTML = ''; var api = pageSheets['rack-l3'] = win.RZHmiSheet.render(host, sheet, sheetOpts());
    if (o && o.focusCls) setTimeout(function () {
      var g = api.svg.querySelector('.hmi-node[data-rz-equipment^="' + o.focusCls + ':"]');
      if (g) { g.setAttribute('data-selected', ''); if (g.scrollIntoView) g.scrollIntoView({ block: 'center', inline: 'nearest' }); }
    }, 60);
  }
  function drawMimic(type, dh) {
    var body = doc.querySelector('#sldMimic .sld-mimic-body'), snap = win.DCAI_CALC && win.DCAI_CALC.snapshot;
    if (!body || !snap || !win.RZHmiSheet || !win.RZDatahallAISheets) return;
    var sheet; try { sheet = win.RZDatahallAISheets.build('sld-mimic', snap, { type: String(type || 'msb'), hall: Number(dh) || 1 }); } catch (e) { if (win.console) console.warn('hmi-v2: sld-mimic — ' + e.message); return; }
    var legacy = doc.getElementById('sldMimicSvg'); if (legacy) legacy.setAttribute('data-dh2-retired', '');
    var host = body.querySelector('.hmi-host[data-hmi-sheet="sld-l3"]');
    if (!host) { host = el('div', { class: 'hmi-host', 'data-hmi-sheet': 'sld-l3' }); body.insertBefore(host, body.firstChild); }
    if (pageSheets['sld-l3']) { pageSheets['sld-l3'].destroy(); pageSheets['sld-l3'] = null; }
    host.innerHTML = '';
    var api = pageSheets['sld-l3'] = win.RZHmiSheet.render(host, sheet, sheetOpts({ sheet: 'dh-e-101' }));
    if (sheet.focusId) setTimeout(function () {
      var g = api.svg.querySelector('.hmi-node[data-node="' + sheet.focusId + '"]');   // the feed sheet is legible at fit: select, do not zoom
      if (g) { g.setAttribute('data-selected', ''); if (g.scrollIntoView) g.scrollIntoView({ block: 'center', inline: 'nearest' }); }
    }, 60);
  }
  function wrapOpener(name, after) {
    var O = win.RZDatahallAIHmiOpeners = win.RZDatahallAIHmiOpeners || {}, prev = O[name];
    if (!prev || prev.__hmiL3) return;
    var w = function () { prev.apply(this, arguments); after.apply(this, arguments); };
    w.__hmiL3 = true; O[name] = w;
  }
  function drawCduInPageModal(num) {
    var body = doc.querySelector('#cduHmi .cdu-hmi-body'), snap = win.DCAI_CALC && win.DCAI_CALC.snapshot;
    if (!body || !snap || !win.RZHmiSheet || !win.RZDatahallAISheets) return;
    var id = /^\d+$/.test(String(num)) ? (String(num).length < 2 ? '0' + num : String(num)) : String(num);
    var legacy = doc.getElementById('cduHmiSvg'); if (legacy) legacy.setAttribute('data-dh2-retired', '');
    var host = body.querySelector('.hmi-host[data-hmi-sheet="cdu-l3"]');
    if (!host) { host = el('div', { class: 'hmi-host', 'data-hmi-sheet': 'cdu-l3' }); body.appendChild(host); }
    if (pageCduSheet) { pageCduSheet.destroy(); pageCduSheet = null; }
    host.innerHTML = '';
    try { pageCduSheet = win.RZHmiSheet.render(host, win.RZDatahallAISheets.build('cdu', snap, { id: id }), sheetOpts()); }
    catch (e) { if (legacy) legacy.removeAttribute('data-dh2-retired'); if (win.console) console.warn('hmi-v2: CDU sheet', e.message); }
  }
  function close() { if (!back) return; back.hidden = true; if (modalSheet) modalSheet.destroy(); modalSheet = null; if (lastFocus) lastFocus.focus(); }
  function bandHtml(r) {
    if (!r || !r.band || r.value == null) return '';
    var lo = r.band[0], hi = r.band[1], span = (hi - lo) || 1, pad = span * 0.5, a = lo - pad, b = hi + pad, pct = function (x) { return Math.max(0, Math.min(100, (x - a) / (b - a) * 100)); };
    return '<div class="pt-band" aria-hidden="true"><i></i><b style="left:' + pct(lo) + '%;width:' + (pct(hi) - pct(lo)) + '%"></b><u style="left:' + pct(r.value) + '%"></u></div>';
  }
  function open(n, api) {
    if (n.cls !== 'cdu') return false;          // the CDU class draws its own L3 sheet; other classes keep the current HMI modal
    if (win.RZDatahallAIEquipmentInspector) return false;   // the inspector owns the click contract (plain → tier-2 opener below, Shift → inspector)
    return openCdu(String(n.eqId || '01'), n, api);
  }
  /* the CDU L3 sheet: reached through the page's opener registry (tier-2 contract of the equipment inspector) or the renderer's own click */
  function openCdu(id, n, api) {
    id = /^\d+$/.test(String(id)) ? (String(id).length < 2 ? '0' + id : String(id)) : String(id);
    if (!api && sheets['dh-m-103']) { api = sheets['dh-m-103']; var g = api.svg.querySelector('[data-rz-equipment="cdu:' + id + '"]'); n = g ? api.node(g.getAttribute('data-node')) : null; }
    n = n || { sym: 'cdu', id: 'cdu' + id, cls: 'cdu', eqId: id };
    lastFocus = doc.activeElement;
    if (!back) {
      back = el('div', { class: 'hmi-modal-back', hidden: '' });
      back.addEventListener('click', function (e) { if (e.target === back) close(); });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && back && !back.hidden) close(); });
      doc.body.appendChild(back);
    }
    var p = payload('cdu', id), rs = rows(p), st = stateOf(n, p);
    var pts = rs.slice(0, 16).map(function (r) {
      return '<div class="hmi-pt"' + (r.alarm ? ' data-alarm="' + esc(r.alarm) + '"' : '') + (r.point ? ' title="Point ' + esc(r.point) + '"' : '') + '>' +
        '<span class="pt-label">' + esc(r.label || '') + '</span><span class="pt-val">' + esc(text(r)) + '</span>' + bandHtml(r) + '</div>';
    }).join('');
    back.innerHTML = '<div class="hmi-modal" role="dialog" aria-modal="true" aria-labelledby="hmiModalTag" data-rz-modal-class="cdu">' +
      '<header><span class="tag" id="hmiModalTag">CDU-' + esc(id) + '</span><span class="cls">Coolant distribution unit</span><span class="state">' + esc(st) + '</span><span class="sp"></span>' +
      '<button type="button" class="hmi-btn" data-trace="up" title="Show what feeds this CDU on the CDU line">Trace upstream</button>' +
      '<button type="button" class="hmi-btn" data-trace="down" title="Show what this CDU feeds on the CDU line">Trace downstream</button>' +
      '<button type="button" class="hmi-btn" data-close aria-label="Close">&#215;</button></header>' +
      '<div class="hmi-m-draw"></div><div class="hmi-m-pts"><div class="hmi-m-sec">Points</div>' + (pts || '<p>—</p>') + '</div>' +
      '<div class="hmi-m-foot"><div><div class="hmi-m-sec">Trend, last 24 h (simulated)</div><div class="hmi-trend">' + trend(id) + '</div></div>' +
      '<div><div class="hmi-m-sec">Alarms</div><ul class="hmi-evt">' + (rs.filter(function (r) { return r.alarm; }).map(function (r) { return '<li>' + esc(r.label) + ' · ' + esc(text(r)) + '</li>'; }).join('') || '<li>None active</li>') + '</ul></div></div></div>';
    back.hidden = false;
    modalSheet = win.RZHmiSheet.render(back.querySelector('.hmi-m-draw'), win.RZDatahallAISheets.build('cdu', win.DCAI_CALC.snapshot, { id: id }), sheetOpts());
    back.querySelector('[data-close]').addEventListener('click', close);
    $$('[data-trace]', back).forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = b.getAttribute('data-trace'); close();
        if (api) { api.trace(n.id, dir); api.focus(n.id); }
      });
    });
    back.querySelector('[data-close]').focus();
    return true;
  }
  /* a fire zone's detection schematic (opener 'fire', the zone payload's tier-2): the fire-zone-l3 sheet with the zone's
     points beside it; the same modal shell as the CDU (focus moved in, Escape and the backdrop close, focus returned) */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }   // modal markup from payload strings: escaped, so a payload that ever carries operator text cannot become markup
  function openFireZone(zid, pointId) {
    var fi = fireInventory(), snap = win.DCAI_CALC && win.DCAI_CALC.snapshot; if (!fi || !snap || !win.RZHmiSheet || !win.RZDatahallAISheets) return false;
    var sheet; try { sheet = win.RZDatahallAISheets.build('fire-zone-l3', snap, { fire: fi, zone: String(zid), point: pointId }); } catch (e) { if (win.console) console.warn('hmi-v2: fire zone — ' + e.message); return false; }
    lastFocus = doc.activeElement;
    if (!back) {
      back = el('div', { class: 'hmi-modal-back', hidden: '' });
      back.addEventListener('click', function (e) { if (e.target === back) close(); });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && back && !back.hidden) close(); });
      doc.body.appendChild(back);
    }
    var p = payload('fire-zone', String(zid)), rs = rows(p), z = fi.zoneById[String(zid)];
    var pts = rs.slice(0, 16).map(function (r) {
      return '<div class="hmi-pt"' + (r.alarm ? ' data-alarm="' + esc(r.alarm) + '"' : '') + (r.point ? ' title="Point ' + esc(r.point) + '"' : '') + '><span class="pt-label">' + esc(r.label || '') + '</span><span class="pt-val">' + esc(text(r)) + '</span></div>';
    }).join('');
    var al = p && p.tabs && p.tabs.alarms ? p.tabs.alarms : [];
    back.innerHTML = '<div class="hmi-modal" role="dialog" aria-modal="true" aria-labelledby="hmiModalTag" data-rz-modal-class="fire-zone">' +
      '<header><span class="tag" id="hmiModalTag">' + esc(String(zid).replace(/^DH-\d\d-/, '')) + '</span><span class="cls">Fire zone · ' + esc(z ? z.name : '') + '</span><span class="state">' + esc(text(find(p, /^state$/i))) + '</span><span class="sp"></span>' +
      '<button type="button" class="hmi-btn" data-close aria-label="Close">&#215;</button></header>' +
      '<div class="hmi-m-draw"></div><div class="hmi-m-pts" data-rz-authored-basis="fire-zone payload rows (js/datahall-ai/hmi-payloads.js): means and isolations from the training isolation register, area from the engine hall geometry, ceiling temperature simulated on design plane p11 (Track A §A6)"><div class="hmi-m-sec">Points</div>' + (pts || '<p>—</p>') + '</div>' +
      '<div class="hmi-m-foot"><div><div class="hmi-m-sec">Alarms</div><ul class="hmi-evt">' + (al.map(function (a) { return '<li>' + esc(a.text || a.point || '') + '</li>'; }).join('') || '<li>None active</li>') + '</ul></div></div></div>';
    back.hidden = false;
    modalSheet = win.RZHmiSheet.render(back.querySelector('.hmi-m-draw'), sheet, sheetOpts({ sheet: 'fire-zone-l3' }));
    back.querySelector('[data-close]').addEventListener('click', close);
    back.querySelector('[data-close]').focus();
    return true;
  }
  function trend(id) {
    var c = ctx(); if (!c || !P) return '';
    var pts = [], lo = Infinity, hi = -Infinity;
    for (var k = 47; k >= 0; k--) {
      var cc = {}; for (var x in c) cc[x] = c[x]; cc.tick = c.tick - k * 450;
      var r = null; try { r = find(P.safePayload('cdu', id, cc), /differential pressure/i); } catch (e) { r = null; }
      var v = r && typeof r.value === 'number' ? r.value : null; pts.push(v);
      if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    if (!isFinite(lo)) return '';
    var pad = (hi - lo) * 0.3 || 0.5; lo -= pad; hi += pad;
    var d = pts.map(function (v, i) { return v == null ? '' : (i ? 'L' : 'M') + (i * 300 / 47).toFixed(1) + ' ' + (60 - (v - lo) / (hi - lo) * 56).toFixed(1); }).join(' ');
    var last = pts[pts.length - 1];
    return '<svg viewBox="0 0 300 64" preserveAspectRatio="none" role="img" aria-label="CDU differential pressure, last 24 hours"><path d="' + d + '"/></svg>' +
      '<div class="hmi-trend-ax"><span>-24 h</span><span>Differential pressure ' + (last != null ? last.toFixed(2) + ' bar' : '—') + '</span><span>now</span></div>';
  }

  /* less text around the drawings (R128/R131): the floor budget belongs to Room Layout, the data-mode pill
     repeats the SIM chip, the legal notice moves under the content (it stays on every tab) */
  function declutter() {
    var budget = $('section[aria-labelledby="hallBudgetTitle"]'), over = $('#p-over');
    if (budget && over) over.insertBefore(budget, over.firstChild);
    var legal = $('details.legal-disclaimer-wrap'), mn = $('.mn');
    if (legal && mn) { mn.appendChild(legal); var pill = legal.querySelector('summary [aria-label="Data mode"]'); if (pill) pill.hidden = true; }
    // captions and eyebrows above a view become the heading's tooltip; the view keeps its title only
    $$('.mn .rz-ops-caption, .mn .dh-primary-q').forEach(function (c) {
      var box = c.closest('.bx, .rz-ops-section, .rz-ops-section__head') || c.parentNode;
      var h = box && box.querySelector('h3');
      if (h && !h.getAttribute('title')) { h.setAttribute('title', c.textContent.replace(/\s+/g, ' ').trim()); h.classList.add('dh2-has-tip'); }
      c.hidden = true;
    });
    $$('.mn .rz-ops-eyebrow').forEach(function (e) { e.hidden = true; });
  }
  function boot() {
    shell(); sidebar(); declutter();
    /* the fire sheets need the workstation inventory, which exists only once the engine authority has validated
       and the fire workstation has booted (often after the Fire tab is first opened) — so mounting keeps retrying:
       fast for 10 s, then every 1.5 s for 5 min, and on every tab click, until all 8 sheets are up */
    var tries = 0, done = function () { return Object.keys(sheets).length >= 14; };
    function tick() { if (win.DCAI_CALC && win.RZDatahallAISheets && doc.getElementById('coolSvg')) mountAll(); }
    var t = setInterval(function () { tries++; tick(); if (done() || tries > 40) { clearInterval(t); if (!done()) slow(); } }, 250);
    function slow() { var n = 0, t2 = setInterval(function () { n++; tick(); if (done() || n > 200) clearInterval(t2); }, 1500); }
    function onTab(ev) {   // a panel's sheets are drawn when it is shown: right after the page's own tab handler, and again once its builder has run
      if (ev.type === 'keydown' && !/^(Enter| |Arrow(Left|Right|Up|Down)|Home|End)$/.test(ev.key)) return;
      if (ev.target.closest && ev.target.closest('#tabs, #fireTabs, #netTabs, .elec-tabs')) { setTimeout(tick, 60); setTimeout(tick, 600); }
    }
    doc.addEventListener('click', onTab, true); doc.addEventListener('keydown', onTab, true);   // hall SLDs are drawn lazily per sub-tab: mount after every tab click (mount() skips a sheet already up)
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  win.RZDhHmiV2 = { setSide: setSide, sheets: sheets, open: open, repaint: repaintNow };
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
