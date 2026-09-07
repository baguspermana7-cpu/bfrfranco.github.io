/* ============================================================================
 * fire-workstation.js — the Fire & Safety workstation UI (Track A §A6)
 * ----------------------------------------------------------------------------
 * The DOM controller for #p-fire. Its home screen is a POINT LIST, not a
 * drawing: sub-tabs points → zones → mimic → cause & effect, a facility summary
 * strip, a page-wide impairment / fire-watch banner above the tab bar, the
 * isolation dialog (the only modal in the workstation), the sidebar counters
 * and the alarm-strip terms. Every value it prints comes from ONE snapshot per
 * 4 s tick: RZDatahallAIFirePoints.evaluate(inventory, register, run, tick).
 *
 * Nothing here decides anything. The rules live in fire-points.js; this file
 * asks, renders, and records. No command leaves the page: the register is a
 * TRAINING register kept in this browser (localStorage, versioned, fail-closed
 * on a foreign store), and every action becomes an alarm-query record in the
 * Alarms workspace through RZDatahallAIAlarmWorkspace.appendEvents().
 *
 * Fails closed: without the engine authority, the points module or the sim
 * tick, body[data-rz-fire-workstation="unavailable"] is stamped and every cell
 * reads an em dash. ES5, zero-build, deferred after equipment-inspector.js.
 * ==========================================================================*/
