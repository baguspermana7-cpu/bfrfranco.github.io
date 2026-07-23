#!/usr/bin/env node
/**
 * test-ltc-parity.mjs — Golden-parity gate for the LTC engine migration.
 *
 * Loads the OLD computeModel (inline constants, extracted verbatim from the
 * pre-migration ltc-system-modelling-lab.js body) and the NEW one
 * (models.ltc.compute from rz-engine.js) and asserts they produce
 * bit-identical results over ≥200 randomized-but-seeded inputs.
 *
 * Every output field is checked with ε=1e-9 relative tolerance.
 * Exit 0 = 100% pass; exit 1 = any failure.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/* ── Load the NEW engine (models.ltc.compute) ── */
function loadNewEngine() {
    const src = readFileSync(resolve(ROOT, 'rz-engine.js'), 'utf8');
    const win = {};
    win.window = win;
    win.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    win.CustomEvent = function () {};
    win.dispatchEvent = function () {};
    win.addEventListener = function () {};
    win.removeEventListener = function () {};
    win.console = console;
    const ctx = vm.createContext(win);
    vm.runInContext(src, ctx, { filename: 'rz-engine.js' });
    if (!win.RZEngine) throw new Error('RZEngine did not attach');
    return win.RZEngine.models.ltc.compute;
}

