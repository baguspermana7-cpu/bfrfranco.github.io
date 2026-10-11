/* ltc-lab-plant.js — the model lab on the shared plant engine.
 *
 * Owner decision (v3.17.0): the lab's physical numbers come from js/ltc-plant.js — the engine
 * whose heat balance closes and every number of which traces — not from the lab's own model,
 * whose PUE carried heuristic multipliers (controlIndex, futureFactor, coef*) that no reader
 * could trace to a component. This adapter keeps the lab's output SCHEMA, so its dashboards,
 * charts and exports keep working, and replaces every physical field with the plant's value:
 *   itKw, liquidKw, airKw, capture, ΔT, flow, pump power, CDU count, PUE (annual), COP, WUE,
 *   annual energy, energy/water cost, carbon, facility kW, the cooling breakdown.
 * The lab's screening layer — design scores, risk index, confidence, density gap — is still the
 * lab model's, labelled as screening. "Legacy screening model" (lab toggle) returns the old model
 * unchanged, for comparison; it is off by default.
 *
 * Inputs flow both ways: the lab's six primary sliders and its site fields write the shared plant
 * (so the strip and every workbench page follow), and a plant edited elsewhere moves the lab.
 */
(function (root) {
  'use strict';
  var P = root.LTCPlant;
  if (!P) return;

  var CLIMATE = { tropical: 'tropical', temperate: 'temperate', dry: 'arid', continental: 'temperate' };
  var CAPTURE_CAP = { direct_liquid: 98, hybrid: 75, air_inrow_dahu: 0 };

  /* lab input → plant input; only what the lab actually owns */
  function toPlant(li) {
    var o = {};
    if (isFinite(li.itLoadMw)) o.itMw = +li.itLoadMw;
    if (isFinite(li.liquidCapture)) o.capturePct = Math.min(+li.liquidCapture, CAPTURE_CAP[li.architectureMode] != null ? CAPTURE_CAP[li.architectureMode] : 98);
    if (isFinite(li.supplyTemp)) o.tcsSupplyC = +li.supplyTemp;
    if (isFinite(li.returnTemp)) o.tcsReturnC = Math.max(+li.returnTemp, (+li.supplyTemp || 0) + 3);
    if (isFinite(li.pumpHead)) o.tcsHeadM = +li.pumpHead;
    if (isFinite(li.pumpEff)) o.tcsPumpEff = Math.max(0.3, +li.pumpEff / 100);
    if (isFinite(li.cduUnit)) o.cduUnitKw = +li.cduUnit;
    if (li.redundancy) o.cduRedundancy = li.redundancy === 'N' ? 0 : li.redundancy === '2N' ? 99 : 1;   // 99 = resolved to N after sizing
    if (isFinite(li.upsEff)) o.upsEff = Math.min(0.995, +li.upsEff / 100);
    if (isFinite(li.distLoss)) o.distLossPct = +li.distLoss;
    if (isFinite(li.rackDensityTarget)) o.rackKw = +li.rackDensityTarget;
    // the lab's climate select speaks only when the reader changed it: a plant on a custom (pasted EPW)
    // climate must not be relabelled 'tropical' by a select that cannot show 'custom'
    if (li.climate && CLIMATE[li.climate] && li.climate !== pulledClimate) o.climate = CLIMATE[li.climate];
    if (isFinite(li.elecPrice)) o.elecPrice = +li.elecPrice;
    if (isFinite(li.waterTariff)) o.waterTariff = +li.waterTariff;
    if (isFinite(li.carbonIntensity)) o.gridEfKgPerKwh = +li.carbonIntensity;
    if (isFinite(li.heatReuse)) o.heatReusePct = +li.heatReuse;
    return o;
  }

  var pulledClimate = null;
  function resolve2N(st) {          // 2N = a second full set: N spares, where N comes from the plant itself
    if (st.cduRedundancy !== 99) return st;
    var probe = Object.assign({}, st, { cduRedundancy: 1 });
    st.cduRedundancy = Math.max(2, P.compute(probe).liquid.cduDutyN);
    return st;
  }
  function compute(li, legacy) {
    // before the first pull the shared plant wins for the keys it has saved, so the very first
    // render already shows the plant chosen elsewhere
    // until the lab has read the shared plant, the plant is what it shows: one default source
    var base = pulled ? Object.assign({}, P.load(), toPlant(li)) : P.load();
    var r = P.compute(resolve2N(base));
    var A = r.annual, d = r.design, L = r.liquid, Ai = r.air, E = r.elec;
    var out = Object.assign({}, legacy || {});
    var coolingKw = L.fwsPumpKw + L.coolerFanKw + L.trimKwe + L.tcsPumpKw + Ai.chillerKwe + Ai.chwPumpKw + Ai.cwPumpKw + Ai.towerFanKw + Ai.fanKw + E.roomFanKw;
    var reuseKwh = A.reuseMWh * 1000, co2 = A.co2t, avoided = reuseKwh * r.input.gridEfKgPerKwh * 0.65 / 1000;
    Object.assign(out, {
      itKw: d.it, liquidKw: d.liquidIt, airKw: d.airIt, effectiveCapture: r.input.capturePct,
      deltaT: L.tcsDeltaK, flowLpm: L.tcsLps * 60, massFlowKgS: L.tcsLps * P.CONST.RHO_W / 1000,
      pumpPowerKw: L.tcsPumpKw + L.fwsPumpKw, cduCount: L.cduTotal,
      pue: r.totals.pueAnnual, pueDesign: r.totals.pue, systemCop: d.it / coolingKw, wue: A.wue,
      annualGwh: A.m0MWh / 1000, annualEnergyCost: A.energyCost, annualWaterCost: A.waterCost,
      annualOpex: A.energyCost + A.waterCost, heatReuseCredit: reuseKwh * r.input.elecPrice * 0.62,
      annualCarbonTons: co2, avoidedCarbonTons: avoided, netCarbonTons: Math.max(0, co2 - avoided),
      totalFacilityKw: d.facility, liquidCop: (L.coolerKw + L.trimKw) / Math.max(1, L.coolerFanKw + L.trimKwe + L.fwsPumpKw),
      airCopEff: Ai.chillerCop, elecPriceEff: r.input.elecPrice, carbonIntensityEff: r.input.gridEfKgPerKwh,
      rackDensity: r.it.hallKw / r.it.racksPerHall,
      breakdown: { it: d.it, liquidCooling: L.fwsPumpKw + L.coolerFanKw + L.trimKwe, airCooling: Ai.chillerKwe + Ai.chwPumpKw + Ai.cwPumpKw + Ai.towerFanKw + Ai.fanKw + E.roomFanKw,
                   pump: L.tcsPumpKw, elecLoss: E.upsLossKw + E.distLossKw + E.txLossKw + d.cordLoss + d.pduLoss, aux: E.auxKw },
      plant: r, engine: 'ltc-plant'
    });
    out.netOpex = Math.max(0, out.annualOpex - out.heatReuseCredit);
    if (li && isFinite(li.targetPue)) out.pueGap = out.pue - li.targetPue;
    if (li && isFinite(li.targetCop)) out.copGap = out.systemCop - li.targetCop;
    out.internals = Object.assign({}, (legacy && legacy.internals) || {}, { totalCoolingKw: coolingKw, annualKwh: A.m0MWh * 1000, annualWaterM3: A.waterM3, heatReuseKwh: reuseKwh });
    return out;
  }

  /* write the lab's inputs into the shared plant (keeps site / advanced keys the lab does not own) */
  /* The lab's first runs happen before it has read the shared plant; writing then would overwrite
   * a plant chosen elsewhere with the lab's own defaults. So nothing is written until pull() ran. */
  var pulled = false;
  function sync(li) {
    if (!pulled) return;
    var mine = toPlant(li), st = Object.assign({}, P.load(), mine);
    if (mine.climate) { delete st.climateBins; delete st.designDbC; delete st.designWbC; pulledClimate = li.climate; }   // a new climate brings its own bins
    P.save(resolve2N(st));
  }

  /* ---- overview: the same nine-block plant as the hub, on RZDiagram, with hover trace ---- */
  function overview(host, r) {
    var D = root.RZDiagram;
    if (!host || !D || !r) return;
    var f1 = function (v) { return (Math.round(v / 100) / 10).toLocaleString('en-US') + ' MW'; };
    var L = r.liquid, A = r.air, E = r.elec, T = r.totals;
    var names = { drycooler: 'Dry coolers', adiabatic: 'Adiabatic coolers', fluidcooler: 'Fluid coolers', tower: 'Towers + HX' };
    var B = [
      ['grid', 0, 0, 'Grid + generators', f1(T.facilityKw) + ' import', 'utility'],
      ['ups', 1, 0, 'UPS + PDU', (r.input.upsEff * 100).toFixed(0) + ' % · ' + Math.round(E.upsLossKw) + ' kW loss', 'ups'],
      ['racks', 3, 0, 'IT racks', r.it.racks + ' racks · ' + r.input.halls + ' halls', 'rack'],
      ['elec', 1, 1, 'Electrical rooms', Math.round(E.roomLoadKw) + ' kW to CHW', 'crah'],
      ['cdu', 2, 1, 'CDUs', L.cduTotal + ' × ' + r.input.cduUnitKw + ' kW', 'cdu'],
      ['cool', 2, 2, names[L.coolerType], L.coolerUnitsTotal + ' units · leaves ' + L.coolerLeavingC.toFixed(1) + ' °C', 'dryCooler'],
      ['crah', 2, 3, 'CRAHs', A.crahTotal + ' × ' + r.input.crahUnitKw + ' kW', 'crah'],
      ['chiller', 1, 3, 'Chillers', A.chillersTotal + ' × ' + (r.input.chillerUnitKw / 1000) + ' MW · COP ' + A.chillerCop.toFixed(1), 'chiller'],
      ['tower', 0, 3, A.chillerType === 'air' && L.coolerType !== 'tower' ? 'Air-cooled condensers' : 'Cooling towers', f1(A.towerKw), 'coolingTower']
    ];
    var narrow = host.clientWidth < 640, NW = narrow ? 210 : 172, NH = 88, CG = 40, RG = 52;
    var d = D.create({ slug: 'labov', title: 'Liquid-to-chip plant — overview',
      desc: 'Power from grid and generators through UPS and PDUs to the racks; liquid heat through CDUs to the liquid coolers; residual air heat through CRAHs to the chillers and towers; electrical losses cooled on chilled water.' });
    var box = {};
    B.forEach(function (b, i) {
      var x = narrow ? 24 : 24 + b[1] * (NW + CG), y = narrow ? 16 + i * (NH + 36) : 24 + b[2] * (NH + RG);
      box[b[0]] = d.node(x, y, { id: b[0], name: b[3], sublabel: b[4], symbol: b[5], interactive: true, w: NW,
        h: !narrow && b[0] === 'racks' ? NH + 2 * (NH + RG) : NH, focal: b[0] === 'racks', fill: b[0] === 'racks' ? 'paper-2' : 'paper',
        tier: b[0] === 'racks' ? 1 : 2, legend: b[0] === 'racks' ? 'IT load — the control point' : 'Plant equipment' });
    });
    var S = { P: { tier: 1, stroke: 'ink', legend: 'Power', state: 'flow' }, Q: { pattern: 'dashed', stroke: 'link', legend: 'Heat (liquid)', state: 'flow' },
              A: { pattern: 'dash-dot', stroke: 'accent', legend: 'Heat (air → chilled water)', state: 'flow' }, X: { pattern: 'dotted', stroke: 'muted', legend: 'Losses as heat' } };
    var E2 = [['grid', 'r', 'ups', 'l', 'P'], ['ups', 'r', 'racks', 'l', 'P'], ['ups', 'b', 'elec', 't', 'X'], ['racks', 'l', 'cdu', 'r', 'Q'],
              ['cdu', 'b', 'cool', 't', 'Q'], ['racks', 'b', 'crah', 'r', 'A'], ['crah', 'l', 'chiller', 'r', 'A'], ['elec', 'b', 'chiller', 't', 'A'], ['chiller', 'l', 'tower', 'r', 'A']];
    var order = B.map(function (b) { return b[0]; }), skip = 0, used = {};
    function portShift(use, k1, k2) { var m = Math.max(use[k1] || 0, use[k2] || 0); use[k1] = (use[k1] || 0) + 1; use[k2] = (use[k2] || 0) + 1; return m ? (m % 2 ? 1 : -1) * 28 * Math.ceil(m / 2) : 0; }
    function at(bx, s) { return s === 'l' ? { x: bx.x, y: bx.y + bx.h / 2 } : s === 'r' ? { x: bx.x + bx.w, y: bx.y + bx.h / 2 } : s === 't' ? { x: bx.x + bx.w / 2, y: bx.y } : { x: bx.x + bx.w / 2, y: bx.y + bx.h }; }
    E2.forEach(function (e) {
      var a = box[e[0]], b = box[e[2]], p1 = at(a, e[1]), p2 = at(b, e[3]), chan;
      if (!narrow) {   // level with the other end — only on a left/right side, only while still on the rack block's border
        var lv = function (bx, sd, y) { return /[lr]/.test(sd) && y >= bx.y + 10 && y <= bx.y + bx.h - 10; };
        if (e[2] === 'racks' && lv(b, e[3], p1.y)) p2 = { x: p2.x, y: p1.y };
        if (e[0] === 'racks' && lv(a, e[1], p2.y)) p1 = { x: p1.x, y: p2.y };
      }
      else {
        var ia = order.indexOf(e[0]), ib = order.indexOf(e[2]);
        if (Math.abs(ia - ib) === 1) { var dn = a.y < b.y, sx = portShift(used, e[0] + (dn ? 'b' : 't'), e[2] + (dn ? 't' : 'b')); p1 = { x: a.x + a.w / 2 + sx, y: dn ? a.y + a.h : a.y }; p2 = { x: b.x + b.w / 2 + sx, y: dn ? b.y : b.y + b.h }; }
        else { skip++; var o1 = used[e[0] + 'R'] = (used[e[0] + 'R'] || 0) + 1, o2 = used[e[2] + 'R'] = (used[e[2] + 'R'] || 0) + 1; p1 = { x: a.x + a.w, y: a.y + a.h / 2 + 12 * (o1 - 1) - 6 }; p2 = { x: b.x + b.w, y: b.y + b.h / 2 + 12 * (o2 - 1) - 6 }; chan = 12 + 9 * (skip - 1); }
      }
      d.edge(p1, p2, Object.assign({ fromId: e[0], toId: e[2], id: e[0] + '>' + e[2], stub: chan }, S[e[4]]));
    });
    d.legend(); d.fit(16);
    host.innerHTML = d.render();
    var svg = host.querySelector('svg');
    if (svg) { svg.setAttribute('width', d.width); svg.style.maxWidth = d.width + 'px'; svg.style.width = '100%'; svg.style.height = 'auto'; }
    d.warnings.forEach(function (w) { console.error('[rz-diagram]', w.kind, w.message); });
    if (root.LTCTrace && !host.__traced) {
      host.__traced = true;
      root.LTCTrace.attach(host, function () {
        var x = host.__r; if (!x) return {};
        var q = x.liquid, a = x.air, el = x.elec, t = x.totals;
        return {
          grid: { title: 'Grid + generators', rows: [['Facility', f1(t.facilityKw)], ['PUE design / annual', t.pue.toFixed(3) + ' / ' + t.pueAnnual.toFixed(3)]], formula: 'IT + cooling + losses + aux' },
          ups: { title: 'UPS + PDU', rows: [['UPS output', f1(el.upsOutKw)], ['UPS loss', Math.round(el.upsLossKw) + ' kW'], ['Cord + PDU loss', Math.round(x.design.cordLoss + x.design.pduLoss) + ' kW (in the hall air)']], formula: 'M1 = IT + cord + PDU losses (+ CDU pumps)' },
          racks: { title: 'IT racks', rows: [['IT', f1(x.it.kw)], ['Into cold plates', f1(q.itKw)], ['Left in the air', f1(a.itKw)]], formula: 'liquid = IT × capture' },
          elec: { title: 'Electrical rooms', rows: [['UPS', Math.round(el.upsLossKw) + ' kW'], ['LV distribution', Math.round(el.distLossKw) + ' kW'], ['Transformers', Math.round(el.txLossKw) + ' kW']], formula: 'losses × room share → CHW' },
          cdu: { title: 'CDUs', rows: [['Installed', String(q.cduTotal)], ['TCS', x.input.tcsSupplyC + ' / ' + x.input.tcsReturnC + ' °C'], ['TCS flow', Math.round(q.tcsLps) + ' L/s'], ['TCS pumps', Math.round(q.tcsPumpKw) + ' kW']], formula: 'ceil(hall liquid duty / unit) + N' },
          cool: { title: names[q.coolerType], rows: [['Sink at design', q.coolerSinkC.toFixed(1) + ' °C'], ['Leaving', q.coolerLeavingC.toFixed(1) + ' °C'], ['Trim on design day', (q.trimShareDesign * 100).toFixed(0) + ' %'], ['Trim hours / yr', String(Math.round(t.trimHours))]], formula: 'leaving = sink + approach; trim covers the rest' },
          crah: { title: 'CRAHs', rows: [['Installed', String(a.crahTotal)], ['Air load per hall', Math.round(a.hallLoadKw) + ' kW'], ['Fans', Math.round(a.fanKw) + ' kW']], formula: '(air IT + CDU skin + cord/PDU loss) / (1 − fan fraction)' },
          chiller: { title: 'Chillers', rows: [['Load', f1(a.chillerEvapKw)], ['COP / kW/RT', a.chillerCop.toFixed(2) + ' / ' + a.chillerKwPerRt.toFixed(3)], ['Part load', (a.chillerPlr * 100).toFixed(0) + ' %']], formula: 'COP = rated × part-load factor × lift ratio' },
          tower: { title: 'Heat rejection', rows: [['Rejected', f1(a.towerKw)], ['Make-up', a.makeupLps.toFixed(1) + ' L/s'], ['WUE annual', t.wueAnnual.toFixed(2) + ' L/kWh']], formula: 'evaporation = latent heat / h_fg' }
        };
      });
    }
    host.__r = r;
  }

  /* plant edited elsewhere (hub strip, another tab) → the lab's inputs follow, then auto-run */
  var FIELDS = [['inItLoad', 'itMw', 1], ['inLiquidCapture', 'capturePct', 1], ['inSupplyTemp', 'tcsSupplyC', 1], ['inReturnTemp', 'tcsReturnC', 1],
    ['inPumpHead', 'tcsHeadM', 1], ['inPumpEff', 'tcsPumpEff', 100], ['inCduUnit', 'cduUnitKw', 1], ['inUpsEff', 'upsEff', 100],
    ['inDistLoss', 'distLossPct', 1], ['inRackDensityTarget', 'rackKw', 1], ['inElecPrice', 'elecPrice', 1], ['inWaterTariff', 'waterTariff', 1],
    ['inCarbonIntensity', 'gridEfKgPerKwh', 1], ['inHeatReuse', 'heatReusePct', 1]];
  function pull() {
    pulled = true;
    // every field the lab shares with the plant takes the plant's value (LTCPlant.DEFAULTS when
    // nothing was chosen): the lab and the workbench open on the same plant
    var n = P.normalise(P.load()), changed = null;
    FIELDS.forEach(function (f) {
      var el = document.getElementById(f[0]);
      if (!el) return;
      var v = Math.round(n[f[1]] * f[2] * 1000) / 1000;
      if (Number(el.value) !== v) { el.value = v; changed = el; }
    });
    var red = document.getElementById('inRedundancy'), want = n.cduRedundancy >= 2 ? '2N' : n.cduRedundancy === 1 ? 'N1' : 'N';
    if (red && red.value !== want) { red.value = want; changed = red; }
    var cl = document.getElementById('inClimate'), back = { tropical: 'tropical', temperate: 'temperate', arid: 'dry' }[n.climate];
    if (cl && back && cl.value !== back && [].some.call(cl.options, function (o) { return o.value === back; })) { cl.value = back; changed = cl; }
    if (cl) pulledClimate = cl.value;                                // what the select shows now is the plant's, not a reader's choice
    if (changed) changed.dispatchEvent(new Event(changed.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return !!changed;
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('load', function () { setTimeout(pull, 400); });
    window.addEventListener('storage', function (e) { if (e.key === P.KEY) pull(); });
  }

  root.LTCLabPlant = { toPlant: toPlant, compute: compute, sync: sync, overview: overview, pull: pull, CLIMATE: CLIMATE,
    /* after the first read of the plant the lab's inputs win; tests state it explicitly */
    ready: function (climateShown) { pulled = true; if (climateShown) pulledClimate = climateShown; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LTCLabPlant;
})(typeof window !== 'undefined' ? window : globalThis);