(function (root) {
  'use strict';
  var doc = root.document; if (!doc) { return; }

  var VERSION = '2.3.0', STORAGE_KEY = 'dhFireIsolationRegister', REFRESH_MS = 4000, LOG_MAX = 60;
  var S = { inv: null, reg: null, run: null, snap: null, hall: 1, view: 'points', seen: {}, log: [], timer: null, unavailable: null, discarded: false,
    filters: { zone: '', type: '', state: '', iso: false, q: '' }, rows: {}, rowsKey: null, tiles: {}, tilesHall: null, dialog: { mode: null, pointId: null, trigger: null, preview: null } };

  function $(id) { return doc.getElementById(id); }
  function FP() { return root.RZDatahallAIFirePoints || null; }
  function SIM() { return root.RZDatahallAISimTelemetry || null; }
  function CE() { return root.RZDatahallAIFireCauseEffect || null; }
  function finite(v) { return typeof v === 'number' && isFinite(v); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function short(id) { return String(id || '').replace(/^DH-\d\d-/, ''); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function tick() { var sim = SIM(); return sim ? sim.tickNow() : 0; }
  function authority() { var a = root.RZDatahallCurrentAuthority ? root.RZDatahallCurrentAuthority() : null; return !!(a && a.snapshot); }
  function geometry() {
    var E = root.DHE; if (!E) { return null; }
    return { halls: finite(E.halls) ? E.halls : 4, hallLengthM: E.hallLengthM, hallWidthM: E.hallWidthM, rackRows: E.rackRows, leakZonesPerHall: 24 };
  }
  function setText(id, text) { var el = $(id); if (el && el.textContent !== String(text)) { el.textContent = String(text); } }
  function hallId(h) { return 'DH-' + pad2(h); }

  /* ------------------------------------------------------------------ register persistence */
  function loadRegister() {
    var F = FP();
    try {
      var raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) { return F.createRegister(); }
      var reg = F.deserialize(raw, S.inv);
      if (!reg) { root.localStorage.removeItem(STORAGE_KEY); S.discarded = true; return F.createRegister(); }
      return reg;
    } catch (e) { return F.createRegister(); }
  }
  function saveRegister() { try { root.localStorage.setItem(STORAGE_KEY, FP().serialize(S.reg)); } catch (e) { /* storage may be unavailable; the session register still works */ } }

  /* ------------------------------------------------------------------ records → Alarms workspace */
  function emit(records) {
    var fresh = [], i;
    for (i = 0; i < (records || []).length; i++) { if (!S.seen[records[i].id]) { S.seen[records[i].id] = true; fresh.push(records[i]); } }
    if (!fresh.length) { return; }
    S.log = S.log.concat(fresh).slice(-LOG_MAX);
    var W = root.RZDatahallAIAlarmWorkspace;
    if (W && W.appendEvents) { try { W.appendEvents(fresh); } catch (e) { if (root.console) { root.console.warn('[fire-workstation] ' + e.message); } } }
  }
  function zoneTransitions(prev, next) {
    /* pure evaluate cannot know yesterday: the workstation diffs snapshots to log a zone RESTORED */
    if (!prev) { return []; }
    var F = FP(), out = [], byId = {}, i;
    for (i = 0; i < prev.zones.length; i++) { byId[prev.zones[i].id] = prev.zones[i]; }
    for (i = 0; i < next.zones.length; i++) {
      var z = next.zones[i], p = byId[z.id];
      if (p && p.impaired && !z.impaired) {
        out.push({ id: 'FIRE-ZR-' + z.id + '-' + next.tick, timestamp: F.isoFromTick(next.tick), sequence: next.tick * 100 + 90 + (i % 9), tag: z.id, point: 'ZONE', location: hallId(z.hall) + '/Z' + pad2(z.n) + ' ' + z.name,
          system: 'fire', severity: 'info', lifecycle: 'returned_ack', kind: 'discrete', previousState: 'impaired', currentState: 'protected', quality: 'simulated', event: 'zone-restored', action: 'restore',
          scenario: 'training', operator: 'system', message: 'Zone ' + z.name + ' back to ' + z.meansAvailable + ' of ' + z.meansTotal + ' independent detection means — release re-armed', incidentId: 'IMP-' + z.id + '-' + (p.impairedSinceTick || 0), asset: 'fire-zone:' + z.id, source: 'fire-points', runId: 'tick-' + next.tick, trigger: 'restore', reset: 'none' });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ evaluate */
  function evaluate() {
    var prev = S.snap;
    S.snap = FP().evaluate(S.inv, S.reg, S.run, tick());
    emit(zoneTransitions(prev, S.snap).concat(S.snap.derivedRecords));
    return S.snap;
  }
  function fireContext() { return S.snap ? S.snap.ctxFire : null; }
  function summary() { return S.snap ? S.snap.summary : null; }
  function causeEffectInput() {
    var ce = CE(); if (!S.snap || !ce) { return null; }
    var rows = null;
    try { rows = ce.applyRuntime(ce.BASE_ROWS, S.snap.runtimeUpdates); } catch (e) { rows = null; }
    return { elapsedSeconds: S.snap.elapsedSeconds, runtimeRows: rows, interlocks: S.snap.interlocks, running: !!S.run, stage: S.snap.stage };
  }

  /* ------------------------------------------------------------------ sub-tabs (scoped: never .et / .ep) */
  function showView(key, focus) {
    S.view = key;
    var btns = doc.querySelectorAll('#fireTabs .ft'), i;
    for (i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-fp') === key;
      btns[i].classList.toggle('on', on); btns[i].setAttribute('aria-selected', on ? 'true' : 'false'); btns[i].setAttribute('tabindex', on ? '0' : '-1');
      if (on && focus) { btns[i].focus(); }
    }
    var panels = doc.querySelectorAll('#p-fire .fp');
    for (i = 0; i < panels.length; i++) { panels[i].classList.toggle('on', panels[i].id === 'fp-' + key); }
    render();
  }
  function wireTabs() {
    var bar = $('fireTabs'); if (!bar) { return; }
    bar.addEventListener('click', function (e) { var b = e.target.closest('.ft'); if (b && bar.contains(b)) { showView(b.getAttribute('data-fp'), false); } });
    bar.addEventListener('keydown', function (e) {
      var keys = ['points', 'zones', 'mimic', 'cause-effect'], i = keys.indexOf(S.view);
      if (e.key === 'ArrowRight') { e.preventDefault(); showView(keys[(i + 1) % keys.length], true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); showView(keys[(i + keys.length - 1) % keys.length], true); }
      if (e.key === 'Home') { e.preventDefault(); showView(keys[0], true); }
      if (e.key === 'End') { e.preventDefault(); showView(keys[keys.length - 1], true); }
    });
  }

  /* ------------------------------------------------------------------ summary strip */
  var METRICS = [['fire', 'FIRE'], ['vesda', 'VESDA'], ['leak', 'LEAK'], ['epo', 'EPO'], ['disabled', 'DISABLED'], ['maint', 'MAINT'], ['facpComms', 'FACP COMMS'], ['lastPoll', 'LAST POLL']];
  function toneFor(key, sm) {
    if (key === 'fire') { return /ALARM|DISCHARGED|LOCKOUT/.test(sm.fire) ? 'critical' : /PRE-ALARM/.test(sm.fire) ? 'warn' : 'ok'; }
    if (key === 'vesda') { return /ALERT/.test(sm.vesda) ? 'warn' : /ISOLATED/.test(sm.vesda) ? 'warn' : 'ok'; }
    if (key === 'leak') { return /WET/.test(sm.leak) ? 'critical' : 'ok'; }
    if (key === 'epo') { return /ACTIVE/.test(sm.epo) ? 'critical' : 'ok'; }
    if (key === 'disabled') { return sm.disabled > 0 ? 'critical' : 'ok'; }
    if (key === 'maint') { return sm.maint > 0 ? 'warn' : 'ok'; }
    return 'ok';
  }
  function renderSummary() {
    var host = $('fireSummary'); if (!host) { return; }
    var sm = summary(), i, html = '';
    if (!host.children.length) {
      for (i = 0; i < METRICS.length; i++) { html += '<div class="rz-ops-metric" data-tone="ok" data-metric="' + METRICS[i][0] + '"><div class="rz-ops-metric__label">' + METRICS[i][1] + '</div><div class="rz-ops-metric__value">—</div></div>'; }
      host.innerHTML = html;
    }
    for (i = 0; i < METRICS.length; i++) {
      var key = METRICS[i][0], el = host.querySelector('[data-metric="' + key + '"]'), val = el.querySelector('.rz-ops-metric__value');
      var text = !sm ? '—' : key === 'disabled' ? sm.disabled + (sm.disabled ? ' ISOLATED' : '') : key === 'maint' ? sm.maint + ' isolated' : key === 'lastPoll' ? 'tick ' + sm.lastPollTick : sm[key];
      if (val.textContent !== String(text)) { val.textContent = String(text); }
      el.setAttribute('data-tone', sm ? toneFor(key, sm) : 'ok');
    }
  }

  /* ------------------------------------------------------------------ point list */
  function filtered() {
    var f = S.filters, q = f.q.toLowerCase(), out = [], i;
    for (i = 0; i < S.snap.points.length; i++) {
      var p = S.snap.points[i];
      if (p.hall !== S.hall) { continue; }
      if (f.zone && p.zoneIds.indexOf(f.zone) < 0 && !(f.zone === 'hall' && !p.zoneId)) { continue; }
      if (f.type && p.type !== f.type) { continue; }
      if (f.state && p.state !== f.state) { continue; }
      if (f.iso && !p.isolation) { continue; }
      if (q && (p.id + ' ' + p.label + ' ' + p.address + ' ' + p.room).toLowerCase().indexOf(q) < 0) { continue; }
      out.push(p);
    }
    return out;
  }
  function stateClass(st) { return st === 'alarm' || st === 'discharged' || st === 'lockout' ? 'rz-ops-status--critical' : st === 'isolated' || st === 'inhibited' || st === 'prealarm' || st === 'active' || st === 'armed' || st === 'trouble' ? 'rz-ops-status--warning' : 'rz-ops-status--normal'; }
  function isoText(p) {
    if (!p.isolation) { return '—'; }
    var i = p.isolation;
    return i.owner + ' · ' + i.reason + ' · expires ' + i.expiryId + ' (tick ' + i.expiresAtTick + ')' + (i.extensions ? ' · ext ' + i.extensions : '') + (i.expired ? ' · EXPIRED' : '');
  }
  function rowHtml(p) {
    return '<td class="rz-fire-addr">' + esc(short(p.id)) + '<span class="rz-fire-sub">' + esc(p.loop + ' · ' + p.address) + '</span></td>' +
      '<td>' + esc(p.typeLabel) + (p.lifeSafety ? '<span class="rz-fire-sub">life-safety</span>' : '') + '</td>' +
      '<td>' + esc((p.zoneId ? short(p.zoneId) + ' ' : '') + p.room) + '</td>' +
      '<td>' + esc(p.meansLabel || (p.releaseRole ? 'release path' : '—')) + '</td>' +
      '<td data-col="state"><span class="rz-ops-status ' + stateClass(p.state) + '">' + esc(p.state) + '</span></td>' +
      '<td data-col="iso">' + esc(isoText(p)) + '</td>' +
      '<td>' + esc(p.lastTestAt) + '</td><td class="rz-fire-q">simulated</td>';
  }
  function renderPoints() {
    var body = $('firePointsBody'); if (!body || !S.snap) { return; }
    var list = filtered(), key = S.hall + '|' + JSON.stringify(S.filters) + '|' + list.length, i;
    if (S.rowsKey !== key) {
      S.rowsKey = key; S.rows = {};
      var frag = doc.createDocumentFragment();
      for (i = 0; i < list.length; i++) {
        var tr = doc.createElement('tr');
        tr.setAttribute('data-rz-equipment', 'fire-point:' + list[i].id); tr.setAttribute('tabindex', '0'); tr.setAttribute('role', 'button');
        tr.setAttribute('data-state', list[i].state); tr.innerHTML = rowHtml(list[i]); S.rows[list[i].id] = tr; frag.appendChild(tr);
      }
      while (body.firstChild) { body.removeChild(body.firstChild); }
      body.appendChild(frag);
    } else {
      for (i = 0; i < list.length; i++) {
        var p = list[i], row = S.rows[p.id]; if (!row) { continue; }
        if (row.getAttribute('data-state') !== p.state) { row.setAttribute('data-state', p.state); row.querySelector('[data-col="state"]').innerHTML = '<span class="rz-ops-status ' + stateClass(p.state) + '">' + esc(p.state) + '</span>'; }
        var it = isoText(p), cell = row.querySelector('[data-col="iso"]'); if (cell.textContent !== it) { cell.textContent = it; }
      }
    }
    setText('firePointsCount', list.length + ' of ' + S.snap.points.filter(function (p) { return p.hall === S.hall; }).length + ' points in ' + hallId(S.hall) + (S.filters.iso ? ' · isolated only' : ''));
    renderLog();
  }
  function renderLog() {
    var host = $('fireIsoLog'); if (!host) { return; }
    var last = S.log.slice(-5).reverse(), html = '', i;
    for (i = 0; i < last.length; i++) { html += '<li><span class="rz-fire-sub">' + esc(last[i].timestamp.replace('T', ' ').replace('.000Z', 'Z')) + '</span> ' + esc(last[i].event) + ' — ' + esc(last[i].message) + '</li>'; }
    if (host.innerHTML !== (html || '<li class="rz-fire-sub">no isolation actions yet in this browser</li>')) { host.innerHTML = html || '<li class="rz-fire-sub">no isolation actions yet in this browser</li>'; }
  }
  function fillSelect(id, options, keep) {
    var sel = $(id); if (!sel) { return; }
    var cur = sel.value, html = '', i;
    for (i = 0; i < options.length; i++) { html += '<option value="' + esc(options[i][0]) + '">' + esc(options[i][1]) + '</option>'; }
    sel.innerHTML = html;
    if (keep && options.some(function (o) { return o[0] === cur; })) { sel.value = cur; }
  }
  function wireFilters() {
    var F = FP();
    var zones = [['', 'All zones'], ['hall', 'Hall-level (FACP, cylinders)']].concat(S.inv.zones.filter(function (z) { return z.hall === S.hall; }).map(function (z) { return [z.id, short(z.id) + ' ' + z.name]; }));
    fillSelect('firePointsZone', zones, true);
    fillSelect('firePointsType', [['', 'All types']].concat(Object.keys(F.TYPES).map(function (t) { return [t, F.TYPES[t].label]; })), true);
    fillSelect('firePointsState', [['', 'All states']].concat(F.STATES.map(function (s) { return [s, s]; })), true);
    var halls = [], h; for (h = 1; h <= S.inv.geometry.halls; h++) { halls.push([String(h), hallId(h)]); }
    fillSelect('firePointsHall', halls, true); if ($('firePointsHall')) { $('firePointsHall').value = String(S.hall); }
    fillSelect('fireZone', S.inv.zones.filter(function (z) { return z.hall === S.hall; }).map(function (z) { return [z.id, hallId(z.hall) + ' ' + short(z.id) + ' ' + z.name]; }), true);
  }
  function onFilter() {
    S.filters = { zone: $('firePointsZone') ? $('firePointsZone').value : '', type: $('firePointsType') ? $('firePointsType').value : '', state: $('firePointsState') ? $('firePointsState').value : '',
      iso: $('firePointsIsolatedOnly') ? $('firePointsIsolatedOnly').getAttribute('aria-pressed') === 'true' : false, q: $('firePointsSearch') ? $('firePointsSearch').value.trim() : '' };
    renderPoints();
  }
  function setHall(n) {
    n = Number(n); if (!finite(n) || n < 1 || n > S.inv.geometry.halls) { return; }
    S.hall = n; S.filters.zone = ''; wireFilters(); S.rowsKey = null; S.tilesHall = null;
    var t = $('firePointsTable'); if (t) { t.setAttribute('data-rz-hall', String(n)); }
    var g = $('fireZonesGrid'); if (g) { g.setAttribute('data-rz-hall', String(n)); }
    render();
  }
  function wirePointsView() {
    ['firePointsZone', 'firePointsType', 'firePointsState'].forEach(function (id) { var el = $(id); if (el) { el.addEventListener('change', onFilter); } });
    var q = $('firePointsSearch'); if (q) { q.addEventListener('input', onFilter); }
    var iso = $('firePointsIsolatedOnly'); if (iso) { iso.addEventListener('click', function () { iso.setAttribute('aria-pressed', iso.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); onFilter(); }); }
    var hall = $('firePointsHall'); if (hall) { hall.addEventListener('change', function () { setHall(hall.value); }); }
    var reset = $('firePointsReset'); if (reset) { reset.addEventListener('click', function () { ['firePointsZone', 'firePointsType', 'firePointsState'].forEach(function (id) { if ($(id)) { $(id).value = ''; } }); if ($('firePointsSearch')) { $('firePointsSearch').value = ''; } if (iso) { iso.setAttribute('aria-pressed', 'false'); } onFilter(); }); }
    var clear = $('firePointsClear');
    if (clear) {
      clear.addEventListener('click', function () {
        if (clear.getAttribute('data-rz-confirm') !== '1') { clear.setAttribute('data-rz-confirm', '1'); clear.textContent = 'Confirm: clear the training register'; setTimeout(function () { clear.removeAttribute('data-rz-confirm'); clear.textContent = 'Clear register'; }, 6000); return; }
        clear.removeAttribute('data-rz-confirm'); clear.textContent = 'Clear register'; clearRegister('operator');
      });
    }
    var alarms = $('fireIsoLogOpen');
    if (alarms) { alarms.addEventListener('click', function () { var b = doc.querySelector('#tabs [data-t="alarms"]'); if (b) { b.click(); } var v = $('alarmSavedView'); if (v) { v.value = 'fire'; v.dispatchEvent(new Event('change', { bubbles: true })); } }); }
  }
  function clearRegister(by) {
    var F = FP(), t = tick(), n = Object.keys(S.reg.entries).length;
    var rec = { id: 'FIRE-CLR-' + t, timestamp: F.isoFromTick(t), sequence: t * 100 + 99, tag: 'REGISTER', point: 'REGISTER', location: 'facility', system: 'fire', severity: 'info', lifecycle: 'returned_ack', kind: 'discrete',
      previousState: n + ' isolated', currentState: 'cleared', quality: 'simulated', event: 'register-cleared', action: 'clear', scenario: 'training', operator: by || 'operator', message: 'Training isolation register cleared by the operator — ' + n + ' isolation(s) removed from this browser', incidentId: 'CLR-' + t, asset: 'fire-register', source: 'fire-points', runId: 'tick-' + t, trigger: 'operator', reset: 'none' };
    S.reg = F.createRegister(); saveRegister(); emit([rec]); render(); refreshInspector();
  }

  /* ------------------------------------------------------------------ zones view */
  function tileHtml(z) {
    var badges = '';
    if (z.impaired) { badges += '<span class="rz-fire-badge is-crit">IMPAIRED</span>'; }
    if (z.releaseInhibited) { badges += '<span class="rz-fire-badge is-crit">RELEASE INHIBITED</span>'; }
    if (z.isolatedCount) { badges += '<span class="rz-fire-badge is-warn">' + z.isolatedCount + ' isolated</span>'; }
    if (z.fireWatch) { badges += '<span class="rz-fire-badge is-warn">FIRE WATCH</span>'; }
    if (z.inEvent && z.state !== 'normal') { badges += '<span class="rz-fire-badge is-crit">' + esc(z.state.replace(/_/g, ' ').toUpperCase()) + '</span>'; }
    return '<div class="rz-fire-tile__id">' + esc(short(z.id)) + ' · ' + esc(z.name) + '</div>' +
      '<div class="rz-fire-tile__means">means ' + z.meansAvailable + ' / ' + z.meansTotal + ' · ' + esc(z.detectionMeans.join(' + ')) + (z.release ? ' · clean agent' : '') + (z.epo ? ' · zoned EPO' : '') + '</div>' +
      '<div class="rz-fire-tile__state">' + (badges || '<span class="rz-fire-badge is-ok">OK</span>') + '</div>';
  }
  function renderZones() {
    var grid = $('fireZonesGrid'); if (!grid || !S.snap) { return; }
    var zones = S.snap.zones.filter(function (z) { return z.hall === S.hall; }), i;
    if (S.tilesHall !== S.hall) {
      S.tilesHall = S.hall; S.tiles = {}; grid.innerHTML = '';
      for (i = 0; i < zones.length; i++) {
        var b = doc.createElement('div'); b.className = 'rz-fire-tile'; b.setAttribute('data-rz-equipment', 'fire-zone:' + zones[i].id); b.setAttribute('tabindex', '0'); b.setAttribute('role', 'button');
        b.setAttribute('title', 'Zone ' + short(zones[i].id) + ' — click for the inspector; its points are listed under Related');
        b.innerHTML = tileHtml(zones[i]); S.tiles[zones[i].id] = b; grid.appendChild(b);
      }
    }
    for (i = 0; i < zones.length; i++) {
      var el = S.tiles[zones[i].id], html = tileHtml(zones[i]);
      if (el && el.innerHTML !== html) { el.innerHTML = html; }
      if (el) { el.setAttribute('data-state', zones[i].impaired ? 'impaired' : zones[i].isolatedCount ? 'isolated' : zones[i].state); }
    }
  }

  /* ------------------------------------------------------------------ banner + sidebar + strip */
  function renderBanner() {
    var b = $('fireImpairmentBanner'); if (!b) { return; }
    var sm = summary();
    if (!sm) { b.hidden = true; return; }
    var crit = /ALARM|DISCHARGED|LOCKOUT/.test(sm.fire) || /ACTIVE/.test(sm.epo) || /WET/.test(sm.leak);
    var warn = sm.fireWatch || sm.impairedZones.length > 0 || sm.expiredIsolations.length > 0 || /PRE-ALARM/.test(sm.fire);
    if (!crit && !warn) { b.hidden = true; return; }
    var parts = [];
    if (crit) { parts.push('FIRE ' + sm.fire + (/ACTIVE/.test(sm.epo) ? ' · EPO ' + sm.epo : '') + (/WET/.test(sm.leak) ? ' · LEAK ' + sm.leak : '') + ' — SIMULATED training run'); }
    if (sm.fireWatch) { parts.push('FIRE WATCH'); }
    if (sm.impairedZones.length) { parts.push(sm.impairedZones.length + ' zone' + (sm.impairedZones.length > 1 ? 's' : '') + ' impaired (' + sm.impairedZones.map(function (z) { return z.replace(/-Z/, ' Z'); }).join(', ') + ') · release inhibited'); }
    if (sm.expiredIsolations.length) { parts.push(sm.expiredIsolations.length + ' isolation' + (sm.expiredIsolations.length > 1 ? 's' : '') + ' expired and not restored'); }
    if (sm.disabled) { parts.push(sm.disabled + ' point' + (sm.disabled > 1 ? 's' : '') + ' isolated'); }
    if (/PRE-ALARM/.test(sm.fire)) { parts.push('VESDA ' + sm.vesda); }
    var text = parts.join(' · ');
    b.setAttribute('data-tone', crit ? 'critical' : 'warn');
    var t = b.querySelector('[data-slot="text"]'); if (t && t.textContent !== text) { t.textContent = text; }
    b.hidden = false;
  }
  function renderSidebar() {
    var sm = summary(); if (!sm) { return; }
    var map = { sbFire: sm.fire === 'NORMAL' ? 'Normal' : sm.fire, sbLeak: sm.leak === 'CLEAR' ? 'Clear' : sm.leak, sbEpo: sm.epo === 'ARMED' ? 'Armed' : sm.epo, sbInAlarm: sm.inAlarm,
      sbSmoke: sm.smokeOk + ' OK' + (sm.smokeTotal - sm.smokeOk ? ' · ' + (sm.smokeTotal - sm.smokeOk) + ' iso' : ''), sbHeat: sm.heatOk + ' OK' + (sm.heatTotal - sm.heatOk ? ' · ' + (sm.heatTotal - sm.heatOk) + ' iso' : ''),
      sbVesda: sm.vesdaOk + ' OK' + (sm.vesdaTotal - sm.vesdaOk ? ' · ' + (sm.vesdaTotal - sm.vesdaOk) + ' iso' : ''), sbRope: sm.ropeOk + ' OK', sbDisabled: sm.disabled, sbMaint: sm.maint + ' isolated' };
    Object.keys(map).forEach(function (id) { setText(id, map[id]); });
    var dis = $('sbDisabled'); if (dis) { dis.className = 'v ' + (sm.disabled > 0 ? 'vo' : 'vg'); }
    var fire = $('sbFire'); if (fire) { fire.className = 'v ' + (/ALARM|DISCHARGED|LOCKOUT/.test(sm.fire) ? 'vr' : /PRE-ALARM/.test(sm.fire) ? 'vo' : 'vg'); }
    var leak = $('sbLeak'); if (leak) { leak.className = 'v ' + (/WET/.test(sm.leak) ? 'vr' : 'vg'); }
    var epo = $('sbEpo'); if (epo) { epo.className = 'v ' + (/ACTIVE/.test(sm.epo) ? 'vr' : 'vg'); }
    var ia = $('sbInAlarm'); if (ia) { ia.className = 'v ' + (sm.inAlarm > 0 ? 'vr' : 'vg'); }
  }

  /* ------------------------------------------------------------------ cause & effect run controls */
  function renderRun() {
    var el = $('fireElapsed'), sm = summary();
    if (el) { el.textContent = S.run ? 'T+' + (S.snap ? S.snap.elapsedSeconds : 0) + ' s · stage ' + (sm ? sm.stage : '—') + ' · SIMULATED' : 'no run · T+0 s'; }
    var start = $('fireStart'), stop = $('fireStop');
    if (start) { start.setAttribute('aria-pressed', S.run ? 'true' : 'false'); }
    if (stop) { stop.hidden = !S.run; }
    var OU = root.RZDatahallAIOperatorUI;
    if (OU && OU.evaluateFire && $('fireCauseEffectBody')) { OU.evaluateFire(); }
  }
  function startRun(eventId, zoneId) {
    if (!eventId || !zoneId) { return false; }
    S.run = { eventId: eventId, zoneId: zoneId, startedAtTick: tick() };
    evaluate(); render(); refreshInspector(); return true;
  }
  function stopRun() { S.run = null; evaluate(); render(); refreshInspector(); }
  function wireRun() {
    var start = $('fireStart'), stop = $('fireStop');
    if (start) { start.addEventListener('click', function () { startRun($('fireScenario') ? $('fireScenario').value : null, $('fireZone') ? $('fireZone').value : null); }); }
    if (stop) { stop.addEventListener('click', stopRun); }
  }

  /* ------------------------------------------------------------------ the isolation dialog */
  function dialogReq() {
    var F = FP();
    return { pointId: S.dialog.pointId, owner: $('fireIsoOwner') ? $('fireIsoOwner').value : '', reason: $('fireIsoReason') ? $('fireIsoReason').value : '', expiryId: $('fireIsoExpiry') ? $('fireIsoExpiry').value : '', tick: tick(),
      acknowledged: $('fireIsoAck') ? $('fireIsoAck').checked : false, action: S.dialog.mode === 'extend' ? 'extend' : 'isolate', MAX: F.MAX_EXTENSIONS };
  }
  function renderDialogPreview() {
    var F = FP(), req = dialogReq(), out = $('fireIsoConsequence'), ackWrap = $('fireIsoAckWrap'), submit = $('fireIsoSubmit'), count = $('fireIsoReasonCount');
    if (count) { count.textContent = String(req.reason.trim().length) + ' / ' + F.MIN_REASON + ' characters'; }
    var pre;
    if (S.dialog.mode === 'extend') {
      var entry = S.reg.entries[req.pointId];
      pre = !entry ? { ok: false, code: 'NOT_ISOLATED', message: F.REFUSALS.NOT_ISOLATED } : entry.extensions >= F.MAX_EXTENSIONS ? { ok: false, code: 'EXTEND_LIMIT', message: F.REFUSALS.EXTEND_LIMIT }
        : !req.expiryId ? { ok: false, code: 'EXPIRY_REQUIRED', message: F.REFUSALS.EXPIRY_REQUIRED } : { ok: true, consequence: null, text: 'Extension ' + (entry.extensions + 1) + ' of ' + F.MAX_EXTENSIONS + ' — the new expiry counts from now.' };
    } else {
      pre = F.previewIsolate(S.inv, S.reg, req, { fire: S.run });
    }
    S.dialog.preview = pre;
    var needAck = !!(pre.ok && pre.consequence && pre.consequence.zoneImpaired);
    if (ackWrap) { ackWrap.hidden = !needAck; }
    if (out) {
      out.setAttribute('data-state', pre.ok ? (needAck ? 'impair' : 'ok') : 'refused');
      out.textContent = pre.ok ? (pre.consequence ? 'Consequence — ' + pre.consequence.text : pre.text || 'No zone drops below two detection means.') : 'REFUSED — ' + pre.code + ': ' + pre.message;
    }
    if (submit) { submit.disabled = !pre.ok || (needAck && !req.acknowledged); }
  }
  function openDialog(mode, pointId, trigger) {
    var F = FP(), p = S.inv.byId[pointId], dlg = $('fireIsoDialog'); if (!p || !dlg) { return false; }
    S.dialog = { mode: mode, pointId: pointId, trigger: trigger || null, preview: null };
    setText('fireIsoTitle', (mode === 'extend' ? 'Extend isolation — ' : 'Isolate point — ') + short(p.id));
    var dl = $('fireIsoPoint');
    if (dl) { dl.innerHTML = '<dt>Point</dt><dd>' + esc(p.label) + '</dd><dt>Type</dt><dd>' + esc(F.TYPES[p.type].label) + (p.means ? ' · ' + esc(F.MEANS[p.means]) : '') + '</dd><dt>Zone / room</dt><dd>' + esc((p.zoneId ? short(p.zoneId) + ' ' : '') + p.room) + ' — ' + esc(hallId(p.hall)) + '</dd><dt>Class</dt><dd>' + (p.lifeSafety ? 'life-safety — never isolable' : 'isolable') + '</dd>'; }
    var owner = $('fireIsoOwner'); if (owner && !owner.options.length) { fillSelect('fireIsoOwner', F.OWNERS.map(function (o) { return [o, o]; })); }
    var exp = $('fireIsoExpiry'); if (exp && !exp.options.length) { fillSelect('fireIsoExpiry', F.EXPIRY_OPTIONS.map(function (o) { return [o.id, o.label]; })); }
    if ($('fireIsoReason')) { $('fireIsoReason').value = ''; }
    if ($('fireIsoAck')) { $('fireIsoAck').checked = false; }
    if ($('fireIsoSubmit')) { $('fireIsoSubmit').textContent = mode === 'extend' ? 'Extend' : 'Isolate'; }
    var reasonLabel = $('fireIsoReasonLabel'); if (reasonLabel) { reasonLabel.textContent = mode === 'extend' ? 'Reason for the extension (optional)' : 'Reason (at least ' + F.MIN_REASON + ' characters)'; }
    renderDialogPreview();
    root.__rzLastEquipmentTrigger = trigger || null;
    dlg.classList.add('show');
    var first = mode === 'extend' ? $('fireIsoExpiry') : $('fireIsoReason'); if (first) { setTimeout(function () { try { first.focus(); } catch (e) { /* trap may own focus */ } }, 30); }
    return true;
  }
  function closeDialog() { var dlg = $('fireIsoDialog'); if (dlg) { dlg.classList.remove('show'); } }
  function submitDialog(e) {
    if (e) { e.preventDefault(); }
    var F = FP(), req = dialogReq(), res;
    res = S.dialog.mode === 'extend' ? F.extend(S.inv, S.reg, req) : F.isolate(S.inv, S.reg, req, { fire: S.run });
    S.reg = res.register; saveRegister(); emit(res.records);
    if (!res.ok) { S.dialog.preview = res; var out = $('fireIsoConsequence'); if (out) { out.setAttribute('data-state', 'refused'); out.textContent = 'REFUSED — ' + res.code + ': ' + res.message; } render(); refreshInspector(); return; }
    closeDialog(); evaluate(); render(); refreshInspector(); focusInspectorAction();
  }
  /* after an act from the inspector the focus belongs on the inspector's next action (the modal's own return
     targets a button that the refresh replaced) */
  function focusInspectorAction() {
    setTimeout(function () {
      var b = doc.querySelector('aside.rz-inspector.open [data-rz-action]') || doc.querySelector('aside.rz-inspector.open [data-rz-open-hmi]') || doc.querySelector('aside.rz-inspector.open [data-slot="id"]');
      if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* best effort */ } }
    }, 80);
  }
  function wireDialog() {
    var form = $('fireIsoForm'); if (!form) { return; }
    form.addEventListener('submit', submitDialog);
    ['fireIsoOwner', 'fireIsoReason', 'fireIsoExpiry', 'fireIsoAck'].forEach(function (id) { var el = $(id); if (el) { el.addEventListener('input', renderDialogPreview); el.addEventListener('change', renderDialogPreview); } });
    var cancel = $('fireIsoCancel'); if (cancel) { cancel.addEventListener('click', closeDialog); }
    var x = doc.querySelector('#fireIsoDialog .fire-iso-close'); if (x) { x.addEventListener('click', closeDialog); }
  }

  /* ------------------------------------------------------------------ inspector actions (named registry) */
  function refreshInspector() {
    var I = root.RZInspector, EI = root.RZDatahallAIEquipmentInspector;
    if (!I || !EI || !I.currentPayloadId || !I.currentPayloadId()) { return; }
    var ref = I.currentPayloadId(); if (!/^fire-|^leak:/.test(ref)) { return; }
    var m = /DH-(\d\d)/.exec(ref), hall = m ? Number(m[1]) : S.hall;
    try { var p = EI.build(ref, hall); if (p && !p.unavailable) { I.refreshPayload(p); } } catch (e) { /* the 4 s refresh will catch up */ }
  }
  function registerActions() {
    root.RZDatahallAIInspectorActions = root.RZDatahallAIInspectorActions || {};
    root.RZDatahallAIInspectorActions.fireIsolate = function (payload, btn, pointId) { openDialog('isolate', pointId, btn); };
    root.RZDatahallAIInspectorActions.fireExtend = function (payload, btn, pointId) { openDialog('extend', pointId, btn); };
    root.RZDatahallAIInspectorActions.fireRestore = function (payload, btn, pointId) {
      /* restore is one click plus a confirm line on the same button — no modal for an act that re-arms protection */
      if (btn && btn.getAttribute('data-rz-confirm') !== '1') {
        btn.setAttribute('data-rz-confirm', '1'); btn.textContent = 'Confirm restore'; btn.classList.add('rz-inspector-action--warn');
        setTimeout(function () { if (btn.getAttribute('data-rz-confirm') === '1') { btn.removeAttribute('data-rz-confirm'); btn.textContent = 'Restore'; btn.classList.remove('rz-inspector-action--warn'); } }, 6000);
        return;
      }
      var owner = $('fireIsoOwner') && $('fireIsoOwner').value ? $('fireIsoOwner').value : 'shift-a';
      var res = FP().restore(S.inv, S.reg, { pointId: pointId, owner: owner, tick: tick() });
      S.reg = res.register; saveRegister(); emit(res.records); evaluate(); render(); refreshInspector(); focusInspectorAction();
    };
  }

  /* ------------------------------------------------------------------ render + lifecycle */
  function render() {
    if (!S.snap) { return; }
    renderSummary(); renderBanner(); renderSidebar(); renderRun();
    if (S.view === 'points') { renderPoints(); }
    if (S.view === 'zones') { renderZones(); }
    var M = root.RZDatahallAIFireMimic; if (M && M.paint) { try { M.paint(S.snap, S.hall); } catch (e) { /* the mimic is optional */ } }
  }
  function unavailable(why) {
    S.unavailable = why;
    if (doc.body) { doc.body.setAttribute('data-rz-fire-workstation', 'unavailable'); }
    var host = $('fireSummary'); if (host && !host.children.length) { host.innerHTML = '<div class="rz-ops-metric" data-tone="warn"><div class="rz-ops-metric__label">FIRE WORKSTATION</div><div class="rz-ops-metric__value">—</div></div>'; }
    setText('firePointsCount', 'unavailable — ' + why);
  }
  function boot() {
    var F = FP(), g = geometry();
    if (!F || !SIM() || !authority() || !g) { unavailable(!F ? 'fire-points.js not loaded' : !SIM() ? 'sim-telemetry.js not loaded' : !authority() ? 'engine authority not validated' : 'engine geometry missing'); return false; }
    try { S.inv = F.buildInventory(g); } catch (e) { unavailable(e.message); return false; }
    S.reg = loadRegister();
    if (doc.body) { doc.body.setAttribute('data-rz-fire-workstation', 'ready'); }
    S.unavailable = null;
    wireFilters();
    if (S.discarded) {
      var t = tick();
      emit([{ id: 'FIRE-DISC-' + t, timestamp: F.isoFromTick(t), sequence: t * 100 + 98, tag: 'REGISTER', point: 'REGISTER', location: 'facility', system: 'fire', severity: 'low', lifecycle: 'returned_ack', kind: 'discrete', previousState: 'stored', currentState: 'discarded', quality: 'simulated', event: 'register-discarded', action: 'discard', scenario: 'training', operator: 'system', message: 'A stored isolation register could not be validated against this inventory and was discarded (fail closed)', incidentId: 'DISC-' + t, asset: 'fire-register', source: 'fire-points', runId: 'tick-' + t, trigger: 'boot', reset: 'none' }]);
    }
    evaluate(); render();
    return true;
  }
  function onTick() {
    if (S.unavailable) { if (boot()) { return; } return; }
    evaluate(); render();
  }
  function init() {
    wireTabs(); wirePointsView(); wireRun(); wireDialog(); registerActions();
    var sc = $('fireScenario'), zn = $('fireZone');
    if (sc) { sc.addEventListener('change', function () { if (S.run) { S.run = { eventId: sc.value, zoneId: S.run.zoneId, startedAtTick: S.run.startedAtTick }; evaluate(); render(); } }); }
    if (zn) { zn.addEventListener('change', function () { if (S.run) { S.run = { eventId: S.run.eventId, zoneId: zn.value, startedAtTick: S.run.startedAtTick }; evaluate(); render(); } }); }
    var bannerBtn = doc.querySelector('#fireImpairmentBanner [data-rz-open-fire]');
    if (bannerBtn) { bannerBtn.addEventListener('click', function () { var b = doc.querySelector('#tabs [data-t="fire"]'); if (b) { b.click(); } var iso = $('firePointsIsolatedOnly'); if (iso) { iso.setAttribute('aria-pressed', 'true'); } showView('points', true); onFilter(); }); }
    boot();
    S.timer = setInterval(onTick, REFRESH_MS);
  }

  root.RZDatahallAIFireWorkstation = {
    version: VERSION, STORAGE_KEY: STORAGE_KEY,
    render: function () { if (!S.unavailable) { evaluate(); render(); refreshInspector(); } return !S.unavailable; },
    snapshot: function () { return S.snap; }, summary: summary, fireContext: fireContext, causeEffectInput: causeEffectInput,
    startRun: startRun, stopRun: stopRun,
    isolate: function (req) { var res = FP().isolate(S.inv, S.reg, Object.assign({ tick: tick() }, req), { fire: S.run }); S.reg = res.register; saveRegister(); emit(res.records); evaluate(); render(); refreshInspector(); return res; },
    restore: function (req) { var res = FP().restore(S.inv, S.reg, Object.assign({ tick: tick() }, req)); S.reg = res.register; saveRegister(); emit(res.records); evaluate(); render(); refreshInspector(); return res; },
    extend: function (req) { var res = FP().extend(S.inv, S.reg, Object.assign({ tick: tick() }, req)); S.reg = res.register; saveRegister(); emit(res.records); evaluate(); render(); refreshInspector(); return res; },
    register: function () { return S.reg; }, clearRegister: function () { clearRegister('api'); }, inventory: function () { return S.inv; },
    setHall: setHall, showView: function (k) { showView(k, false); }, openDialog: openDialog, log: function () { return S.log.slice(); }, unavailable: function () { return S.unavailable; }
  };

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
})(typeof window !== 'undefined' ? window : this);
