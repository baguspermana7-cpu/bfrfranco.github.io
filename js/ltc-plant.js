/* ltc-plant.js — one liquid-to-chip plant that every LTC Workbench tool reads.
 *
 * WHY THIS EXISTS
 * Each workbench tool used to carry its own picture of the plant: the model lab had an
 * engine of its own (js/ltc-system-modelling-lab.js computeModel), the plant map drew
 * racks → CDU → dry cooler and stopped, and the Tier simulator had a separate air-side
 * chain with no CDU at all. The heat that liquid cooling does NOT capture — 10–30 % of IT,
 * plus fan, pump, UPS and transformer losses — went nowhere. This model closes every heat
 * path and every power path for one plant, so a number on any page traces to the same place.
 *
 * WHAT IT COVERS
 *   Liquid path   racks → CDUs (TCS loop) → facility water (FWS) → heat rejection:
 *                 dry cooler | adiabatic dry cooler | closed-circuit fluid cooler | open tower,
 *                 with a trim chiller for whatever the cooler cannot reach
 *   Air path      residual IT air heat + CDU skin loss + fan heat → CRAHs → chilled water
 *                 → chillers (water-cooled to towers, or air-cooled)
 *   Electrical    UPS, transformer and distribution losses → electrical-room cooling on CHW
 *   Power chain   MV → transformers → UPS → PDU → racks; MCC → mechanical loads
 *   Annual        hour-weighted over climate bins, never "70–80 % of the design-day PUE"
 *   Faults        CDU feeder, CDU, CRAH, chiller, FWS pump — what each does to one hall
 *
 * PHYSICS, stated where used: Q = ṁ·cp·ΔT for every stream; P = ρ·g·H·V̇/η for pumps;
 * specific fan power for air movers; heat-exchanger duty ∝ UA·LMTD; chiller COP = rated COP ×
 * part-load factor × lift ratio; evaporation = Q_latent / h_fg. Inputs marked ASSUMED are
 * typical design values, not a vendor selection. Educational model: it sizes and balances;
 * it does not replace a basis of design or an 8,760-hour simulation on the site's EPW file.
 *
 * WHAT WAS TAKEN FROM PRACTITIONER POSTS, AND WHAT WAS NOT (owner asked for a check, not a merge)
 *   Taken, after recomputing: the cooler-type limits (dry bulb vs adiabatic pre-cooled air vs
 *   wet bulb) and the resulting equipment count; the VSD part-load COP points 100 % 5.50,
 *   80 % 6.268, 50 % 7.924 (consistent with the stated 0.64 / 0.56 / 0.44 kW/RT); annual PUE
 *   from climate bins; site-specific climate. Not taken: the same curve's tail above COP 15
 *   at 10–20 % load (motor, drive and fan losses do not shrink with load; clamped at 30 %
 *   PLR); a uniform-random 75–100 % IT profile (mean 87.5 %, σ 7.2 % — noise that averages
 *   out, not an AI workload shape); a published plant report's pump powers (6.1 MW for
 *   775 L/s implies ~600 m of head).
 */
