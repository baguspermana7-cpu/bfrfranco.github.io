#!/usr/bin/env python3
"""Reproduce an incident's stated conditions in a calculator (PRD-Q03).

A dossier may carry `reproduce[]`: entries that set calculator inputs to the conditions the record states, each input
backed by evidence that resolves verbatim (tools/incidents_fmea.resolve_evidence). Every input the record does not
state comes from a named, generated baseline (data/reproduce-baselines.json, BR-2), shown as "Baseline", never as a fact
about the site. Only owner-accepted entries render (BR-1, BR-3); the link is a P2 share link (#rzs=, origin
incident:<slug>:<entry id>).

    python3 tools/incidents_reproduce.py validate                     # RV1-RV17 on all dossiers (exit 1 on any)
    python3 tools/incidents_reproduce.py report [--entries] [--format md|json]
    python3 tools/incidents_reproduce.py decide --accept slug:id,... [--reject slug:id,...] --by owner --request R123
    python3 tools/incidents_reproduce.py retire slug:id --request R123 --reason "..."
    python3 tools/incidents_reproduce.py review <slug> --verdict B|C --closest "calc:input" --reason "..."
"""
import argparse
import base64
import datetime
import glob
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "lib"))
import incidents_fmea  # noqa: E402
import incident_rules  # noqa: E402

SCHEMA = "rz-incident-reproduce/1"
PAGE = {"tia": "tia-942-checklist.html", "tier": "tier-advisor.html"}
HEADING = {"tia": "TIA-942 checklist", "tier": "Tier advisor"}
LINK_TEXT = {"tia": "Open the checklist with these inputs", "tier": "Open the tier advisor with these inputs"}
META = {"tia-t3-ent-all": "Tier 3 list, Enterprise", "tier-defaults": "the advisor's own defaults"}
BASENOTE = {
    "tia-t3-ent-all": ("Baseline: every other item on the Tier 3, Enterprise list is ticked, so the gaps the checklist shows "
                       "are the ones the record states. The baseline is part of this reproduction, not a claim about the site."),
    "tier-defaults": "Baseline: every other input keeps the tier advisor's default.",
}
INTRO = ("The links below open a calculator with the conditions this record states. Only the inputs listed here come "
         "from the record. Every other input is the baseline named under each link.")
REVIEW_FILE = os.path.join(ROOT, "data", "incidents", "_reproduce-review.json")
DATA_DIR = os.path.join(ROOT, "data", "incidents")
EV_SRC = {"soe", "metric", "coe", "improvement", "ref", "factor", "lesson", "rootCause", "tech"}
ENTRY_KEYS = {"id", "calc", "baseline", "mode", "set", "status", "draftedBy", "draftedOn", "decidedBy", "decidedOn",
              "request", "retiredReason"}
