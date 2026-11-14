#!/usr/bin/env python3
"""market-posture-golden.py — run the ORIGINAL tradermonty/claude-trading-skills Python on the
market-posture fixtures and on seeded synthetic scenarios, print JSON for tools/test-market-posture.mjs.

  python3 -I tools/market-posture-golden.py --skills ~/.code/claude-trading-skills/skills \
      --fixtures tools/fixtures/market-posture > golden.json

Stdlib only (the skills' scoring code is stdlib; `requests` is imported by their fetchers but every
HTTP call is replaced by the fixture text here — nothing touches the network).
The PRNG and scenario builders are mirrored line for line in test-market-posture.mjs.
"""
import argparse
import contextlib
import datetime as dt
import importlib
import io
import json
import math
import os
import sys

OMIT_PY_ONLY = ("exposure_guidance", "guidance", "actions")


def clean(v):
    if isinstance(v, float):
        if math.isnan(v):
            return {"__float__": "nan"}
        if math.isinf(v):
            return {"__float__": "inf" if v > 0 else "-inf"}
        return v
    if isinstance(v, dict):
        return {k: clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [clean(x) for x in v]
    return v


def load_skill(scripts_dir, modules):
    """Import modules from one skill's scripts dir (the skills share module names)."""
    for name in list(sys.modules):
        if name in ("scorer", "calculators", "csv_client", "data_fetcher", "calculate_exposure",
                    "provenance_contract") or name.startswith("calculators."):
            del sys.modules[name]
    sys.path.insert(0, scripts_dir)
    try:
        return {m: importlib.import_module(m) for m in modules}
    finally:
        sys.path.remove(scripts_dir)


class FakeResp:
    def __init__(self, text):
        self.text = text

    def raise_for_status(self):
        return None


# ---------- seeded scenarios (mirrored in the JS test) ----------
class Rng:
    M = 2147483647

    def __init__(self, seed):
        self.s = seed % self.M or 1

    def next(self):
        self.s = (self.s * 48271) % self.M
        return self.s

    def randint(self, lo, hi):
        return lo + self.next() % (hi - lo + 1)


def day(i):
    return (dt.date(2024, 1, 1) + dt.timedelta(days=i)).isoformat()


def breadth_scenario(seed):
    r = Rng(seed)
    n = r.randint(1, 150)
    rows = []
    for i in range(n):
        rows.append({
            "Date": day(i),
            "S&P500_Price": 4000 + r.randint(0, 2000) * 0.5,
            "Breadth_Index_Raw": r.randint(0, 100) / 100,
            "Breadth_Index_200MA": r.randint(20, 80) / 100,
            "Breadth_Index_8MA": r.randint(5, 95) / 100,
            "Breadth_200MA_Trend": [1, -1, 0][r.randint(0, 2)],
            "Bearish_Signal": r.randint(0, 9) == 0,
            "Is_Peak": r.randint(0, 29) == 0,
            "Is_Trough": r.randint(0, 29) == 0,
            "Is_Trough_8MA_Below_04": r.randint(0, 49) == 0,
        })
    summary = {"Average Peaks (200MA)": "0.722", "Average Troughs (8MA < 0.4)": "0.231"} if r.randint(0, 3) else {}
    return rows, summary


SECTORS = ["Technology", "Consumer Cyclical", "Communication Services", "Financial", "Industrials", "Utilities",
           "Consumer Defensive", "Healthcare", "Real Estate", "Energy", "Basic Materials"]
WS = ["sec_technology", "sec_consumercyclical", "sec_communicationservices", "sec_financial", "sec_industrials",
      "sec_utilities", "sec_consumerdefensive", "sec_healthcare", "sec_realestate", "sec_energy", "sec_basicmaterials"]


def opt_slope(r):
    return None if r.randint(0, 19) == 0 else (r.randint(0, 400) - 200) / 10000


def uptrend_scenario(seed):
    r = Rng(seed)
    n = r.randint(1, 60)
    ts = []
    for i in range(n):
        for ws in ["all"] + WS:
            if ws != "all" and r.randint(0, 9) == 0:
                continue
            ts.append({"worksheet": ws, "date": day(i), "count": r.randint(0, 500), "total": 500,
                       "ratio": r.randint(0, 600) / 1000, "ma_10": r.randint(0, 600) / 1000, "slope": opt_slope(r),
                       "trend": ["up", "down", "neutral"][r.randint(0, 2)]})
    summary = []
    if r.randint(0, 3):
        for name in SECTORS:
            if r.randint(0, 11) == 0:
                continue
            summary.append({"Sector": name, "Ratio": None if r.randint(0, 24) == 0 else r.randint(0, 600) / 1000,
                            "10MA": r.randint(0, 600) / 1000, "Trend": ["Up", "Down"][r.randint(0, 1)],
                            "Slope": opt_slope(r), "Status": "Normal"})
    return ts, summary


# ---------- original pipelines (mirroring each skill's main()) ----------
def breadth_analyze(B, rows, summary):
    c1 = B["calculators.trend_level_calculator"].calculate_breadth_level_trend(rows)
    c2 = B["calculators.ma_crossover_calculator"].calculate_ma_crossover(rows)
    c3 = B["calculators.cycle_calculator"].calculate_cycle_position(rows)
    c4 = B["calculators.bearish_signal_calculator"].calculate_bearish_signal(rows)
    c5 = B["calculators.historical_context_calculator"].calculate_historical_percentile(rows, summary)
    c6 = B["calculators.divergence_calculator"].calculate_divergence(rows)
    comps = {"breadth_level_trend": c1, "ma_crossover": c2, "cycle_position": c3, "bearish_signal": c4,
             "historical_percentile": c5, "divergence": c6}
    scores = {k: v["score"] for k, v in comps.items()}
    avail = {k: v.get("data_available", True) for k, v in comps.items()}
    composite = B["scorer"].calculate_composite_score(scores, avail)
    return {"as_of": rows[-1]["Date"], "total_rows": len(rows), "components": comps, "composite": composite}


def uptrend_analyze(U, fetcher):
    DF = U["data_fetcher"]
    all_ts = fetcher.get_all_timeseries()
    latest = fetcher.get_latest_all()
    sec_latest = fetcher.get_all_sector_latest()
    summary = fetcher.fetch_sector_summary()
    ct = {DF.WORKSHEET_TO_DISPLAY.get(ws, ws): (row.get("count"), row.get("total")) for ws, row in sec_latest.items()}
    for s in summary:
        c = ct.get(s["Sector"], (None, None))
        s["Count"], s["Total"] = c[0], c[1]
    c1 = U["calculators.market_breadth_calculator"].calculate_market_breadth(latest, all_ts)
    c2 = U["calculators.sector_participation_calculator"].calculate_sector_participation(summary, sec_latest)
    c3 = U["calculators.sector_rotation_calculator"].calculate_sector_rotation(summary, sec_latest)
    c4 = U["calculators.momentum_calculator"].calculate_momentum(all_ts, summary)
    c5 = U["calculators.historical_context_calculator"].calculate_historical_context(all_ts)
    comps = {"market_breadth": c1, "sector_participation": c2, "sector_rotation": c3, "momentum": c4,
             "historical_context": c5}
    scores = {k: v["score"] for k, v in comps.items()}
    avail = {k: v.get("data_available", True) for k, v in comps.items()}
    flags = {"late_cycle": c3.get("late_cycle_flag", False),
             "high_spread": (c2.get("spread") is not None and c2["spread"] > 0.40),
             "divergence": c3.get("divergence_flag", False)}
    composite = U["scorer"].calculate_composite_score(scores, avail, flags, historical_data_points=c5.get("data_points"))
    return {"as_of": latest.get("date") if latest else None, "components": comps, "warning_flags": flags,
            "composite": composite}


def exposure(E, breadth, uptrend):
    X = E["calculate_exposure"]
    scores = {"breadth": X.extract_breadth_score(breadth), "uptrend": X.extract_uptrend_score(uptrend),
              "regime": None, "top_risk": None, "ftd": None, "theme": None, "sector": None, "institutional": None}
    composite, provided, missing = X.calculate_composite_score(scores)
    mc = len(set(missing) & X.CRITICAL_INPUTS)
    return {"exposure_ceiling_pct": X.determine_exposure_ceiling(composite),
            "participation": X.determine_participation(scores["uptrend"], scores["breadth"], None),
            "model_state": X.determine_recommendation(composite, scores["top_risk"], mc),
            "confidence": X.determine_confidence(provided, missing), "composite_score": round(composite, 1),
            "composite_raw": composite, "component_scores": {f"{k}_score": v for k, v in scores.items() if v is not None},
            "inputs_provided": provided, "inputs_missing": missing}


def fetcher_from(U, ts_rows, summary_rows):
    f = U["data_fetcher"].UptrendDataFetcher()
    f._timeseries_cache = ts_rows
    f._sector_summary_cache = summary_rows
    return f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skills", required=True)
    ap.add_argument("--fixtures", required=True)
    ap.add_argument("--scenarios", type=int, default=60)
    a = ap.parse_args()
    sk = os.path.abspath(os.path.expanduser(a.skills))
    fx = os.path.abspath(a.fixtures)
    read = lambda n: open(os.path.join(fx, n), encoding="utf-8").read()  # noqa: E731

    B = load_skill(os.path.join(sk, "market-breadth-analyzer", "scripts"), [
        "csv_client", "scorer", "calculators.trend_level_calculator", "calculators.ma_crossover_calculator",
        "calculators.cycle_calculator", "calculators.bearish_signal_calculator",
        "calculators.historical_context_calculator", "calculators.divergence_calculator"])
    out = {"fixture": {}, "perturbed": {}, "breadth_scenarios": [], "uptrend_scenarios": [], "exposure_scenarios": []}
    CC = B["csv_client"]
    texts = {CC.DEFAULT_DETAIL_URL: read("market_breadth_data.csv"), CC.DEFAULT_SUMMARY_URL: read("market_breadth_summary.csv")}
    CC.requests.get = lambda url, timeout=None: FakeResp(texts[url])
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        rows = CC.fetch_detail_csv()
        summary = CC.fetch_summary_csv()
    out["fixture"]["breadth_rows"] = len(rows)
    out["fixture"]["breadth_summary"] = summary
    b_fix = breadth_analyze(B, rows, summary)
    out["fixture"]["breadth"] = b_fix
    # perturbation: latest 8MA dropped by 0.30 must move the score
    prow = [dict(r) for r in rows]
    prow[-1]["Breadth_Index_8MA"] = round(prow[-1]["Breadth_Index_8MA"] - 0.30, 6)
    out["perturbed"]["breadth"] = breadth_analyze(B, prow, summary)
    b_scen = []
    for i in range(a.scenarios):
        r, s = breadth_scenario(1000 + i)
        b_scen.append(breadth_analyze(B, r, s))
    out["breadth_scenarios"] = b_scen

    U = load_skill(os.path.join(sk, "uptrend-analyzer", "scripts"), [
        "data_fetcher", "scorer", "calculators.market_breadth_calculator", "calculators.sector_participation_calculator",
        "calculators.sector_rotation_calculator", "calculators.momentum_calculator", "calculators.historical_context_calculator"])
    DF = U["data_fetcher"]
    utexts = {DF.TIMESERIES_URL: read("uptrend_ratio_timeseries.csv"), DF.SECTOR_SUMMARY_URL: read("sector_summary.csv")}
    f = DF.UptrendDataFetcher()
    f.session.get = lambda url, timeout=None: FakeResp(utexts[url])
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        u_fix = uptrend_analyze(U, f)
    out["fixture"]["uptrend"] = u_fix
    u_scen = []
    with contextlib.redirect_stderr(io.StringIO()):
        for i in range(a.scenarios):
            ts, sm = uptrend_scenario(5000 + i)
            u_scen.append(uptrend_analyze(U, fetcher_from(U, ts, sm)))
    out["uptrend_scenarios"] = u_scen

    E = load_skill(os.path.join(sk, "exposure-coach", "scripts"), ["calculate_exposure"])
    out["fixture"]["exposure"] = exposure(E, b_fix, u_fix)
    out["perturbed"]["exposure"] = exposure(E, out["perturbed"]["breadth"], u_fix)
    out["fixture"]["exposure_breadth_only"] = exposure(E, b_fix, None)
    out["fixture"]["exposure_none"] = exposure(E, None, None)
    out["exposure_scenarios"] = [exposure(E, b, u) for b, u in zip(b_scen, u_scen)]
    json.dump(clean(out), sys.stdout)


if __name__ == "__main__":
    main()
