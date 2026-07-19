#!/usr/bin/env python3
"""ENGINE ACCURACY TRUTH HARNESS (M1) — independent high-precision computation
of worked examples for every rz-engine model family. Emits
tools/fixtures/accuracy-truth.json consumed by tools/test-engine-accuracy.mjs.

Independence rule: every value here is derived from the AUTHORITATIVE formula
(annuity math, binomial sums, Weibull CDF, Magnus, Colebrook iterated to 1e-12,
exact Poisson sums, machine-precision Φ⁻¹ via Newton on math.erf) — never by
copying engine output. Where the engine implements a documented approximation
(Haaland, BSM/Acklam), the fixture carries BOTH the exact truth and the
approximation's allowed error bound so the gate asserts |engine−truth| ≤ bound.
Run: python3 tools/verify-engine-accuracy.py   (regenerates the fixture)
"""
import json, math, os
from decimal import Decimal, getcontext

getcontext().prec = 50
OUT = os.path.join(os.path.dirname(__file__), 'fixtures', 'accuracy-truth.json')

T = {"_generated_by": "tools/verify-engine-accuracy.py", "cases": {}}
def case(fid, inputs, truth, tol, note, kind="abs"):
    T["cases"][fid] = {"inputs": inputs, "truth": truth, "tol": tol, "tolKind": kind, "note": note}

# ── FINANCIAL ────────────────────────────────────────────────────────────────
def npv(cfs, r):
    r = Decimal(str(r)); return float(sum(Decimal(str(cf)) / (1 + r) ** t for t, cf in enumerate(cfs)))

CF1 = [-1000, 300, 300, 300, 300]
case("roi.npv.basic", {"cashflows": CF1, "rate": 0.08}, npv(CF1, 0.08), 1e-9, "geometric discounting, Decimal 50dp", "abs")
CF2 = [-5_000_000, 900_000, 1_100_000, 1_300_000, 1_500_000, 1_700_000, 1_700_000, 1_700_000]
case("roi.npv.large", {"cashflows": CF2, "rate": 0.10}, npv(CF2, 0.10), 1e-6, "large-magnitude series", "abs")

def irr(cfs):
    # Decimal Newton with bisection safety, 60 iters — root of NPV(r)=0
    lo, hi = Decimal("-0.99"), Decimal("10")
    def f(r): return sum(Decimal(str(cf)) / (1 + r) ** t for t, cf in enumerate(cfs))
    flo, fhi = f(lo), f(hi)
    assert flo * fhi < 0
    for _ in range(200):
        mid = (lo + hi) / 2; fm = f(mid)
        if flo * fm <= 0: hi, fhi = mid, fm
        else: lo, flo = mid, fm
    return float((lo + hi) / 2)

case("roi.irr.basic", {"cashflows": CF1}, irr(CF1), 1e-6, "bisection 200 iters, Decimal", "abs")
case("roi.irr.large", {"cashflows": CF2}, irr(CF2), 1e-6, "large-magnitude convergence quality", "abs")

def crf(r, n):
    r = Decimal(str(r)); return float(r * (1 + r) ** n / ((1 + r) ** n - 1))
case("finance.crf.8pct20y", {"r": 0.08, "n": 20}, crf(0.08, 20), 1e-12, "capital recovery factor identity", "abs")

def disc_payback(cfs, r):
    cum = Decimal(0); rr = Decimal(str(r))
    prev = Decimal(0)
    for t, cf in enumerate(cfs):
        d = Decimal(str(cf)) / (1 + rr) ** t
        prev = cum; cum += d
        if cum >= 0 and t > 0:
            return float((t - 1) + (-prev) / d)
    return math.inf
case("roi.discountedPayback", {"cashflows": CF1, "rate": 0.06}, disc_payback(CF1, 0.06), 1e-9, "fractional-year interpolation", "abs")

# escalation: engine projectByYear PUSHES Math.round(v) but compounds the UNROUNDED v.
esc_true_y10 = float(Decimal("1000000") * (Decimal("1.03") ** 10))
case("finance.projectByYear.y10", {"startVal": 1000000, "ratePct": 0.03, "startYear": 2026, "endYear": 2036, "pickYear": 2036},
     esc_true_y10, 0.5, "display rounds ≤$0.5; compounding itself must be UNROUNDED (no drift)", "abs")