/* ── Inline OLD computeModel (verbatim extraction of the pre-migration body) ── */
function makeOldComputeModel() {
    const CLIMATE_FACTORS = {
        tropical:    { wetBulb: 26, baseWue: 0.62, climateCopBias: -0.45 },
        temperate:   { wetBulb: 17, baseWue: 0.22, climateCopBias:  0.38 },
        dry:         { wetBulb: 16, baseWue: 0.30, climateCopBias:  0.55 },
        continental: { wetBulb: 19, baseWue: 0.38, climateCopBias:  0.22 }
    };
    const COOLANTS = {
        water: { cp: 4.186, rho: 997 },
        pg20:  { cp: 3.92,  rho: 1025 },
        pg30:  { cp: 3.75,  rho: 1038 }
    };
    const RACK_PROFILES = {
        ai_hpc_direct_liquid:   { label: 'AI/HPC Direct Liquid',     baseDensity: 70,  liquidBias: 1.18, airResidual: 0.24, riskBias: 7,  futureBias: 1.18 },
        enterprise_mixed:       { label: 'Enterprise Mixed',          baseDensity: 28,  liquidBias: 0.86, airResidual: 0.56, riskBias: 3,  futureBias: 0.72 },
        immersion_single_phase: { label: 'Immersion Single-Phase',    baseDensity: 85,  liquidBias: 1.28, airResidual: 0.14, riskBias: 6,  futureBias: 1.28 },
        immersion_two_phase:    { label: 'Immersion Two-Phase',       baseDensity: 100, liquidBias: 1.36, airResidual: 0.08, riskBias: 7,  futureBias: 1.4  },
        legacy_air_plus_rdhx:   { label: 'Legacy Air + RDHx',        baseDensity: 22,  liquidBias: 0.62, airResidual: 0.72, riskBias: 11, futureBias: 0.42 }
    };

    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    function ashraeScore(supplyTemp, returnTemp, deltaT, effectiveCapture, designDensity, controlIndex) {
        var score = 100;
        if (supplyTemp < 18 || supplyTemp > 40) score -= 30;
        if (returnTemp > 50) score -= 18;
        if (deltaT < 6) score -= 14;
        if (deltaT > 14) score -= 8;
        if (effectiveCapture < 65) score -= 12;
        if (designDensity > 100) score -= 7;
        if (controlIndex < 60) score -= 9;
        return clamp(score, 0, 100);
    }
    function ansiScore(redundancy, monitoring, rackDensity, hydraulicMargin, rackProfileKey) {
        var base = redundancy === '2N' ? 88 : (redundancy === 'N1' ? 78 : 62);
        base += monitoring * 0.11;
        if (rackDensity > 80) base -= 6;
        if (hydraulicMargin > 25) base -= 4;
        if (rackProfileKey === 'legacy_air_plus_rdhx') base -= 6;
        return clamp(base, 0, 100);
    }
    function isoScore(monitoring, pue, netCarbonTons, annualGwh, futureFactor) {
        var score = 35 + monitoring * 0.42;
        if (pue <= 1.2) score += 21;
        else if (pue <= 1.3) score += 15;
        else if (pue <= 1.4) score += 9;
        else if (pue <= 1.5) score += 4;
        var intensity = annualGwh > 0 ? netCarbonTons / annualGwh : 0;
        if (intensity <= 250) score += 8;
        else if (intensity <= 350) score += 4;
        if (futureFactor > 1.15) score += 4;
        return clamp(score, 0, 100);
    }
    function nfpaScore(fireType, concurrent, designDensity) {
        var map = { clean_agent: 94, water_mist: 88, double_interlock: 81, dry_pipe: 72 };
        var score = map[fireType] || 70;
        if (concurrent) score += 4;
        if (designDensity > 90) score -= 4;
        return clamp(score, 0, 100);
    }
    function uptimeScore(redundancy, monitoring, concurrent, upsEff, controlIndex) {
        var score = redundancy === '2N' ? 92 : (redundancy === 'N1' ? 80 : 58);
        score += monitoring * 0.1;
        score += (upsEff - 95) * 3.2;
        score += (controlIndex - 70) * 0.14;
        if (concurrent) score += 6;
        return clamp(score, 0, 100);
    }

    return function computeModel(input) {
        var climateData = CLIMATE_FACTORS[input.climate] || CLIMATE_FACTORS.tropical;
        var coolant = COOLANTS[input.coolantKey] || COOLANTS.water;
        var rackProfile = RACK_PROFILES[input.rackType] || RACK_PROFILES.ai_hpc_direct_liquid;
        var failureMode = input.failureMode || 'normal';
        var failureNote = 'Normal operation profile';
        var elecPriceEff = input.elecPrice;
        var carbonIntensityEff = input.carbonIntensity;
        var failureRiskAdd = 0;

        var yearDelta = Math.max(input.modelYear - 2026, 0);
        var futureFactor = clamp(1 + ((input.coefFutureTech + (yearDelta * 0.9)) / 100) * rackProfile.futureBias, 0.8, 1.65);
        var controlIndex = clamp(
            (input.controlQuality * 0.55) +
            (input.predictiveGain * 0.95) +
            (input.monitoring * 0.22) +
            (input.concurrent ? 8 : 0),
            0, 100
        );

        if (failureMode === 'sensor_degraded') {
            controlIndex = clamp(controlIndex - 18, 0, 100);
            failureRiskAdd += 13;
            failureNote = 'Sensor degraded: reduced control observability';
        } else if (failureMode === 'redundancy_degraded') {
            failureRiskAdd += 16;
            failureNote = 'Redundancy degraded: resilience margin reduced';
        } else if (failureMode === 'grid_stress') {
            elecPriceEff *= 1.18;
            carbonIntensityEff *= 1.12;
            failureRiskAdd += 6;
            failureNote = 'Grid stress: tariff and carbon intensity elevated';
        }

        var designDensity = Math.max(5, input.rackDensityTarget * (1 + input.highDensityShare / 250) * (1 + yearDelta * 0.0045));
        var densityStress = clamp(designDensity / 70, 0.5, 2.8);
        var effectiveCapture = clamp(
            input.liquidCapture * (0.74 + rackProfile.liquidBias * 0.26) * (input.coefHeatTransfer / 100) * (1 + controlIndex / 500),
            20, 99
        );

        var itKw = Math.max(input.itLoadMw * 1000, 100);
        var liquidKw = itKw * (effectiveCapture / 100);
        var airKw = itKw - liquidKw;
        var baseDeltaT = Math.max(input.returnTemp - input.supplyTemp, 3);
        var deltaT = clamp(baseDeltaT * (0.9 + densityStress * 0.08), 3, 20);

        var massFlowKgS = liquidKw / (coolant.cp * deltaT);
        var baseFlowM3s = massFlowKgS / coolant.rho;
        var redundancyFactor = input.redundancy === '2N' ? 2 : (input.redundancy === 'N1' ? 1.15 : 1);
        var pipeFactor = input.coefPipeLoss;
        var designFlowM3s = baseFlowM3s * redundancyFactor * (1 + (input.hydraulicMargin / 100)) * pipeFactor;
        var flowLpm = designFlowM3s * 60000;

        var pumpHeadEff = input.pumpHead * pipeFactor * (1 + (densityStress - 1) * 0.22);
        var hydraulicPowerKw = (coolant.rho * 9.81 * pumpHeadEff * designFlowM3s) / 1000;
        var pumpPowerKw = hydraulicPowerKw / Math.max(input.pumpEff / 100, 0.35);

        var cduLossKw = liquidKw * (input.coefCduLoss / 100);
        var economizerFraction = input.economizerHours / 100;
        var supplyBonus = clamp((input.supplyTemp - 28) * 0.11, -0.45, 1.5);
        var controlBonus = (controlIndex - 60) / 180;

        var liquidCop = clamp(
            (6.1 + climateData.climateCopBias + supplyBonus + economizerFraction * 1.05 + controlBonus) * futureFactor,
            3.0, 19
        );

        var airCopEff = clamp(
            input.airCop * (1 + economizerFraction * 0.58 + controlBonus * 0.32) * (0.92 + (1 - rackProfile.airResidual) * 0.12),
            1.7, 16
        );

        if (failureMode === 'heatwave') {
            airCopEff = clamp(airCopEff * 0.82, 1.4, 16);
            failureRiskAdd += 9;
            failureNote = 'Heatwave stress: reduced air-path cooling effectiveness';
        }

        var liquidCoolingKw = ((liquidKw + cduLossKw) / liquidCop) + pumpPowerKw;
        if (failureMode === 'pump_degraded') {
            pumpPowerKw *= 1.28;
            liquidCoolingKw *= 1.14;
            flowLpm *= 0.9;
            failureRiskAdd += 11;
            failureNote = 'Pump degraded: lower flow and higher hydraulic overhead';
        }
        var airCoolingKw = airKw / airCopEff;
        var fanKw = itKw * (input.fanPower / 100) * (1 - effectiveCapture / 100 * 0.55) * (1 - controlBonus * 0.18);
        var totalCoolingKw = liquidCoolingKw + airCoolingKw + fanKw;
        var systemCop = itKw / Math.max(totalCoolingKw, 1);

        var upsInputKw = itKw / Math.max(input.upsEff / 100, 0.9);
        var upsLossKw = upsInputKw - itKw;
        var distLossKw = upsInputKw * (input.distLoss / 100);

        var auxKw = itKw * 0.03;
        var totalFacilityKw = itKw + totalCoolingKw + upsLossKw + distLossKw + auxKw;
        var pue = totalFacilityKw / itKw;

        var annualKwh = totalFacilityKw * 8760;
        var annualGwh = annualKwh / 1000000;
        var annualEnergyCost = annualKwh * elecPriceEff;

        var wue = climateData.baseWue * (1 - economizerFraction * 0.43) * (1 - effectiveCapture / 100 * 0.32) * (1 - (futureFactor - 1) * 0.18);
        wue = Math.max(wue, 0.04);
        var annualWaterM3 = (annualKwh * wue) / 1000;
        var annualWaterCost = annualWaterM3 * input.waterTariff;
        var grossOpex = annualEnergyCost + annualWaterCost;

        var heatReuseKwAvg = liquidKw * (input.heatReuse / 100) * (0.42 + rackProfile.futureBias * 0.1) * (1 + yearDelta * 0.012);
        var heatReuseKwh = heatReuseKwAvg * 8760;
        var heatReuseCredit = heatReuseKwh * elecPriceEff * 0.62;
        var netOpex = Math.max(grossOpex - heatReuseCredit, 0);

        var annualCarbonTons = (annualKwh * carbonIntensityEff) / 1000;
        var avoidedCarbonTons = (heatReuseKwh * carbonIntensityEff * 0.65) / 1000;
        var netCarbonTons = Math.max(annualCarbonTons - avoidedCarbonTons, 0);

        var cduBase = Math.max(1, Math.ceil(liquidKw / input.cduUnit));
        var cduCount = input.redundancy === '2N' ? cduBase * 2 : (input.redundancy === 'N1' ? cduBase + 1 : cduBase);
        var rackDensity = itKw / Math.max(input.rackCount, 1);
        var rackDensityGap = designDensity - rackDensity;

        var scoreA = ashraeScore(input.supplyTemp, input.returnTemp, deltaT, effectiveCapture, designDensity, controlIndex);
        var scoreB = ansiScore(input.redundancy, input.monitoring, rackDensity, input.hydraulicMargin, input.rackType);
        var scoreC = isoScore(input.monitoring, pue, netCarbonTons, annualGwh, futureFactor);
        var scoreD = nfpaScore(input.fireType, input.concurrent, designDensity);
        var scoreE = uptimeScore(input.redundancy, input.monitoring, input.concurrent, input.upsEff, controlIndex);
        var totalScore = (scoreA * 0.24) + (scoreB * 0.16) + (scoreC * 0.16) + (scoreD * 0.2) + (scoreE * 0.24);

        var riskIndex = 18;
        riskIndex += rackProfile.riskBias;
        if (input.redundancy === 'N') riskIndex += 12;
        if (!input.concurrent) riskIndex += 8;
        if (designDensity > 90) riskIndex += 8;
        if (rackDensity > 80) riskIndex += 8;
        if (input.fireType === 'dry_pipe') riskIndex += 6;
        riskIndex += Math.max(0, (80 - input.monitoring) * 0.2);
        riskIndex += Math.max(0, (input.upsEff < 96 ? (96 - input.upsEff) * 3 : 0));
        riskIndex -= Math.max(0, (controlIndex - 70) * 0.18);
        riskIndex -= yearDelta * 0.12;
        riskIndex += failureRiskAdd;
        riskIndex = clamp(riskIndex, 5, 95);

        var confidence = clamp(
            45 +
            (input.monitoring * 0.32) +
            (input.concurrent ? 6 : 0) +
            (input.countryKey !== 'custom' ? 8 : 0) +
            ((deltaT >= 6 && deltaT <= 14) ? 6 : 0) +
            ((input.hydraulicMargin <= 20) ? 3 : 0) +
            ((input.coefPipeLoss >= 0.9 && input.coefPipeLoss <= 1.2) ? 2 : 0),
            0, 99
        );

        var pueGap = pue - input.targetPue;
        var copGap = systemCop - input.targetCop;

        return {
            input: input,
            rackTypeLabel: rackProfile.label,
            itKw: itKw,
            liquidKw: liquidKw,
            airKw: airKw,
            effectiveCapture: effectiveCapture,
            designDensity: designDensity,
            rackDensityGap: rackDensityGap,
            controlIndex: controlIndex,
            futureFactor: futureFactor,
            yearDelta: yearDelta,
            deltaT: deltaT,
            flowLpm: flowLpm,
            pumpPowerKw: pumpPowerKw,
            cduCount: cduCount,
            pue: pue,
            systemCop: systemCop,
            wue: wue,
            annualGwh: annualGwh,
            annualEnergyCost: annualEnergyCost,
            elecPriceEff: elecPriceEff,
            carbonIntensityEff: carbonIntensityEff,
            annualWaterCost: annualWaterCost,
            annualOpex: grossOpex,
            heatReuseCredit: heatReuseCredit,
            netOpex: netOpex,
            annualCarbonTons: annualCarbonTons,
            avoidedCarbonTons: avoidedCarbonTons,
            netCarbonTons: netCarbonTons,
            rackDensity: rackDensity,
            confidence: confidence,
            riskIndex: riskIndex,
            failureMode: failureMode,
            failureNote: failureNote,
            scores: { ashrae: scoreA, ansi: scoreB, iso: scoreC, nfpa: scoreD, uptime: scoreE, total: totalScore },
            pueGap: pueGap,
            copGap: copGap,
            totalFacilityKw: totalFacilityKw,
            liquidCop: liquidCop,
            airCopEff: airCopEff,
            massFlowKgS: massFlowKgS,
            internals: {
                yearDelta: yearDelta,
                densityStress: densityStress,
                redundancyFactor: redundancyFactor,
                pipeFactor: pipeFactor,
                pumpHeadEff: pumpHeadEff,
                liquidCop: liquidCop,
                airCopEff: airCopEff,
                totalCoolingKw: totalCoolingKw,
                economizerFraction: economizerFraction,
                annualKwh: annualKwh,
                annualWaterM3: annualWaterM3,
                heatReuseKwh: heatReuseKwh
            },
            breakdown: {
                it: itKw,
                liquidCooling: liquidCoolingKw,
                airCooling: airCoolingKw,
                pump: pumpPowerKw,
                elecLoss: upsLossKw + distLossKw,
                aux: auxKw + fanKw
            }
        };
    };
}

