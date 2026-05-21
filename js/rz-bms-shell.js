/* ============================================================================
 * rz-bms-shell.js — Shared BMS/DCIM operations-console shell controller
 * v1.23.0 — vanilla ES5, zero-build, no dependencies.
 *
 * Spec sources:
 *   - Documents/screenshot bms rz/conv/review/14-uiux-re-review-2026-05-22-best-design.md
 *   - Documents/screenshot bms rz/dc ai/review/24-uiux-re-review-2026-05-22-best-design.md
 *
 * What this controller provides (pure additive — page opts in by loading the
 * script and calling RZBMSShell.init / RZBMSShell.<api>):
 *
 *   RZBMSShell.init({state, alarms, dataQuality, updateAge, constraint, role})
 *       Mount/refresh the top status strip in the page's
 *       `.rz-bms-status-strip` host. Idempotent — safe to call repeatedly.
 *
 *   RZBMSShell.setStatus(partial)
 *       Update individual fields without re-rendering the whole strip.
 *
 *   RZBMSShell.layerToggle(host, layers, onChange)
 *       Mount a layer-toggle toolbar inside `host` (HTMLElement). `layers` is
 *       an array of {id, label, pressed?}. `onChange(activeIds)` fires whenever
 *       the user toggles a layer. ARIA-aware (aria-pressed + aria-label).
 *
 *   RZBMSShell.inspector.select(host, payload)
 *       Render an object payload into the right-inspector at `host`. Payload
 *       schema below. Idempotent + safe to call with payload=null to clear.
 *
 *   RZBMSShell.inspector.clear(host)
 *       Clear an inspector to the empty/help state.
 *
 *   RZBMSShell.attachClickToInspector(diagram, hostInspector, resolver)
 *       Wires click-to-inspect on a diagram element. resolver(target) returns
 *       a payload (or null). Handles keyboard activation (Enter/Space).
 *
 *   RZBMSShell.alarmBadge(navItem, count, severity)
 *       Update the alarm badge on a nav item. severity is one of
 *       'normal'|'warn'|'critical'|'stale'.
 *
 * Inspector payload schema (all fields optional, gracefully degraded):
 *   {
 *     title:        "UPS-A",
 *     statusChip:   {label:"Online", state:"is-normal"},
 *     critical:     [{k:"Load",   v:"79.2",  unit:"%"},
 *                    {k:"Input",  v:"OK"}],
 *     thresholds:   [{k:"Warning",  v:">80%"}, {k:"Critical", v:">95%"}],
 *     trend:        "load, voltage, current, temp",  // free text for now
 *     alarms:       [{sev:"warn", msg:"Load 81% > warning"}],
 *     interlocks:   ["Bypass available", "Battery 100%"],
 *     maintenance:  "Last test 2026-04-12",
 *     source:       "Simulated · Scenario A locked"
 *   }
 *
 * Engine preservation:
 *   This controller does NOT touch any engine values. It is presentation only.
 *   Pages remain responsible for feeding engine-derived values into
 *   setStatus() and inspector.select() payloads.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var d = document;

  /* ------------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------------*/
  function el(tag, attrs, kids) {
    var node = d.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (kids) {
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? d.createTextNode(c) : c);
      }
    }
    return node;
  }

  function pickStateClass(state) {
    if (!state) return '';
    var s = String(state).toLowerCase();
    if (s.indexOf('crit') === 0 || s === 'alarm' || s === 'trip') return 'is-critical';
    if (s.indexOf('warn') === 0) return 'is-warn';
    if (s === 'stale' || s === 'comms' || s === 'degraded') return 'is-stale';
    if (s === 'maint' || s === 'maintenance') return 'is-maint';
    if (s === 'simulated' || s === 'simulation') return 'is-simulated';
    return 'is-normal';
  }

  function formatCount(n, label) {
    var x = Number(n) || 0;
    return x + ' ' + label;
  }

  /* ------------------------------------------------------------------------
   * Top status strip
   * ------------------------------------------------------------------------*/
  var statusState = {};

  function renderStatusStrip(host) {
    if (!host) return;
    host.innerHTML = '';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-label', 'System status summary');

    var s = statusState;

    if (s.state) {
      host.appendChild(el('div', { class: 'rz-bms-status-cell' }, [
        el('span', { class: 'rz-bms-chip ' + pickStateClass(s.state), text: s.state })
      ]));
    }
    if (s.critical != null) {
      host.appendChild(el('div', { class: 'rz-bms-status-cell' }, [
        el('span', { class: 'rz-bms-status-label', text: 'Critical' }),
        el('span', {
          class: 'rz-bms-status-value ' + ((s.critical | 0) > 0 ? 'is-critical' : 'is-good'),
          'data-numeric': '1',
          text: String(s.critical | 0)
        })
      ]));
    }
    if (s.warning != null) {
      host.appendChild(el('div', { class: 'rz-bms-status-cell' }, [
        el('span', { class: 'rz-bms-status-label', text: 'Warning' }),
        el('span', {
          class: 'rz-bms-status-value ' + ((s.warning | 0) > 0 ? 'is-warn' : 'is-good'),
          'data-numeric': '1',
          text: String(s.warning | 0)
        })
      ]));
    }
    if (s.dataQuality) {
      host.appendChild(el('div', { class: 'rz-bms-status-cell' }, [
        el('span', { class: 'rz-bms-status-label', text: 'Data' }),
        el('span', {
          class: 'rz-bms-status-value ' + (s.dataQuality.toUpperCase() === 'GOOD' ? 'is-good' : 'is-stale'),
          text: String(s.dataQuality).toUpperCase()
        })
      ]));
    }
    if (s.updateAge) {
      host.appendChild(el('div', { class: 'rz-bms-status-cell' }, [
        el('span', { class: 'rz-bms-status-label', text: 'Updated' }),
        el('span', { class: 'rz-bms-status-value', 'data-numeric': '1', text: String(s.updateAge) })
      ]));
    }
    if (s.constraint) {
      host.appendChild(el('div', { class: 'rz-bms-status-cell' }, [
        el('span', { class: 'rz-bms-status-label', text: 'Constraint' }),
        el('span', { class: 'rz-bms-status-value', text: String(s.constraint) })
      ]));
    }
    if (s.role) {
      host.appendChild(el('div', { class: 'rz-bms-status-cell' }, [
        el('span', { class: 'rz-bms-status-label', text: 'User' }),
        el('span', { class: 'rz-bms-status-value', text: String(s.role) })
      ]));
    }
    if (s.simulated) {
      host.appendChild(el('div', { class: 'rz-bms-status-cell' }, [
        el('span', { class: 'rz-bms-chip is-simulated', text: 'Simulated' })
      ]));
    }
  }

  function init(opts) {
    opts = opts || {};
    statusState = {
      state:       opts.state       || 'NORMAL',
      critical:    opts.critical    == null ? 0 : opts.critical,
      warning:     opts.warning     == null ? 0 : opts.warning,
      dataQuality: opts.dataQuality || 'GOOD',
      updateAge:   opts.updateAge   || '',
      constraint:  opts.constraint  || '',
      role:        opts.role        || '',
      simulated:   !!opts.simulated
    };
    var host = d.querySelector(opts.host || '.rz-bms-status-strip');
    renderStatusStrip(host);
  }

  function setStatus(partial) {
    if (!partial) return;
    for (var k in partial) {
      if (Object.prototype.hasOwnProperty.call(partial, k)) statusState[k] = partial[k];
    }
    var host = d.querySelector('.rz-bms-status-strip');
    renderStatusStrip(host);
  }

  /* ------------------------------------------------------------------------
   * Layer-toggle toolbar
   * ------------------------------------------------------------------------*/
  function layerToggle(host, layers, onChange) {
    if (!host || !layers || !layers.length) return;
    host.innerHTML = '';
    host.className = (host.className ? host.className + ' ' : '') + 'rz-bms-layer-toolbar';
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Diagram layer toggles');

    var active = {};
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      active[L.id] = !!L.pressed;
      (function (lyr) {
        var btn = el('button', {
          type: 'button',
          class: 'rz-bms-layer-btn',
          'aria-pressed': active[lyr.id] ? 'true' : 'false',
          'aria-label': 'Toggle layer ' + lyr.label,
          'data-layer': lyr.id,
          text: lyr.label
        });
        btn.addEventListener('click', function () {
          active[lyr.id] = !active[lyr.id];
          btn.setAttribute('aria-pressed', active[lyr.id] ? 'true' : 'false');
          if (typeof onChange === 'function') {
            var ids = [];
            for (var k in active) if (active[k]) ids.push(k);
            onChange(ids);
          }
        });
        host.appendChild(btn);
      })(L);
    }
    // Fire initial onChange with starting state
    if (typeof onChange === 'function') {
      var initial = [];
      for (var k in active) if (active[k]) initial.push(k);
      onChange(initial);
    }
  }

  /* ------------------------------------------------------------------------
   * Right inspector
   * ------------------------------------------------------------------------*/
  function renderInspector(host, p) {
    if (!host) return;
    host.innerHTML = '';
    host.setAttribute('aria-live', 'polite');

    if (!p) {
      host.appendChild(el('div', {
        class: 'rz-bms-inspector-empty',
        text: 'Select an object to inspect.'
      }));
      return;
    }

    var header = el('div', { class: 'rz-bms-inspector-header' }, [
      el('h3', { class: 'rz-bms-inspector-title', text: p.title || 'Selected' }),
      p.statusChip
        ? el('span', { class: 'rz-bms-chip ' + (p.statusChip.state || 'is-normal'), text: p.statusChip.label || '' })
        : null
    ]);
    host.appendChild(header);

    function kvSection(titleText, items) {
      if (!items || !items.length) return;
      var sec = el('section', { class: 'rz-bms-inspector-section' });
      sec.appendChild(el('h4', { class: 'rz-bms-inspector-section-title', text: titleText }));
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        sec.appendChild(el('div', { class: 'rz-bms-kv' }, [
          el('span', { class: 'rz-bms-kv-key', text: it.k }),
          el('span', { class: 'rz-bms-kv-val', 'data-numeric': '1',
            text: (it.v == null ? '' : String(it.v)) + (it.unit ? ' ' + it.unit : '') })
        ]));
      }
      host.appendChild(sec);
    }

    kvSection('Critical values', p.critical);
    kvSection('Thresholds',      p.thresholds);

    if (p.trend) {
      var s = el('section', { class: 'rz-bms-inspector-section' });
      s.appendChild(el('h4', { class: 'rz-bms-inspector-section-title', text: 'Trend' }));
      s.appendChild(el('div', { class: 'rz-bms-dim', text: String(p.trend) }));
      host.appendChild(s);
    }

    if (p.alarms && p.alarms.length) {
      var as = el('section', { class: 'rz-bms-inspector-section' });
      as.appendChild(el('h4', { class: 'rz-bms-inspector-section-title', text: 'Alarms' }));
      for (var a = 0; a < p.alarms.length; a++) {
        var aRow = p.alarms[a];
        as.appendChild(el('div', { class: 'rz-bms-kv' }, [
          el('span', { class: 'rz-bms-chip ' + pickStateClass(aRow.sev), text: (aRow.sev || '').toUpperCase() }),
          el('span', { class: 'rz-bms-kv-val', text: aRow.msg || '' })
        ]));
      }
      host.appendChild(as);
    }

    if (p.interlocks && p.interlocks.length) {
      var is = el('section', { class: 'rz-bms-inspector-section' });
      is.appendChild(el('h4', { class: 'rz-bms-inspector-section-title', text: 'Interlocks' }));
      for (var k = 0; k < p.interlocks.length; k++) {
        is.appendChild(el('div', { class: 'rz-bms-kv' }, [
          el('span', { class: 'rz-bms-kv-key', text: '·' }),
          el('span', { class: 'rz-bms-kv-val', text: String(p.interlocks[k]) })
        ]));
      }
      host.appendChild(is);
    }

    if (p.maintenance) {
      var ms = el('section', { class: 'rz-bms-inspector-section' });
      ms.appendChild(el('h4', { class: 'rz-bms-inspector-section-title', text: 'Maintenance' }));
      ms.appendChild(el('div', { class: 'rz-bms-dim', text: String(p.maintenance) }));
      host.appendChild(ms);
    }

    if (p.source) {
      var ss = el('section', { class: 'rz-bms-inspector-section' });
      ss.appendChild(el('h4', { class: 'rz-bms-inspector-section-title', text: 'Source / data quality' }));
      ss.appendChild(el('div', { class: 'rz-bms-muted', text: String(p.source) }));
      host.appendChild(ss);
    }
  }

  var inspector = {
    select: function (host, payload) {
      renderInspector(typeof host === 'string' ? d.querySelector(host) : host, payload);
    },
    clear: function (host) {
      renderInspector(typeof host === 'string' ? d.querySelector(host) : host, null);
    }
  };

  function attachClickToInspector(diagram, hostInspector, resolver) {
    if (!diagram || typeof resolver !== 'function') return;
    var inspectorEl = typeof hostInspector === 'string' ? d.querySelector(hostInspector) : hostInspector;

    function activate(target) {
      var payload = null;
      try { payload = resolver(target); } catch (e) { payload = null; }
      renderInspector(inspectorEl, payload);
    }
    diagram.addEventListener('click', function (ev) { activate(ev.target); });
    diagram.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        activate(ev.target);
      }
    });
  }

  /* ------------------------------------------------------------------------
   * Nav badge update
   * ------------------------------------------------------------------------*/
  function alarmBadge(navItem, count, severity) {
    if (!navItem) return;
    var badge = navItem.querySelector('.rz-bms-nav-badge');
    if (!badge) {
      badge = el('span', { class: 'rz-bms-nav-badge', 'aria-label': 'alarm count' });
      navItem.appendChild(badge);
    }
    var n = Number(count) || 0;
    badge.textContent = String(n);
    badge.className = 'rz-bms-nav-badge ' + (n === 0 ? 'is-normal' : ('is-' + (severity || 'warn')));
  }

  /* ------------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------------*/
  global.RZBMSShell = {
    version: '1.23.0',
    init: init,
    setStatus: setStatus,
    layerToggle: layerToggle,
    inspector: inspector,
    attachClickToInspector: attachClickToInspector,
    alarmBadge: alarmBadge
  };
})(typeof window !== 'undefined' ? window : this);
