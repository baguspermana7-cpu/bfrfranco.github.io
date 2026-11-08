/* rz-cx-tree.js — the commissioning program as a five-deep tree (owner K28, 2026-11-08).
 *
 *   RZCxTree.programTree(input, overrides) -> { levels: [node L0..L6], totals, basis, sources }
 *
 * Depth: level (L0..L6) -> system -> subsystem -> equipment type -> activity. Every node carries
 *   { id, path, kind, label, qty?, share, cost, manHours, laborDays, start, finish, months, crew, children }
 * and the numbers are allocations of RZEngine.models.commissioning.programPlan(input, overrides.plan):
 *   - a level node equals programPlan().levels[i] exactly (cost, manHours, start, finish);
 *   - every parent's cost and man-hours equal the sum of its children EXACTLY (integer largest-remainder split);
 *   - laborDays split the same way on hundredths of a day;
 *   - a parent's start = earliest child start, finish = latest child finish.
 * Editing only a level (overrides.plan, the existing programPlan contract) moves every descendant with it.
 * Editing a node (overrides.nodes[path] = { weight, exclude }) re-shares its siblings; the parent total holds.
 *
 * Shares, per level (each rule cited in SOURCES):
 *   L0  system weight = handbook L2+L3+L4 planning days (review effort follows system complexity)
 *   L1  system weight = units factory-tested (FAT is per unit, "unit-count-driven"); only FAT equipment appears
 *   L2-L4 system weight = handbook planning days of that level for that system (02.4.8)
 *   L5  system weight = handbook L4 days (integration depth)
 *   L6  system weight = assets handed over (O&M, as-builts and CMMS load are per asset)
 *   subsystem/equipment inside a system: by unit count of that level's equipment
 *   activity inside equipment: the level's sub-activities that apply to the equipment's discipline, by their w
 * Timing: systems and equipment work in parallel inside the level window. The level's activities run on the
 * handbook dependency chain, stretched so the critical path fills the window exactly; an equipment row keeps the
 * absolute windows of the activities that apply to it (a chiller's start-up still waits for electrical start-up).
 * Crew on a node = its labour days / (its months x workDaysPerMonth) / shift productivity, the programPlan formula.
 *
 * ES5, no dependencies besides RZEngine (window or globalThis). Dual target: window.RZCxTree / module.exports. */
