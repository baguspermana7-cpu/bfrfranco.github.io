#!/usr/bin/env python3
"""PRD-Q03 static gate: reproduce an incident in a calculator.

    python3 tools/test-incidents-reproduce.py      # exit 1 on any failed law

U   each validation rule fails on a planted defect (a check that cannot fail proves nothing)
L1  accepted entries carry owner decision fields, validate RV1-RV17, and sit on no seed dossier
L2  each rendered link decodes to exactly {v:1, calc, inputs: baseline + set, origin}, <= 8,000 characters
L5  only dossiers with accepted entries render #reproduce (after #fmea, before #causes), the nav entry and the FMEA
    back-link; one row per set item; no other page carries them
L7  the review report covers every dossier: Q/B/C/S/N, none unreviewed (U)
F   data/reproduce-baselines.json equals a fresh build
"""
import base64
import copy
import glob
import html
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import incidents_reproduce as RP  # noqa: E402

fail = 0


def law(lid, ok, msg):
    global fail
    if not ok:
        fail += 1
    print(f"{'PASS' if ok else 'FAIL'} {lid} {msg}")


B = RP.load_baselines()
DS = {inc["slug"]: inc for _, inc in RP._dossiers()}

# ── U: planted defects, each must raise its rule ──────────────────────────────────────────────────────────────────
ovh = DS["ovhcloud-sbg2-fire-2021"]


def planted(rule, mutate):
    inc = copy.deepcopy(ovh)
    mutate(inc)
    errs = RP.validate_reproduce(inc, B)
    return any(rule in e for e in errs), errs


def _seed(i):
    i["sourcing"]["lastVerified"] = "seed — not verified"


def _kakao(i):   # a violated item resting on a contributing factor alone (F15)
    i["reproduce"][0]["set"][0]["evidence"] = [{"src": "factor", "i": 0, "quote": i["contributingFactors"][0][:40]}]


CASES = [
    ("RV10", lambda i: i["reproduce"][0]["set"][0]["evidence"][0].update(quote="equipped with fire detection and sprinklers")),
    ("RV8", lambda i: i["reproduce"][0]["set"][0].update(value=True)),
    ("RV8", lambda i: i["reproduce"][0]["set"][3].update(value=False)),
    ("RV11", _kakao),
    ("RV12", _seed),
    ("RV13", lambda i: i["reproduce"][0].pop("request")),
    ("RV6", lambda i: i["reproduce"][0]["set"][0].update(input="chk-not_an_item")),
    ("RV7", lambda i: i["reproduce"][1]["set"][0].update(value="halon")),
    ("RV7", lambda i: i["reproduce"][0]["set"][0].update(value="false")),
    ("RV16", lambda i: i["reproduce"][1].update(calc="tia", baseline="tia-t3-ent-all", set=i["reproduce"][0]["set"])),
    ("RV9", lambda i: i["reproduce"][0].update(set=[i["reproduce"][0]["set"][3]])),
    ("RV5", lambda i: i["reproduce"][0].update(mode="FM-99")),
    ("RV4", lambda i: i["reproduce"][0].update(baseline="tier-defaults")),
    ("RV2", lambda i: i["reproduce"][1].update(id="rp-tia")),
    ("RV1", lambda i: i["reproduce"][0].update(extra=1)),
]
for rule, fn in CASES:
    ok, errs = planted(rule, fn)
    law("U-" + rule, ok, f"planted defect raises {rule}" + ("" if ok else f" (got {errs[:2]})"))

# ── L1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
with_rp = {s: i for s, i in DS.items() if i.get("reproduce")}
acc = [(s, e) for s, i in with_rp.items() for e in RP.accepted(i)]
errs = [e for i in with_rp.values() for e in RP.validate_reproduce(i, B)]
fields = all(e.get("decidedBy") == "owner" and e.get("decidedOn") and e.get("request") for _, e in acc)
law("L1", not errs and fields and acc and not any(RP.incident_rules.is_seed(i) for i in with_rp.values()),
    f"{len(acc)} accepted entr(ies) on {len(with_rp)} dossier(s); RV1-RV17 errors {len(errs)}; owner fields on all {fields}")

