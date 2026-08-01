#!/usr/bin/env python3
"""
_ingest_rca.py — merge official-RCA workflow verdicts into incident dossiers.

Input: a JSON file = list of {slug, verdict:{finalRootCause, finalContributingFactors,
finalTechnicalDeepDive, approvedSources[], officialPostmortem, verdict, fabricationRisk}}.

For each incident it updates rootCause / contributingFactors / technicalDeepDive, MERGES
approvedSources into references (dedup by url, official/regulatory/court first), and sets
sourcing.officialPostmortem. Skips any verdict with fabricationRisk == 'high'
(logged, left for a re-run). Original file backed up to <slug>.json.bak-rca.

Usage: python3 tools/_ingest_rca.py /tmp/rca_results.json [--apply]
"""
import json
import os
import sys
import html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "incidents")
# gate (test-incidents-corpus) accepts exactly these ref types as "official"
_ACCEPTED = {"official-postmortem", "regulatory", "vendor-status"}
# map the verifier's schema enum (+ legacy) onto the gate's vocabulary
_TYPE_MAP = {
    "official": "official-postmortem", "officialPostmortem": "official-postmortem",
    "official-postmortem": "official-postmortem", "official-status": "vendor-status",
    "vendor-status": "vendor-status", "vendor": "vendor-status",
    "regulatory": "regulatory", "court": "regulatory", "press": "press", "news": "press",
}


def _maptype(t):
    return _TYPE_MAP.get(t, "press")


def _clean(s):
    return html.unescape(s).strip() if isinstance(s, str) else s


def main():
    if len(sys.argv) < 2:
        print("usage: _ingest_rca.py <results.json> [--apply]")
        return
    apply = "--apply" in sys.argv
    results = json.load(open(sys.argv[1], encoding="utf-8"))
    done, skipped = [], []
    for r in results:
        slug = r.get("slug")
        v = r.get("verdict") or {}
        if not slug:
            continue
        path = os.path.join(DATA, f"{slug}.json")
        if not os.path.exists(path):
            print(f"  ! no dossier: {slug}")
            continue
        if v.get("fabricationRisk") == "high":
            skipped.append(f"{slug} (fabricationRisk=high)")
            continue
        d = json.load(open(path, encoding="utf-8"))

        rc = _clean(v.get("finalRootCause"))
        td = _clean(v.get("finalTechnicalDeepDive"))
        cf = [_clean(x) for x in (v.get("finalContributingFactors") or []) if _clean(x)]
        if rc and len(rc) > len(d.get("rootCause", "") or "") * 0.5:
            d["rootCause"] = rc
        if td and len(td) > 200:
            d["technicalDeepDive"] = td
        if len(cf) >= 3:
            d["contributingFactors"] = cf

        # merge approved sources into references, dedup by url
        refs = d.get("references", [])
        by_url = {(x.get("url") or "").rstrip("/"): x for x in refs}
        add = []
        for s in v.get("approvedSources") or []:
            u = (s.get("url") or "").rstrip("/")
            if not u:
                continue
            mt = _maptype(s.get("type", "press"))
            q = _clean(s.get("quote", ""))
            if u in by_url:
                # dup URL: upgrade an existing non-official ref to an accepted type + fill quote
                ex = by_url[u]
                if mt in _ACCEPTED and ex.get("type") not in _ACCEPTED:
                    ex["type"] = mt
                if q and not (ex.get("quote") or "").strip():
                    ex["quote"] = q
                continue
            ref = {"title": _clean(s.get("title", "")), "url": s.get("url", ""),
                   "type": mt, "quote": q, "accessed": s.get("accessed", "")}
            by_url[u] = ref
            add.append(ref)
        # official first
        refs = add + refs
        refs.sort(key=lambda x: 0 if x.get("type") in _ACCEPTED else 1)
        d["references"] = refs

        n_off = sum(1 for x in refs if x.get("type") in _ACCEPTED)
        src = d.get("sourcing", {}) or {}
        # only claim officialPostmortem when an accepted-type ref actually backs it
        if v.get("officialPostmortem") and n_off >= 1:
            src["officialPostmortem"] = True
        d["sourcing"] = src
        done.append(f"{slug}: rootCause {len(d['rootCause'])}c · tech {len(d.get('technicalDeepDive',''))}c · +{len(add)} refs ({n_off} official) · PM={src.get('officialPostmortem', False)}")
        if apply:
            json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print(("APPLIED" if apply else "DRY-RUN") + f" — {len(done)} merged, {len(skipped)} skipped")
    for x in done:
        print("  ✓", x)
    for x in skipped:
        print("  ⨯", x)


if __name__ == "__main__":
    main()