(function (root) {
    'use strict';

    var CP_W = 4.186;      // kJ/(kg·K)  water — STANDARD
    var RHO_W = 997;       // kg/m³      water at ~30 °C — STANDARD
    var CP_A = 1.006;      // kJ/(kg·K)  air — STANDARD
    var RHO_A = 1.18;      // kg/m³      air at ~30 °C — STANDARD
    var G = 9.81;          // m/s²
    var H_FG = 2430;       // kJ/kg      latent heat of water at ~30 °C — STANDARD
    var KWRT = 3.517;      // kW thermal per refrigeration ton — STANDARD

    /* Generic tropical-lowland climate bins [dry bulb °C, coincident wet bulb °C, hours].
       ILLUSTRATIVE — mean ≈ 28 °C, 8,760 h. Replace with bins from the site's EPW file: two
       sites in the same country can differ by double digits in fan energy and water. */
    var TROPICAL_BINS = [[24, 23, 1400], [26, 24.5, 2200], [28, 25.5, 2000], [30, 26.5, 1600], [32, 27, 1100], [34, 27.5, 460]];

    /* VSD (magnetic-bearing) chiller part-load factor on COP, from the cited points:
       PLR 1.0 → 1.000, 0.8 → 6.268/5.5 = 1.140, 0.5 → 7.924/5.5 = 1.441. Linear between
       points, flat below 0.3 PLR (not extrapolated into the implausible low-load tail). */
    var F80 = 6.268 / 5.5, F50 = 7.924 / 5.5;
    var PLR_CURVE = [[0.3, F50 + (F50 - F80) * (0.2 / 0.3)], [0.5, F50], [0.8, F80], [1.0, 1.0]];

    var DEFAULTS = {
        itMw: 100,                // IT load, MW (owner: "anggap IT load 100 MW")
        itUtil: 0.85,             // annual mean IT utilisation (design day = 1.0)
        halls: 5,                 // data halls DH01…DH05
        rackKw: 132,              // ASSUMED — NVL72-class liquid rack
        capturePct: 85,           // share of IT heat into the cold plates
        tcsSupplyC: 35,           // technology cooling system (CDU → rack) supply
        tcsReturnC: 45,
        cduApproachK: 3,          // CDU plate HX approach: FWS supply = TCS supply − approach
        fwsDeltaK: 10,            // facility water ΔT
        cduUnitKw: 2000,          // ASSUMED — CDU liquid duty
        cduRedundancy: 1,         // +N per hall
        cduFeed: 'single',        // 'single' = each CDU on feeder A or B; 'dual' = ATS-fed
        tcsHeadM: 25, tcsPumpEff: 0.70,
        fwsHeadM: 30, fwsPumpEff: 0.75,
        cduSkinLossPct: 1.0,      // CDU casing / piping heat into the hall air, % of liquid duty
        liquidRejection: 'drycooler', // drycooler | adiabatic | fluidcooler | tower
        coolerApproachK: { drycooler: 6, adiabatic: 6, fluidcooler: 3, tower: 4 },   // at rating
        coolerUnitKw: { drycooler: 1800, adiabatic: 1800, fluidcooler: 1800, tower: 6000 }, // ASSUMED rated duty
        coolerFanKwPerMw: { drycooler: 18, adiabatic: 18, fluidcooler: 12, tower: 8 },      // ASSUMED
        // the tightest approach each cooler type is sized for; below it the trim chiller takes over.
        // Dry coolers sized to 1 K at 35 °C would need ~6× the coil area of their rating.
        coolerMinApproachK: { drycooler: 4, adiabatic: 1.5, fluidcooler: 2, tower: 3 },
        adiabaticEff: 0.85,       // pad saturation effectiveness
        adiabaticOnC: 28,         // pads wet above this dry bulb
        coolerAirRiseK: 5,        // air temperature rise through a dry/adiabatic coil
        trimChillerCop: 7.0,      // ASSUMED — low-lift trim on FWS
        designDbC: 35,            // design ambient dry bulb (tropical)
        designWbC: 28,            // design coincident wet bulb
        climateBins: TROPICAL_BINS,
        crahUnitKw: 250,          // ASSUMED — fan-wall CRAH sensible
        crahRedundancy: 1,        // +N per hall
        airDeltaK: 12,            // CRAH air ΔT (contained hot aisle)
        sfpKwPerM3s: 1.2,         // specific fan power, kW per m³/s
        chwSupplyC: 18,           // elevated CHW (air path only)
        chwDeltaK: 8,
        chillerType: 'water',     // water (to towers) | air (air-cooled)
        chillerUnitKw: 4000,      // ASSUMED — kW_th
        chillerRedundancy: 1,
        chillerCopRated: 6.5,     // ASSUMED — at 18 °C CHW and the rating condenser condition
        chillerVsd: true,         // apply the VSD part-load curve
        chillerStageAll: true,    // run every installed chiller at equal PLR (exploits the curve)
        chwHeadM: 35, cwHeadM: 25, pumpEff: 0.78,
        towerApproachK: 4, towerFanKwPerMw: 8, cyclesOfConc: 4,
        upsEff: 0.97, txEff: 0.99, distLossPct: 1.0,
        elecRoomShare: 1.0,       // share of electrical losses that land in cooled rooms
        auxPctOfIt: 1.0,          // lighting, controls, BMS
        cduOnUps: true            // CDU pumps on UPS so cold plates keep flow through a transfer
    };

    /* Four plant presets — the comparison practitioners actually run. */
    var PRESETS = {
        baseline: { label: 'Air-cooled chillers, dry coolers', chillerType: 'air', liquidRejection: 'drycooler' },
        fluid: { label: 'Fluid coolers + water-cooled chillers', chillerType: 'water', liquidRejection: 'fluidcooler' },
        dry: { label: 'Dry coolers + water-cooled chillers', chillerType: 'water', liquidRejection: 'drycooler' },
        hybrid: { label: 'Adiabatic (hybrid) coolers + water-cooled chillers', chillerType: 'water', liquidRejection: 'adiabatic' }
    };

    function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function normalise(input) {
        var o = {};
        Object.keys(DEFAULTS).forEach(function (k) {
            var d = DEFAULTS[k], v = input && input[k];
            if (typeof d === 'number') o[k] = num(v, d);
            else if (typeof d === 'boolean') o[k] = input && k in input ? !!v : d;
            else if (Array.isArray(d)) o[k] = Array.isArray(v) && v.length ? v : d;
            else if (d && typeof d === 'object') o[k] = Object.assign({}, d, v && typeof v === 'object' ? v : {});
            else o[k] = v != null ? String(v) : d;
        });
        o.halls = Math.max(1, Math.round(o.halls));
        o.capturePct = clamp(o.capturePct, 0, 99);
        o.itUtil = clamp(o.itUtil, 0.1, 1);
        if (!PRESETS[o.preset] && input && PRESETS[input.preset]) o.preset = input.preset;
        return o;
    }

    function pumpKw(flowM3s, headM, eff) { return RHO_W * G * headM * flowM3s / 1000 / eff; }
    function lmtd(a, b) { a = Math.max(a, 0.05); b = Math.max(b, 0.05); return Math.abs(a - b) < 1e-6 ? a : (a - b) / Math.log(a / b); }

    function plrFactor(plr) {
        var x = clamp(plr, PLR_CURVE[0][0], 1);
        for (var i = 1; i < PLR_CURVE.length; i++) {
            var a = PLR_CURVE[i - 1], b = PLR_CURVE[i];
            if (x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
        }
        return 1;
    }

    /* Chiller COP at an operating point. Rating: CHW supply at p.chwSupplyC, condensing at
       the rating condition (water-cooled: 30 °C entering condenser water; air-cooled: 30 °C
       dry bulb — the cited curve's rating point). Lift ratio is the Carnot-style correction:
       COP scales with (T_cond,rated − T_evap)/(T_cond − T_evap). */
    function chillerCop(p, plr, dbC, wbC) {
        var tEvap = p.chwSupplyC - 4;                                          // evaporator ~4 K below CHW supply
        var condRated = p.chillerType === 'air' ? 30 + 12 : 30 + 5;            // condensing temperature at rating
        var condNow = p.chillerType === 'air' ? dbC + 12 : (wbC + p.towerApproachK) + 5;
        var lift = clamp((condRated - tEvap) / Math.max(condNow - tEvap, 5), 0.5, 1.8);
        var copRated = p.chillerType === 'air' ? Math.min(p.chillerCopRated, 5.5) : p.chillerCopRated;
        return copRated * (p.chillerVsd ? plrFactor(plr) : 1) * lift;
    }

    /* Liquid heat rejection at one ambient condition: how far the cooler can bring FWS down,
       the share left for the trim chiller, and the cooler's water use. */
    function cooler(p, q, dbC, wbC) {
        var mode = p.liquidRejection, fwsS = p.tcsSupplyC - p.cduApproachK, fwsR = fwsS + p.fwsDeltaK;
        var airIn = dbC, wet = false;
        if (mode === 'adiabatic' && dbC > p.adiabaticOnC) { airIn = dbC - p.adiabaticEff * (dbC - wbC); wet = true; }
        var sink = mode === 'fluidcooler' || mode === 'tower' ? wbC : airIn;
        // The cooler is sized to reach FWS supply when the sink allows it with at least the
        // minimum approach; otherwise it gets as close as that approach and the trim chiller
        // takes the rest. Unit count, not leaving temperature, pays for a tight approach.
        var leaving = Math.max(fwsS, Math.min(fwsR, sink + p.coolerMinApproachK[mode]));
        var share = (leaving - fwsS) / p.fwsDeltaK;                            // left for the trim chiller
        var qCooler = q * (1 - share);
        var evapKgS = 0;
        if (mode === 'fluidcooler' || mode === 'tower') evapKgS = qCooler * 0.85 / H_FG;   // ~85 % of rejection is latent
        else if (wet) {
            var airKgS = qCooler / (CP_A * p.coolerAirRiseK);
            evapKgS = airKgS * CP_A * (dbC - airIn) / H_FG;                    // water evaporated to pre-cool the air
        }
        return { leaving: leaving, trimShare: share, qCooler: qCooler, evapKgS: evapKgS, sinkC: sink, airInC: airIn };
    }

    /* Equipment count for the liquid coolers at the design day: a unit rated at its rating
       approach delivers duty ∝ LMTD, so a tighter approach to the sink derates every unit.
       Rating: water FWS-return → FWS-supply against a sink `ratingApproach` below supply. */
    function coolerCount(p, q, c) {
        var mode = p.liquidRejection, fwsS = p.tcsSupplyC - p.cduApproachK, fwsR = fwsS + p.fwsDeltaK;
        var app = p.coolerApproachK[mode];
        var evaporative = mode === 'fluidcooler' || mode === 'tower';
        var rise = evaporative ? 0 : p.coolerAirRiseK;
        var ratedL = lmtd(fwsR - (fwsS - app + rise), app);
        var actualL = lmtd(fwsR - (c.sinkC + rise), Math.max(c.leaving - c.sinkC, 0.05));
        var derate = clamp(actualL / ratedL, 0.05, 1.5);
        // the trim chiller covers what the cooler cannot reach; count units for the cooler's share
        var unitKw = p.coolerUnitKw[mode] * derate;
        var n = Math.max(1, Math.ceil(c.qCooler / unitKw));
        return { n: n, derate: derate, unitKw: unitKw, ratedLmtdK: ratedL, actualLmtdK: actualL };
    }

    /* Trace: every output carries how it was got, so a tooltip or the ƒx panel can show it. */
    function T(label, value, unit, formula, inputs) {
        return { label: label, value: value, unit: unit, formula: formula, inputs: inputs || [] };
    }

    /* One steady operating point: IT at `util`, ambient (db, wb). Equipment counts are passed
       in from the design day so part-load operation runs the installed plant. */
    function solve(p, util, dbC, wbC, sized) {
        var it = p.itMw * 1000 * util;
        var liquidIt = it * p.capturePct / 100;
        var tcsDT = p.tcsReturnC - p.tcsSupplyC;
        var tcsM3s = liquidIt / (CP_W * tcsDT) / RHO_W;
        var tcsPump = pumpKw(tcsM3s, p.tcsHeadM, p.tcsPumpEff);    // pump work ends up as heat in the loop
        var liquidDuty = liquidIt + tcsPump;                        // what the CDUs pass on
        var cduSkin = liquidDuty * p.cduSkinLossPct / 100;          // into hall air, not FWS
        var toFws = liquidDuty - cduSkin;
        var fwsM3s = toFws / (CP_W * p.fwsDeltaK) / RHO_W;
        var fwsPump = pumpKw(fwsM3s, p.fwsHeadM, p.fwsPumpEff);
        var qFws = toFws + fwsPump;
        var c = cooler(p, qFws, dbC, wbC);
        var trimKw = qFws * c.trimShare;
        // trim chiller: evaporator ~3 K below FWS supply; condenser on the plant's own medium
        var tEvT = (p.tcsSupplyC - p.cduApproachK) - 3;
        var condR = p.chillerType === 'air' ? 42 : 35, condN = p.chillerType === 'air' ? dbC + 12 : wbC + p.towerApproachK + 5;
        var trimCop = p.trimChillerCop * clamp((condR - tEvT) / Math.max(condN - tEvT, 3), 0.4, 1.8);
        var trimKwe = trimKw / trimCop;
        var coolerFans = c.qCooler / 1000 * p.coolerFanKwPerMw[p.liquidRejection];

        var airIt = it - liquidIt;
        var crahAirM3sPerKw = 1 / (RHO_A * CP_A * p.airDeltaK);    // m³/s per kW sensible
        // fan heat is itself removed by the CRAH: Q = Q0 + SFP·V, V = Q·k → Q = Q0 / (1 − SFP·k)
        var fanFrac = p.sfpKwPerM3s * crahAirM3sPerKw;
        var crahLoad = (airIt + cduSkin) / (1 - fanFrac);
        var crahFans = crahLoad * fanFrac;

        var upsOut = it + (p.cduOnUps ? tcsPump : 0);
        var distLoss = upsOut * p.distLossPct / 100;
        var upsIn = (upsOut + distLoss) / p.upsEff;
        var upsLoss = upsIn - upsOut - distLoss;
        var auxKw = p.itMw * 1000 * p.auxPctOfIt / 100;           // not utilisation-dependent
        var airChillers = p.chillerType === 'air';

        var txLoss = 0, evap, erLoad, erFans, chillerKwe, chwPump, cwPump, towerRej, towerFans, mcc, plr, cop, towerEvapKgS;
        for (var i = 0; i < 6; i++) {                               // transformer loss depends on load: iterate
            erLoad = (upsLoss + distLoss + txLoss) * p.elecRoomShare;
            erFans = erLoad * fanFrac / (1 - fanFrac);
            evap = crahLoad + erLoad + erFans;
            var running = sized ? (p.chillerStageAll ? sized.chillersTotal : Math.max(1, Math.ceil(evap / p.chillerUnitKw))) : Math.ceil(evap / p.chillerUnitKw);
            plr = evap / (running * p.chillerUnitKw);
            cop = chillerCop(p, plr, dbC, wbC);
            chillerKwe = evap / cop;
            chwPump = pumpKw(evap / (CP_W * p.chwDeltaK) / RHO_W, p.chwHeadM, p.pumpEff);
            // condenser heat: to towers (water-cooled) or to air through the chiller's own fans (air-cooled)
            // an air-cooled plant has an air-cooled trim chiller too: no tower unless the liquid path is one
            towerRej = airChillers ? 0 : evap + chillerKwe + chwPump + trimKw + trimKwe;
            if (p.liquidRejection === 'tower') towerRej += c.qCooler;
            var cwKgS = towerRej / (CP_W * 5.5);                    // 5.5 K condenser water ΔT
            cwPump = towerRej > 0 ? pumpKw(cwKgS / RHO_W, p.cwHeadM, p.pumpEff) : 0;
            towerFans = towerRej / 1000 * p.towerFanKwPerMw;
            mcc = (p.cduOnUps ? 0 : tcsPump) + fwsPump + coolerFans + trimKwe
                + crahFans + erFans + chillerKwe + chwPump + cwPump + towerFans + auxKw;
            txLoss = (upsIn + mcc) / p.txEff - upsIn - mcc;
        }
        towerEvapKgS = towerRej * 0.85 / H_FG;
        var coolerEvap = p.liquidRejection === 'tower' ? 0 : c.evapKgS;  // tower mode already counted in towerRej
        var evapKgS = towerEvapKgS + coolerEvap;
        var makeupLps = evapKgS * p.cyclesOfConc / (p.cyclesOfConc - 1);
        var facility = upsIn + mcc + txLoss;

        // energy balance: every kW of electricity in leaves as heat somewhere
        var heatOut = (p.liquidRejection === 'tower' ? 0 : c.qCooler) + towerRej + cwPump + towerFans + coolerFans + auxKw
            + (airChillers ? evap + chillerKwe + chwPump + trimKw + trimKwe : 0)
            + (txLoss + upsLoss + distLoss) * (1 - p.elecRoomShare);

        return {
            it: it, liquidIt: liquidIt, tcsDT: tcsDT, tcsLps: tcsM3s * 1000, tcsPump: tcsPump, liquidDuty: liquidDuty,
            cduSkin: cduSkin, toFws: toFws, fwsLps: fwsM3s * 1000, fwsPump: fwsPump, cooler: c, trimKw: trimKw, trimKwe: trimKwe,
            coolerFans: coolerFans, airIt: airIt, crahLoad: crahLoad, crahFans: crahFans, fanFrac: fanFrac,
            crahAirM3sPerKw: crahAirM3sPerKw, upsOut: upsOut, upsIn: upsIn, upsLoss: upsLoss, distLoss: distLoss,
            txLoss: txLoss, auxKw: auxKw, erLoad: erLoad, erFans: erFans, evap: evap, plr: plr, cop: cop,
            chillerKwe: chillerKwe, chwPump: chwPump, cwPump: cwPump, towerRej: towerRej, towerFans: towerFans,
            mcc: mcc, facility: facility, pue: facility / it, makeupLps: makeupLps, wue: makeupLps * 3600 / it,
            balanceErr: Math.abs(heatOut - facility) / facility
        };
    }

    function compute(input, fault) {
        var p = normalise(input && input.preset && PRESETS[input.preset] ? Object.assign({}, input, PRESETS[input.preset]) : input);
        var f = fault || {};
        var d = solve(p, 1, p.designDbC, p.designWbC, null);         // design day sizes the plant
        var hallIt = d.it / p.halls;
        var racksPerHall = Math.ceil(hallIt / p.rackKw);
        var cduN = Math.ceil(d.liquidDuty / p.halls / p.cduUnitKw);
        var cduPerHall = cduN + p.cduRedundancy;
        var crahLoadHall = d.crahLoad / p.halls;
        var crahN = Math.ceil(crahLoadHall / p.crahUnitKw);
        var crahPerHall = crahN + p.crahRedundancy;
        var chillersN = Math.ceil(d.evap / p.chillerUnitKw);
        var cc = coolerCount(p, d.toFws + d.fwsPump, d.cooler);
        var sized = { chillersTotal: chillersN + p.chillerRedundancy };
        d = solve(p, 1, p.designDbC, p.designWbC, sized);           // design day on the installed plant

        // annual: hour-weighted over climate bins at mean utilisation — PUE = Σ facility·h / Σ IT·h
        var hours = 0, eFac = 0, eIt = 0, water = 0, trimH = 0, binOut = [];
        p.climateBins.forEach(function (b) {
            var s = solve(p, p.itUtil, b[0], b[1], sized), h = b[2];
            hours += h; eFac += s.facility * h; eIt += s.it * h; water += s.makeupLps * 3600 * h / 1000;
            trimH += s.trimKw > 0 ? h : 0;
            binOut.push({ db: b[0], wb: b[1], hours: h, pue: s.pue, cop: s.cop, trimShare: s.cooler.trimShare, plr: s.plr });
        });

        var res = {
            input: p,
            design: d,
            it: { kw: d.it, hallKw: hallIt, racksPerHall: racksPerHall, racks: racksPerHall * p.halls },
            liquid: { itKw: d.liquidIt, dutyKw: d.liquidDuty, tcsDeltaK: d.tcsDT, tcsLps: d.tcsLps, tcsPumpKw: d.tcsPump,
                      cduSkinKw: d.cduSkin, cduPerHall: cduPerHall, cduDutyN: cduN, cduTotal: cduPerHall * p.halls,
                      fwsSupplyC: p.tcsSupplyC - p.cduApproachK, fwsReturnC: p.tcsSupplyC - p.cduApproachK + p.fwsDeltaK,
                      fwsLps: d.fwsLps, fwsPumpKw: d.fwsPump, coolerType: p.liquidRejection,
                      coolerLeavingC: d.cooler.leaving, coolerSinkC: d.cooler.sinkC, trimShareDesign: d.cooler.trimShare,
                      trimKw: d.trimKw, trimKwe: d.trimKwe, coolerKw: d.cooler.qCooler, coolerFanKw: d.coolerFans,
                      coolerUnits: cc.n, coolerUnitsTotal: cc.n + 1, coolerDerate: cc.derate, coolerUnitKw: cc.unitKw },
            air: { itKw: d.airIt, hallLoadKw: crahLoadHall, crahPerHall: crahPerHall, crahDutyN: crahN,
                   crahTotal: crahPerHall * p.halls, airflowHallM3s: crahLoadHall * d.crahAirM3sPerKw, fanKw: d.crahFans,
                   chwSupplyC: p.chwSupplyC, chwReturnC: p.chwSupplyC + p.chwDeltaK, chwLps: d.evap / (CP_W * p.chwDeltaK),
                   chillerType: p.chillerType, chillerEvapKw: d.evap, chillerKwe: d.chillerKwe, chillerCop: d.cop,
                   chillerKwPerRt: KWRT / d.cop, chillerPlr: d.plr, chillersN: chillersN, chillersTotal: sized.chillersTotal,
                   chwPumpKw: d.chwPump, cwPumpKw: d.cwPump, towerKw: d.towerRej, towerFanKw: d.towerFans, makeupLps: d.makeupLps },
            elec: { upsLossKw: d.upsLoss, distLossKw: d.distLoss, txLossKw: d.txLoss, roomLoadKw: d.erLoad,
                    roomFanKw: d.erFans, upsInKw: d.upsIn, upsOutKw: d.upsOut, mccKw: d.mcc, auxKw: d.auxKw },
            totals: { facilityKw: d.facility, pue: d.pue, wue: d.wue, balanceErr: d.balanceErr,
                      pueAnnual: eIt ? eFac / eIt : d.pue, waterM3Year: water, wueAnnual: eIt ? water * 1000 / eIt : 0,
                      trimHours: trimH, hours: hours, bins: binOut,
                      split: { liquid: d.cooler.qCooler + d.trimKw, air: d.crahLoad, elec: d.erLoad } }
        };
        res.trace = traces(res, p);
        res.fault = faultOverlay(res, p, f);
        return res;
    }

    function traces(r, p) {
        var L = r.liquid, A = r.air, E = r.elec;
        return {
            liquidIt: T('Heat into cold plates', L.itKw, 'kW', 'IT × capture', ['itMw', 'capturePct']),
            tcsLps: T('TCS flow', L.tcsLps, 'L/s', 'Q / (cp·ΔT) / ρ, ΔT = TCS return − supply', ['tcsSupplyC', 'tcsReturnC']),
            tcsPumpKw: T('TCS pump power', L.tcsPumpKw, 'kW', 'ρ·g·H·V̇ / η', ['tcsHeadM', 'tcsPumpEff']),
            cduPerHall: T('CDUs per hall', L.cduPerHall, '', 'ceil(hall liquid duty / CDU unit) + N', ['cduUnitKw', 'cduRedundancy']),
            fwsLps: T('FWS flow', L.fwsLps, 'L/s', 'Q / (cp·ΔT_FWS) / ρ', ['fwsDeltaK']),
            coolerLeaving: T('Cooler leaving water (design day)', L.coolerLeavingC, '°C', 'sink + approach; sink = dry bulb, pre-cooled air, or wet bulb by cooler type', ['liquidRejection', 'designDbC', 'designWbC']),
            coolerUnits: T('Liquid coolers (duty units)', L.coolerUnits, '', 'ceil(cooler duty / (rated unit × LMTD_design / LMTD_rating))', ['coolerUnitKw', 'coolerApproachK']),
            trimKw: T('Trim chiller duty (design day)', L.trimKw, 'kW', 'FWS heat × (cooler leaving − FWS supply) / ΔT_FWS', ['designDbC', 'coolerApproachK']),
            airIt: T('IT heat left in the air', A.itKw, 'kW', 'IT × (1 − capture)', ['itMw', 'capturePct']),
            crahPerHall: T('CRAHs per hall', A.crahPerHall, '', 'ceil(hall air load incl. fan heat / CRAH unit) + N', ['crahUnitKw', 'crahRedundancy', 'airDeltaK']),
            chwLps: T('CHW flow', A.chwLps, 'L/s', 'evaporator load / (cp·ΔT_CHW)', ['chwDeltaK']),
            chillerCop: T('Chiller COP (design day)', A.chillerCop, '', 'rated COP × part-load factor(PLR) × lift ratio', ['chillerCopRated', 'chillerVsd', 'chillerStageAll']),
            chillerKwe: T('Chiller input power', A.chillerKwe, 'kW', 'evaporator load / COP', ['chillerCopRated']),
            towerKw: T('Cooling-tower heat rejected', A.towerKw, 'kW', 'evaporator + compressor + CHW pump + trim (+ liquid heat in tower mode)', []),
            makeupLps: T('Make-up water (design day)', A.makeupLps, 'L/s', 'evaporation × C/(C−1), evaporation = latent heat / h_fg', ['cyclesOfConc']),
            elecRoom: T('Electrical-room cooling load', E.roomLoadKw, 'kW', '(UPS + distribution + transformer losses) × room share', ['upsEff', 'txEff', 'distLossPct']),
            pue: T('PUE, design day', r.totals.pue, '', 'facility input / IT at design ambient and full load', []),
            pueAnnual: T('PUE, annual', r.totals.pueAnnual, '', 'Σ facility·h / Σ IT·h over the climate bins at mean utilisation', ['climateBins', 'itUtil'])
        };
    }

    /* Fault overlay — what a failure does to one hall (default DH01). Steady-state shift plus
       the one transient that matters: a cold plate has almost no thermal mass, so a rack that
       loses TCS FLOW reaches its throttle point in seconds; a loop that keeps flow but loses
       heat rejection rides on its water for minutes. */
    function faultOverlay(r, p, f) {
        if (!f || !f.kind) return null;
        var hall = f.hall || 'DH01';
        var cdu = r.liquid.cduPerHall, cduN = r.liquid.cduDutyN;
        var racksPerCdu = r.it.racksPerHall / cdu;
        var hallLiquid = r.liquid.dutyKw / p.halls, hallAir = r.air.hallLoadKw;
        var crahCap = r.air.crahPerHall * p.crahUnitKw;
        var out = { kind: f.kind, hall: hall, lostCdu: [], lostCrah: 0, liquidShortKw: 0, airLoadKw: hallAir,
                    airCapKw: crahCap, flowLost: false, rideThroughS: null, note: '' };
        if (f.kind === 'cdu-feeder') {
            // single-fed CDUs alternate A/B; losing a feeder drops every other CDU
            var lost = p.cduFeed === 'dual' ? 0 : Math.ceil(cdu / 2);
            for (var i = 0; i < lost; i++) out.lostCdu.push(2 * i + 1);
            var left = cdu - lost;
            out.liquidShortKw = Math.max(0, hallLiquid - left * p.cduUnitKw);
            out.flowLost = out.liquidShortKw > 0;
            out.note = p.cduFeed === 'dual' ? 'CDUs are dual-fed through ATS: no CDU drops.'
                : lost + ' of ' + cdu + ' CDUs lose power; ' + left + ' remain for ' + cduN + ' needed.';
        } else if (f.kind === 'cdu') {
            out.lostCdu = [1];
            out.liquidShortKw = Math.max(0, hallLiquid - (cdu - 1) * p.cduUnitKw);
            out.flowLost = out.liquidShortKw > 0;
            out.note = 'One CDU out: N+' + p.cduRedundancy + ' ' + (out.flowLost ? 'is not enough.' : 'covers it.');
        } else if (f.kind === 'crah') {
            out.lostCrah = num(f.count, 2);
            out.airCapKw = (r.air.crahPerHall - out.lostCrah) * p.crahUnitKw;
            out.note = out.lostCrah + ' CRAHs out of ' + r.air.crahPerHall + '.';
        } else if (f.kind === 'fws-pump') {
            var loopM3 = num(f.loopM3, 6) * r.liquid.cduPerHall;           // ASSUMED ~6 m³ TCS volume per CDU
            var margin = 60 - p.tcsReturnC;                                  // ASSUMED throttle at ~60 °C return
            out.rideThroughS = loopM3 * RHO_W * CP_W * Math.max(margin, 1) / hallLiquid;
            out.note = 'FWS lost to ' + hall + ': TCS loop water absorbs the heat for ≈' + Math.round(out.rideThroughS / 60) + ' min.';
        } else if (f.kind === 'chiller') {
            // CHW capacity, not CRAH capacity: the CRAHs only remove what the chillers can absorb
            var plantCap = (r.air.chillersTotal - 1) * p.chillerUnitKw;
            out.airCapKw = Math.min(crahCap, crahCap * plantCap / Math.max(r.air.chillerEvapKw, 1));
            out.note = 'One chiller trips: ' + (plantCap >= r.air.chillerEvapKw ? 'N+' + p.chillerRedundancy + ' covers it.' : 'CHW plant short by ' + Math.round(r.air.chillerEvapKw - plantCap) + ' kW.');
        }
        if (out.liquidShortKw > 0) out.airLoadKw = hallAir + out.liquidShortKw;   // racks still running dump into air
        out.airShortKw = Math.max(0, out.airLoadKw - out.airCapKw);
        out.racksAffected = Math.round(out.lostCdu.length * racksPerCdu);
        if (out.flowLost) out.rideThroughS = 10;                                   // cold plate: seconds
        return out;
    }

    /* Shared state: one plant for every page. localStorage + #p= hash (hash wins, so a link
       carries the scenario). */
    var KEY = 'ltc_plant_v1';
    function load() {
        var s = {};
        try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
        try {
            var m = /[#&]p=([^&]+)/.exec(location.hash || '');
            if (m) s = Object.assign(s, JSON.parse(decodeURIComponent(m[1])));
        } catch (e) { /* malformed hash: keep stored state */ }
        return s;
    }
    function save(input) {
        var diff = {};
        Object.keys(input || {}).forEach(function (k) {
            if (k === 'preset' || (k in DEFAULTS && JSON.stringify(input[k]) !== JSON.stringify(DEFAULTS[k]))) diff[k] = input[k];
        });
        try { localStorage.setItem(KEY, JSON.stringify(diff)); } catch (e) { /* private mode */ }
        try { root.dispatchEvent(new CustomEvent('ltc-plant-change', { detail: diff })); } catch (e) { /* node */ }
        return diff;
    }

    var api = { DEFAULTS: DEFAULTS, PRESETS: PRESETS, TROPICAL_BINS: TROPICAL_BINS, PLR_CURVE: PLR_CURVE,
                compute: compute, solve: solve, normalise: normalise, plrFactor: plrFactor, chillerCop: chillerCop,
                lmtd: lmtd, load: load, save: save, KEY: KEY,
                CONST: { CP_W: CP_W, RHO_W: RHO_W, CP_A: CP_A, RHO_A: RHO_A, H_FG: H_FG, KWRT: KWRT } };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.LTCPlant = api;
})(typeof window !== 'undefined' ? window : globalThis);