# ── L2 + L5 on the rendered pages ──────────────────────────────────────────────────────────────────────────────────
ready, why = RP.p2_ready()
law("P2", ready, f"P2 share links ready on both calculators ({why})")
pages = sorted(glob.glob(os.path.join(ROOT, "incident-*.html")))
l2, l5 = [], []
for p in pages:
    slug = os.path.basename(p)[len("incident-"):-5]
    s = open(p, encoding="utf-8").read()
    inc = DS.get(slug)
    want = RP.accepted(inc) if inc else []
    has = 'id="reproduce"' in s
    if not want:
        if has or 'href="#reproduce"' in s or 'class="rp-back"' in s:
            l5.append(f"{slug}: renders reproduce without accepted entries")
        continue
    if not has:
        l5.append(f"{slug}: #reproduce missing")
        continue
    if not s.index('id="fmea"') < s.index('id="reproduce"') < s.index('id="causes"'):
        l5.append(f"{slug}: #reproduce not between #fmea and #causes")
    if '<a href="#reproduce">Reproduce</a>' not in s:
        l5.append(f"{slug}: nav entry missing")
    for e in want:
        blk = re.search(r'<div class="rp-entry" id="%s".*?</div>' % re.escape(e["id"]), s, flags=re.S)
        if not blk:
            l5.append(f"{slug}: entry {e['id']} missing")
            continue
        if blk.group(0).count('class="rp-row"') != len(e["set"]):
            l5.append(f"{slug}:{e['id']}: rows != set items")
        back = re.search(r'<details class="fm-row" id="%s".*?</details>' % re.escape(e["mode"]), s, flags=re.S)
        if not back or f'href="#{e["id"]}"' not in back.group(0):
            l5.append(f"{slug}:{e['id']}: FMEA back-link missing in {e['mode']}")
        href = html.unescape(re.search(r'class="rp-open" href="([^"]+)"', blk.group(0)).group(1))
        page, b64 = href.split("#rzs=")
        try:
            got = json.loads(base64.urlsafe_b64decode(b64 + "=" * (-len(b64) % 4)).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            l2.append(f"{slug}:{e['id']} link does not decode")
            continue
        base = B[e["baseline"]]
        exp_inputs = {k: dict(v) for k, v in base["inputs"].items()}
        for it in e["set"]:
            exp_inputs[it["input"]] = {"t": base["inputs"][it["input"]]["t"], "v": it["value"]}
        exp = {"v": 1, "calc": e["calc"], "inputs": exp_inputs, "origin": f"incident:{slug}:{e['id']}"}
        if json.dumps(got, sort_keys=True) != json.dumps(exp, sort_keys=True) or page != RP.PAGE[e["calc"]] or len(href) > 8000:
            l2.append(f"{slug}:{e['id']} payload/page/length")
law("L2", not l2 and acc, f"{len(acc)} link(s) decode to baseline + set with origin, on the right page, <= 8,000 chars"
    + (f" — {l2[:3]}" if l2 else ""))
law("L5", not l5, f"{len(pages)} dossier pages: reproduce renders exactly where accepted" + (f" — {l5[:3]}" if l5 else ""))

# ── L7 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
rows = RP.report(list(DS.values()), RP._reviews())
cnt = {}
for r in rows:
    cnt[r["verdict"]] = cnt.get(r["verdict"], 0) + 1
law("L7", len(rows) == len(DS) and "U" not in cnt and cnt.get("Q", 0) == len(with_rp),
    f"report covers {len(rows)}/{len(DS)} dossiers: " + " ".join(f"{k}{v}" for k, v in sorted(cnt.items())))

# ── F ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
r = subprocess.run([sys.executable, os.path.join(HERE, "build-reproduce-baselines.py"), "--check"], capture_output=True, text=True)
law("F", r.returncode == 0, r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr.strip()[:120])

print(f"test-incidents-reproduce: {'all passed' if not fail else str(fail) + ' failed'}")
sys.exit(1 if fail else 0)
