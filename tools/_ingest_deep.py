#!/usr/bin/env python3
"""
_ingest_deep.py — merge deep-forensic re-research verdicts into incident dossiers.

Input: JSON list of {slug, verdict:{rootCause, technicalDeepDive, contributingFactors[],
sequenceOfEvents[], metrics[], improvements[], lessonsLearnt[], coe[],
comprehensiveAnalysis[], approvedSources[], officialPostmortem, operatorShort, ...}}.

Replaces the rich content fields (only when the new value is at least as deep), merges
approvedSources into references (dedup + type-normalised to the gate vocabulary), stores
operatorShort, and sets sourcing.officialPostmortem when an accepted-type ref backs it.
Preserves slug/title/operator/dcName/date/location/category/magnitude/severity/durationMin.

Usage: python3 tools/_ingest_deep.py /tmp/deep_results.json [--apply]
"""
import json
import os
import sys
import html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "incidents")
_ACCEPTED = {"official-postmortem", "regulatory", "vendor-status"}
_TYPE_MAP = {
    "official": "official-postmortem", "officialPostmortem": "official-postmortem",
    "official-postmortem": "official-postmortem", "official-status": "vendor-status",
    "vendor-status": "vendor-status", "vendor": "vendor-status",
    "regulatory": "regulatory", "court": "regulatory", "press": "press", "news": "press",
}


def _c(s):
    return html.unescape(s).strip() if isinstance(s, str) else s


def _clist(xs):
    return [_c(x) for x in xs if _c(x)] if isinstance(xs, list) else []


def main():
    if len(sys.argv) < 2:
        print("usage: _ingest_deep.py <results.json> [--apply]"); return
    apply = "--apply" in sys.argv
    results = json.load(open(sys.argv[1], encoding="utf-8"))
    done = []
    for r in results:
        slug = r.get("slug"); v = r.get("verdict") or {}
        if not slug:
            continue
        path = os.path.join(DATA, f"{slug}.json")
        if not os.path.exists(path):
            print(f"  ! no dossier: {slug}"); continue
        d = json.load(open(path, encoding="utf-8"))

        # rich scalar/array fields — replace when the new value is at least as deep
        rc = _c(v.get("rootCause"))
        if rc and len(rc) >= 0.7 * len(d.get("rootCause", "") or ""):
            d["rootCause"] = rc
        td = _c(v.get("technicalDeepDive"))
        if td and len(td) > 300:
            d["technicalDeepDive"] = td
        cf = _clist(v.get("contributingFactors"))
        if len(cf) >= 4:
            d["contributingFactors"] = cf

        soe = [{"t": _c(e.get("t", "")), "phase": _c(e.get("phase", "")), "event": _c(e.get("event", "")), "source": _c(e.get("source", ""))}
               for e in (v.get("sequenceOfEvents") or []) if _c(e.get("event"))]
        if len(soe) >= max(12, len(d.get("sequenceOfEvents", []))):
            d["sequenceOfEvents"] = soe

        metrics = [{"label": _c(m.get("label", "")), "value": _c(m.get("value", "")), "source": _c(m.get("source", ""))}
                   for m in (v.get("metrics") or []) if _c(m.get("label"))]
        if len(metrics) >= max(6, len(d.get("metrics", []))):
            d["metrics"] = metrics

        for key in ("improvements", "lessonsLearnt"):
            new = _clist(v.get(key))
            if len(new) >= max(4, len(d.get(key, []))):
                d[key] = new

        coe = [{"action": _c(c.get("action", "")), "owner": _c(c.get("owner", "")), "status": _c(c.get("status", ""))}
               for c in (v.get("coe") or []) if _c(c.get("action"))]
        if coe:
            d["coe"] = coe

        ca = [{"heading": _c(x.get("heading", "")), "body": _c(x.get("body", ""))}
              for x in (v.get("comprehensiveAnalysis") or []) if _c(x.get("body"))]
        if len(ca) >= 4:
            d["comprehensiveAnalysis"] = ca

        if _c(v.get("operatorShort")):
            d["operatorShort"] = _c(v.get("operatorShort"))

        # references merge (dedup by url, type-normalised, official first)
        refs = d.get("references", [])
        by_url = {(x.get("url") or "").rstrip("/"): x for x in refs}
        add = []
        for s in v.get("approvedSources") or []:
            u = (s.get("url") or "").rstrip("/")
            if not u:
                continue
            mt = _TYPE_MAP.get(s.get("type", "press"), "press"); q = _c(s.get("quote", ""))
            if u in by_url:
                ex = by_url[u]
                if mt in _ACCEPTED and ex.get("type") not in _ACCEPTED:
                    ex["type"] = mt
                if q and not (ex.get("quote") or "").strip():
                    ex["quote"] = q
                continue
            ref = {"title": _c(s.get("title", "")), "url": s.get("url", ""), "type": mt, "quote": q, "accessed": s.get("accessed", "")}
            by_url[u] = ref; add.append(ref)
        refs = add + refs
        refs.sort(key=lambda x: 0 if x.get("type") in _ACCEPTED else 1)
        d["references"] = refs
        n_off = sum(1 for x in refs if x.get("type") in _ACCEPTED)

        src = d.get("sourcing", {}) or {}
        if v.get("officialPostmortem") and n_off >= 1:
            src["officialPostmortem"] = True
        d["sourcing"] = src

        done.append(f"{slug}: rootC {len(d['rootCause'])}c · SOE {len(d['sequenceOfEvents'])} · metrics {len(d['metrics'])} · impr {len(d.get('improvements',[]))} · refs {len(refs)}({n_off} off) · PM={src.get('officialPostmortem', False)}")
        if apply:
            json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print(("APPLIED" if apply else "DRY-RUN") + f" — {len(done)} dossiers")
    for x in done:
        print("  ✓", x)


if __name__ == "__main__":
    main()