# ── RELIABILITY (exact probability math) ─────────────────────────────────────
def avail(mtbf, mttr): return float(Decimal(mtbf) / (Decimal(mtbf) + Decimal(mttr)))
a_ups = avail(250000, 8)
case("rel.availability.ups", {"mtbf": 250000, "mttr": 8}, a_ups, 1e-12, "steady-state MTBF/(MTBF+MTTR)", "abs")

# THE saturation case: two parallel paths of a high-availability item — engine's
# in-chain toFixed(6) collapses this to exactly 1.0 (defect M2a-1).
par2 = float(1 - (Decimal(1) - Decimal(str(a_ups))) ** 2)
case("rel.parallel.saturation", {"a": a_ups, "paths": 2}, par2, 1e-15,
     "1-(1-a)^2 = 0.999999998976 — must NOT saturate to 1.0", "abs")

a_crac = avail(100000, 6)
chain2 = float((1 - (Decimal(1) - Decimal(str(a_ups))) ** 2) * (1 - (Decimal(1) - Decimal(str(a_crac))) ** 2))
case("rel.systemAvailability.ups-crac-2n", {"components": ["ups", "crac"], "redundancy": "2n"}, chain2, 1e-12,
     "series of two 2-path parallel groups — full-precision chain", "abs")
case("rel.downtime.chain2", {"availability": chain2}, float((1 - Decimal(str(chain2))) * 8760 * 60), 1e-6,
     "annual downtime minutes of the chain — nonzero (was 0.0 via saturation)", "abs")

def k_of_n(a, k, n):
    a = Decimal(str(a)); s = Decimal(0)
    for i in range(k, n + 1):
        s += Decimal(math.comb(n, i)) * a ** i * (1 - a) ** (n - i)
    return float(s)
case("rel.kOutOfN.2of3", {"a": 0.99, "k": 2, "n": 3}, k_of_n(0.99, 2, 3), 1e-12, "exact binomial sum", "abs")
case("rel.kOutOfN.3of4-high", {"a": 0.9999, "k": 3, "n": 4}, k_of_n(0.9999, 3, 4), 1e-15, "high-availability k-of-n — no 6dp collapse", "abs")

# ── STATISTICS ───────────────────────────────────────────────────────────────
def phi_inv(p):
    # Newton on Φ(x)=p using math.erf (double precision ≈1e-16)
    x = 0.0
    for _ in range(60):
        fx = 0.5 * (1 + math.erf(x / math.sqrt(2))) - p
        dfx = math.exp(-x * x / 2) / math.sqrt(2 * math.pi)
        if dfx == 0: break
        step = fx / dfx
        x -= step
        if abs(step) < 1e-15: break
    return x
for p in (0.8, 0.95, 0.99, 0.999):
    case(f"stat.phiInv.{p}", {"p": p}, phi_inv(p), 2e-9,
         "Φ⁻¹ truth (erf-Newton, ~1e-15). tol = Acklam(2003) bound 1.15e-9 + margin (M2b)", "abs")

def poisson_cdf(k, lam):
    lam = Decimal(str(lam)); s = Decimal(0); term = (-lam).exp()
    for i in range(0, k + 1):
        s += term; term = term * lam / (i + 1)
    return float(s)
case("stat.poissonCdf.3at2p5", {"k": 3, "lambda": 2.5}, poisson_cdf(3, 2.5), 1e-9, "exact Poisson partial sum", "abs")
case("stat.poissonCdf.10at20", {"k": 10, "lambda": 20}, poisson_cdf(10, 20), 1e-9, "left-tail heavy case", "abs")

def weibull_F(t, beta, eta): return float(1 - Decimal(-((Decimal(t) / Decimal(eta)) ** Decimal(beta))).exp())
case("asset.weibullF.b2e15t5", {"beta": 2.0, "eta": 15, "t": 5}, weibull_F(5, 2, 15), 5e-5,
     "F(t)=1-exp(-(t/η)^β); engine returns 4dp → tol 5e-5", "abs")

# ── THERMO-HYDRAULICS ────────────────────────────────────────────────────────
# Magnus dew point with the engine's documented Alduchov-Eskridge constants.
A_MAG, B_MAG = 17.625, 243.04
def dew(tC, rhPct):
    g = math.log(rhPct / 100.0) + A_MAG * tC / (B_MAG + tC)
    return B_MAG * g / (A_MAG - g)