REQUIRED = {"id", "calc", "baseline", "mode", "set", "status", "draftedBy", "draftedOn"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def esc(s):
    return html.escape(str(s), quote=True)


def load_baselines(path=None):
    with open(path or os.path.join(ROOT, "data", "reproduce-baselines.json"), encoding="utf-8") as fh:
        return json.load(fh)["baselines"]


def _schema(root):
    with open(os.path.join(root, "data", "scenario-link.schema.json"), encoding="utf-8") as fh:
        return json.load(fh)


def _routes(root):
    src = open(os.path.join(root, "js", "rz-scenario.js"), encoding="utf-8").read()
    m = re.search(r"var ROUTES = \{(.*?)\};", src, flags=re.S)
    return dict(re.findall(r"(\w+): '([^']+)'", m.group(1))) if m else {}


def p2_ready(root=ROOT):
    """P2 share links usable on both target pages: schema file, readLink, the script tag, and the TIA mirrors."""
    if not os.path.exists(os.path.join(root, "data", "scenario-link.schema.json")):
        return False, "data/scenario-link.schema.json missing"
    js = open(os.path.join(root, "js", "rz-scenario.js"), encoding="utf-8").read()
    if "readLink" not in js:
        return False, "rzScenario.readLink missing"
    for page in PAGE.values():
        if "js/rz-scenario.js" not in open(os.path.join(root, page), encoding="utf-8").read():
            return False, f"{page} does not load js/rz-scenario.js"
    tia = open(os.path.join(root, PAGE["tia"]), encoding="utf-8").read()
    if 'id="tiaTier"' not in tia or 'id="tiaDcType"' not in tia:
        return False, "TIA mirrors #tiaTier/#tiaDcType missing"
    return True, "ready"


def accepted(inc):
    return [e for e in (inc.get("reproduce") or []) if isinstance(e, dict) and e.get("status") == "accepted"]


def entries_for_mode(inc, mode_id):
    return [e for e in accepted(inc) if e.get("mode") == mode_id]


def origin(inc, entry):
    return f"incident:{inc['slug']}:{entry['id']}"


def payload(entry, baselines, inc=None):
    base = baselines[entry["baseline"]]
    inputs = {k: dict(v) for k, v in base["inputs"].items()}
    for it in entry["set"]:
        inputs[it["input"]] = {"t": base["inputs"][it["input"]]["t"], "v": it["value"]}
    out = {"v": 1, "calc": entry["calc"], "inputs": inputs}
    if inc is not None:
        out["origin"] = origin(inc, entry)
    return out


def encode(obj):
    raw = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def link(entry, baselines, inc=None):
    return PAGE[entry["calc"]] + "#rzs=" + encode(payload(entry, baselines, inc))


def _payload_errors(obj, schema, length):
    """RV14/RV15: the payload against data/scenario-link.schema.json (the subset the reader enforces)."""
    errs = []
    props = schema["properties"]
    if length > schema.get("x-rz-max-link-length", 8000):
        errs.append(f"RV14 link is {length} characters (> {schema.get('x-rz-max-link-length', 8000)})")
    if set(obj) - set(props) or not set(schema["required"]) <= set(obj):
        errs.append("RV15 payload keys do not match the schema")
    if obj.get("v") != props["v"]["const"]:
        errs.append("RV15 version")
    if not re.fullmatch(props["calc"]["pattern"], obj.get("calc", "")):
        errs.append("RV15 calc pattern")
    if "origin" in obj and not re.fullmatch(props["origin"]["pattern"], obj["origin"]):
        errs.append("RV17 origin does not match the P2 v1 pattern")
    ip = props["inputs"]
    if len(obj["inputs"]) > ip["maxProperties"]:
        errs.append("RV15 too many inputs")
    types = set(ip["additionalProperties"]["properties"]["t"]["enum"])
    for k, rec in obj["inputs"].items():
        if not re.fullmatch(ip["propertyNames"]["pattern"], k):
            errs.append(f"RV15 input id {k!r}")
        if rec.get("t") not in types:
            errs.append(f"RV15 input type {k}:{rec.get('t')}")
        v = rec.get("v")
        if not (isinstance(v, bool) or (isinstance(v, str) and len(v) <= 2000)):
            errs.append(f"RV15 input value {k}")
    return errs


def validate_reproduce(inc, baselines, root=ROOT):
    """RV1-RV17 for one dossier. Returns a list of error strings (empty = valid)."""
    slug = inc.get("slug", "?")
    rp = inc.get("reproduce")
    if rp is None:
        return []
    errs = []
    if not isinstance(rp, list):
        return [f"{slug}: RV1 reproduce is not an array"]
    routes = _routes(root)
    schema = _schema(root)
    modes = {m.get("id") for m in (inc.get("fmea") or {}).get("modes", [])}
    seen_ids, seen_calc = set(), set()
    if rp and incident_rules.is_seed(inc):
        errs.append(f"{slug}: RV12 entries on a seed dossier")
    for n, e in enumerate(rp):
        tag = f"{slug}: reproduce[{n}]"
        if not isinstance(e, dict):
            errs.append(f"{tag}: RV1 not an object")
            continue
        extra, missing = set(e) - ENTRY_KEYS, REQUIRED - set(e)
        if extra or missing:
            errs.append(f"{tag}: RV1 keys extra {sorted(extra)} missing {sorted(missing)}")
            continue
        if not re.fullmatch(r"rp-[a-z0-9-]{1,30}", str(e["id"])):
            errs.append(f"{tag}: RV1 id {e['id']!r}")
        if e["id"] in seen_ids:
            errs.append(f"{tag}: RV2 duplicate id {e['id']}")
        seen_ids.add(e["id"])
        if e["calc"] not in PAGE or routes.get(e["calc"]) != PAGE[e["calc"]]:
            errs.append(f"{tag}: RV3 calc {e['calc']!r} not routed to {PAGE.get(e['calc'])}")
            continue
        if e["calc"] in seen_calc:
            errs.append(f"{tag}: RV16 second entry for calc {e['calc']}")
        seen_calc.add(e["calc"])
        base = baselines.get(e["baseline"])
        if not base or base.get("calc") != e["calc"]:
            errs.append(f"{tag}: RV4 baseline {e['baseline']!r} missing or for another calculator")
            continue
        if e["mode"] not in modes:
            errs.append(f"{tag}: RV5 mode {e['mode']} not in fmea.modes")
        if e["status"] not in ("proposed", "accepted", "rejected", "retired"):
            errs.append(f"{tag}: RV1 status {e['status']!r}")
        decided = {"decidedBy", "decidedOn", "request"} & set(e)
        if e["status"] == "proposed" and decided:
            errs.append(f"{tag}: RV13 proposed entry carries {sorted(decided)}")
        if e["status"] != "proposed":
            if e.get("decidedBy") != "owner" or not DATE.match(str(e.get("decidedOn", ""))) or \
                    not re.fullmatch(r"R[0-9]{2,4}", str(e.get("request", ""))):
                errs.append(f"{tag}: RV13 {e['status']} needs decidedBy owner, decidedOn, request")
        if e["status"] == "retired" and not e.get("retiredReason"):
            errs.append(f"{tag}: RV13 retired without retiredReason")
        if not DATE.match(str(e["draftedOn"])):
            errs.append(f"{tag}: RV1 draftedOn")
        items = e["set"] if isinstance(e["set"], list) else []
        if not 1 <= len(items) <= 20:
            errs.append(f"{tag}: RV1 set must hold 1-20 items")
        seen_in = set()
        violated = 0
        for j, it in enumerate(items):
            t2 = f"{tag}.set[{j}]"
            if not isinstance(it, dict) or set(it) != {"input", "value", "role", "evidence"}:
                errs.append(f"{t2}: RV1 keys")
                continue
            inp = it["input"]
            if inp not in base["inputs"]:
                errs.append(f"{t2}: RV6 input {inp} not in baseline {e['baseline']}")
                continue
            if inp in seen_in:
                errs.append(f"{t2}: RV6 duplicate input {inp}")
            seen_in.add(inp)
            bt, bv, val = base["inputs"][inp]["t"], base["inputs"][inp]["v"], it["value"]
            if bt == "checkbox" and not isinstance(val, bool):
                errs.append(f"{t2}: RV7 {inp} is a checkbox, value must be boolean")
            elif bt == "select" and val not in (base.get("options", {}).get(inp) or {}):
                errs.append(f"{t2}: RV7 {inp} value {val!r} is not an option")
            elif bt == "number" and not (isinstance(val, str) and re.fullmatch(r"-?\d+(\.\d+)?", val)):
                errs.append(f"{t2}: RV7 {inp} value must be a numeric string")
            if it["role"] == "violated":
                violated += 1
                if val == bv:
                    errs.append(f"{t2}: RV8 violated {inp} equals the baseline value")
            elif it["role"] == "stated":
                if val != bv:
                    errs.append(f"{t2}: RV8 stated {inp} differs from the baseline value")
            else:
                errs.append(f"{t2}: RV1 role {it['role']!r}")
            evs = it["evidence"] if isinstance(it["evidence"], list) else []
            if not 1 <= len(evs) <= 4:
                errs.append(f"{t2}: RV1 evidence must hold 1-4 pointers")
            sourced = False
            for k, ev in enumerate(evs):
                if not isinstance(ev, dict) or ev.get("src") not in EV_SRC or not (12 <= len(str(ev.get("quote", ""))) <= 300):
                    errs.append(f"{t2}.evidence[{k}]: RV1 pointer shape")
                    continue
                if incidents_fmea.resolve_evidence(inc, ev) is None:
                    errs.append(f"{t2}.evidence[{k}]: RV10 does not resolve verbatim ({ev.get('src')}[{ev.get('i')}])")
                    continue
                if ev["src"] == "ref":
                    sourced = True
                elif ev["src"] in ("soe", "metric"):
                    field = incidents_fmea._LIST_FIELD[ev["src"]]
                    if str((inc.get(field) or [])[ev["i"]].get("source") or "").strip():
                        sourced = True
            if it["role"] == "violated" and not sourced:
                errs.append(f"{t2}: RV11 violated item has no reference or sourced timeline/metric pointer")
        if violated == 0:
            errs.append(f"{tag}: RV9 no violated item")
        if not errs or all(not x.startswith(tag) for x in errs):
            pl = payload(e, baselines, inc)
            ln = link(e, baselines, inc)
            errs += [f"{tag}: {x}" for x in _payload_errors(pl, schema, len(ln))]
            if len(origin(inc, e)) > 80:
                errs.append(f"{tag}: RV17 origin longer than 80 characters")
    return errs


def _word(base, inp, v, record):
    t = base["inputs"][inp]["t"]
    if t == "checkbox":
        return ("present" if v else "not present") if record else ("ticked" if v else "not ticked")
    if t == "select":
        return base.get("options", {}).get(inp, {}).get(v, v)
    return str(v)


def entry_html(inc, entry, baselines):
    base = baselines[entry["baseline"]]
    rows = []
    for it in entry["set"]:
        inp = it["input"]
        ev = "".join(incidents_fmea._ev_html(inc, p) for p in it["evidence"])
        rows.append(
            f'<li class="rp-row" data-role="{esc(it["role"])}" data-input="{esc(inp)}">'
            f'<span class="rp-in">{esc(base["labels"].get(inp, inp))}</span>'
            f'<span class="rp-rec">In the record: {esc(_word(base, inp, it["value"], True))}</span>'
            f'<span class="rp-base">Baseline: {esc(_word(base, inp, base["inputs"][inp]["v"], False))}</span>'
            f'<ul class="fm-ev">{ev}</ul></li>')
    return (f'<div class="rp-entry" id="{esc(entry["id"])}" data-calc="{esc(entry["calc"])}">'
            f'<h3 class="rp-h">{esc(HEADING[entry["calc"]])}</h3>'
            f'<p class="rp-meta"><a href="#{esc(entry["mode"])}">FMEA mode {esc(entry["mode"])}</a> · {esc(META.get(entry["baseline"], base["describe"]))}</p>'
            f'<ul class="rp-rows">{"".join(rows)}</ul>'
            f'<p class="rp-basenote">{esc(BASENOTE.get(entry["baseline"], "Baseline: " + base["describe"] + "."))}</p>'
            f'<p class="rp-go"><a class="rp-open" href="{esc(link(entry, baselines, inc))}">{esc(LINK_TEXT[entry["calc"]])}</a></p>'
            f'</div>')


def reproduce_section(inc, baselines, root=ROOT):
    """'' when the dossier has no accepted entry or P2 is not ready (FR-6, §9.5)."""
    acc = accepted(inc)
    if not acc or not p2_ready(root)[0]:
        return ""
    order = {"tia": 0, "tier": 1}
    body = "".join(entry_html(inc, e, baselines) for e in sorted(acc, key=lambda e: order.get(e["calc"], 9)))
    return (f'<section class="inc-sec" id="reproduce" aria-labelledby="h-reproduce">'
            f'<h2 id="h-reproduce">Reproduce in a calculator</h2><p class="rp-intro">{esc(INTRO)}</p>{body}</section>')


def mode_backlink(inc, mode_id, root=ROOT):
    """FMEA row back-link (FR-8): 'Reproduce: TIA-942 checklist · Tier advisor'."""
    es = entries_for_mode(inc, mode_id)
    if not es or not p2_ready(root)[0]:
        return ""
    links = " · ".join(f'<a href="#{esc(e["id"])}">{esc(HEADING[e["calc"]])}</a>' for e in es)
    return f'<p class="rp-back">Reproduce: {links}</p>'


CSS = r"""
.rp-entry{margin:1.4rem 0 0}
.rp-h{font:600 1.02rem/1.35 'IBM Plex Sans',system-ui,sans-serif;color:var(--text);margin:0}
.rp-meta{font-family:'JetBrains Mono',monospace;font-size:.74rem;color:var(--muted);margin:.2rem 0 .6rem}
.rp-meta a,.rp-back a{color:inherit}
.rp-rows{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.rp-row{display:grid;grid-template-columns:minmax(0,1.4fr) 11rem 9rem;gap:.25rem 1rem;padding:.7rem 0;border-bottom:1px solid var(--line)}
.rp-row .fm-ev{grid-column:1/-1}
.rp-in{color:var(--text);font-size:.92rem}
.rp-rec,.rp-base{color:var(--text-body);font-size:.86rem}
.rp-row[data-role="violated"] .rp-rec{color:var(--text);font-weight:600}
.rp-basenote,.rp-intro{color:var(--text-body);font-size:.88rem}
.rp-open{color:var(--amber);text-decoration:none;border-bottom:1px solid currentColor}
.rp-open:hover{color:var(--text)}
.rp-open:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.rp-back{font-size:.84rem;color:var(--text-body);margin:.5rem 0 0}
@media (max-width:600px){.rp-row{grid-template-columns:1fr}.rp-open{display:inline-block;min-height:44px;padding:.6rem 0}}
@media print{.rp-go{display:none}}
"""


# ── CLI ────────────────────────────────────────────────────────────────────────
def _dossiers():
    out = []
    for f in sorted(glob.glob(os.path.join(DATA_DIR, "*.json"))):
        if os.path.basename(f).startswith("_"):
            continue
        with open(f, encoding="utf-8") as fh:
            out.append((f, json.load(fh)))
    return out


def _reviews():
    if not os.path.exists(REVIEW_FILE):
        return {}
    with open(REVIEW_FILE, encoding="utf-8") as fh:
        return json.load(fh).get("reviews", {})


def report(incidents, reviews):
    rows = []
    for inc in incidents:
        slug = inc["slug"]
        acc = accepted(inc)
        if acc:
            v, closest, reason = "Q", ", ".join(f'{e["calc"]}:{e["id"]}' for e in acc), "accepted entries"
        elif incident_rules.is_seed(inc):
            v, closest, reason = "S", "", "seed dossier (RV12)"
        else:
            r = reviews.get(slug)
            cats = set(inc.get("category") or [])
            if r:
                v, closest, reason = r["verdict"], r.get("closestInput", ""), r.get("reason", "")
            elif not cats & {"power", "cooling", "fire"}:
                v, closest, reason = "N", "", "no power, cooling or fire category"
            else:
                v, closest, reason = "U", "", "unreviewed: power, cooling or fire dossier without a review record"
        rows.append({"slug": slug, "verdict": v, "closest": closest, "reason": reason})
    return rows


def _write(path, inc):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(inc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("validate")
    rp = sub.add_parser("report")
    rp.add_argument("--entries", action="store_true")
    rp.add_argument("--format", choices=["md", "json"], default="md")
    dp = sub.add_parser("decide")
    dp.add_argument("--accept", default="")
    dp.add_argument("--reject", default="")
    dp.add_argument("--by", required=True)
    dp.add_argument("--request", required=True)
    tp = sub.add_parser("retire")
    tp.add_argument("target")
    tp.add_argument("--request", required=True)
    tp.add_argument("--reason", required=True)
    vp = sub.add_parser("review")
    vp.add_argument("slug")
    vp.add_argument("--verdict", required=True, choices=["B", "C"])
    vp.add_argument("--closest", default="")
    vp.add_argument("--reason", required=True)
    a = ap.parse_args()
    baselines = load_baselines()
    ds = _dossiers()
    today = datetime.date.today().isoformat()

    if a.cmd == "validate":
        errs = [e for _, inc in ds for e in validate_reproduce(inc, baselines)]
        n = sum(len(inc.get("reproduce") or []) for _, inc in ds)
        for e in errs:
            print("  ✗ " + e)
        print(f"{'FAIL' if errs else 'PASS'} — reproduce entries: {n} across {sum(1 for _, i in ds if i.get('reproduce'))} dossier(s), "
              f"{len(errs)} error(s)")
        sys.exit(1 if errs else 0)

    if a.cmd == "report":
        if a.entries:
            data = [{"slug": inc["slug"], **{k: e[k] for k in ("id", "calc", "baseline", "mode", "status")},
                     "set": [(it["input"], it["value"], it["role"]) for it in e["set"]], "link": link(e, baselines, inc)}
                    for _, inc in ds for e in (inc.get("reproduce") or [])]
        else:
            data = report([i for _, i in ds], _reviews())
        if a.format == "json":
            print(json.dumps({"ok": True, "data": data, "errors": []}, indent=1))
        else:
            for r in data:
                print(" | ".join(str(v) for v in r.values()))
        return

    if a.cmd == "decide":
        if a.by != "owner" or not re.fullmatch(r"R[0-9]{2,4}", a.request):
            print("refused: --by owner and --request R<n> are required (BR-3)")
            sys.exit(1)
        want = {t: "accepted" for t in a.accept.split(",") if t} | {t: "rejected" for t in a.reject.split(",") if t}
        changed = {}
        for path, inc in ds:
            for e in inc.get("reproduce") or []:
                key = f'{inc["slug"]}:{e["id"]}'
                if key in want:
                    if e["status"] != "proposed":
                        print(f"refused: {key} is {e['status']}, not proposed")
                        sys.exit(1)
                    e.update(status=want.pop(key), decidedBy="owner", decidedOn=today, request=a.request)
                    changed[path] = inc
        if want:
            print("refused: unknown entries " + ", ".join(want))
            sys.exit(1)
        for path, inc in changed.items():
            errs = validate_reproduce(inc, baselines)
            if errs:
                print("refused: " + "; ".join(errs))
                sys.exit(1)
        for path, inc in changed.items():
            _write(path, inc)
        print(f"recorded {sum(1 for _ in changed)} dossier(s)")
        return

    if a.cmd == "retire":
        slug, eid = a.target.split(":", 1)
        for path, inc in ds:
            if inc["slug"] != slug:
                continue
            for e in inc.get("reproduce") or []:
                if e["id"] == eid and e["status"] == "accepted":
                    e.update(status="retired", decidedOn=today, request=a.request, retiredReason=a.reason[:140])
                    _write(path, inc)
                    print(f"retired {a.target}")
                    return
        print(f"refused: no accepted entry {a.target}")
        sys.exit(1)

    if a.cmd == "review":
        doc = {"schema": "rz-reproduce-review/1", "reviews": _reviews()}
        doc["reviews"][a.slug] = {"verdict": a.verdict, "closestInput": a.closest, "reason": a.reason,
                                  "reviewedBy": "session", "reviewedOn": today}
        doc["reviews"] = dict(sorted(doc["reviews"].items()))
        with open(REVIEW_FILE, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=1, ensure_ascii=False)
            fh.write("\n")
        print(f"review recorded for {a.slug}")


if __name__ == "__main__":
    main()
