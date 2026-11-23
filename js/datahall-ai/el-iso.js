/*
 * js/datahall-ai/el-iso.js — the 3D equipment view of the DC AI electrical tab (PRD-ELECTRICAL-BMS decision 5, law E6).
 * Geometry is js/rz-el-iso.js (the same module as EPMS). This file only says WHAT stands in the site:
 *   HV GIS bays        = distribution.hv_switchyard_bays (line bays + transformer bays) — the engine
 *   main transformers  = distribution.hv_transformer_bays (= main_tx_total, one bay each) — the engine
 *   MV switchroom      = the MV breakers drawn on DH-E-001                                 — the one-line
 *   generator yard     = equipment.gensets_installed (duty + standby)                     — the engine
 * Each unit stands for the DH-E-001 symbol that represents it; its lamp is that symbol's drawn state and selecting it
 * clicks that symbol, so the same inspector opens. The one-line stays the authority.
 */
(function () {
  'use strict';
  var SHEET = '.hmi-host[data-hmi-sheet="dh-e-001"]', KEY = 'rz.dcai.elec.proj';
  var ISO = null, PROJ = null, obs = null, queued = false;

  function sheetHost() { return document.querySelector(SHEET); }
  function nodeEl(id) { var h = sheetHost(); return h ? h.querySelector('.hmi-node[data-node="' + id + '"]') : null; }
  /* the one-line's own words, mapped once: anything the sheet does not state (na, empty) is NO DATA, never "stopped" */
  function stateOf(id) {
    var g = id && nodeEl(id), s = g && g.getAttribute('data-state');
    if (s === 'running' || s === 'closed' || s === 'energized') return 'running';
    if (s === 'standby') return 'standby';
    if (s === 'alarm' || s === 'trip' || s === 'tripped') return 'alarm';
    if (s === 'warn' || s === 'warning') return 'warn';
    if (s === 'open' || s === 'stopped' || s === 'deenergized') return 'stopped';
    return 'nodata';
  }
  var TAGS = {};   /* the one-line's own tags, from the same sheet build the page draws */
  function tagOf(id, fb) { return TAGS[id] || fb; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* Which DH-E-001 symbol each real unit stands for. The sheet draws hall 1 in full (CB-TA/B, TX-MA01/MB01), halls 2..8
     as one breaker + one transformer symbol each, the line bays one by one, and the generators as one DUTY and one
     STANDBY symbol. A unit is never given a symbol of its own that the sheet does not draw: `rep` says how many units
     share the symbol whose state the lamp shows. */
  function spec(snap, has) {
    var d = snap.distribution, eq = snap.equipment;
    var perHall = d.main_tx_per_hall_per_feed * 2, gis = [], tx = [], gens = [], i, h, k;
    function node(id) { return has[id] ? id : null; }
    for (i = 1; i <= d.hv_line_bays; i++) gis.push({ node: node('cb-hv' + i), tag: 'HV line bay ' + i + ' (Q' + i + ')', rep: 1 });
    for (h = 1; h * perHall <= d.hv_transformer_bays; h++) for (k = 0; k < perHall; k++) {
      var feed = 'AB'.charAt(k % 2), n = (h - 1) * perHall + k + 1;
      var bay = h === 1 ? node('cb-tx' + feed) : node('cb-h' + h), t = h === 1 ? node('tx-main' + feed) : node('tx-h' + h);
      gis.push({ node: bay, tag: 'HV transformer bay ' + n + ' · DH-' + pad(h) + ' feed ' + feed, rep: h === 1 ? 1 : perHall });
      tx.push({ node: t, tag: (h === 1 ? 'TX-M' + feed + '01' : 'TX-M' + pad(n)) + ' · DH-' + pad(h) + ' feed ' + feed + ' · ' + d.main_tx_mva + ' MVA', rep: h === 1 ? 1 : perHall });
    }
    var mv = Object.keys(has).filter(function (n) { return /^cb-(mv|f)[A-Z]\d*$/.test(n) || n === 'mv-tie'; });
    for (i = 0; i < eq.gensets_installed; i++) {
      var duty = i < eq.gensets_duty;
      gens.push({ node: node(duty ? 'gen1' : 'gen2'), tag: 'Generator ' + (i + 1) + (duty ? ' · duty' : ' · standby') + ' · ' + eq.generator_unit_kw / 1000 + ' MW', rep: duty ? eq.gensets_duty : eq.gensets_installed - eq.gensets_duty });
    }
    return {
      label: 'DH-E-001 site in 3D: HV GIS, main transformers, MV switchroom, generator yard. Schematic arrangement, not to scale.',
      zones: [
        { id: 'gis', label: 'HV GIS BAYS', cls: 'gis', at: [0, 0], cols: Math.ceil(gis.length / 2), size: [8, 12, 20], gap: [2, 8], units: gis },
        { id: 'tx', label: 'MAIN TRANSFORMERS', cls: 'tx', at: [126, 0], cols: Math.ceil(tx.length / 2), size: [14, 14, 16], gap: [5, 10], units: tx },
        { id: 'mv', label: 'MV SWITCHROOM', cls: 'mv', at: [0, 92], cols: mv.length, size: [9, 12, 22], gap: [2, 6], units: mv.map(function (id) { return { node: id, tag: tagOf(id, id), rep: 1 }; }) },
        { id: 'gen', label: 'GENERATOR YARD', cls: 'gen', at: [0, 138], cols: 19, size: [10, 6, 8], gap: [3, 4], units: gens }
      ],
      stateOf: stateOf,
      symbolOf: function (id) { return id ? tagOf(id, id) : null; },
      open: function (id) { var g = id && nodeEl(id); if (g) g.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    };
  }

  function show(p) {
    var iso = p === 'iso', view = document.getElementById('elecIsoView');
    document.body.setAttribute('data-el-proj', p);
    if (view) view.hidden = !iso;
    document.querySelectorAll('#p-elec > .ep').forEach(function (ep) { if (iso) ep.setAttribute('data-iso-hidden', ''); else ep.removeAttribute('data-iso-hidden'); });
    if (iso && ISO) { ISO.refresh(); ISO.centre(); }
  }

  function mount() {
    var host = document.getElementById('elecIsoHost'), sw = document.getElementById('elecProj'), snap = window.DCAI_CALC && window.DCAI_CALC.snapshot;
    if (ISO || !host || !sw || !window.RZElIso || !snap || !snap.distribution || !snap.equipment) return;
    var sh = sheetHost(); if (!sh) return;   /* the one-line mounts first: units stand for its symbols */
    try { (window.RZDatahallAISheets.build('dh-e-001', snap).nodes || []).forEach(function (n) { if (n.tag) TAGS[n.id] = n.tag; }); } catch (x) { TAGS = {}; }
    var has = {}; Array.prototype.forEach.call(sh.querySelectorAll('.hmi-node[data-node]'), function (g) { has[g.getAttribute('data-node')] = true; });
    ISO = window.RZElIso.mount(host, spec(snap, has));
    PROJ = window.RZElIso.projSwitch(sw, KEY, show);
    /* lamps follow the one-line: any state the sheet repaints repaints here, once per frame */
    obs = new MutationObserver(function () { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; if (ISO) ISO.refresh(); }); });
    obs.observe(sh, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
    document.getElementById('elecTabs').addEventListener('click', function (ev) { if (ev.target.closest('button[data-ep]') && PROJ && PROJ.get() === 'iso') PROJ.set('line', true); });
  }

  function tryMount() { mount(); if (!ISO) setTimeout(tryMount, 600); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryMount); else tryMount();
})();