case("cdu.dewPoint.t20rh60", {"tAirC": 20, "rhPct": 60}, dew(20, 60), 0.05,
     "Magnus (Alduchov-Eskridge 2006, α=17.625 β=243.04); engine rounds 1dp", "abs")

# CDU size(): flow = kW/(ρ·cp·ΔT), ρ=997, cp=4.18 (engine DATA.cdu)
flow_lpm = 1000.0 / (997 * 4.18 * 10) * 60000
case("cdu.size.flow1MWdT10", {"itKw": 1000, "deltaT": 10}, flow_lpm, 0.05, "Q=kW/(ρ·cp·ΔT)·60000, engine 1dp", "abs")

def colebrook(re, rel):
    # iterate 1/√f = -2 log10(rel/3.7 + 2.51/(Re √f)) to 1e-14
    x = 8.0  # 1/sqrt(f) initial
    for _ in range(200):
        nx = -2 * math.log10(rel / 3.7 + 2.51 / re * x)
        if abs(nx - x) < 1e-14: x = nx; break
        x = nx
    return 1 / (x * x)
# hydraulics() internal case: itKw=500, dT=10, supply 20 → Tavg 25; engine props:
Tavg = 25.0
rho = 1000.6 - 0.0476 * Tavg - 0.0034 * Tavg * Tavg
mu = 2.414e-5 * (10 ** (247.8 / (Tavg + 133.0)))
flow_lpm2 = 500 * 60 / ((rho / 1000) * 4.186 * 10)
D = 0.1; area = math.pi * (D / 2) ** 2
vel = (flow_lpm2 / 1000 / 60) / area
Re = rho * vel * D / mu
rel_r = 0.045 / 100
f_cole = colebrook(Re, rel_r)
case("cdu.hydraulics.friction500kW", {"itKw": 500, "deltaTK": 10, "supplyC": 20, "pipeDiamMm": 100, "pipeLengthM": 50},
     f_cole, 0.02 * f_cole, "Colebrook truth (1e-14); Haaland documented band ±2%", "abs")
case("cdu.hydraulics.reynolds500kW", {"itKw": 500, "deltaTK": 10, "supplyC": 20, "pipeDiamMm": 100, "pipeLengthM": 50},
     Re, Re * 1e-3 + 1.0, "Re from engine's own ρ(T)/μ(T) correlations (verifies plumbing, 1dp rounding)", "abs")

# ── DEEP-SEA POSTER FLOOR (owner baseline — must reproduce EXACTLY) ─────────
case("cooling.deepSea.poster.flow", {"itLoadMw": 150, "pueTarget": 1.15, "mode": "poster"},
     8.625, 1e-9, "poster: 172.5 MW /(4.0·5) = 8.625 m³/s — OWNER FLOOR", "abs")
case("cooling.deepSea.poster.pumps", {"itLoadMw": 150, "pueTarget": 1.15, "mode": "poster"},
     4, 0, "poster: 4 duty (+1 standby) × 2.9 m³/s — OWNER FLOOR", "abs")

# ── OPEX self-consistency (whole-dollar accounting convention) ──────────────
energy_true = 2.5 * 1000 * 1.5 * 8760 * 0.09
case("opex.powerCostAnnual.2p5MW", {"mw": 2.5, "pue": 1.5, "rate": 0.09}, energy_true, 0.5,
     "whole-dollar accounting rounding — |engine−truth| ≤ $0.5 (documented convention)", "abs")


# ── M3-FULL: remaining model families (formula-grade truth) ─────────────────
# FIRE — NFPA 2001 clean-agent quantity. Constants (k1,k2,designC) are the
# published NFPA-2001 Novec-1230 table values (shared w/ engine DATA — the
# independence is in the FORMULA implementation).
k1, k2, Cc = 0.0664, 0.0002741, 4.5
s_vol = k1 + k2 * 20.0
fire_kg = (1463.0 / s_vol) * (Cc / (100 - Cc))
case("fire.agentQuantity.novec1463m3", {"volumeM3": 1463, "agent": "novec1230", "tempC": 20},
     fire_kg, 0.06, "m = V/s · C/(100−C), s = k1+k2·T (NFPA 2001 eq.); engine 1dp", "abs")
inert_v = 1463.0 * math.log(100 / (100 - 40.0))
case("fire.agentQuantity.inert40pct", {"volumeM3": 1463, "agent": "inergen", "concentration": 40},
     inert_v, 0.06, "V_agent = V·ln(100/(100−C)) — inert flooding equation", "abs")

