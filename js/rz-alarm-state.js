/* ============================================================================
 * rz-alarm-state.js — ISA-18.2 alarm state machine + color discipline (v1.43.4)
 * ----------------------------------------------------------------------------
 * Closes review doc-27 §3.3 P0 (color discipline: status > domain > decorative)
 * + §4.3 P1 (alarm state UX):
 *
 *   "Warna status harus menang atas warna domain. Jika equipment fault, warna
 *    fault harus terlihat meskipun equipment termasuk domain cooling/network/
 *    electrical."
 *   "Alarm harus punya state: active, acknowledged, shelved, inhibited,
 *    returned-to-normal. Equipment dalam maintenance mode harus punya
 *    indicator berbeda dari fault."
 *
 * The library provides:
 *   - ISA-18.2 alarm states (the canonical 7-state model)
 *   - 4 severity tiers (critical / high / medium / low) with colours
 *   - resolveColor() — color-discipline arbiter: status colour wins over
 *     domain colour; only NORMAL falls through to the domain colour
 *   - deriveFromEquipment() — maps a line/breaker data-state into an alarm
 *     state + severity (used by the inspector Alarms tab)
 *   - audit() walker (consumed by probe-line-model.mjs)
 *
 * Zero-build, ES5-safe, no imports. Pure logic + small helpers — no DOM
 * mutation on load (additive).
 * ==========================================================================*/
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* ISA-18.2 alarm states                                               */
  /* ------------------------------------------------------------------ */
  var STATES = {
    'normal':     { label: 'Normal',                  abbr: 'NORM',  alarmActive: false, color: null },
    'unack':      { label: 'Unacknowledged alarm',    abbr: 'UNACK', alarmActive: true,  color: '#fca5a5' },
    'ack':        { label: 'Acknowledged alarm',      abbr: 'ACK',   alarmActive: true,  color: '#fbbf24' },
    'rtn_unack':  { label: 'Returned-to-normal (unack)', abbr: 'RTN', alarmActive: false, color: '#7dd3fc' },
    'shelved':    { label: 'Shelved (operator)',      abbr: 'SHLV',  alarmActive: false, color: '#c4b5fd' },
    'suppressed': { label: 'Suppressed by design',    abbr: 'SUPP',  alarmActive: false, color: '#94a3b8' },
    'oos':        { label: 'Out-of-service (maint.)', abbr: 'OOS',   alarmActive: false, color: '#C3B0FA' }
  };

  /* ------------------------------------------------------------------ */
  /* Severity tiers (orthogonal to alarm state)                          */
  /* ------------------------------------------------------------------ */
  var SEVERITY = {
    'critical': { label: 'Critical', rank: 4, color: '#ef4444', bg: 'rgba(239,68,68,0.18)' },
    'high':     { label: 'High',     rank: 3, color: '#f97316', bg: 'rgba(249,115,22,0.16)' },
    'medium':   { label: 'Medium',   rank: 2, color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
    'low':      { label: 'Low',      rank: 1, color: '#eab308', bg: 'rgba(234,179,8,0.12)' }
  };

  function getState(name) {
    if (!name || !STATES[name]) { return STATES['normal']; }
    return STATES[name];
  }

  function getSeverity(name) {
    if (!name || !SEVERITY[name]) { return SEVERITY['medium']; }
    return SEVERITY[name];
  }

  /* ------------------------------------------------------------------ */
  /* Color discipline arbiter — review §3.3                             */
  /* ------------------------------------------------------------------ */
  /* Returns the colour an element should render given its alarm state +
   * its domain colour. Status WINS over domain unless state is normal. */
  function resolveColor(alarmState, domainColor) {
    var st = getState(alarmState);
    if (st.alarmActive || (st.color && alarmState !== 'normal')) {
      return st.color || domainColor || 'var(--t3)';
    }
    /* Normal → fall through to the domain colour (decorative grouping ok). */
    return domainColor || 'var(--g)';
  }

  /* ------------------------------------------------------------------ */
  /* Equipment-state → alarm-state mapping                              */
  /* Maps RZLineModel / RZBreakerSymbols data-state into an alarm state. */
  /* ------------------------------------------------------------------ */
  function deriveFromEquipment(equipState) {
    switch (equipState) {
      case 'fault':
      case 'tripped':
        return { alarm: 'unack', severity: 'critical',
                 summary: 'ACTIVE — fault/trip, acknowledgement required' };
      case 'isolated':
        return { alarm: 'oos', severity: 'low',
                 summary: 'Out-of-service — isolated for maintenance' };
      case 'maintenance':
        return { alarm: 'oos', severity: 'low',
                 summary: 'Out-of-service — maintenance / LOTO' };
      case 'standby':
        return { alarm: 'normal', severity: 'low',
                 summary: 'Normal standby — N+1 spare ready' };
      case 'de-energized':
        return { alarm: 'suppressed', severity: 'low',
                 summary: 'Suppressed — line de-energized by design' };
      case 'simulated':
        return { alarm: 'normal', severity: 'low',
                 summary: 'Normal — simulated telemetry' };
      case 'energized':
        return { alarm: 'normal', severity: 'low',
                 summary: 'Normal — no active alarm' };
      default:
        return { alarm: 'normal', severity: 'medium',
                 summary: 'Unknown state — operator review' };
    }
  }

  function esc(s) {
    if (s === null || s === undefined) { return ''; }
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Small inline alarm chip (state + severity). */
  function chipHtml(alarmState, severity) {
    var st = getState(alarmState);
    var sv = getSeverity(severity);
    if (!st.alarmActive && alarmState === 'normal') {
      return '<span style="display:inline-block;padding:1px 7px;border-radius:3px;' +
        'font-family:JetBrains Mono,monospace;font-size:9px;font-weight:700;' +
        'background:rgba(34,197,94,0.14);color:#86efac;border:1px solid rgba(34,197,94,0.4)">NORMAL</span>';
    }
    var col = st.color || sv.color;
    return '<span style="display:inline-block;padding:1px 7px;border-radius:3px;' +
      'font-family:JetBrains Mono,monospace;font-size:9px;font-weight:700;' +
      'background:' + sv.bg + ';color:' + col + ';border:1px solid ' + col + '">' +
      esc(st.abbr) + ' · ' + esc(sv.label.toUpperCase()) + '</span>';
  }

  /* ------------------------------------------------------------------ */
  /* Auditor — consumed by probe-line-model.mjs                         */
  /* ------------------------------------------------------------------ */
  function audit(rootEl) {
    var doc = rootEl || (typeof document !== 'undefined' ? document : null);
    if (!doc) { return { points: 0, issues: [{ kind: 'no-document' }] }; }
    var nodes = doc.querySelectorAll('[data-alarm-state]');
    var issues = [];
    for (var i = 0; i < nodes.length; i++) {
      var st = nodes[i].getAttribute('data-alarm-state');
      if (st && !STATES[st]) { issues.push({ kind: 'unknown-state', state: st, idx: i }); }
      var sv = nodes[i].getAttribute('data-alarm-severity');
      if (sv && !SEVERITY[sv]) { issues.push({ kind: 'unknown-severity', severity: sv, idx: i }); }
    }
    return { points: nodes.length, issues: issues };
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */
  var API = {
    STATES: STATES,
    SEVERITY: SEVERITY,
    resolveColor: resolveColor,
    deriveFromEquipment: deriveFromEquipment,
    chipHtml: chipHtml,
    audit: audit,
    version: '1.43.4'
  };

  if (root) { root.RZAlarmState = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
