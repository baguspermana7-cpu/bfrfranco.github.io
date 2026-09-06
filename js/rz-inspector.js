/* ============================================================================
 * rz-inspector.js — right-side inspector: line/breaker attrs, registry basis, equipment payloads (v1.45.0)
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
    /* v1.45.0 — payload mode (Track A §A5) */
    '.rz-inspector-chip{display:inline-block;margin:6px 0 0;padding:2px 8px;border-radius:999px;font-family:JetBrains Mono,monospace;font-size:10px;font-weight:600;letter-spacing:.04em;border:1px solid rgba(255,255,255,0.18);color:#e2e8f0}' +
    '.rz-inspector-chip.is-normal{color:#86efac;border-color:rgba(134,239,172,0.4)}' +
    '.rz-inspector-chip.is-standby{color:#fbbf24;border-color:rgba(251,191,36,0.4)}' +
    '.rz-inspector-chip.is-fault{color:#fca5a5;border-color:rgba(252,165,165,0.5)}' +
    '.rz-inspector-action{margin:8px 0 0;padding:6px 10px;border:1px solid rgba(56,189,248,0.35);background:rgba(56,189,248,0.08);color:#7dd3fc;' +
      'font-family:IBM Plex Sans,sans-serif;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;border-radius:4px;cursor:pointer}' +
    '.rz-inspector-action:hover,.rz-inspector-action:focus-visible{background:rgba(56,189,248,0.18);outline:2px solid #38bdf8;outline-offset:1px}' +
    '.rz-inspector-v[data-basis-param]{cursor:pointer;text-decoration:underline dotted rgba(255,255,255,0.3)}' +
    '.rz-inspector-v[data-basis-param]::after,.rz-inspector-v[data-rz-authored-basis]::after{content:"";display:inline-block;width:5px;height:5px;border-radius:50%;margin-left:5px;vertical-align:middle;background:var(--rz-ev,#8fa2b8)}' +
    '.rz-inspector-v.state-run,.rz-inspector-v.state-online,.rz-inspector-v.state-up,.rz-inspector-v.state-dry,.rz-inspector-v.state-normal,.rz-inspector-v.state-float,.rz-inspector-v.state-coupled,.rz-inspector-v.state-armed,.rz-inspector-v.state-ok{color:#86efac}' +
    '.rz-inspector-v.state-stby,.rz-inspector-v.state-bypass,.rz-inspector-v.state-de-energized,.rz-inspector-v.state-unavailable{color:#fbbf24}' +
    '.rz-inspector-v.state-trip,.rz-inspector-v.state-wet,.rz-inspector-v.state-alarm,.rz-inspector-v.state-discharge{color:#fca5a5}' +
    '.rz-inspector-back{display:block;margin:0 0 10px;background:none;border:none;color:#7dd3fc;font-family:IBM Plex Sans,sans-serif;font-size:10.5px;cursor:pointer;padding:0}' +
    '.rz-inspector-spark{width:100%;height:64px;display:block;margin:6px 0 10px}' +
    '.rz-inspector-alarm{padding:8px 10px;border:1px solid rgba(252,165,165,0.35);border-left:3px solid #fca5a5;border-radius:4px;margin-bottom:6px;font-size:11px}' +
    '.rz-inspector-alarm .rz-inspector-dep-k{color:#fca5a5}' +
    '.rz-inspector-prov{margin-top:14px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);font-size:10px;color:#64748b;font-family:JetBrains Mono,monospace}' +
    /* responsive ladder (owner ledger 2026-08-26): ≥1440 docked when the page opts in, 1024–1439 overlay, 768–1023 bottom sheet, <768 full sheet */
    '@media (min-width:1440px){body[data-rz-inspector-dock="1"] .rz-inspector.open{box-shadow:none}body[data-rz-inspector-dock="1"].rz-inspector-docked{padding-right:360px}}' +
    '@media (max-width:1023px){.rz-inspector{top:auto;bottom:-100vh;right:0;left:0;width:100vw;height:55vh;border-left:none;border-top:1px solid rgba(255,255,255,0.12);transition:bottom .25s cubic-bezier(.4,0,.2,1)}.rz-inspector.open{bottom:0;right:0}}' +
    '@media (max-width:767px){.rz-inspector{height:100vh}.rz-inspector-close{width:44px;height:44px;top:6px;right:6px}}' +
    '@media (max-width:640px){.rz-inspector{width:100vw}}';

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
  var basisMode = false;   /* A3: the panel is showing a registry record, not equipment metadata */
  var payloadMode = false; /* A5: the panel is showing an equipment payload (hmi-payloads.js) */
  var currentPayload = null, payloadOpts = null, lastTrigger = null;

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
        '<div class="rz-inspector-id" data-slot="id" tabindex="-1">—</div>' +
        '<div data-slot="chip"></div>' +
        '<div data-slot="actions"></div>' +
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
    if (payloadMode) { renderPayload(); return; }
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
    leaveBasisMode();
    leavePayloadMode();
    currentEl = el;
    render();
    inspectorEl.classList.add('open');
  }

  /* ---- A3 basis mode: a registry record in the right-side panel ----------
     Numbers drawn inside an SVG mimic carry data-basis-param; a click on one must
     NOT open the centre modal (review doc-27 §3.2: "jangan modal tengah, menutup
     topology"). The record HTML has ONE renderer — RZBasisDrawer.renderRecord —
     this panel only hosts it. Works for any [data-basis-param] element or a bare id. */
  function isBasisHook(el) { return !!(el && el.getAttribute && el.getAttribute('data-basis-param')); }
  function basisIdOf(el) {
    var t = el;
    while (t && t !== doc.body) { if (isBasisHook(t)) { return t.getAttribute('data-basis-param'); } t = t.parentNode; }
    return null;
  }
  function leaveBasisMode() {
    if (!basisMode || !inspectorEl) { return; }
    basisMode = false;
    inspectorEl.classList.remove('rz-inspector-basis');
    inspectorEl.querySelector('.rz-inspector-tabs').hidden = false;
  }
  function openBasis(target) {
    var id = typeof target === 'string' ? target : basisIdOf(target);
    if (!id) { return false; }
    buildShell();
    if (payloadMode) { payloadMode = false; inspectorEl.classList.remove('rz-inspector-payload'); inspectorEl.querySelector('[data-slot="chip"]').innerHTML = ''; inspectorEl.querySelector('[data-slot="actions"]').innerHTML = ''; }
    basisMode = true;
    currentEl = null;
    inspectorEl.classList.add('rz-inspector-basis');
    inspectorEl.querySelector('.rz-inspector-tabs').hidden = true;
    inspectorEl.querySelector('[data-slot="kind"]').textContent = 'BASIS';
    inspectorEl.querySelector('[data-slot="id"]').textContent = id;
    var body = inspectorEl.querySelector('[data-slot="body"]');
    var drawer = root.RZBasisDrawer;
    body.innerHTML = drawer && drawer.renderRecord
      ? drawer.renderRecord(id)
      : '<div class="rz-inspector-empty">Basis drawer not loaded — registry record for ' + esc(id) + ' cannot be shown.</div>';
    /* the record's dependency links navigate inside the panel */
    var links = body.querySelectorAll('[data-basis-goto]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openBasis(e.currentTarget.getAttribute('data-basis-goto')); });
    }
    inspectorEl.classList.add('open');
    return true;
  }

  /* ---- A5 payload mode: an equipment payload from js/datahall-ai/hmi-payloads.js ----
     Every value cell carries data-basis-param (registry-backed, evidence dot from
     RZEvidence) OR data-rz-authored-basis (declared: simulated / state / authored) —
     never both, so the traceability walker can classify it. A click on a hooked cell
     enters basis mode with a way back; nothing here opens the centre modal. */
  function evColor(cls) { return root.RZEvidence ? root.RZEvidence.color(cls) : '#8fa2b8'; }
  function evOf(id) { return root.RZSvgBasis ? root.RZSvgBasis.evidenceOf(id) : 'DERIVED'; }
  function cellAttrs(r) {
    if (r.basis) {
      return ' data-basis-param="' + esc(r.basis) + '"' + (r.params ? ' data-basis-params="' + esc([r.basis].concat(r.params).join(' ')) + '"' : '')
        + ' data-evidence="' + esc(evOf(r.basis)) + '" tabindex="0" role="button" style="--rz-ev:' + evColor(evOf(r.basis)) + '" title="' + esc(r.basis + ' · ' + evOf(r.basis)) + '"';
    }
    var col = r.quality === 'simulated' ? '#8b7bd0' : r.quality === 'state' ? '#7dd3fc' : '#8fa2b8';
    return ' data-rz-authored-basis="' + esc(r.declared || '') + '" style="--rz-ev:' + col + '" title="' + esc((r.quality || 'declared').toUpperCase() + ' · ' + (r.declared || '')) + '"';
  }
  function payloadRow(r) {
    var cls = 'rz-inspector-v' + (r.state ? ' state-' + esc(r.state) : '');
    return '<div class="rz-inspector-row"><span class="rz-inspector-k">' + esc(r.label) + '</span>' +
      '<span class="' + cls + '"' + cellAttrs(r) + '>' + esc(r.text) + (r.unit ? ' ' + esc(r.unit) : '') + '</span></div>';
  }
  function payloadRows(rows, empty) {
    if (!rows || !rows.length) { return '<div class="rz-inspector-empty">' + esc(empty) + '</div>'; }
    return rows.map(payloadRow).join('');
  }
  function sparkline(t) {
    var s = t.series || [], n = s.length; if (n < 2) { return ''; }
    var vals = s.filter(function (x) { return typeof x === 'number'; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = (max - min) || 1;
    var pts = s.map(function (v, i) { return (i / (n - 1) * 100).toFixed(2) + ',' + (v == null ? 32 : (32 - (v - min) / span * 28 + 2)).toFixed(2); }).join(' ');
    return '<svg class="rz-inspector-spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="' + pts + '" fill="none" stroke="#7dd3fc" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>';
  }
  function renderPayloadTab(p, tab) {
    var t = p.tabs;
    switch (tab) {
      case 'live': return payloadRows(t.live, 'No live points.');
      case 'capacity': return payloadRows(t.capacity, 'No capacity rows.');
      case 'deps': {
        var html = '';
        (t.deps.upstream || []).forEach(function (d) { html += depCardPayload('Upstream', d); });
        (t.deps.downstream || []).forEach(function (d) { html += depCardPayload('Downstream', d); });
        (p.actions && p.actions.related || []).forEach(function (id) { html += depCardPayload('Related', { id: id, label: id }); });
        return html || '<div class="rz-inspector-empty">No dependencies declared.</div>';
      }
      case 'alarms': {
        if (!t.alarms || !t.alarms.length) { return '<div class="rz-inspector-empty">No active alarms for the selected scenario.</div>'; }
        return t.alarms.map(function (a) {
          return '<div class="rz-inspector-alarm" data-rz-authored-basis="simulated alarm record from the selected scenario (quality: simulated), never a field event (Track A §A5)">' +
            '<div class="rz-inspector-dep-k">' + esc(a.severity) + ' · ' + esc(a.lifecycle) + '</div>' +
            '<div class="rz-inspector-dep-v">' + esc(a.tag) + ' / ' + esc(a.point) + '</div><div>' + esc(a.message) + '</div></div>';
        }).join('');
      }
      case 'trend': {
        if (!t.trend) { return '<div class="rz-inspector-empty">No trend point declared.</div>'; }
        var last = t.trend.series[t.trend.series.length - 1];
        return '<div data-rz-authored-basis="' + esc(t.trend.declared) + '">' + row(t.trend.label, (last == null ? '—' : last) + (t.trend.unit ? ' ' + t.trend.unit : '')) + sparkline(t.trend) +
          '<div class="rz-inspector-empty">' + esc(t.trend.series.length + ' ticks · ' + t.trend.declared) + '</div></div>';
      }
      case 'maint': return payloadRows(t.maint, 'No maintenance rows.');
    }
    return '';
  }
  function depCardPayload(k, d) {
    return '<div class="rz-inspector-dep" data-rz-depid="' + esc(d.id) + '" tabindex="0" role="button">' +
      '<div class="rz-inspector-dep-k">' + esc(k) + '</div><div class="rz-inspector-dep-v">' + esc(d.label || d.id) + '</div></div>';
  }
  function renderPayload() {
    var p = currentPayload; if (!p || !inspectorEl) { return; }
    inspectorEl.querySelector('[data-slot="kind"]').textContent = String(p.kind || 'equipment').toUpperCase() + ' · ' + String(p.label || '');
    inspectorEl.querySelector('[data-slot="id"]').textContent = p.title;
    var chip = p.statusChip || { label: 'NORMAL', state: 'normal' };
    inspectorEl.querySelector('[data-slot="chip"]').innerHTML = '<span class="rz-inspector-chip is-' + esc(chip.state) + '">' + esc(chip.label) + '</span>';
    var actions = inspectorEl.querySelector('[data-slot="actions"]');
    /* the button element survives the 4 s refresh: a modal that opened from it returns focus to it */
    var wantAction = !!(p.actions && p.actions.openHmi), btn = actions.querySelector('[data-rz-open-hmi]');
    if (wantAction !== !!btn) {
      actions.innerHTML = wantAction ? '<button type="button" class="rz-inspector-action" data-rz-open-hmi="1">Open equipment HMI</button>' : '';
      btn = actions.querySelector('[data-rz-open-hmi]');
    }
    if (btn) { btn.onclick = function (e) { e.stopPropagation(); if (payloadOpts && payloadOpts.onOpenHmi) { payloadOpts.onOpenHmi(currentPayload || p, btn); } }; }
    var body = inspectorEl.querySelector('[data-slot="body"]');
    body.innerHTML = renderPayloadTab(p, currentTab) +
      '<div class="rz-inspector-prov">engine ' + esc(p.provenance.engineVersion) + ' · scenario ' + esc(p.provenance.scenarioId) + ' / ' + esc(p.provenance.coolingScenarioId) + ' · tick ' + esc(p.provenance.tick) +
      ' · ' + esc(p.provenance.counts.derived + (p.provenance.counts.published || 0)) + ' engine · ' + esc(p.provenance.counts.simulated) + ' simulated · ' + esc(p.provenance.counts.state) + ' state</div>';
    var deps = body.querySelectorAll('[data-rz-depid]');
    for (var i = 0; i < deps.length; i++) {
      deps[i].addEventListener('click', function (e) { e.stopPropagation(); var id = e.currentTarget.getAttribute('data-rz-depid'); if (payloadOpts && payloadOpts.onNavigate) { payloadOpts.onNavigate(id); } });
      deps[i].addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } });
    }
    var cells = body.querySelectorAll('.rz-inspector-v[data-basis-param]');
    for (var j = 0; j < cells.length; j++) {
      cells[j].addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); openBasisFromPayload(e.currentTarget.getAttribute('data-basis-param')); });
      cells[j].addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openBasisFromPayload(e.currentTarget.getAttribute('data-basis-param')); } });
    }
  }
  function openBasisFromPayload(id) {
    var back = currentPayload, opts = payloadOpts;
    openBasis(id);
    var body = inspectorEl.querySelector('[data-slot="body"]');
    var b = doc.createElement('button'); b.type = 'button'; b.className = 'rz-inspector-back'; b.textContent = '← back to ' + (back ? back.title : 'equipment');
    b.addEventListener('click', function (e) { e.stopPropagation(); openPayload(back, opts); });
    body.insertBefore(b, body.firstChild);
  }
  function leavePayloadMode() {
    if (!payloadMode || !inspectorEl) { return; }
    payloadMode = false; currentPayload = null;
    inspectorEl.classList.remove('rz-inspector-payload');
    inspectorEl.querySelector('[data-slot="chip"]').innerHTML = '';
    inspectorEl.querySelector('[data-slot="actions"]').innerHTML = '';
  }
  /** openPayload(payload, { trigger, onOpenHmi(payload, button), onNavigate(id), tab }) */
  function openPayload(payload, opts) {
    if (!payload || payload.unavailable || !payload.tabs) { return false; }
    buildShell();
    leaveBasisMode();
    payloadMode = true; currentPayload = payload; payloadOpts = opts || {}; currentEl = null;
    if (payloadOpts.trigger) { lastTrigger = payloadOpts.trigger; }
    if (payloadOpts.tab) { currentTab = payloadOpts.tab; }
    var tabs = inspectorEl.querySelectorAll('.rz-inspector-tab');
    for (var i = 0; i < tabs.length; i++) { tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === currentTab); }
    inspectorEl.querySelector('.rz-inspector-tabs').hidden = false;
    inspectorEl.classList.add('rz-inspector-payload');
    renderPayload();
    var wasOpen = inspectorEl.classList.contains('open');
    inspectorEl.classList.add('open');
    if (doc.body && doc.body.getAttribute('data-rz-inspector-dock') === '1' && root.matchMedia && root.matchMedia('(min-width:1440px)').matches) { doc.body.classList.add('rz-inspector-docked'); }
    if (!wasOpen || !payloadOpts.keepFocus) { var idEl = inspectorEl.querySelector('[data-slot="id"]'); if (idEl && idEl.focus) { idEl.focus({ preventScroll: true }); } }
    return true;
  }
  /** refresh the current payload (same equipment, new tick) without moving focus */
  function refreshPayload(payload) {
    if (!payloadMode || !payload || payload.unavailable) { return false; }
    currentPayload = payload; renderPayload(); return true;
  }
  function currentPayloadId() { return payloadMode && currentPayload ? currentPayload.classId + ':' + currentPayload.id : null; }

  function close() {
    if (inspectorEl) { inspectorEl.classList.remove('open'); }
    if (doc.body) { doc.body.classList.remove('rz-inspector-docked'); }
    leaveBasisMode();
    var trig = lastTrigger; lastTrigger = null;
    leavePayloadMode();
    currentEl = null;
    if (trig && trig.focus) { try { if (!trig.hasAttribute('tabindex')) { trig.setAttribute('tabindex', '-1'); } trig.focus({ preventScroll: true }); } catch (e) { /* SVG focus is best-effort */ } }
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
      if (e.key !== 'Escape' || !isOpen()) { return; }
      /* a centre modal above the inspector owns ESC first (DHModal on the AI cockpit) */
      if (root.DHModal && typeof root.DHModal.isOpen === 'function' && root.DHModal.isOpen()) { return; }
      close();
    });
    /* Outside-click to close. */
    doc.addEventListener('click', function (e) {
      if (!isOpen()) { return; }
      var t = e.target;
      while (t && t !== doc.body) {
        if (t === inspectorEl) { return; }
        if (t.getAttribute && (t.getAttribute('data-rz-line') === '1' ||
                               t.getAttribute('data-rz-breaker') === '1' ||
                               t.getAttribute('data-basis-param') ||
                               t.getAttribute('data-rz-equipment') ||
                               t.hasAttribute('data-rz-inspector-keep'))) { return; }
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
  var API = { open: open, openBasis: openBasis, basisIdOf: basisIdOf, openPayload: openPayload, refreshPayload: refreshPayload, currentPayloadId: currentPayloadId, close: close, isOpen: isOpen, version: '1.45.0' };
  if (root) { root.RZInspector = API; }

})(typeof window !== 'undefined' ? window : null,
   typeof document !== 'undefined' ? document : null);
