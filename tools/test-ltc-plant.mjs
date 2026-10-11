#!/usr/bin/env node
/* test-ltc-plant — the shared LTC plant model closes its books and behaves like a plant.
 *
 *   P1  energy balance: electricity in = heat out, within 0.5 %, for both heat-rejection
 *       modes and 200 random plants — the check that would have caught the residual air heat
 *       going nowhere.
 *   P2  100 MW hand calculation: CDU, CRAH and chiller counts and the TCS flow match
 *       arithmetic done outside the model.
 *   P3  physics direction: more capture → less air heat; hotter ambient → more trim; tower
 *       mode needs no trim at the design wet bulb; PUE design ≥ annual on dry coolers.
 *   P4  faults: losing CDU feeder A on single-fed CDUs drops half of them and pushes the
 *       shortfall into the hall air; dual-fed CDUs lose none; one CDU out is covered by N+1;
 *       FWS loss gives minutes, flow loss gives seconds.
 *   P8  review defects: compare presets, feeder-A indices, smooth cooler count, enum and range
 *       validation, CHW pump heat, FWS fault inputs, climate-aware save.
 *   P7  DH01 thermal view: normal in envelope, CRAH loss warms the aisles it fed, CDU feeder loss
 *       sheds IT on the dead loops, the running worst case overheats, CHW loss raises supply air.
 *   P6  engine v2: metering order M0>M1>M2>M3, PUE1<2<3, CUE/REF/ERF identities, sizing by hand,
 *       hall geometry, transients against the analytic first-order solution, climate presets.
 *   P5  practitioner claims recomputed: the VSD part-load points, the 5.4 MW adiabatic-vs-fluid
 *       cooler count, and the water–energy shape of the four plant presets.
 *
 * Run: node tools/test-ltc-plant.mjs     (exits 1 on any failure)
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const P = require('../js/ltc-plant.js');

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: got ${a}, want ${b} ± ${tol}`);

// P1
for (const mode of ['drycooler', 'tower']) {
  const r = P.compute({ liquidRejection: mode });
  ok(r.totals.balanceErr < 0.005, `P1 ${mode}: energy balance off by ${(r.totals.balanceErr * 100).toFixed(3)} %`);
}
let seed = 7;
const rnd = (lo, hi) => { seed = (seed * 16807) % 2147483647; return lo + (hi - lo) * (seed / 2147483647); };
for (let i = 0; i < 200; i++) {
  const kinds = ['drycooler', 'adiabatic', 'fluidcooler', 'tower'];
  const inp = { itMw: rnd(5, 300), halls: Math.round(rnd(1, 12)), capturePct: rnd(50, 98), tcsSupplyC: rnd(25, 45),
    designDbC: rnd(15, 45), designWbC: rnd(10, 30), chillerCopRated: rnd(4, 9), upsEff: rnd(0.93, 0.99),
    liquidRejection: kinds[Math.floor(rnd(0, 4))], chillerType: rnd(0, 1) < 0.5 ? 'air' : 'water', elecRoomShare: rnd(0, 1) };
  inp.designWbC = Math.min(inp.designWbC, inp.designDbC);
  inp.tcsReturnC = inp.tcsSupplyC + rnd(5, 15);
  const r = P.compute(inp);
  ok(r.totals.balanceErr < 0.005, `P1 random #${i}: balance off by ${(r.totals.balanceErr * 100).toFixed(3)} % for ${JSON.stringify(inp)}`);
  ok(r.totals.pue > 1 && r.totals.pue < 2, `P1 random #${i}: PUE ${r.totals.pue} outside (1, 2)`);
}

// P2 — 100 MW defaults by hand
{
  const r = P.compute({});
  const liquidIt = 100000 * 0.85;                               // 85,000 kW
  const tcsKgS = liquidIt / (4.186 * 10);                        // 2,030.6 kg/s
  near(r.liquid.tcsLps, tcsKgS / 997 * 1000, 0.5, 'P2 TCS flow L/s');
  const pump = 997 * 9.81 * 25 * (tcsKgS / 997) / 1000 / 0.70;   // ≈ 711 kW
  near(r.liquid.tcsPumpKw, pump, 0.5, 'P2 TCS pump kW');
  ok(r.liquid.cduPerHall === Math.ceil((liquidIt + pump) / 5 / 2000) + 1, `P2 CDU per hall ${r.liquid.cduPerHall}`);
  ok(r.it.racksPerHall === Math.ceil(20000 / 132), `P2 racks per hall ${r.it.racksPerHall}`);
  // CRAH: air load per hall incl. CDU skin, divided by (1 − fan fraction)
  const skin = (liquidIt + pump) * 0.01;
  const fanFrac = 1.2 / (1.18 * 1.006 * 12);
  // cord and PDU losses dissipate in the hall air, so the CRAHs carry them too
  const cord = 100000 * 0.005, pdu = (100000 + cord) / (1 - 0.015) - (100000 + cord);
  const hall = (15000 + skin + cord + pdu) / 5 / (1 - fanFrac);
  near(r.air.hallLoadKw, hall, 0.5, 'P2 CRAH hall load kW');
  ok(r.air.crahPerHall === Math.ceil(hall / 250) + 1, `P2 CRAH per hall ${r.air.crahPerHall}`);
  ok(r.air.chillersN === Math.ceil(r.air.chillerEvapKw / 4000), 'P2 chiller count from evaporator load');
  ok(r.liquid.fwsSupplyC === 32 && r.liquid.fwsReturnC === 42, 'P2 FWS 32/42 °C from TCS 35 − 3 K approach');
}

// P3
{
  const a = P.compute({ capturePct: 70 }), b = P.compute({ capturePct: 90 });
  ok(b.air.itKw < a.air.itKw && b.air.crahTotal <= a.air.crahTotal, 'P3 more capture must leave less heat in the air');
  ok(P.compute({ designDbC: 40 }).liquid.trimKw > P.compute({ designDbC: 25 }).liquid.trimKw, 'P3 hotter ambient must need more trim');
  ok(P.compute({ liquidRejection: 'tower' }).liquid.trimKw === 0, 'P3 tower at 28 °C wet bulb + 4 K approach reaches 32 °C FWS without trim');
  const d = P.compute({});
  ok(d.totals.pue >= d.totals.pueAnnual, 'P3 design-day PUE must not be below annual on dry coolers');
  ok(d.elec.roomLoadKw > 0 && d.air.chillerEvapKw > d.air.hallLoadKw * 5, 'P3 chillers must carry the electrical rooms as well as the CRAHs');
}

// P4
{
  const s = P.compute({}, { kind: 'cdu-feeder' }).fault;
  ok(s.lostCdu.length === 5 && s.liquidShortKw > 0 && s.airLoadKw > s.airCapKw, `P4 single-fed feeder loss: lost ${s.lostCdu.length}, short ${s.liquidShortKw}`);
  ok(s.rideThroughS <= 30, 'P4 flow loss at the cold plate is seconds, not minutes');
  const dual = P.compute({ cduFeed: 'dual' }, { kind: 'cdu-feeder' }).fault;
  ok(dual.lostCdu.length === 0 && dual.liquidShortKw === 0, 'P4 dual-fed CDUs lose none on one feeder');
  const one = P.compute({}, { kind: 'cdu' }).fault;
  ok(one.liquidShortKw === 0, 'P4 one CDU out is covered by N+1');
  const fws = P.compute({}, { kind: 'fws-pump' }).fault;
  ok(fws.rideThroughS > 60 && fws.rideThroughS < 1800, `P4 FWS loss ride-through ${fws.rideThroughS}s should be minutes`);
}

// P5 — practitioner claims, recomputed rather than copied
{
  // VSD part-load points as published: COP 5.5 / 6.268 / 7.924 at 100 / 80 / 50 % → kW/RT 0.64 / 0.56 / 0.44
  near(5.5 * P.plrFactor(0.8), 6.268, 0.001, 'P5 PLR curve at 80 %');
  near(5.5 * P.plrFactor(0.5), 7.924, 0.001, 'P5 PLR curve at 50 %');
  near(3.517 / 7.924, 0.444, 0.001, 'P5 kW/RT at 50 %');
  ok(P.plrFactor(0.1) === P.plrFactor(0.3), 'P5 curve is not extrapolated into the low-load tail (COP ~50 at 10 % load is not credible)');
  // 5.4 MW at FWS 30/35.5 °C, design 35/28 °C: an adiabatic dry cooler needs several times the fluid coolers
  const base = { itMw: 5, capturePct: 99, halls: 1, tcsSupplyC: 33, cduApproachK: 3, fwsDeltaK: 5.5 };
  const fc = P.compute({ ...base, liquidRejection: 'fluidcooler' }).liquid;
  const ad = P.compute({ ...base, liquidRejection: 'adiabatic' }).liquid;
  ok(fc.trimShareDesign === 0 && fc.coolerUnits <= 4, `P5 fluid cooler reaches 30 °C from a 28 °C wet bulb with ≤ 4 units (got ${fc.coolerUnits}, trim ${fc.trimShareDesign})`);
  ok(ad.coolerUnits >= 2 * fc.coolerUnits, `P5 adiabatic needs ≥ 2× the units (got ${ad.coolerUnits} vs ${fc.coolerUnits})`);
  // four presets: the water–energy trade-off has the right shape
  const R = Object.fromEntries(Object.keys(P.PRESETS).map((k) => [k, P.compute({ preset: k }).totals]));
  ok(R.fluid.pueAnnual < R.dry.pueAnnual && R.fluid.wueAnnual > R.dry.wueAnnual, 'P5 fluid coolers: lower PUE, more water than dry coolers');
  ok(R.baseline.wueAnnual === 0, 'P5 air-cooled baseline evaporates no water');
  ok(R.hybrid.wueAnnual < R.fluid.wueAnnual, 'P5 adiabatic uses less water than fluid coolers');
  for (const [k, t] of Object.entries(R)) {
    ok(t.balanceErr < 0.005, `P5 ${k}: balance`);
    ok(t.pueAnnual <= t.pue + 1e-9, `P5 ${k}: annual PUE above design-day PUE`);
    ok(Math.abs(t.hours - 8760) < 1, `P5 ${k}: climate bins cover ${t.hours} h, not 8,760`);
  }
}

// P6 — engine v2: metering points, annual KPIs, sizing, hall, transients, site layer
{
  const r = P.compute({});
  const A = r.annual;
  ok(A.m0MWh > A.m1MWh && A.m1MWh > A.m2MWh && A.m2MWh > A.m3MWh, 'P6 M0 > M1 > M2 > M3 (losses accumulate outward from the IT input)');
  ok(A.pue1 < A.pue2 && A.pue2 < A.pue3, 'P6 PUE category 1 < 2 < 3 for the same facility');
  near(A.m3MWh, 100 * 0.85 * 8760, 1, 'P6 M3 = IT MW × utilisation × 8,760 h');
  near(A.cue, (A.m0MWh - A.renewableMWh) * 0.72 / A.m3MWh, 1e-9, 'P6 CUE identity');
  near(A.pue3, r.totals.pueAnnual, 1e-9, 'P6 PUE3 equals the annual PUE');
  const q = P.compute({ renewablePct: 40, heatReusePct: 20 }).annual;
  ok(q.ref > 0.39 && q.ref < 0.41 && q.cue < A.cue && q.erf > 0, 'P6 renewable share lowers CUE and sets REF; reuse sets ERF');
  // sizing by hand
  const d = r.design;
  ok(r.power.genTotal === Math.ceil(d.facility / 3000) + 1, 'P6 generator count = ceil(facility / unit) + 1');
  ok(r.power.upsTotal === Math.ceil(d.upsOut / 1250) + 1, 'P6 UPS modules N+1');
  ok(P.compute({ upsTopology: '2N' }).power.upsTotal === 2 * Math.ceil(d.upsOut / 1250), 'P6 UPS modules 2N');
  // hall: every rack placed, rows paired across hot aisles
  const h = r.hall;
  ok(h.racks.length === r.it.racksPerHall && h.rows % 2 === 0, `P6 hall places ${h.racks.length} of ${r.it.racksPerHall} racks in ${h.rows} rows`);
  ok(h.cdus.length === r.liquid.cduPerHall && h.crahs.length === r.air.crahPerHall, 'P6 hall carries the sized CDUs and CRAHs');
  // CDU loops: each CDU is drawn at a row end its own block reaches, no two share a spot, loads balanced
  for (const q of [{}, { itMw: 37 }, { racksPerRow: 13 }, { cduUnitKw: 1500 }]) {
    const g = P.compute(q).hall, ez = r.input.endZoneM, spots = new Set(), sizes = [];
    let bad = '';
    g.cdus.forEach((c) => {
      const mine = g.racks.filter((k) => k.cdu === c.i), west = c.x < g.lengthM / 2;
      sizes.push(mine.length);
      const key = c.x.toFixed(2) + ',' + c.y.toFixed(2);
      if (spots.has(key)) bad = bad || `CDU ${c.i + 1} sits on another CDU`;
      spots.add(key);
      const row = g.rowsY.findIndex((rw) => Math.abs(rw.y + r.input.rackDepthM / 2 - c.y) < 1e-6);
      const ends = (ri) => { const xs = g.racks.filter((k) => k.row === ri).map((k) => k.x); return [Math.min(...xs), Math.max(...xs)]; };
      const touches = mine.filter((k) => ends(k.row).some((e) => Math.abs(k.x - e) < 1e-6));
      if (!(c.x > 0 && c.x < ez) && !(c.x > g.lengthM - ez && c.x < g.lengthM)) bad = bad || `CDU ${c.i + 1} is not in an end zone`;
      if (!mine.some((k) => k.row === row)) bad = bad || `CDU ${c.i + 1} sits at a row it does not serve`;
      if (touches.length && !touches.some((k) => k.row === row && Math.abs(k.x - ends(row)[west ? 0 : 1]) < 1e-6)) bad = bad || `CDU ${c.i + 1} is not at the row end its own racks reach`;
      const rows = [...new Set(mine.map((k) => k.row))].sort((a, b) => a - b);
      if (rows.length && rows[rows.length - 1] - rows[0] !== rows.length - 1) bad = bad || `CDU ${c.i + 1} serves non-adjacent rows`;
    });
    ok(!bad && Math.max(...sizes) - Math.min(...sizes) <= 1, `P6 CDU loops placed and balanced ${JSON.stringify(q)} (${bad || sizes.join('/')})`);
  }
  // transients against the analytic solution
  for (const [k, f] of [['fws-pump', 0], ['cooler', 0.5], ['chw', 0]]) {
    const t = P.transient(r, k, { f });
    let worst = 0;
    for (const [min, T] of t.series) worst = Math.max(worst, Math.abs(T - t.analytic(min * 60)));
    ok(worst < 0.05, `P6 transient ${k}: numeric vs analytic off by ${worst.toFixed(3)} K`);
  }
  const fws = P.transient(r, 'fws-pump');
  near(fws.secondsToLimit, (60 - 45) * fws.C / fws.Q, 1.5, 'P6 FWS loss: time to throttle = C·ΔT / Q');
  ok(P.transient(r, 'chiller').secondsToLimit === null, 'P6 one chiller tripping with N+1 never reaches the limit');
  // site layer
  for (const c of Object.keys(P.CLIMATES)) {
    const x = P.compute({ climate: c });
    ok(Math.abs(x.totals.hours - 8760) < 1 && x.totals.balanceErr < 0.005, `P6 climate ${c}: 8,760 h and balance`);
  }
  ok(P.compute({ climate: 'temperate' }).totals.pueAnnual < P.compute({ climate: 'tropical' }).totals.pueAnnual, 'P6 a temperate site runs a lower annual PUE than a tropical one');
  ok(JSON.stringify(P.parseBins('30,26,4000\n24 22 4760\nbad line')) === JSON.stringify([[30, 26, 4000], [24, 22, 4760]]), 'P6 parseBins reads db, wb, hours lines and skips the rest');
}

// P7 — DH01 thermal view (js/ltc-dh01.js): the approximation behaves like the hall it draws
{
  globalThis.LTCPlant = P;
  const DH = require('../js/ltc-dh01.js');
  const r = P.compute({});
  const n = DH.solveHall(r, 'none', 'common', 0, 'throttled');
  ok(n.racks.length === r.it.racksPerHall && n.over27 === 0, `P7 normal: every rack inside the recommended envelope (hottest ${n.maxInlet.toFixed(1)} °C)`);
  ok(n.airSupply >= n.airDemand, 'P7 normal: installed CRAH airflow covers rack demand');
  const c4 = DH.solveHall(r, 'crah4', 'common', 0, 'throttled');
  ok(c4.over27 > 0 && c4.airSupply < n.airSupply, 'P7 four CRAHs out: the aisles they fed run warm');
  const west = c4.racks.filter((k) => k.x < r.hall.lengthM / 2 && k.inlet > 27).length, east = c4.racks.filter((k) => k.x >= r.hall.lengthM / 2 && k.inlet > 27).length;
  ok(west >= east, `P7 the west-wall loss bites hardest nearest the west wall (west ${west}, east ${east})`);
  const per = DH.solveHall(r, 'cdu-feeder', 'per-cdu', 0, 'throttled');
  const lost = Object.keys(per.lostCdu).length, share = lost / r.liquid.cduPerHall;
  ok(Math.abs(per.itLostKw / r.it.hallKw - share) < 0.06 && per.over27 === 0, `P7 feeder A, one loop per CDU: the racks on dead CDUs shed their load (${(per.itLostKw / 1000).toFixed(1)} MW) and the room stays in envelope`);
  const run = DH.solveHall(r, 'cdu-feeder', 'per-cdu', 0, 'running');
  ok(run.maxInlet > per.maxInlet + 5, 'P7 if those racks kept running on air the room would overheat');
  const chw = DH.solveHall(r, 'chw', 'common', 10, 'throttled');
  ok(chw.supply > n.supply, 'P7 chilled water lost: supply air rises with the CHW transient');
  // v3.17.4 — the solver is a mass and energy balance; the plan draws exactly these flows
  for (const [nm, x] of [['normal', n], ['crah4', c4], ['feeder', per], ['running', run]]) {
    const fed = x.racks.reduce((a, k) => a + k.f * k.dem, 0);
    const mouths = x.aisles.reduce((a, ai) => a + ai.west + ai.east + ai.bypass, 0);
    near(fed + x.recircM3s, x.airDemand, 1e-6 * x.airDemand + 1e-9, `P7 ${nm}: rack airflow = supply drawn + exhaust pulled back`);
    near(mouths, x.airSupply, 1e-6 * x.airSupply, `P7 ${nm}: every m³/s the fans move reaches an aisle mouth (served or bypassed)`);
    near(x.returnC - x.supply, x.qAirKw / (x.airSupply * P.CONST.RHO_A * P.CONST.CP_A), 1e-6, `P7 ${nm}: return − supply = air heat ÷ (ṁ·cp)`);
    ok(x.aisles.every((ai) => ai.unmet < 1e-9 || ai.westTo < ai.eastTo), `P7 ${nm}: unmet air sits between where the two supplies end`);
  }
  ok(n.fanSpeed < 1 && n.supply === r.input.supplyAirC && !n.coilLimited && n.recircM3s < 1e-9, 'P7 normal: fans below rated speed, coil at set-point, no recirculation');
  ok(c4.fanSpeed === 1 && c4.coilLimited && c4.supply > n.supply, 'P7 four CRAHs out: survivors at rated flow, coil cannot hold set-point');
  const hot = c4.racks.filter((k) => k.f < 0.97);
  ok(hot.length && hot.every((k) => k.inlet > c4.supply), 'P7 four CRAHs out: racks short of supply air run above supply temperature');
}

// P8 — defects found by review (v3.17.1); each assertion failed before its fix
{
  // compare table: a stored preset must not override the preset being compared
  const rows = P.comparePresets({ preset: 'baseline', chillerType: 'air', liquidRejection: 'drycooler' });
  const pues = rows.map((x) => x.r.totals.pueAnnual.toFixed(4));
  ok(new Set(pues).size === 4 && rows.every((x) => x.r.input.liquidRejection === P.PRESETS[x.k].liquidRejection), `P8 compare shows four different plants (got ${pues.join(', ')})`);
  ok(P.compute({ preset: 'baseline', liquidRejection: 'fluidcooler' }).input.liquidRejection === 'fluidcooler', 'P8 an explicit key wins over the stored preset');
  // feeder A loses the feeder-A CDUs, by valid index, odd counts included
  for (const cduUnitKw of [2000, 1900]) {
    const r = P.compute({ cduUnitKw }), f = P.compute({ cduUnitKw }, { kind: 'cdu-feeder' }).fault, n = r.liquid.cduPerHall;
    ok(f.lostCdu.every((i) => i >= 0 && i < n && i % 2 === 0), `P8 feeder A takes even (feeder-A) CDUs in range: ${f.lostCdu.join(',')} of ${n}`);
    const geo = r.hall.cdus;
    ok(f.lostCdu.every((i) => geo[i] && geo[i].feeder === 'A'), 'P8 the CDUs lost are the ones the hall geometry puts on feeder A');
  }
  // cooler count has no jumps as the design dry bulb crosses the cooler limit
  const us = [];
  for (let db = 30; db <= 40; db += 0.5) us.push(P.compute({ designDbC: db }).liquid.coolerUnits);
  const top = Math.max(...us), worst = Math.max(...us.slice(1).map((u, i) => Math.abs(u - us[i]))) / top;
  ok(worst < 0.15, `P8 cooler count changes smoothly with design dry bulb (largest step ${(worst * 100).toFixed(0)} % of ${top})`);
  ok(Math.min(...us) >= 0.5 * top, `P8 a hotter design day does not shrink the cooler plant that still carries the cooler hours (min ${Math.min(...us)} of ${top})`);
  // a bad enum from a URL hash cannot turn the plant into NaN
  for (const bad of [{ liquidRejection: 'x' }, { chillerType: 'magic' }, { upsTopology: '3N' }, { cduFeed: 'none' }, { climate: 'mars' }]) {
    ok(isFinite(P.compute(bad).totals.pue), `P8 invalid ${JSON.stringify(bad)} falls back to a valid value`);
  }
  ok(isFinite(P.compute({ cyclesOfConc: 1 }).totals.wueAnnual) && isFinite(P.compute({ airDeltaK: 0.5 }).totals.pue) && isFinite(P.compute({ fwsDeltaK: 0 }).totals.pue), 'P8 degenerate physical inputs are clamped');
  // CHW pump heat lands on the chillers
  const r = P.compute({});
  ok(r.air.chillerEvapKw > r.air.hallLoadKw * r.input.halls + r.elec.roomLoadKw + r.elec.roomFanKw, 'P8 chiller load includes the CHW pump heat');
  // FWS fault honours the advanced inputs
  const a = P.compute({}, { kind: 'fws-pump' }).fault.rideThroughS, b = P.compute({ tcsLoopM3PerCdu: 12, throttleC: 60 }, { kind: 'fws-pump' }).fault.rideThroughS;
  ok(Math.abs(b / a - 2) < 0.01, 'P8 the FWS fault uses tcsLoopM3PerCdu (double the volume, double the ride-through)');
  // save keeps an explicit value that equals the global default but not the climate's default
  const kept = P.saveDiff({ climate: 'temperate', designDbC: 35 });
  ok(kept.designDbC === 35, 'P8 save keeps a design dry bulb that differs from the climate preset');
}

if (fails.length) {
  console.log(fails.slice(0, 20).join('\n'));
  console.log(`FAIL — ${fails.length} assertion(s)`);
  process.exit(1);
}
const r = P.compute({});
console.log(`PASS — LTC plant model: energy balance closes (202 plants), 100 MW hand checks, physics direction, faults. `
  + `100 MW: PUE ${r.totals.pue.toFixed(3)} design / ${r.totals.pueAnnual.toFixed(3)} annual, ${r.liquid.cduTotal} CDUs, ${r.air.crahTotal} CRAHs, ${r.air.chillersTotal} chillers.`);