# WATER — annual m³ = WUE(L/kWh) · IT kWh / 1000; formula case w/ wue=1.8
water_m3 = 1.8 * (2.5 * 1000 * 8760) / 1000
case("water.annualM3.wue1p8", {"mw": 2.5, "wue": 1.8}, water_m3, 1.0,
     "WUE·IT-kWh/1000 (engine rounds m³ to integer)", "abs")

# PUE — partial-load identity: PUE(l) = 1 + oh·(0.55/l + 0.45)
pl = 1 + (1.5 - 1) * (0.55 / 0.4 + 0.45)
case("pue.partialLoad.d1p5l0p4", {"designPUE": 1.5, "loadFraction": 0.4}, pl, 1e-12,
     "documented screening formula — exact identity", "abs")

# DEEP-SEA accurate mode — energy balance: kg/s = MW_heat·1e6/(cp·ΔT), ρ=1025 cp=3985
heat_mw = 10 * 1.15
kgps = heat_mw * 1e6 / (3985 * 8.0)
m3s_acc = kgps / 1025
case("cooling.deepSea.accurate.flow10MW", {"itLoadMw": 10, "pueTarget": 1.15, "deltaTC": 8},
     round(m3s_acc, 3), 5e-4, "accurate mode: TEOS-10 ρ=1025 cp=3985 energy balance (engine 3dp)", "abs")

# COMMISSIONING — readinessIndex weighted identity (weights from the engine's
# published table L1.05 L2.08 L3.12 L4.15 L5.22 ist.18 sat.08 fat.07 punch.05)
Wt = {"L1":0.05,"L2":0.08,"L3":0.12,"L4":0.15,"L5":0.22,"ist":0.18,"sat":0.08,"fat":0.07,"punchlist":0.05}
comp = {"L1":1.0,"L2":0.8,"L3":0.5,"ist":0.25}
present = sum(Wt[k] for k in comp)
weighted = sum(Wt[k]*v for k,v in comp.items())
case("cx.readinessIndex.partial", {"completion": comp}, round(100*weighted/present, 1), 0.05,
     "Σw·c/Σw over PRESENT keys only ×100 (engine 1dp)", "abs")

# OPEX staffing — headcount × salary × load factor (US dcTechMid 75,100? engine
# DATA benchmark; formula identity w/ explicit salary 75100, load 1.3)
case("opex.staffingCostAnnual.us13", {"headcount": 13, "region": "US"},
     None, 0.5, "IDENTITY IN GATE: round(hc·salary·loadFactor) recomputed from engine DATA — formula check", "abs")

# FORECAST — compound growth exact
case("forecast.compoundGrowth.2p5pct10y", {"base": 1000, "ratePct": 0.025, "years": 10},
     float(Decimal("1000") * (Decimal("1.025") ** 10)), 1e-6, "FV = base·(1+r)^n", "abs")

# NEWSVENDOR end-to-end (normal mode) — python replication w/ erf-based Φ/Φ⁻¹
muA, sigA, ltW, ltSigW = 6.0, 3.6, 16, 4
Lfrac, sLfrac = ltW/52, ltSigW/52
muLT = muA * Lfrac
sigLT = math.sqrt(Lfrac * sigA**2 + muA**2 * sLfrac**2)
cu, unit, carry, life = 85000, 45000, 0.25, 8
co = carry * unit * life
cr = max(0.001, min(0.999, cu / (cu + co)))
qstar = max(0, math.ceil(muLT + phi_inv(cr) * sigLT))
case("spares.newsvendor.qstar.normal", {"unitCost": unit, "understockCostPerEvent": cu, "carryRatePct": 25,
     "partLifeYrs": 8, "muAnnual": muA, "sigmaAnnual": sigA, "ltWeeks": 16, "ltSigmaWeeks": 4, "poissonMode": False},
     qstar, 0, "Q* = ⌈μLT + Φ⁻¹(CR)·σLT⌉ — end-to-end replication (Acklam ≡ erf-Newton at ceil grain)", "abs")

# TIER classify boundary — weighted score w/ redundancy cap is engine-table logic;
# identity asserted in gate (score in [0,100], cap honored) — no fixture value.

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(T, open(OUT, 'w'), indent=1)
print(f"accuracy-truth.json: {len(T['cases'])} cases written")
for k, v in T["cases"].items():
    print(f"  {k}: truth={v['truth']!r} tol={v['tol']}")