(function (root) {
  'use strict';

  var HB = 'cx-handbook/02-commissioning-process-levels-roles.html';
  var SOURCES = {
    days: HB + '#s02-4-8 (planning days per system, MSC-1 hall values; same table as js/rz-cx-plan.js SYSTEMS)',
    qty: 'rz-engine.js models.commissioning.equipScale (unit counts from IT load and rack density)',
    activities: 'rz-engine.js DATA.commissioning.cx.rich.subActivities (ASHRAE Guideline 0 / BCxA practice; w and dep)',
    plan: 'rz-engine.js models.commissioning.programPlan (level cost, man-hours, window, crew, shift)',
    fat: 'rz-engine.js subActivities.l1 basis "Per-unit FATs at OEM works — unit-count-driven"',
    assets: 'rz-engine.js subActivities.l6 basis "O&M, as-builts & CMMS load — asset register"',
    bmsPoints: 'rz-engine.js DATA.commissioning.cx.rich.bms[bmsComplexity].pts',
    liquid: 'screening: CDUs and rack manifolds exist only for liquid cooling (dlc, immersion); their count = equipScale cooling_units',
    dryCooler: 'screening: one dry cooler per chiller (no separate count in equipScale)',
    dcim: 'screening: two DCIM servers per site'
  };

  /* Discipline of each sub-activity (by its own name and basis text); 'all' applies to every equipment. */
  var ACT_DISCIPLINE = {
    'Electrical system startups': 'electrical', 'Mechanical system startups': 'mechanical',
    'Controls point-to-point': 'controls', 'Power-path integration tests': 'electrical',
    'Cooling-chain integration tests': 'mechanical'
  };

  /* Catalog. days = handbook 02.4.8 (l2,l3,l4). eq.key = equipScale field; eq.fat = factory-tested (L1);
   * eq.points = BMS point count; eq.fixed = fixed count; when = 'liquid' | 'air'. */
  var SYSTEMS = [
    { id: 'hv_intake', label: 'Utility 150 kV intake', block: 'electrical', days: { l2: 10, l3: 5, l4: 3 }, subs: [
      { id: 'bays', label: 'HV switchgear bays', eq: [{ id: 'hv_bay', label: '150 kV bay', key: 'switchgear', fat: true }] },
      { id: 'protection', label: 'Protection and metering', eq: [{ id: 'relay_panel', label: 'Protection relay panel', key: 'switchgear' }] }] },
    { id: 'main_tx', label: '150/20 kV main transformers', block: 'electrical', days: { l2: 10, l3: 5, l4: 3 }, subs: [
      { id: 'transformers', label: 'Power transformers', eq: [{ id: 'main_tx', label: '150/20 kV transformer', key: 'transformers', fat: true }] },
      { id: 'auxiliaries', label: 'Tap changer and cooling controls', eq: [{ id: 'tx_aux', label: 'OLTC and cooling panel', key: 'transformers' }] }] },
    { id: 'mv_board', label: '20 kV boards and feeders', block: 'electrical', days: { l2: 10, l3: 5, l4: 3 }, subs: [
      { id: 'switchboards', label: '20 kV switchboards', eq: [{ id: 'mv_switchboard', label: '20 kV switchboard', key: 'switchgear', fat: true }] },
      { id: 'feeders', label: 'Feeders', eq: [{ id: 'mv_feeder', label: '20 kV feeder', key: 'lvsb' }] }] },
    { id: 'generators', label: 'Generators and paralleling', block: 'electrical', days: { l2: 2, l3: 1, l4: 3 }, subs: [
      { id: 'gensets', label: 'Generator sets', eq: [{ id: 'genset', label: 'Generator set', key: 'generators', fat: true }] },
      { id: 'transfer', label: 'Paralleling and transfer', eq: [{ id: 'ats', label: 'Transfer switch', key: 'ats' }] },
      { id: 'fuel', label: 'Fuel system', eq: [{ id: 'day_tank', label: 'Day tank and transfer pump', key: 'generators' }] }] },
    { id: 'unit_subs', label: '20/0.4 kV unit substations', block: 'electrical', days: { l2: 10, l3: 5, l4: 3 }, subs: [
      { id: 'unit_tx', label: 'Unit transformers', eq: [{ id: 'unit_tx', label: '20/0.4 kV transformer', key: 'lvsb', fat: true }] }] },
    { id: 'ups', label: 'UPS and batteries', block: 'electrical', days: { l2: 2, l3: 1, l4: 2 }, subs: [
      { id: 'modules', label: 'UPS modules', eq: [{ id: 'ups_module', label: 'UPS module', key: 'ups_modules', fat: true }] },
      { id: 'batteries', label: 'Battery strings', eq: [{ id: 'battery_string', label: 'Battery string', key: 'ups_modules' }] },
      { id: 'sts', label: 'Static transfer switches', eq: [{ id: 'sts', label: 'Static transfer switch', key: 'sts' }] }] },
    { id: 'lv_busway', label: 'LV switchboards, PDU and busway', block: 'electrical', days: { l2: 10, l3: 5, l4: 3 }, subs: [
      { id: 'switchboards', label: 'LV switchboards', eq: [{ id: 'lv_switchboard', label: 'LV switchboard', key: 'lvsb', fat: true }] },
      { id: 'busway', label: 'Busway', eq: [{ id: 'busway_run', label: 'Busway run', key: 'busway' }] },
      { id: 'distribution', label: 'PDUs and RPPs', eq: [{ id: 'pdu', label: 'PDU', key: 'pdus' }, { id: 'rpp', label: 'Remote power panel', key: 'rpp' }] },
      { id: 'boards', label: 'Distribution boards', eq: [{ id: 'db', label: 'Distribution board', key: 'db' }] }] },
    { id: 'chillers', label: 'Chillers', block: 'mechanical', days: { l2: 5, l3: 3, l4: 3 }, subs: [
      { id: 'chillers', label: 'Chillers', eq: [{ id: 'chiller', label: 'Chiller', key: 'chillers', fat: true }] }] },
    { id: 'dry_coolers', label: 'Dry coolers', block: 'mechanical', days: { l2: 5, l3: 3, l4: 3 }, subs: [
      { id: 'dry_coolers', label: 'Dry coolers', eq: [{ id: 'dry_cooler', label: 'Dry cooler', key: 'chillers', src: 'dryCooler' }] }] },
    { id: 'fws', label: 'FWS pumps, manifold and treatment', block: 'mechanical', days: { l2: 5, l3: 3, l4: 3 }, subs: [
      { id: 'pumps', label: 'Pumps and drives', eq: [{ id: 'pump', label: 'Pump', key: 'pumps' }, { id: 'vfd', label: 'Variable-frequency drive', key: 'vfd' }] },
      { id: 'sumps', label: 'Sumps and drainage', eq: [{ id: 'sump_pump', label: 'Sump pump', key: 'sumpPumps' }] }] },
    { id: 'cdu', label: 'CDUs', block: 'mechanical', days: { l2: 5, l3: 5, l4: 4 }, when: 'liquid', subs: [
      { id: 'cdus', label: 'Coolant distribution units', eq: [{ id: 'cdu', label: 'CDU', key: 'cooling_units', fat: true, src: 'liquid' }] }] },
    { id: 'crah', label: 'CRAH and fan walls', block: 'mechanical', days: { l2: 5, l3: 5, l4: 3 }, subs: [
      { id: 'terminals', label: 'CRAH, in-row and RDHx units', when: 'air', eq: [{ id: 'cooling_unit', label: 'Cooling unit', key: 'cooling_units', fat: true }] },
      { id: 'ahus', label: 'Air handling units', eq: [{ id: 'ahu', label: 'AHU', key: 'ahu' }] }] },
    { id: 'racks', label: 'Racks and TCS manifolds', block: 'mechanical', days: { l2: 5, l3: 5, l4: 4 }, subs: [
      { id: 'racks', label: 'Racks', eq: [{ id: 'rack', label: 'Rack', key: 'racks' }] },
      { id: 'manifolds', label: 'TCS manifolds', when: 'liquid', eq: [{ id: 'rack_manifold', label: 'Rack manifold', key: 'racks', src: 'liquid' }] }] },
    { id: 'fire', label: 'Fire detection and suppression', block: 'controls', days: { l2: 10, l3: 5, l4: 5 }, subs: [
      { id: 'zones', label: 'Detection and suppression zones', eq: [{ id: 'fire_zone', label: 'Fire zone', key: 'fireZones' }] },
      { id: 'pumps', label: 'Fire pumps', eq: [{ id: 'fire_pump', label: 'Fire pump', key: 'firePumps', fat: true }] }] },
    { id: 'bms', label: 'BMS', block: 'controls', days: { l2: 7.5, l3: 12.5, l4: 12.5 }, subs: [
      { id: 'controllers', label: 'Controllers and MCCs', eq: [{ id: 'mcc', label: 'MCC / controller panel', key: 'mcc' }] },
      { id: 'points', label: 'Field points', eq: [{ id: 'bms_point', label: 'BMS point', points: true }] }] },
    { id: 'epms', label: 'EPMS / PME', block: 'controls', days: { l2: 5, l3: 10, l4: 5 }, subs: [
      { id: 'meters', label: 'Power meters', eq: [{ id: 'pdu_meter', label: 'Metered PDU', key: 'pdus' }, { id: 'board_meter', label: 'Switchboard meter', key: 'lvsb' }] }] },
    { id: 'ot_network', label: 'OT network and DCIM', block: 'controls', days: { l2: 5, l3: 10, l4: 5 }, subs: [
      { id: 'dcim', label: 'DCIM servers', eq: [{ id: 'dcim_server', label: 'DCIM server', fixed: 2, src: 'dcim' }] },
      { id: 'security', label: 'Access control and CCTV on the OT network', eq: [{ id: 'access_door', label: 'Access door', key: 'accessDoors' }, { id: 'camera', label: 'Camera', key: 'cameras' }] },
      { id: 'lighting', label: 'Lighting control', eq: [{ id: 'light_zone', label: 'Lighting zone', key: 'lightZones' }, { id: 'emergency_light', label: 'Emergency light', key: 'emergLights' }] }] }
  ];
  var LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
  var LIQUID = { dlc: 1, immersion: 1, liquid: 1 };

  /* ── small exact helpers ─────────────────────────────────────────────────────────────────────── */
  /* Split an integer total over weights so the parts are integers that sum to the total exactly
   * (largest remainder; ties go to the earlier item, so the result is deterministic). */
  function split(total, weights) {
    var n = weights.length, sum = 0, i, out = [], rem = [], used = 0;
    for (i = 0; i < n; i++) sum += weights[i];
    if (!(sum > 0)) { for (i = 0; i < n; i++) out.push(0); if (n) out[0] = total; return out; }
    for (i = 0; i < n; i++) { var raw = total * weights[i] / sum, fl = Math.floor(raw); out.push(fl); rem.push({ i: i, r: raw - fl }); used += fl; }
    rem.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    for (var j = 0; used < total && j < rem.length; j++, used++) out[rem[j].i]++;
    return out;
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  function engine() { var E = root.RZEngine; return E && E.models && E.models.commissioning; }

  function sanitizeNodes(nodes) {
    var out = {};
    if (!nodes || typeof nodes !== 'object') return out;
    for (var k in nodes) {
      if (!Object.prototype.hasOwnProperty.call(nodes, k) || !/^L[0-6](\/[a-z0-9_]+){1,4}$/.test(k)) continue;
      var o = nodes[k], c = {};
      if (!o || typeof o !== 'object') continue;
      if (typeof o.weight === 'number' && isFinite(o.weight) && o.weight >= 0 && o.weight <= 100) c.weight = o.weight;
      if (o.exclude === true) c.exclude = true;
      if (c.weight != null || c.exclude) out[k] = c;
    }
    return out;
  }

  /* Quantity of one equipment type for this site, or 0 when it does not exist here. */
  function qtyOf(eq, equip, inp, R) {
    if (eq.points) { var b = R.bms[inp.bmsComplexity] || R.bms.standard; return b.pts; }
    if (eq.fixed != null) return eq.fixed;
    var q = equip[eq.key]; return typeof q === 'number' && q > 0 ? q : 0;
  }
  function present(item, liquid) { return !item.when || (item.when === 'liquid' ? liquid : !liquid); }

  /* The level's activity timeline: fractions [s, f] of the window. Durations are w; a dependent activity starts
   * when its predecessor finishes; the chain is stretched so the latest finish is exactly 1. */
  function timeline(acts) {
    var at = {}, i, last = 0;
    for (i = 0; i < acts.length; i++) {
      var a = acts[i], s = a.dep && at[a.dep] ? at[a.dep].f : 0;
      at[a.n] = { s: s, f: s + a.w }; if (at[a.n].f > last) last = at[a.n].f;
    }
    for (i = 0; i < acts.length; i++) { at[acts[i].n].s /= last; at[acts[i].n].f /= last; }
    return at;
  }
  function actsFor(acts, block) {
    var out = [];
    for (var i = 0; i < acts.length; i++) { var d = ACT_DISCIPLINE[acts[i].n] || 'all'; if (d === 'all' || d === block) out.push(acts[i]); }
    return out;
  }

  /* Level-specific weight of a system and of its equipment rows. */
  function systemWeight(lid, sys, eqRows) {
    var lk = lid.toLowerCase(), q = 0, i;
    for (i = 0; i < eqRows.length; i++) q += eqRows[i].qty;
    if (!eqRows.length) return 0;
    if (lk === 'l0') return sys.days.l2 + sys.days.l3 + sys.days.l4;
    if (lk === 'l1' || lk === 'l6') return q;
    if (lk === 'l5') return sys.days.l4;
    return sys.days[lk] || 0;
  }

  /* Give children shares of the parent (cost, man-hours, labour days) and fill their numbers.
   * kids: [{ w, node }] in display order. */
  function share(parent, kids, nodeOv) {
    var w = [], i;
    for (i = 0; i < kids.length; i++) {
      var ov = nodeOv[kids[i].node.path];
      w.push(ov && ov.exclude ? 0 : kids[i].w * (ov && ov.weight != null ? ov.weight : 1));
    }
    var sum = 0; for (i = 0; i < w.length; i++) sum += w[i];
    var cost = split(parent.cost, w), mh = split(parent.manHours, w), ld = split(Math.round(parent.laborDays * 100), w);
    var out = [];
    for (i = 0; i < kids.length; i++) {
      if (!(w[i] > 0)) continue;
      var n = kids[i].node;
      n.share = sum > 0 ? +(w[i] / sum).toFixed(4) : 0;
      n.cost = cost[i]; n.manHours = mh[i]; n.laborDays = ld[i] / 100;
      out.push(n);
    }
    return out;
  }
  function crewOf(laborDays, months, P, prod) { return months > 0 ? +(laborDays / (months * P.workDaysPerMonth) / prod).toFixed(2) : 0; }
  function setWindow(node, s, f) { node.start = r2(s); node.finish = r2(f); node.months = r2(f - s); }
  function rollWindow(node) {
    var s = Infinity, f = -Infinity;
    for (var i = 0; i < node.children.length; i++) { s = Math.min(s, node.children[i].start); f = Math.max(f, node.children[i].finish); }
    if (node.children.length) setWindow(node, s, f);
  }

  function programTree(input, overrides) {
    overrides = overrides || {};
    var C = engine();
    if (!C || typeof C.programPlan !== 'function') return null;
    var plan = C.programPlan(input, overrides.plan || {});
    var R = root.RZEngine.DATA ? root.RZEngine.DATA.commissioning.cx.rich : C._rich();
    var P = R.plan, inp = plan.input, equip = C.equipScale(inp), liquid = !!LIQUID[inp.coolingType];
    var nodeOv = sanitizeNodes(overrides.nodes);
    var levels = [];

    for (var li = 0; li < plan.levels.length; li++) {
      var PL = plan.levels[li], lid = PL.id, lk = lid.toLowerCase();
      var prod = (P.shifts[PL.shift] || P.shifts['1x8']).productivity;
      var acts = R.subActivities[lk] || [];
      var tl = timeline(acts), span = PL.end - PL.start;
      var L = { id: lid, path: lid, kind: 'level', label: PL.label, share: 1, cost: PL.cost, manHours: PL.manHours,
                laborDays: PL.laborDays, crew: PL.crewNeeded, shift: PL.shift, children: [] };
      setWindow(L, PL.start, PL.end);

      /* systems with the equipment rows that exist at this site and at this level */
      var sysKids = [];
      for (var si = 0; si < SYSTEMS.length; si++) {
        var S = SYSTEMS[si];
        if (!present(S, liquid)) continue;
        var subKids = [], allEq = [];
        for (var bi = 0; bi < S.subs.length; bi++) {
          var B = S.subs[bi];
          if (!present(B, liquid)) continue;
          var eqKids = [];
          for (var ei = 0; ei < B.eq.length; ei++) {
            var E = B.eq[ei];
            if (lk === 'l1' && !E.fat) continue;
            var q = qtyOf(E, equip, inp, R);
            if (!(q > 0)) continue;
            var en = { id: E.id, path: lid + '/' + S.id + '/' + B.id + '/' + E.id, kind: 'equipment', label: E.label, qty: q,
                       block: S.block, source: SOURCES[E.src || (E.points ? 'bmsPoints' : (E.fixed != null ? 'dcim' : 'qty'))], children: [] };
            eqKids.push({ w: q, node: en }); allEq.push({ qty: q });
          }
          if (!eqKids.length) continue;
          var bw = 0; for (var k = 0; k < eqKids.length; k++) bw += eqKids[k].w;
          subKids.push({ w: bw, node: { id: B.id, path: lid + '/' + S.id + '/' + B.id, kind: 'subsystem', label: B.label, children: [], _eq: eqKids } });
        }
        var sw = systemWeight(lid, S, allEq);
        if (!(sw > 0)) continue;
        sysKids.push({ w: sw, node: { id: S.id, path: lid + '/' + S.id, kind: 'system', label: S.label, block: S.block, children: [], _subs: subKids } });
      }

      L.children = share(L, sysKids, nodeOv);
      for (var a = 0; a < L.children.length; a++) {
        var SN = L.children[a];
        SN.children = share(SN, SN._subs, nodeOv); delete SN._subs;
        for (var b = 0; b < SN.children.length; b++) {
          var BN = SN.children[b];
          BN.children = share(BN, BN._eq, nodeOv); delete BN._eq;
          for (var c = 0; c < BN.children.length; c++) {
            var EN = BN.children[c], mine = actsFor(acts, SN.block), actKids = [];
            for (var d = 0; d < mine.length; d++) {
              var A = mine[d], an = { id: 'a' + acts.indexOf(A), path: EN.path + '/a' + acts.indexOf(A), kind: 'activity', label: A.n,
                                      basis: A.basis, dependsOn: A.dep || null, children: [] };
              setWindow(an, PL.start + tl[A.n].s * span, PL.start + tl[A.n].f * span);
              actKids.push({ w: A.w, node: an });
            }
            EN.children = share(EN, actKids, nodeOv);
            for (var e = 0; e < EN.children.length; e++) { var AN = EN.children[e]; AN.crew = crewOf(AN.laborDays, AN.months, P, prod); }
            rollWindow(EN); EN.crew = crewOf(EN.laborDays, EN.months, P, prod);
          }
          rollWindow(BN); BN.crew = crewOf(BN.laborDays, BN.months, P, prod);
        }
        rollWindow(SN); SN.crew = crewOf(SN.laborDays, SN.months, P, prod);
      }
      levels.push(L);
    }
    return {
      levels: levels,
      totals: { cost: plan.total, manHours: plan.manHours, finish: plan.finishMonth },
      site: { itLoad: inp.itLoad, coolingType: inp.coolingType, liquid: liquid, equip: equip },
      depth: ['level', 'system', 'subsystem', 'equipment', 'activity'],
      plan: plan,
      basis: 'allocations of programPlan: level = programPlan level; children split cost and man-hours exactly ' +
             '(largest remainder) by handbook days (L2-L4), L2+L3+L4 days (L0), FAT unit count (L1), L4 days (L5), ' +
             'asset count (L6); equipment by unit count; activities by sub-activity w on the dependency chain; ' +
             'crew = labour days / (months x ' + P.workDaysPerMonth + ') / shift productivity',
      sources: SOURCES
    };
  }

  /* Walk a tree depth-first: fn(node, depth, parent). */
  function walk(nodes, fn, depth, parent) {
    depth = depth || 0;
    for (var i = 0; i < nodes.length; i++) { fn(nodes[i], depth, parent || null); walk(nodes[i].children || [], fn, depth + 1, nodes[i]); }
  }
  /* Find one node by path ("L3/chillers/chillers/chiller"). */
  function find(tree, path) {
    var hit = null;
    if (tree && tree.levels) walk(tree.levels, function (n) { if (n.path === path) hit = n; });
    return hit;
  }

  var API = { programTree: programTree, walk: walk, find: find, SYSTEMS: SYSTEMS, SOURCES: SOURCES, ACT_DISCIPLINE: ACT_DISCIPLINE, split: split, version: '1.0.0' };
  root.RZCxTree = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