/* ── Deterministic PRNG (mulberry32) ── */
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/* ── Input generator ── */
const RACK_TYPES = ['ai_hpc_direct_liquid', 'enterprise_mixed', 'immersion_single_phase', 'immersion_two_phase', 'legacy_air_plus_rdhx'];
const COOLANTS_KEYS = ['water', 'pg20', 'pg30'];
const ARCH_MODES = ['direct_liquid', 'hybrid', 'air_inrow_dahu', 'manual'];
const CLIMATES = ['tropical', 'temperate', 'dry', 'continental'];
const COUNTRIES = ['custom', 'sg', 'us_va', 'nl', 'id_jkt', 'in_mum', 'ie'];
const REDUNDANCIES = ['N', 'N1', '2N'];
const FAILURE_MODES = ['normal', 'sensor_degraded', 'redundancy_degraded', 'grid_stress', 'heatwave', 'pump_degraded'];
const FIRE_TYPES = ['clean_agent', 'water_mist', 'double_interlock', 'dry_pipe'];

function pick(arr, r) { return arr[Math.floor(r * arr.length)]; }
function rng(lo, hi, r) { return lo + r * (hi - lo); }

function genInput(rand) {
    const supplyTemp = rng(16, 42, rand());
    const returnTemp = supplyTemp + rng(3, 18, rand());
    return {
        itLoadMw:          rng(0.5, 80, rand()),
        rackCount:         Math.round(rng(10, 2000, rand())),
        rackType:          pick(RACK_TYPES, rand()),
        rackDensityTarget: rng(5, 180, rand()),
        highDensityShare:  rng(0, 100, rand()),
        modelYear:         Math.round(rng(2024, 2032, rand())),
        architectureMode:  pick(ARCH_MODES, rand()),
        liquidCapture:     rng(0, 100, rand()),
        coolantKey:        pick(COOLANTS_KEYS, rand()),
        supplyTemp:        supplyTemp,
        returnTemp:        returnTemp,
        pumpHead:          rng(5, 80, rand()),
        pumpEff:           rng(35, 95, rand()),
        hydraulicMargin:   rng(0, 40, rand()),
        controlQuality:    rng(0, 100, rand()),
        predictiveGain:    rng(0, 60, rand()),
        coefHeatTransfer:  rng(60, 99, rand()),
        coefCduLoss:       rng(0.5, 5, rand()),
        coefPipeLoss:      rng(0.75, 1.8, rand()),
        coefFutureTech:    rng(-10, 45, rand()),
        cduUnit:           rng(200, 2000, rand()),
        redundancy:        pick(REDUNDANCIES, rand()),
        climate:           pick(CLIMATES, rand()),
        countryKey:        pick(COUNTRIES, rand()),
        airCop:            rng(1.5, 12, rand()),
        economizerHours:   rng(0, 95, rand()),
        fanPower:          rng(1, 8, rand()),
        upsEff:            rng(90, 99, rand()),
        distLoss:          rng(0.5, 5, rand()),
        heatReuse:         rng(0, 60, rand()),
        elecPrice:         rng(0.03, 0.35, rand()),
        waterTariff:       rng(0.5, 5, rand()),
        carbonIntensity:   rng(0.1, 1.2, rand()),
        monitoring:        rng(0, 100, rand()),
        fireType:          pick(FIRE_TYPES, rand()),
        targetPue:         rng(1.05, 1.6, rand()),
        targetCop:         rng(3, 12, rand()),
        failureMode:       pick(FAILURE_MODES, rand()),
        concurrent:        rand() > 0.4
    };
}

