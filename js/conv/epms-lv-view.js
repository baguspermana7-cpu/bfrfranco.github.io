/*
 * epms-lv-view.js — E-S-102 "LV distribution — typical hall" on EPMS_Telemetry.html, and the page status of BOTH views
 * (PRD-CONV-EQUIPMENT-TRUTH §6.1 / §7.1 F3 F4 F14 F21, phase E5).
 *
 *   one sheet per hall from js/conv/epms-lv.js; the hall selector re-renders the host with that hall's sheet and state
 *   (every hall keeps its own switching state); values only from the engine and the solve.
 *   Operation is select-before-operate: the inspector of a selected item offers "Select · <command>"; only then
 *   "Execute" (or "Cancel") — two presses, and a selection is dropped when another item is opened or the hall changes.
 *   Every operation here or on E-S-101 (event 'rz-epms-change') re-solves all four halls and repaints the status
 *   strip and bar through window.RZEpmsStatus: a dead source, a dead board, a UPS on battery is an alarm, never NORMAL.
 *   A ring is dead on E-S-102 when its feeder's ring on E-S-101 is dead (window.RZEpmsPage.dev).
 *   Read-only handle for the gates: window.RZEpmsLvPage.
 */
(function () {
  'use strict';
  var doc = document, LV = window.RZEpmsLv, C = window.CONV_CALC;
  var host = doc.getElementById('epms-lv-host'), msgEl = doc.getElementById('epms-lv-msg');
  if (!host || !LV || !window.RZHmiSheet) return;
  var auth = typeof EPMS_RUNTIME_AUTHORITY_AVAILABLE !== 'undefined' && EPMS_RUNTIME_AUTHORITY_AVAILABLE;
  var snap = auth && C ? C.snapshot : null, B = snap ? LV.basis(snap) : null;
  var LIVE = !!(B && window.RZConvSld && typeof C.getFleet === 'function');
  var U = 'UNAVAILABLE', DASH = '—', HALLS = LV.HALLS;
  var DECL = 'E-S-102 simulated switching state solved through js/conv/sld-topology.js from the engine hall loads; no field device is read';
  var SH = [], ST = [], RES = [], cur = 0, sheet = null, armed = null, lastMsg = null, ops = 0;
  function grp(v) { return Math.round(v || 0).toLocaleString('en-US'); }
  function kw(v) { return grp(v) + ' kW'; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* every hall's sheet is built from the engine; without the authority hall A is still drawn, stateless */
  HALLS.forEach(function (code, h) {
    var fleet = C && typeof C.getFleet === 'function' ? C.getFleet('genset', code) : null;
    SH[h] = C && C.snapshot ? LV.build(h, C.snapshot, fleet) : null;
    ST[h] = SH[h] ? LV.normalState(SH[h]) : null;
  });
  if (!SH[0]) { if (msgEl) msgEl.innerHTML = '<b>SIMULATION</b> EPMS authority unavailable — E-S-102 cannot be drawn without the engine.'; return; }
  var E = LIVE ? B.e : null;

  function upstream(h) {
    var P = window.RZEpmsPage, out = {};
    if (!P || !P.live) return out;
    SH[h].nodes.forEach(function (n) { if (n.ring) { var d = P.dev(n.ring); out[n.id] = !!(d && d.energised); } });
    return out;
  }
  function solveAll() { if (!LIVE) return; HALLS.forEach(function (c, h) { RES[h] = LV.solve(SH[h], ST[h], B, upstream(h)); }); }

  function devState(d, closed) {
    if (!d) return 'stopped';
    if (closed === false) return d.lineLive || d.loadLive ? 'standby' : 'stopped';
    return d.energised ? (d.kw > 0.5 ? 'energized' : 'standby') : 'stopped';
  }
  function fv(t, alarm) { var o = { text: t }; if (alarm) o.alarm = alarm; return o; }
  function read(n) {
    var o = { values: {} }, S = SH[cur];
    if (!LIVE) { o.state = null; (n.values || []).forEach(function (v) { o.values[v.k] = fv(v.k === 'st' ? U : DASH); }); return o; }
    var r = RES[cur], st = ST[cur], d = r.dev[n.id];
    if (n.sw) {
      var closed = !!st.closed[n.id];
      o.state = devState(d, closed);
      o.values.st = fv(n.sw === 'ss' ? (closed ? 'ON' : 'OFF') : (closed ? 'CLOSED' : 'OPEN'));
      o.values.pw = fv(kw(d && d.kw) + ' · ' + grp(d && d.a) + ' A');
      return o;
    }
    if (n.src === 'grid') {
      var lost = r.lost[n.id];
      o.state = lost ? 'stopped' : 'energized';
      o.values.st = fv(st.lost[n.id] ? 'OUT OF SERVICE' : (lost ? 'DEAD' : 'LIVE'), lost ? '1' : null);
      o.values.kw = fv(kw(r.raw.sources[n.id] && r.raw.sources[n.id].kw));
      if (lost) o.alarm = '1';
      return o;
    }
    if (n.board) {
      var bus = r.raw.nodes[n.board], live = !!(bus && bus.energised);
      o.state = live ? 'energized' : 'stopped';
      o.values.r = fv(n.kv === 'mv' ? E.mv_voltage_kv + ' kV · ' + E.mv_fault_level_ka + ' kA' : E.lv_voltage_v + ' V · ' + E.lv_fault_level_ka + ' kA');
      if (!live) o.alarm = '1';
      return o;
    }
    if (n.tx) {
      o.state = devState(d);
      o.values.r = fv(grp(E.dist_tx_kva) + ' kVA ' + E.mv_voltage_kv + ' / ' + (E.lv_voltage_v / 1000) + ' kV');
      o.values.ld = fv(kw(d.kw / (n.units || 1)) + ' each · ' + d.pct.toFixed(1) + ' %');
      return o;
    }
    if (n.ups) {
      var bat = SH[cur].nodes.filter(function (m) { return m.src === 'battery' && m.rec === n.id.replace('inv', 'rec'); })[0];
      var onBat = bat && r.batt[bat.id];
      o.state = devState(d);
      if (n.sym === 'rectifier') { o.values.kw = fv(onBat ? 'input lost' : kw(d && d.kw)); return o; }
      o.values.st = fv(!(d && d.energised) ? 'OFF' : (onBat ? 'ON BATTERY' : 'ON MAINS'), onBat || !(d && d.energised) ? '1' : null);
      o.values.ld = fv(kw(d && d.kw) + ' · ' + (100 * (d ? d.kw : 0) / bat.ratingKw).toFixed(1) + ' %');
      o.values.r = fv(SH[cur].counts.modules + ' × ' + grp(E.ups_module_kw_rated) + ' kW');
      if (onBat) o.alarm = '1';
      return o;
    }
    if (n.src === 'battery') {
      var dis = !!r.batt[n.id];
      o.state = dis ? 'energized' : 'standby';
      o.values.st = fv(dis ? 'DISCHARGING' : 'FLOAT', dis ? '1' : null);
      if (dis) o.alarm = '1';
      return o;
    }
    if (n.src === 'gen') {
      var run = !!st.run[n.id], sk = r.raw.sources[n.id];
      o.state = run ? (sk && sk.kw > 0.5 ? 'running' : 'standby') : 'stopped';
      o.values.st = fv(run ? 'RUNNING' : 'STANDBY');
      o.values.kw = fv(run ? kw(sk && sk.kw) + (sk && sk.overload ? ' over' : '') : grp(n.ratedKw) + ' kW', sk && sk.overload ? '1' : null);
      if (sk && sk.overload) o.alarm = '1';
      return o;
    }
    if (n.load) {
      var on = !!(d && d.energised);
      o.state = on ? 'energized' : 'stopped';
      o.values.kw = fv(on ? kw(n.kw) : '0 kW · not supplied', on ? null : '1');
      if (!on) o.alarm = '1';
      return o;
    }
    if (n.sym === 'protectionRelay') { var cb = r.dev[n.cb]; o.state = cb && cb.energised ? 'normal' : 'standby'; return o; }
    return o;
  }
  function flow(e) {
    if (!e.flowOf) return null;
    if (!LIVE) return 'unavailable';
    var x = RES[cur].edges[e.id];
    return x && x.energised && x.kw > 0.5 ? 'running' : 'stopped';
  }
  function rest(e) { return !!(LIVE && e.flowOf === 'p' && RES[cur].edges[e.id] && RES[cur].edges[e.id].energised); }

  /* E-S-102 symbols the shared payload classes (js/conv/payloads.js, epms:*) do not describe: name and role here */
  var KIND = {
    switchgear: ['Switchboard', 'The board whose bus is drawn beside it: incomers, bus section and outgoing feeders'],
    rectifier: ['UPS rectifier / charger', 'Converts the LV supply to the DC bus and charges the battery'],
    inverterIec: ['UPS inverter', 'Converts the DC bus back to clean AC for the rack PDU / RPP boards'],
    batteryIec: ['UPS battery', 'Holds the DC bus when the rectifier input is lost; autonomy is not modelled by the engine'],
    staticSwitch: ['Static bypass switch', 'Feeds the load straight from the input when the inverter is lost or overloaded']
  };
  function byId(id) { return SH[cur].nodes.filter(function (n) { return n.id === id; })[0] || null; }
  function relayOf(n) { return n.sym === 'protectionRelay' ? n : (n.relay ? byId(n.relay) : null); }
  function payload(n) {
    var T = window.RZConvTruth; if (!T) return null;
    var p = T.sheetPayload({ classId: 'epms', node: n, read: read(n), store: null, edges: SH[cur].edges, nodes: SH[cur].nodes, declared: DECL, tick: ops,
      scope: 'E-S-102 · hall ' + HALLS[cur] });
    var out = {}; Object.keys(p).forEach(function (k) { out[k] = p[k]; });
    var kd = KIND[n.sym], role = [];
    if (kd) { out.kind = kd[0]; role.push({ label: 'Role', text: kd[1], unit: '', quality: 'declared', declared: DECL }); }
    if (n.src === 'gen') role.push({ label: 'Operation', text: 'started and stopped on this sheet; output limited to ' + grp(n.ratingKw) + ' kW (' + grp(E ? E.genset_max_loading * 100 : 0) + ' % of the unit rating)', unit: '', quality: 'declared', declared: DECL });
    var custom = [], cmd = LIVE ? LV.command(SH[cur], ST[cur], n.id) : null;
    if (cmd) {
      if (armed && armed.h === cur && armed.id === n.id) {
        custom.push({ id: 'sbo-exec', label: 'Execute · ' + armed.label, handler: 'epmsLvExecute', tone: 'default', title: 'Operate ' + n.tag + ' now: ' + armed.label });
        custom.push({ id: 'sbo-cancel', label: 'Cancel', handler: 'epmsLvCancel', tone: 'default', title: 'Drop the selection of ' + n.tag });
      } else {
        custom.push({ id: 'sbo-select-' + cmd.verb, label: 'Select · ' + cmd.label, handler: 'epmsLvSelect', tone: 'default', title: 'Select ' + n.tag + ' to ' + cmd.label.toLowerCase() + '; Execute follows' });
      }
    }
    var rl = relayOf(n);
    if (LIVE && rl && rl.prot && window.RZEpmsTccSpec) custom.push({ id: 'tcc', label: 'Time–current curves', handler: 'epmsLvTcc', tone: 'default',
      title: 'The LV main against the 20 kV devices above it, from the engine settings' });
    out.actions = { openHmi: true, related: [], custom: custom };
    /* the E-S-101 genset class says its sets are not started there; on E-S-102 they are, so that row is replaced */
    var live = (p.tabs.live || []).filter(function (r) { return !/not started on this sheet/.test(r.text || ''); });
    if (lastMsg) role.unshift({ label: 'Last command', text: lastMsg, unit: '', quality: 'declared', declared: DECL });
    var tabs = {}; Object.keys(p.tabs).forEach(function (k) { tabs[k] = p.tabs[k]; });
    tabs.live = role.concat(live);
    out.tabs = tabs;
    return out;
  }
  function say(text, refused) {
    if (!msgEl) return;
    msgEl.innerHTML = '<b>SIMULATION</b> ' + esc(text);
    if (refused) msgEl.setAttribute('data-refused', '1'); else msgEl.removeAttribute('data-refused');
  }

  /* ── page status: both sheets, all halls ─────────────────────────────────────────────────────────────────────── */
  function model() {
    var m = { alarms: [], offNormal: 0, servedKw: 0, demandKw: 0, ringsLive: 0, ringsTotal: 0, ringsLostA: 0, ringsLostB: 0, onBattery: 0, upsTotal: 0,
      gensRunning: 0, gensTotal: 0, lvClosed: 0, lvTotal: 0, lvHall: HALLS[cur], halls: [] };
    HALLS.forEach(function (code, h) {
      var S = SH[h], r = RES[h], s = LV.summary(S, ST[h], r), al = LV.alarms(S, ST[h], r);
      al.forEach(function (a) { m.alarms.push({ prio: a.prio, tag: a.tag, text: 'Hall ' + code + ' · ' + a.text, hall: code, id: a.id }); });
      m.offNormal += s.offNormal; m.servedKw += s.servedKw; m.demandKw += s.demandKw; m.onBattery += s.onBattery; m.gensRunning += s.running;
      S.nodes.forEach(function (n) {
        if (n.src === 'grid') { m.ringsTotal++; if (r.lost[n.id]) { if (n.tag === 'RING A') m.ringsLostA++; else m.ringsLostB++; } else m.ringsLive++; }
        if (n.src === 'battery') m.upsTotal++;
        if (n.src === 'gen') m.gensTotal++;
      });
      if (h === cur) { m.lvClosed = s.cbClosed; m.lvTotal = s.cbTotal; }
      m.halls.push({ hall: code, served: s.servedKw, demand: s.demandKw, alarms: al.length, running: s.running, gensets: S.counts.gensets });
    });
    /* E-S-101: an off-normal position there, and its typical LV unit dead */
    var P = window.RZEpmsPage, S1 = window.RZEpmsSheets && window.RZEpmsSheets.sld;
    if (P && P.live && S1) S1.nodes.forEach(function (n) {
      if (n.sw && P.closed(n.id) !== (n.normal !== 'open')) m.offNormal++;
      if (n.load === 'lvsb') { var d = P.dev(n.id); if (!(d && d.energised)) m.alarms.push({ prio: 1, tag: n.tag, text: 'E-S-101 · ' + n.tag + ' not supplied', id: n.id }); }
    });
    return m;
  }
  function rail(m) {
    var S = SH[cur], r = RES[cur];
    function set(id, html) { var el = doc.getElementById(id); if (el) el.innerHTML = html; }
    set('epms-lv-rail-hall', HALLS[cur]);
    set('epms-lv-rail-sources', S.nodes.filter(function (n) { return n.src === 'grid' || n.src === 'battery'; }).map(function (n) {
      var t = n.src === 'grid' ? (r.lost[n.id] ? (ST[cur].lost[n.id] ? 'OUT' : 'DEAD') : 'LIVE · ' + kw(r.raw.sources[n.id].kw)) : (r.batt[n.id] ? 'ON BATTERY' : 'FLOAT');
      return '<li><span>' + esc(n.tag) + '</span><b>' + esc(t) + '</b></li>';
    }).join(''));
    var hs = m.halls[cur];
    set('epms-lv-rail-gen', '<b>' + hs.gensets + ' sets</b> · ' + (hs.gensets - E.genset_spare_per_hall) + ' + ' + E.genset_spare_per_hall + ' · <b>' + (hs.running ? hs.running + ' running' : 'standby') + '</b>');
    var mine = m.alarms.filter(function (a) { return a.hall === HALLS[cur]; });
    set('epms-lv-rail-alarms', mine.length ? mine.slice(0, 8).map(function (a) { return '<li>' + esc(a.text.replace(/^Hall [A-D] · /, '')) + '</li>'; }).join('') +
      (mine.length > 8 ? '<li>+ ' + (mine.length - 8) + ' more</li>' : '') : '<li><span>none</span></li>');
    var site = doc.getElementById('epms-lv-site');
    if (site) {
      site.textContent = 'Site ' + m.gensTotal + ' sets · hall ' + HALLS[cur] + ' ' + hs.gensets + ' · ' + kw(hs.served) + ' supplied';
      site.title = 'Site: ' + m.gensTotal + ' gensets (' + HALLS.length + ' halls × ' + E.genset_per_hall + '), ' + kw(m.servedKw) + ' of ' + kw(m.demandKw) + ' supplied. ' +
        'Supply: ' + E.hv_voltage_kv + ' kV GIS → ' + E.mv_voltage_kv + ' kV (E-S-101) → hall rings → ' + E.lv_voltage_v + ' V.';
    }
  }
  function status() {
    if (!LIVE) { if (window.RZEpmsStatus) window.RZEpmsStatus.unavailable(); return; }
    var m = model();
    if (window.RZEpmsStatus) window.RZEpmsStatus.paint(m);
    rail(m);
  }

  /* ── drawing ─────────────────────────────────────────────────────────────────────────────────────────────────── */
  function paint() {
    if (!sheet) return;
    sheet.update();
    SH[cur].nodes.forEach(function (n) {
      if (!n.sw) return;
      var g = sheet.svg.querySelector('.hmi-node[data-node="' + n.id + '"]'); if (!g) return;
      if (LIVE) g.setAttribute('data-pos', ST[cur].closed[n.id] ? 'closed' : 'open'); else g.removeAttribute('data-pos');
      if (armed && armed.h === cur && armed.id === n.id) g.setAttribute('data-selected', '');
    });
    if (window.RZConvVfx) window.RZConvVfx.bind(host, SH[cur], flow, rest);
    if (window.RZConvTruth && window.RZConvTruth.marks) window.RZConvTruth.marks(sheet.svg);
  }
  var opener = null;
  function render() {
    var T = window.RZConvTruth;
    if (!opener && T) {
      var base = T.opener(payload, '#epms-lv-host');
      opener = function (n, api, el) {
        if (armed && armed.id !== n.id) { armed = null; say('Selection dropped: ' + n.tag + ' opened', false); }
        base(n, api, el);
      };
    }
    if (sheet && sheet.destroy) sheet.destroy();
    sheet = window.RZHmiSheet.render(host, SH[cur], { read: read, flow: flow, open: opener });
    var defs = doc.querySelector('svg.hmi-defs'); if (defs) defs.setAttribute('data-theme', 'dark');
    paint();
  }
  function refreshInspector(id) {
    var n = byId(id);
    if (n && window.RZInspector && window.RZInspector.refreshPayload) window.RZInspector.refreshPayload(payload(n));
  }
  function changed() { solveAll(); paint(); status(); }

  var ACT = window.RZDatahallAIInspectorActions = window.RZDatahallAIInspectorActions || {};
  ACT.epmsLvSelect = function (p) {
    var n = byId(p.id); if (!n || !LIVE) return;
    var cmd = LV.command(SH[cur], ST[cur], n.id); if (!cmd) return;
    armed = { h: cur, id: n.id, verb: cmd.verb, label: cmd.label };
    lastMsg = n.tag + ' selected to ' + cmd.label.toLowerCase() + ' — Execute or Cancel';
    say(lastMsg, false); paint(); refreshInspector(n.id);
  };
  ACT.epmsLvCancel = function (p) {
    var n = byId(p.id); armed = null;
    lastMsg = (n ? n.tag : 'Selection') + ' deselected, nothing operated';
    say(lastMsg, false); paint(); if (n) refreshInspector(n.id);
  };
  ACT.epmsLvExecute = function (p) {
    var n = byId(p.id); if (!n || !LIVE) return;
    if (!armed || armed.h !== cur || armed.id !== n.id) { lastMsg = 'REFUSED — select ' + n.tag + ' before executing'; say(lastMsg, true); refreshInspector(n.id); return; }
    var now = LV.command(SH[cur], ST[cur], n.id);
    if (!now || now.verb !== armed.verb) { armed = null; lastMsg = 'REFUSED — ' + n.tag + ' changed since it was selected; select it again'; say(lastMsg, true); refreshInspector(n.id); return; }
    var r = LV.operate(SH[cur], ST[cur], n.id, B, upstream(cur));
    armed = null; ops++;
    if (r.ok) { ST[cur] = r.state; lastMsg = r.reason + '; flows re-solved'; say(lastMsg, false); changed(); }
    else { lastMsg = 'REFUSED — ' + r.reason; say(lastMsg, true); paint(); }
    refreshInspector(n.id);
  };
  ACT.epmsLvTcc = function (p, btn) {
    var n = byId(p.id), rl = n && relayOf(n); if (!rl || !LIVE || !window.RZConvTccModal || !window.RZEpmsTccSpec) return;
    var spec = window.RZEpmsTccSpec(n, 'lsig'); if (!spec) return;
    spec.sub = 'Typical chain of hall ' + HALLS[cur] + ': LV main → 20 kV feeder → 20 kV incomer → 150 kV transformer bay';
    window.RZConvTccModal.open(spec, { trigger: btn, theme: 'dark' });
  };

  function setHall(h) {
    if (h === cur && sheet) return;
    if (armed) { armed = null; say('Selection dropped: hall changed', false); }
    cur = h;
    doc.querySelectorAll('.epms-hall-btn').forEach(function (b) { b.setAttribute('aria-pressed', Number(b.getAttribute('data-epms-hall')) === h ? 'true' : 'false'); });
    if (window.RZInspector && window.RZInspector.close) window.RZInspector.close();
    render(); status();
  }
  doc.querySelectorAll('.epms-hall-btn').forEach(function (b) {
    b.addEventListener('click', function () { setHall(Number(b.getAttribute('data-epms-hall'))); });
  });
  doc.addEventListener('rz-epms-change', function () { changed(); });

  solveAll();
  if (!LIVE) say('EPMS authority unavailable — E-S-102 is drawn without states, flows or switching.', true);
  window.RZEpmsLvView = { show: function () { if (!sheet) render(); else sheet.fit(); } };
  status();
  /* read-only handle for the gates: the solved state of each hall, never a way to change it */
  window.RZEpmsLvPage = Object.freeze({
    live: LIVE,
    hall: function () { return cur; },
    sheet: function (h) { var S = SH[h == null ? cur : h]; return S ? { no: S.no, hall: S.hallCode, counts: JSON.parse(JSON.stringify(S.counts)),
      gensets: S.nodes.filter(function (n) { return n.src === 'gen'; }).map(function (n) { return n.tag; }),
      devices: S.nodes.filter(function (n) { return n.cls; }).map(function (n) { return n.id; }) } : null; },
    tagOf: function (id) { var n = byId(id); return n ? n.tag || null : null; },
    summary: function (h) { h = h == null ? cur : h; return LIVE ? LV.summary(SH[h], ST[h], RES[h]) : null; },
    alarms: function (h) { h = h == null ? cur : h; return LIVE ? JSON.parse(JSON.stringify(LV.alarms(SH[h], ST[h], RES[h]))) : null; },
    model: function () { return LIVE ? JSON.parse(JSON.stringify(model())) : null; },
    armed: function () { return armed ? { hall: armed.h, id: armed.id, verb: armed.verb } : null; }
  });
})();
