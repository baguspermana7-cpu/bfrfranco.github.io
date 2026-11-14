"""market-posture-recorder.py — pytest plugin: record every call the ORIGINAL
tradermonty/claude-trading-skills test-suites make into the scoring functions (bound
args with defaults applied + return value) as JSON lines, so tools/test-market-posture.mjs
can replay the Python tests' own cases against js/rz-market-posture.js (law P1).

Reproduce (scratch venv with pytest + requests; never install system-wide), per skill:
  cd <copy of skills/<skill>/scripts>
  RZREC_SKILL=<skill> RZREC_OUT=/tmp/rec.jsonl PYTHONPATH=<dir holding this file renamed recorder.py> \
    python -m pytest -q -p no:cacheprovider -p recorder tests --ignore=tests/test_provenance_contract.py
then add {"skill": <skill>} to each line and gzip the three files together into
tools/fixtures/market-posture/python-test-calls.jsonl.gz."""
import copy, functools, importlib, inspect, json, math, os, sys

TARGETS = {
    "market-breadth-analyzer": [
        ("calculators.trend_level_calculator", "calculate_breadth_level_trend"),
        ("calculators.ma_crossover_calculator", "calculate_ma_crossover"),
        ("calculators.cycle_calculator", "calculate_cycle_position"),
        ("calculators.bearish_signal_calculator", "calculate_bearish_signal"),
        ("calculators.historical_context_calculator", "calculate_historical_percentile"),
        ("calculators.divergence_calculator", "calculate_divergence"),
        ("scorer", "calculate_composite_score"),
    ],
    "uptrend-analyzer": [
        ("calculators.market_breadth_calculator", "calculate_market_breadth"),
        ("calculators.sector_participation_calculator", "calculate_sector_participation"),
        ("calculators.sector_rotation_calculator", "calculate_sector_rotation"),
        ("calculators.momentum_calculator", "calculate_momentum"),
        ("calculators.historical_context_calculator", "calculate_historical_context"),
        ("scorer", "calculate_composite_score"),
        ("data_fetcher", "build_summary_from_timeseries"),
    ],
    "exposure-coach": [
        ("calculate_exposure", n) for n in (
            "extract_breadth_score", "extract_uptrend_score", "calculate_composite_score",
            "determine_exposure_ceiling", "determine_recommendation",
            "determine_participation", "determine_confidence")
    ],
}

class Unserializable(Exception):
    pass

def clean(v):
    if isinstance(v, bool) or v is None or isinstance(v, str):
        return v
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        if math.isnan(v):
            return {"__float__": "nan"}
        if math.isinf(v):
            return {"__float__": "inf" if v > 0 else "-inf"}
        return v
    if isinstance(v, (list, tuple)):
        return [clean(x) for x in v]
    if isinstance(v, (set, frozenset)):
        return sorted(clean(x) for x in v)
    if isinstance(v, dict):
        if not all(isinstance(k, str) for k in v):
            raise Unserializable()
        return {k: clean(x) for k, x in v.items()}
    raise Unserializable(type(v).__name__)

def pytest_configure(config):
    skill = os.environ["RZREC_SKILL"]
    out = open(os.environ["RZREC_OUT"], "w")
    scripts = os.getcwd()
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    for modname, fname in TARGETS[skill]:
        mod = importlib.import_module(modname)
        orig = getattr(mod, fname)
        sig = inspect.signature(orig)

        def make(orig=orig, sig=sig, fname=fname, modname=modname):
            @functools.wraps(orig)
            def wrapper(*a, **kw):
                try:
                    b = sig.bind(*a, **kw)
                    b.apply_defaults()
                    args = clean(copy.deepcopy(list(b.arguments.values())))
                except Exception:
                    args = None
                res = orig(*a, **kw)
                if args is not None:
                    try:
                        rec = {"fn": modname + "." + fname, "args": args, "out": clean(res),
                               "test": os.environ.get("PYTEST_CURRENT_TEST", "").split(" ")[0]}
                        out.write(json.dumps(rec) + "\n")
                        out.flush()
                    except Unserializable:
                        pass
                return res
            return wrapper
        setattr(mod, fname, make())