/* ── Assert helpers ── */
let pass = 0, fail = 0;
const failures = [];
const EPS = 1e-9;
let maxDrift = 0;

function cmpField(path, oldVal, newVal, inputIdx) {
    if (typeof oldVal === 'number' && typeof newVal === 'number') {
        const absOld = Math.abs(oldVal);
        const relErr = absOld > 0 ? Math.abs(oldVal - newVal) / absOld : Math.abs(oldVal - newVal);
        if (relErr > maxDrift) maxDrift = relErr;
        if (relErr > EPS) {
            fail++;
            failures.push(`input[${inputIdx}] ${path}: old=${oldVal} new=${newVal} relErr=${relErr.toExponential(3)}`);
        } else {
            pass++;
        }
    } else if (typeof oldVal === 'string' || typeof oldVal === 'boolean') {
        if (oldVal !== newVal) {
            fail++;
            failures.push(`input[${inputIdx}] ${path}: old=${JSON.stringify(oldVal)} new=${JSON.stringify(newVal)}`);
        } else {
            pass++;
        }
    }
}

function compareResults(oldR, newR, idx) {
    const SCALAR_FIELDS = [
        'itKw','liquidKw','airKw','effectiveCapture','designDensity','rackDensityGap',
        'controlIndex','futureFactor','yearDelta','deltaT','flowLpm','pumpPowerKw',
        'cduCount','pue','systemCop','wue','annualGwh','annualEnergyCost','elecPriceEff',
        'carbonIntensityEff','annualWaterCost','annualOpex','heatReuseCredit','netOpex',
        'annualCarbonTons','avoidedCarbonTons','netCarbonTons','rackDensity','confidence',
        'riskIndex','pueGap','copGap','totalFacilityKw','liquidCop','airCopEff','massFlowKgS'
    ];
    for (const f of SCALAR_FIELDS) cmpField(f, oldR[f], newR[f], idx);

    cmpField('failureMode', oldR.failureMode, newR.failureMode, idx);
    cmpField('failureNote', oldR.failureNote, newR.failureNote, idx);
    cmpField('rackTypeLabel', oldR.rackTypeLabel, newR.rackTypeLabel, idx);

    for (const k of ['ashrae','ansi','iso','nfpa','uptime','total']) {
        cmpField('scores.' + k, oldR.scores[k], newR.scores[k], idx);
    }
    for (const k of ['it','liquidCooling','airCooling','pump','elecLoss','aux']) {
        cmpField('breakdown.' + k, oldR.breakdown[k], newR.breakdown[k], idx);
    }
    for (const k of ['yearDelta','densityStress','redundancyFactor','pipeFactor','pumpHeadEff',
                      'liquidCop','airCopEff','totalCoolingKw','economizerFraction',
                      'annualKwh','annualWaterM3','heatReuseKwh']) {
        cmpField('internals.' + k, oldR.internals[k], newR.internals[k], idx);
    }
}

/* ── Main ── */
const N = 250;
const SEED = 0xDEADBEEF;

const oldCompute = makeOldComputeModel();
const newCompute = loadNewEngine();
const rand = mulberry32(SEED);

for (let i = 0; i < N; i++) {
    const inp = genInput(rand);
    const oldR = oldCompute(inp);
    const newR = newCompute(inp);
    compareResults(oldR, newR, i);
}

console.log(`\nLTC parity gate: ${N} input combinations`);
console.log(`  checks: ${pass + fail}  pass: ${pass}  fail: ${fail}`);
console.log(`  max relative drift: ${maxDrift.toExponential(3)}`);

if (failures.length > 0) {
    console.error('\nFAILURES:');
    failures.slice(0, 20).forEach(f => console.error('  ' + f));
    if (failures.length > 20) console.error(`  ... and ${failures.length - 20} more`);
    process.exit(1);
}

console.log('\nPARITY 100% — all fields match within ε=1e-9');
process.exit(0);
