/* ============================================================================
 * rz-inspector.js — right-side inspector for line + breaker metadata (v1.43.0)
 * ----------------------------------------------------------------------------
 * Closes review doc-27 §3.2 P0:
 *   "Equipment popup masih MODAL CENTER, menutup topology. Jadikan click
 *    equipment membuka right-side inspector, bukan modal tengah. Inspector
 *    harus sticky dan tidak menutup line topology."
 *
 * Inspector tabs (review doc-27 §3.2):
 *   - Live: state, current value
 *   - Capacity: rated capacity, current vs design
 *   - Dependencies: upstream / downstream IDs (clickable for navigation)
 *   - Alarms: state-derived alarm + redundancy
 *   - Trend: placeholder (sparkline arrives in a later ship)
 *   - Maintenance: sensor tag, device functions, AF category (for breakers)
 *
 * Auto-attaches click handler to:
 *   - [data-rz-line="1"]   (from RZLineModel.line())
 *   - [data-rz-breaker="1"] (from RZBreakerSymbols.render())
 *
 * Slide-in from right, ESC + outside-click close. Visual identical for
 * existing rendering — the inspector is OVERLAY, never modifies SVG.
 *
 * Zero-build, ES5-safe, no imports.
 * ==========================================================================*/
(function (root, doc) {
  'use strict';
  if (!doc) { return; }

  /* ------------------------------------------------------------------ */
  /* Styles — scoped to .rz-inspector, injected once                    */
  /* ------------------------------------------------------------------ */
  var STYLE_ID = 'rz-inspector-styles';
  var CSS = '' +
    '.rz-inspector{position:fixed;top:0;right:-380px;width:360px;height:100vh;' +
      'background:rgba(15,23,42,0.97);border-left:1px solid rgba(255,255,255,0.12);' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
      'box-shadow:-4px 0 24px rgba(0,0,0,0.4);' +
      'transition:right .25s cubic-bezier(.4,0,.2,1);z-index:9999;' +
      'display:flex;flex-direction:column;font-family:IBM Plex Sans,system-ui,-apple-system,sans-serif;' +
      'color:#f1f5f9}' +
    '.rz-inspector.open{right:0}' +
    '.rz-inspector-hdr{padding:14px 18px 8px;border-bottom:1px solid rgba(255,255,255,0.08)}' +
    '.rz-inspector-kind{font-family:JetBrains Mono,monospace;font-size:9.5px;letter-spacing:.08em;' +
      'text-transform:uppercase;color:#7dd3fc;margin-bottom:3px}' +
    '.rz-inspector-id{font-family:JetBrains Mono,monospace;font-size:14px;font-weight:600;' +
      'color:#f1f5f9;word-break:break-all;line-height:1.25}' +
    '.rz-inspector-close{position:absolute;top:12px;right:12px;width:28px;height:28px;' +
      'border:none;background:rgba(255,255,255,0.04);color:#94a3b8;font-size:18px;cursor:pointer;' +
      'border-radius:6px;display:grid;place-items:center;line-height:1;padding:0}' +
    '.rz-inspector-close:hover{background:rgba(239,68,68,0.18);color:#fca5a5}' +
    '.rz-inspector-tabs{display:flex;gap:2px;padding:6px 10px 0;flex-wrap:wrap}' +
    '.rz-inspector-tab{padding:6px 10px;background:transparent;border:none;border-bottom:2px solid transparent;' +
      'color:#94a3b8;font-family:IBM Plex Sans,sans-serif;font-size:10.5px;font-weight:500;letter-spacing:.02em;' +
      'cursor:pointer;border-radius:0;text-transform:uppercase}' +
    '.rz-inspector-tab:hover{color:#cbd5e1;background:rgba(255,255,255,0.03)}' +
    '.rz-inspector-tab.active{color:#7dd3fc;border-bottom-color:#06b6d4;background:rgba(6,182,212,0.06)}' +
    '.rz-inspector-body{flex:1;overflow-y:auto;padding:12px 18px 24px;' +
      'scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.18) transparent}' +
    '.rz-inspector-row{display:flex;justify-content:space-between;align-items:flex-start;' +
      'padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);gap:12px}' +
    '.rz-inspector-row:last-child{border-bottom:none}' +
    '.rz-inspector-k{font-family:IBM Plex Sans,sans-serif;font-size:10.5px;color:#94a3b8;' +
      'text-transform:uppercase;letter-spacing:.04em;flex-shrink:0}' +
    '.rz-inspector-v{font-family:JetBrains Mono,monospace;font-size:11.5px;color:#e2e8f0;' +
      'text-align:right;font-variant-numeric:tabular-nums;word-break:break-all}' +
    '.rz-inspector-v.state-energized{color:#86efac}' +
    '.rz-inspector-v.state-fault,.rz-inspector-v.state-tripped{color:#fca5a5}' +
    '.rz-inspector-v.state-standby,.rz-inspector-v.state-open{color:#fbbf24}' +
    '.rz-inspector-v.state-maintenance,.rz-inspector-v.state-isolated{color:#c4b5fd}' +
    '.rz-inspector-pill{display:inline-block;padding:2px 8px;border-radius:999px;' +
      'font-family:JetBrains Mono,monospace;font-size:10px;font-weight:600;letter-spacing:.04em;' +
      'background:rgba(56,189,248,0.12);color:#7dd3fc;border:1px solid rgba(56,189,248,0.28)}' +
    '.rz-inspector-empty{padding:24px 0;text-align:center;color:#64748b;font-size:11px;font-style:italic}' +
    '.rz-inspector-dep{cursor:pointer;padding:8px 10px;background:rgba(255,255,255,0.03);' +
      'border:1px solid rgba(255,255,255,0.06);border-radius:6px;margin-bottom:6px;' +
      'transition:background .15s,border-color .15s}' +
    '.rz-inspector-dep:hover{background:rgba(56,189,248,0.08);border-color:rgba(56,189,248,0.3)}' +
    '.rz-inspector-dep-k{font-size:9px;color:#7dd3fc;text-transform:uppercase;letter-spacing:.06em;' +
      'margin-bottom:2px}' +
    '.rz-inspector-dep-v{font-family:JetBrains Mono,monospace;font-size:12px;color:#e2e8f0;font-weight:600}' +
    '.rz-inspector-pulse{display:inline-block;width:6px;height:6px;border-radius:50%;' +
      'background:#86efac;margin-right:6px;vertical-align:middle;animation:rzPulse 1.8s ease-in-out infinite}' +
    '@keyframes rzPulse{0%,100%{opacity:.4}50%{opacity:1}}' +
    '@media (max-width:640px){.rz-inspector{width:100vw;right:-100vw}}';

  function injectStyles() {
    if (doc.getElementById(STYLE_ID)) { return; }
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------------ */
  /* Build inspector DOM once                                            */
  /* ------------------------------------------------------------------ */
  var inspectorEl = null;
  var currentEl = null;
  var currentTab = 'live';

  function buildShell() {
    if (inspectorEl) { return inspectorEl; }
    var el = doc.createElement('aside');
    el.className = 'rz-inspector';
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', 'Equipment inspector');
    el.setAttribute('data-rz-inspector', '1');
    el.innerHTML =
      '<div class="rz-inspector-hdr">' +
        '<button class="rz-inspector-close" aria-label="Close inspector" type="button">×</button>' +
        '<div class="rz-inspector-kind" data-slot="kind">LINE</div>' +
        '<div class="rz-inspector-id" data-slot="id">—</div>' +
      '</div>' +
      '<div class="rz-inspector-tabs" role="tablist">' +
        '<button class="rz-inspector-tab active" data-tab="live" role="tab" type="button">Live</button>' +
        '<button class="rz-inspector-tab" data-tab="capacity" role="tab" type="button">Capacity</button>' +
        '<button class="rz-inspector-tab" data-tab="deps" role="tab" type="button">Deps</button>' +
        '<button class="rz-inspector-tab" data-tab="alarms" role="tab" type="button">Alarms</button>' +
        '<button class="rz-inspector-tab" data-tab="trend" role="tab" type="button">Trend</button>' +
        '<button class="rz-inspector-tab" data-tab="maint" role="tab" type="button">Maint</button>' +
      '</div>' +
      '<div class="rz-inspector-body" data-slot="body"></div>';
    doc.body.appendChild(el);

    el.querySelector('.rz-inspector-close').addEventListener('click', close);
    var tabs = el.querySelectorAll('.rz-inspector-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function (e) {
        var tab = e.currentTarget.getAttribute('data-tab');
        switchTab(tab);
      });
    }

    inspectorEl = el;
    return el;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering helpers                                                   */
  /* ------------------------------------------------------------------ */
  function esc(s) {
    if (s === null || s === undefined) { return ''; }
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function row(k, v, stateClass) {
    if (v === null || v === undefined || v === '') { return ''; }
    var cls = 'rz-inspector-v' + (stateClass ? ' state-' + esc(stateClass) : '');
    return '<div class="rz-inspector-row">' +
      '<span class="rz-inspector-k">' + esc(k) + '</span>' +
      '<span class="' + cls + '">' + esc(v) + '</span>' +
    '</div>';
  }

  function attr(el, k) {
    return el.getAttribute('data-' + k) || '';
  }

  function isBreaker(el) {
    return el.getAttribute('data-rz-breaker') === '1';
  }

  function isLine(el) {
    return el.getAttribute('data-rz-line') === '1';
  }

  function getMetadata(el) {
    return {
      kind: isBreaker(el) ? 'breaker' : 'line',
      id: attr(el, 'id') || '(no id)',
      from: attr(el, 'from'),
      to: attr(el, 'to'),
      upstream: attr(el, 'upstream'),
      downstream: attr(el, 'downstream'),
      medium: attr(el, 'medium'),
      direction: attr(el, 'direction'),
      state: attr(el, 'state'),
      capacity: attr(el, 'capacity'),
      current: attr(el, 'current'),
      redundancy: attr(el, 'redundancy'),
      sensor: attr(el, 'sensor'),
      tag: attr(el, 'tag'),
      voltage: attr(el, 'voltage'),
      ratingA: attr(el, 'rating-a'),
      ratingKa: attr(el, 'rating-ka'),
      deviceFns: attr(el, 'device-fns'),
      af: attr(el, 'af'),
      ct: attr(el, 'ct'),
      interlock: attr(el, 'interlock')
    };
  }

  function renderLive(m) {
    var html = '';
    var pulse = m.state === 'energized' ? '<span class="rz-inspector-pulse"></span>' : '';
    html += '<div class="rz-inspector-row">' +
      '<span class="rz-inspector-k">State</span>' +
      '<span class="rz-inspector-v state-' + esc(m.state || 'unknown') + '">' +
      pulse + esc(m.state || '—') + '</span></div>';
    /* v1.43.2 — data-quality chip from RZTelemetryQuality (review §3.4 + §5.7). */
    if (root && root.RZTelemetryQuality && currentEl) {
      var qState = root.RZTelemetryQuality.getPointState(currentEl);
      html += '<div class="rz-inspector-row">' +
        '<span class="rz-inspector-k">Data quality</span>' +
        '<span class="rz-inspector-v">' + root.RZTelemetryQuality.chipHtml(qState) + '</span>' +
      '</div>';
    }
    html += row('Current value', m.current, m.state);
    html += row('Direction', m.direction);
    if (m.kind === 'line') { html += row('Medium', m.medium); }
    if (m.kind === 'breaker') {
      html += row('Voltage', m.voltage);
      html += row('Interlock', m.interlock);
    }
    return html || '<div class="rz-inspector-empty">No live data exposed.</div>';
  }

  function renderCapacity(m) {
    var html = '';
    html += row('Rated capacity', m.capacity);
    if (m.kind === 'breaker') {
      html += row('Rated current', m.ratingA);
      html += row('Interrupt kA', m.ratingKa ? m.ratingKa + ' kA' : '');
      html += row('CT ratio', m.ct);
    }
    html += row('Current loading', m.current);
    html += row('Redundancy role', m.redundancy);
    return html || '<div class="rz-inspector-empty">No capacity data.</div>';
  }

  function depCard(label, id) {
    if (!id) { return ''; }
    return '<div class="rz-inspector-dep" data-rz-depid="' + esc(id) + '">' +
      '<div class="rz-inspector-dep-k">' + esc(label) + '</div>' +
      '<div class="rz-inspector-dep-v">' + esc(id) + '</div></div>';
  }

  function renderDeps(m) {
    var html = '';
    if (m.kind === 'line') {
      html += depCard('From', m.from);
      html += depCard('To', m.to);
    } else {
      html += depCard('Upstream', m.upstream);
      html += depCard('Downstream', m.downstream);
    }
    if (m.tag) { html += row('Failure domain / tag', m.tag); }
    if (m.redundancy) { html += row('Redundancy role', m.redundancy); }
    return html || '<div class="rz-inspector-empty">No upstream / downstream IDs recorded.</div>';
  }

  function renderAlarms(m) {
    var html = '';
    /* v1.43.4 — ISA-18.2 alarm state machine via RZAlarmState (review §3.3 + §4.3). */
    if (root && root.RZAlarmState) {
      var d = root.RZAlarmState.deriveFromEquipment(m.state);
      html += '<div class="rz-inspector-row">' +
        '<span class="rz-inspector-k">Alarm state</span>' +
        '<span class="rz-inspector-v">' + root.RZAlarmState.chipHtml(d.alarm, d.severity) + '</span>' +
      '</div>';
      html += row('Summary', d.summary, m.state);
    } else {
      var alarm = '';
      if (m.state === 'fault' || m.state === 'tripped') { alarm = 'ACTIVE — fault/trip state'; }
      else if (m.state === 'isolated' || m.state === 'maintenance') { alarm = 'Inhibited — maintenance / LOTO'; }
      else if (m.state === 'standby') { alarm = 'Normal standby — N+1 spare ready'; }
      else if (m.state === 'energized') { alarm = 'Normal — no active alarm'; }
      else { alarm = 'Unknown state — operator review'; }
      html += row('Alarm summary', alarm, m.state);
    }
    html += row('State', m.state);
    if (m.kind === 'breaker' && m.deviceFns) {
      html += row('Protection (ANSI)', m.deviceFns);
    }
    if (m.kind === 'breaker' && m.af) {
      html += row('Arc-flash PPE', m.af);
    }
    return html;
  }

  function renderTrend() {
    return '<div class="rz-inspector-empty">' +
      'Trend sparkline coming in a later ship (v1.43.x data-quality service).' +
      '</div>';
  }

  function renderMaint(m) {
    var html = '';
    html += row('Sensor / tag', m.sensor || m.tag);
    if (m.kind === 'breaker') {
      html += row('Protection (ANSI)', m.deviceFns);
      html += row('Arc-flash PPE', m.af);
      html += row('CT ratio', m.ct);
      html += row('Interlock', m.interlock);
    }
    html += row('Last update', 'live (engine-derived)');
    return html || '<div class="rz-inspector-empty">No maintenance metadata.</div>';
  }

  function render() {
    if (!currentEl || !inspectorEl) { return; }
    var m = getMetadata(currentEl);
    inspectorEl.querySelector('[data-slot="kind"]').textContent = m.kind.toUpperCase();
    inspectorEl.querySelector('[data-slot="id"]').textContent = m.id;
    var body = inspectorEl.querySelector('[data-slot="body"]');
    var html = '';
    switch (currentTab) {
      case 'live': html = renderLive(m); break;
      case 'capacity': html = renderCapacity(m); break;
      case 'deps': html = renderDeps(m); break;
      case 'alarms': html = renderAlarms(m); break;
      case 'trend': html = renderTrend(); break;
      case 'maint': html = renderMaint(m); break;
    }
    body.innerHTML = html;

    /* Wire dependency cards to navigate (open inspector for the target id). */
    var deps = body.querySelectorAll('[data-rz-depid]');
    for (var i = 0; i < deps.length; i++) {
      deps[i].addEventListener('click', function (e) {
        var id = e.currentTarget.getAttribute('data-rz-depid');
        var target = doc.querySelector('[data-id="' + id + '"]');
        if (target) { open(target); }
      });
    }
  }

  function switchTab(name) {
    if (!inspectorEl) { return; }
    currentTab = name;
    var tabs = inspectorEl.querySelectorAll('.rz-inspector-tab');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      if (t.getAttribute('data-tab') === name) { t.classList.add('active'); }
      else { t.classList.remove('active'); }
    }
    render();
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */
  function open(el) {
    if (!el || !(isLine(el) || isBreaker(el))) { return; }
    buildShell();
    currentEl = el;
    render();
    inspectorEl.classList.add('open');
  }

  function close() {
    if (inspectorEl) { inspectorEl.classList.remove('open'); }
    currentEl = null;
  }

  function isOpen() {
    return inspectorEl && inspectorEl.classList.contains('open');
  }

  /* ------------------------------------------------------------------ */
  /* Auto-attach                                                         */
  /* ------------------------------------------------------------------ */
  function init() {
    injectStyles();
    /* Delegated click handler — catches future-rendered elements too. */
    doc.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== doc.body) {
        if (t.getAttribute && (t.getAttribute('data-rz-line') === '1' ||
                               t.getAttribute('data-rz-breaker') === '1')) {
          /* Don't hijack legitimate links / form controls inside the same group. */
          if (t.tagName === 'A' || t.tagName === 'BUTTON') { return; }
          e.stopPropagation();
          open(t);
          return;
        }
        t = t.parentNode;
      }
    }, false);
    /* ESC to close. */
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { close(); }
    });
    /* Outside-click to close. */
    doc.addEventListener('click', function (e) {
      if (!isOpen()) { return; }
      var t = e.target;
      while (t && t !== doc.body) {
        if (t === inspectorEl) { return; }
        if (t.getAttribute && (t.getAttribute('data-rz-line') === '1' ||
                               t.getAttribute('data-rz-breaker') === '1')) { return; }
        t = t.parentNode;
      }
      close();
    }, true);
  }

  /* Wait for DOM ready. */
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Export. */
  var API = { open: open, close: close, isOpen: isOpen, version: '1.43.0' };
  if (root) { root.RZInspector = API; }

})(typeof window !== 'undefined' ? window : null,
   typeof document !== 'undefined' ? document : null);
