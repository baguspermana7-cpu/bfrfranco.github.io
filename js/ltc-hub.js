/* ============================================================================
 * ltc-hub.js — Standards map: one liquid-to-chip plant, the standards that
 * govern each block, and the tool that answers the question for it.
 * ----------------------------------------------------------------------------
 * The figure and the coverage matrix are built from ONE table (SYSTEMS), so a
 * block cannot appear in the drawing and be missing from the matrix, or the
 * reverse. Statements are summaries of the cited documents, written to be
 * checkable; they are not quotations and not compliance advice.
 * ==========================================================================*/
(function () {
  'use strict';
  var L = window.LTC;

  var BODIES = ['ASHRAE', 'Uptime', 'TIA', 'NFPA', 'ISO/IEC'];

  /* role per reference: governs (sets a requirement on the block), measures
   * (defines a metric taken at the block), references (relevant, not binding) */
  var SYSTEMS = [
    { id: 'utility', sym: 'utility', name: 'Utility intake', sub: 'MV service', refs: [
      { body: 'Uptime', role: 'governs', code: 'Tier Standard: Topology',
        text: 'For Tier III and IV the engine-generator plant is the primary power source; the utility is treated as an economic alternative, not a redundant one.',
        tool: ['ltc-uptime-tier-alignment.html#simulator', 'Test the power path'] },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2',
        text: 'Total facility energy for PUE is taken at the facility boundary: utility metering plus any on-site generation.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compute PUE'] } ] },
    { id: 'genset', sym: 'genset', name: 'Engine generators', sub: 'standby / primary', refs: [
      { body: 'Uptime', role: 'governs', code: 'Tier Standard: Topology',
        text: 'Every Tier requires at least 12 hours of on-site fuel. Tier III/IV generators must carry the site without a runtime limit at the rating used.',
        tool: ['ltc-uptime-tier-alignment.html#simulator', 'Take a generator out'] },
      { body: 'NFPA', role: 'references', code: 'NFPA 110',
        text: 'Emergency and standby power systems. Type 10 means power restored to the load within 10 seconds of loss.' } ] },
    { id: 'swgr', sym: 'switchgear', name: 'Switchgear + ATS', sub: 'LV main boards', refs: [
      { body: 'Uptime', role: 'governs', code: 'Concurrent maintainability',
        text: 'Tier III: each component and each distribution path can be removed for planned work without affecting the IT load.',
        tool: ['ltc-uptime-tier-alignment.html#simulator', 'Sweep every component'] },
      { body: 'NFPA', role: 'references', code: 'NFPA 70E',
        text: 'Arc-flash risk assessment and equipment labelling before energized work.' } ] },
    { id: 'ups', sym: 'ups', name: 'UPS', sub: 'N / N+1 / 2N', refs: [
      { body: 'Uptime', role: 'governs', code: 'Capacity components',
        text: 'Tier II adds redundant capacity components (N+1); Tier III/IV add redundant distribution paths.',
        tool: ['ltc-uptime-tier-alignment.html#availability', 'Series / parallel availability'] },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2 · PUE1',
        text: 'Category 1 PUE takes IT energy at the UPS output — the coarsest of the three categories.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compare PUE categories'] } ] },
    { id: 'pdu', sym: 'pdu', name: 'PDU / RPP', sub: 'rack feeds A + B', refs: [
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2 · PUE2',
        text: 'Category 2 PUE takes IT energy at the PDU output, so transformer and PDU losses move to the overhead side.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compare PUE categories'] },
      { body: 'NFPA', role: 'governs', code: 'NFPA 70 Art. 645 / NFPA 75',
        text: 'Where an IT room is designed under Article 645, a remote disconnecting means (EPO) for the room’s IT power and HVAC is required.',
        tool: ['ltc-nfpa-fire-risk.html#sequence', 'Fire sequence'] } ] },
    { id: 'racks', sym: 'rack', name: 'IT racks', sub: 'cold plates + air', focal: true, refs: [
      { body: 'ASHRAE', role: 'governs', code: 'TC 9.9 Thermal Guidelines',
        text: 'Server inlet air is the control point. Recommended envelope 18–27 °C for classes A1–A4; allowable limits depend on class.',
        tool: ['ltc-ashrae-thermal-control.html#envelope', 'Check an inlet condition'] },
      { body: 'TIA', role: 'governs', code: 'TIA-942-B · EDA',
        text: 'Equipment distribution area: where horizontal cabling terminates at the racks.',
        tool: ['ltc-ansi-tia-topology-readiness.html#spaces', 'Spaces & cabling'] },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-2 · PUE3',
        text: 'Category 3 PUE takes IT energy at the IT equipment input — the most accurate category.' } ] },
    { id: 'cdu', sym: 'cdu', name: 'CDU', sub: 'liquid-to-liquid', refs: [
      { body: 'ASHRAE', role: 'governs', code: 'TC 9.9 liquid cooling classes',
        text: 'Facility water is classed W17, W27, W32, W40, W45 or W+ by its maximum supply temperature.',
        tool: ['ltc-ashrae-thermal-control.html#liquid', 'Classify a supply temperature'] },
      { body: 'ASHRAE', role: 'references', code: 'Loop sizing',
        text: 'Flow, ΔT, pump power and PUE for the whole chain are computed in the system model.',
        tool: ['ltc-system-modelling-lab.html', 'Open the model'] } ] },
    { id: 'reject', sym: 'dryCooler', name: 'Heat rejection', sub: 'dry coolers', refs: [
      { body: 'ASHRAE', role: 'governs', code: 'Standard 90.4',
        text: 'Energy standard for data centers: compliance via the mechanical load component (MLC) and the electrical loss component (ELC).' },
      { body: 'ISO/IEC', role: 'measures', code: 'ISO/IEC 30134-9 · WUE',
        text: 'Site water use per unit of IT energy (L/kWh). Dry heat rejection drives it toward zero.',
        tool: ['ltc-iso-energy-governance.html#kpi', 'Compute WUE'] } ] },
    { id: 'fire', sym: 'aspirating', name: 'Fire protection', sub: 'detect · suppress', refs: [
      { body: 'NFPA', role: 'governs', code: 'NFPA 75 / 76',
        text: 'Fire protection of IT equipment rooms (75) and telecommunications facilities (76).' },
      { body: 'NFPA', role: 'governs', code: 'NFPA 72',
        text: 'Detection and signalling: detector spacing, aspirating sensitivity, alarm sequence.',
        tool: ['ltc-nfpa-fire-risk.html#detection', 'Detector count'] },
      { body: 'NFPA', role: 'governs', code: 'NFPA 2001',
        text: 'Clean-agent systems: agent quantity from room volume, design concentration and temperature.',
        tool: ['ltc-nfpa-fire-risk.html#agent', 'Size the agent'] },
      { body: 'TIA', role: 'references', code: 'TIA-942-B annex',
        text: 'Rated facilities reference suppression type alongside power and cooling redundancy.' } ] }
  ];
  var BY_ID = {};
  SYSTEMS.forEach(function (s) { BY_ID[s.id] = s; });

  /* ---- figure ------------------------------------------------------------ */
  /* power and heat are always moving in a running plant: animate those
   * connectors; the dotted monitoring link stays still */
  function flowing(d) {
    var edge0 = d.edge;
    d.edge = function (a, b, o) {
      o = o || {};
      if (o.pattern !== 'dotted' && !o.state) o.state = 'flow';
      return edge0(a, b, o);
    };
    return d;
  }
  var GAP = 40;
  function build(D, o) {
    var d = flowing(D.create({
      slug: 'ltcmap', width: 1200, height: 600,
      title: 'Liquid-to-chip plant — standards map',
      desc: 'Power flows from the utility and engine generators through switchgear, UPS and PDUs to the IT racks; ' +
            'heat leaves the racks through the CDU to dry coolers; fire protection watches the IT space. ' +
            'Each block opens the standards that govern it.'
    }));
    var box = {};
    function n(id, x, y, extra) {
      var s = BY_ID[id];
      box[id] = d.node(x, y, Object.assign({
        id: id, name: s.name, sublabel: s.sub, symbol: s.sym, interactive: true,
        focal: !!s.focal, tier: s.focal ? 1 : 2, fill: s.focal ? 'paper-2' : 'paper',
        legend: s.focal ? 'IT load — the control point' : 'Plant equipment'
      }, extra || {}));
      return box[id];
    }
    function right(b) { return b.x + b.w + GAP; }
    function e(a, b, side, o2) {
      var A = box[a], B = box[b];
      var p1, p2;
      if (side === 'h') {
        p1 = { x: A.x + A.w, y: A.y + A.h / 2 }; p2 = { x: B.x, y: B.y + B.h / 2 };
      } else {
        p1 = { x: A.x + A.w / 2, y: A.y + A.h }; p2 = { x: B.x + B.w / 2, y: B.y };
      }
      d.edge(p1, p2, Object.assign({ fromId: a, toId: b }, o2 || {}));
    }

    if (!o.narrow) {
      var y0 = 24;
      n('utility', 24, y0);
      n('swgr', right(box.utility), y0);
      n('ups', right(box.swgr), y0);
      n('pdu', right(box.ups), y0);
      n('racks', right(box.pdu) + 8, y0, { h: 232 });
      n('genset', 24, y0 + 140);
      n('cdu', box.pdu.x, y0 + 140);
      n('reject', box.cdu.x - 40 - 132, y0 + 140, { w: 132 });
      n('fire', box.racks.x, y0 + 280);
      e('utility', 'swgr', 'h', { tier: 1, stroke: 'ink', legend: 'Power' });
      d.edge({ x: box.genset.x + box.genset.w, y: box.genset.y + box.genset.h / 2 },
             { x: box.swgr.x + box.swgr.w / 2, y: box.swgr.y + box.swgr.h },
             { fromId: 'genset', toId: 'swgr', tier: 1, stroke: 'ink' });
      e('swgr', 'ups', 'h', { tier: 1, stroke: 'ink' });
      e('ups', 'pdu', 'h', { tier: 1, stroke: 'ink' });
      d.edge({ x: box.pdu.x + box.pdu.w, y: box.pdu.y + box.pdu.h / 2 },
             { x: box.racks.x, y: box.pdu.y + box.pdu.h / 2 }, { fromId: 'pdu', toId: 'racks', tier: 1, stroke: 'ink' });
      d.edge({ x: box.racks.x, y: box.cdu.y + box.cdu.h / 2 },
             { x: box.cdu.x + box.cdu.w, y: box.cdu.y + box.cdu.h / 2 },
             { fromId: 'racks', toId: 'cdu', pattern: 'dashed', stroke: 'link', legend: 'Heat (liquid)' });
      d.edge({ x: box.cdu.x, y: box.cdu.y + box.cdu.h / 2 },
             { x: box.reject.x + box.reject.w, y: box.reject.y + box.reject.h / 2 },
             { fromId: 'cdu', toId: 'reject', pattern: 'dashed', stroke: 'link' });
      d.edge({ x: box.fire.x + box.fire.w / 2, y: box.fire.y },
             { x: box.fire.x + box.fire.w / 2, y: box.racks.y + box.racks.h },
             { fromId: 'fire', toId: 'racks', pattern: 'dotted', stroke: 'soft', legend: 'Monitors' });
    } else {
      /* narrow pane: two columns, power down the left, heat and fire on the right */
      var x0 = 16, y = 16, ROWG = 32;
      n('utility', x0, y);
      n('genset', right(box.utility) - 8, y);
      y += box.utility.h + ROWG; n('swgr', x0, y);
      y += box.swgr.h + ROWG; n('ups', x0, y);
      y += box.ups.h + ROWG; n('pdu', x0, y);
      y += box.pdu.h + ROWG; n('racks', x0, y, { w: Math.max(box.pdu.w, 140) });
      n('cdu', box.genset.x, box.ups.y);
      n('reject', box.genset.x, box.swgr.y);
      n('fire', box.genset.x, box.racks.y);
      /* two feeders land on the switchgear's top edge: fan them (rule 4) */
      var top = d.ports(box.swgr, 2, 'top', { id: 'swgr' });
      d.edge({ x: top[0].x, y: box.utility.y + box.utility.h }, top[0],
             { fromId: 'utility', toId: 'swgr', tier: 1, stroke: 'ink', legend: 'Power' });
      d.edge({ x: box.genset.x, y: box.genset.y + box.genset.h / 2 }, top[1],
             { fromId: 'genset', toId: 'swgr', tier: 1, stroke: 'ink' });
      e('swgr', 'ups', 'v', { tier: 1, stroke: 'ink' });
      e('ups', 'pdu', 'v', { tier: 1, stroke: 'ink' });
      e('pdu', 'racks', 'v', { tier: 1, stroke: 'ink' });
      d.edge({ x: box.racks.x + box.racks.w, y: box.racks.y + 16 },
             { x: box.cdu.x + box.cdu.w / 2, y: box.cdu.y + box.cdu.h },
             { fromId: 'racks', toId: 'cdu', pattern: 'dashed', stroke: 'link', legend: 'Heat (liquid)' });
      d.edge({ x: box.cdu.x + box.cdu.w / 2, y: box.cdu.y },
             { x: box.reject.x + box.reject.w / 2, y: box.reject.y + box.reject.h },
             { fromId: 'cdu', toId: 'reject', pattern: 'dashed', stroke: 'link' });
      d.edge({ x: box.fire.x, y: box.fire.y + box.fire.h / 2 },
             { x: box.racks.x + box.racks.w, y: box.fire.y + box.fire.h / 2 },
             { fromId: 'fire', toId: 'racks', pattern: 'dotted', stroke: 'soft', legend: 'Monitors' });
    }
    d.legend();
    return d;
  }

  /* ---- inspector --------------------------------------------------------- */
  var ROLE_WORD = { governs: 'Governs', measures: 'Measures', references: 'Context' };
  function open(id) {
    var s = BY_ID[id];
    if (!s) return;
    if (fig) {
      SYSTEMS.forEach(function (x) { fig.mark(x.id, x.id === id ? 'selected' : null); });
    }
    var html = '<ul class="ltc-refs">' + s.refs.map(function (r) {
      return '<li><code>' + L.esc(r.body + ' · ' + r.code) + '</code> <span class="ltc-chip">' +
        ROLE_WORD[r.role] + '</span><p>' + L.esc(r.text) + '</p>' +
        (r.tool ? '<a href="' + r.tool[0] + '">' + L.esc(r.tool[1]) + ' →</a>' : '') + '</li>';
    }).join('') + '</ul>';
    L.inspect({ sym: s.sym, eyebrow: 'Plant block', title: s.name, html: html });
  }

  /* ---- coverage matrix --------------------------------------------------- */
  function matrix() {
    var host = document.getElementById('ltcMatrix');
    if (!host) return;
    var mark = { governs: '● governs', measures: '◐ measures', references: '○ context' };
    var h = '<table class="ltc-table"><thead><tr><th>Plant block</th>' +
      BODIES.map(function (b) { return '<th>' + b + '</th>'; }).join('') + '</tr></thead><tbody>';
    SYSTEMS.forEach(function (s) {
      h += '<tr><td><button class="ltc-btn" type="button" data-open="' + s.id + '" style="min-height:28px;text-transform:none;letter-spacing:0">' +
        L.sym(s.sym, 18) + L.esc(s.name) + '</button></td>';
      BODIES.forEach(function (b) {
        var rs = s.refs.filter(function (r) { return r.body === b; });
        var best = rs.some(function (r) { return r.role === 'governs'; }) ? 'governs'
          : rs.some(function (r) { return r.role === 'measures'; }) ? 'measures'
          : rs.length ? 'references' : '';
        h += '<td class="mono" style="font-size:12px;color:var(' + (best === 'governs' ? '--t1' : '--t3') + ')">' +
          (best ? mark[best] : '') + '</td>';
      });
      h += '</tr>';
    });
    host.innerHTML = h + '</tbody></table>';
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]');
      if (b) open(b.getAttribute('data-open'));
    });
  }

  /* ---- lifecycle: commissioning levels and the tests standards ask for ----- */
  var LIFE = [
    { id: 'l1', name: 'L1 · Factory', sub: 'FAT at the vendor', sym: 'ups', tests: [
      ['Vendor', 'Factory acceptance of UPS, switchgear, generators, chillers, CDUs against the submittal'],
      ['NFPA 2001', 'Listed agent containers and valves arrive with their listing; quantities checked against the design'] ] },
    { id: 'l2', name: 'L2 · Delivered', sub: 'site acceptance', sym: 'switchgear', tests: [
      ['Site', 'Receipt inspection: nameplates, ratings, damage, documentation'],
      ['TIA-568', 'Installed cabling certified: copper permanent links and fiber links tested (Tier 1 loss, Tier 2 OTDR where specified)'] ] },
    { id: 'l3', name: 'L3 · Started', sub: 'install + start-up', sym: 'pump', tests: [
      ['Vendor', 'Start-up of each unit by the manufacturer; settings recorded'],
      ['NFPA 72', 'Detection devices installed and tested; aspirating transport time verified'] ] },
    { id: 'l4', name: 'L4 · Functional', sub: 'each system, all modes', sym: 'cdu', focal: true, tests: [
      ['NFPA 72', 'Acceptance testing of the fire alarm system and its interfaces'],
      ['NFPA 2001', 'Enclosure integrity (door-fan) test proves the hold time; release sequence verified without discharge'],
      ['ASHRAE', 'Cooling sequences verified at load; rack inlet and facility-water supply inside the design envelope'] ] },
    { id: 'l5', name: 'L5 · Integrated', sub: 'IST · load banks', sym: 'rack', tests: [
      ['Uptime', 'Tier Certification of Constructed Facility demonstrates maintainability (and fault tolerance for IV) under load'],
      ['Site', 'Utility failure, generator transfer, UPS and cooling failover with load banks at design IT load'] ] },
    { id: 'ops', name: 'Operate', sub: 'measure · improve', sym: 'meter', tests: [
      ['ISO/IEC 30134', '12 months of PUE, WUE, CUE at a stated category'],
      ['ISO 50001', 'Certification: stage 1 and 2 audits, annual surveillance, recertification in year 3'],
      ['Uptime', 'Operational Sustainability (staffing, maintenance, management) assessed separately from topology'] ] }
  ];
  var LBY = {}; LIFE.forEach(function (x) { LBY[x.id] = x; });
  function lifeBuild(D, o) {
    var d = flowing(D.create({ slug: 'ltclife', title: 'Commissioning levels to operation',
      desc: 'Factory, delivery, start-up, functional and integrated systems testing, then operation; each level opens the tests the standards ask for there.' }));
    var x = 16, y = 16, G = o.narrow ? 28 : 36, prev = null, box = {};
    LIFE.forEach(function (s, i) {
      /* snake: the second row runs right to left, so L3 drops straight onto L4 */
      if (!o.narrow && i === 3) { x = box.l3.x; y = box.l1.y + box.l1.h + 56; }
      box[s.id] = d.node(x, y, { id: s.id, name: s.name, sublabel: s.sub, symbol: s.sym, interactive: true, focal: !!s.focal,
        fill: s.focal ? 'paper-2' : 'paper', tier: s.focal ? 1 : 2, w: 152, legend: s.focal ? 'Where most defects surface' : 'Stage' });
      if (prev) {
        var A = box[prev], B = box[s.id];
        if (o.narrow) d.edge({ x: A.x + A.w / 2, y: A.y + A.h }, { x: B.x + B.w / 2, y: B.y }, { fromId: prev, toId: s.id, legend: i === 1 ? 'Gate to next stage' : undefined });
        else if (B.y === A.y && B.x > A.x) d.edge({ x: A.x + A.w, y: A.y + A.h / 2 }, { x: B.x, y: B.y + B.h / 2 }, { fromId: prev, toId: s.id, legend: i === 1 ? 'Gate to next stage' : undefined });
        else if (B.y === A.y) d.edge({ x: A.x, y: A.y + A.h / 2 }, { x: B.x + B.w, y: B.y + B.h / 2 }, { fromId: prev, toId: s.id });
        else d.edge({ x: A.x + A.w / 2, y: A.y + A.h }, { x: B.x + B.w / 2, y: B.y }, { fromId: prev, toId: s.id });
      }
      if (o.narrow) y = box[s.id].y + box[s.id].h + G; else if (i < 3) x = box[s.id].x + box[s.id].w + G; else x = box[s.id].x - G - 152;
      prev = s.id;
    });
    d.legend();
    return d;
  }
  function openLife(id) {
    var s = LBY[id]; if (!s) return;
    if (lifeFig) LIFE.forEach(function (x) { lifeFig.mark(x.id, x.id === id ? 'selected' : null); });
    L.inspect({ sym: s.sym, eyebrow: 'Commissioning', title: s.name, html: '<ul class="ltc-refs">' + s.tests.map(function (t) {
      return '<li><code>' + L.esc(t[0]) + '</code><p>' + L.esc(t[1]) + '</p></li>'; }).join('') + '</ul>' });
  }
  var lifeFig = null;

  var fig = null;
  function boot() {
    L.init({ module: 'hub' });
    fig = L.draw(document.getElementById('ltcMap'), build, open);
    lifeFig = L.draw(document.getElementById('ltcLife'), lifeBuild, openLife);
    matrix();
    /* the inspector is a persistent column only on wide screens; elsewhere it is a
     * drawer, and opening a drawer nobody asked for hides the plant */
    if (window.matchMedia('(min-width: 1280px)').matches) open('racks');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
