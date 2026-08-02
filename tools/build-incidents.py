#!/usr/bin/env python3
"""
build-incidents.py — render the root-gated DC-Incidents dossier.

Reads data/incidents/*.json (provenance-mandatory corpus) and writes:
  - dc-incidents.html            (hub: ranked, sortable incident index)
  - incident-<slug>.html         (one dedicated dossier page per incident)

Every page is gated (enforceTierFeatureAccess('dc-incidents'), root-only via the
page-access flag) and audit-passing (version stamp, mobile patch, dark palette,
gate markup, cookie consent). Ranking is a transparent composite of the sourced
magnitude sub-scores. Run:  python3 tools/build-incidents.py --apply
"""
import json
import glob
import os
import argparse
import html
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data", "incidents")
VER_TAG = "2026-08-01-gloss"

CATEGORY_LABEL = {
    "power": "Power", "cooling": "Cooling", "network": "Network",
    "software": "Software", "human": "Human error", "fire": "Fire",
    "flood": "Flood/Water", "supply": "Supply chain",
}
CATEGORY_TONE = {
    "power": "amber", "cooling": "cyan", "network": "cyan", "software": "amber",
    "human": "red", "fire": "red", "flood": "cyan", "supply": "amber",
}
REF_TONE = {
    "official-postmortem": "green", "regulatory": "green", "vendor-status": "cyan",
    "news": "amber", "linkedin": "cyan", "x": "cyan", "forum": "muted",
}

# ── magnitude ranking (transparent, sourced sub-scores 0-10) ──
WEIGHTS = {"blastRadiusScore": 0.35, "usersScore": 0.25, "financialScore": 0.20, "durationScore": 0.20}


def magnitude_score(inc):
    m = inc.get("magnitude", {})
    return round(sum(WEIGHTS[k] * float(m.get(k, 0)) for k in WEIGHTS), 3)


def esc(s):
    return html.escape(str(s), quote=True)


# ── RZExplain linkify: wrap the first occurrence of each glossary term in prose with a
#    data-explain span (wired by rz-explain.js wireAll — robust vs the alias-scan cache). ──
import re as _re
_TERMS = [
    ("automatic transfer switch", "automatic-transfer-switch"), ("single point of failure", "single-point-of-failure"),
    ("safe deployment process", "safe-deployment"), ("safe deployment", "safe-deployment"),
    ("cascading failure", "cascading-failure"), ("control plane", "control-plane"), ("data plane", "data-plane"),
    ("thermal runaway", "thermal-runaway"), ("blast radius", "blast-radius"), ("static switch", "static-transfer-switch"),
    ("static transfer switch", "static-transfer-switch"), ("free cooling", "free-cooling"), ("retry storm", "retry-storm"),
    ("race condition", "race-condition"), ("feature file", "feature-file"), ("lithium-ion", "lithium-ion-battery"),
    ("de-energisation", "de-energisation"), ("de-energization", "de-energisation"), ("switchgear", "switchgear"),
    ("chiller", "chiller"), ("failover", "failover"), ("post-mortem", "postmortem"), ("postmortem", "postmortem"),
    ("genset", "genset"), ("DDoS", "ddos"), ("BGP", "bgp"),
]
# longest-first so multi-word terms win
_TERMS.sort(key=lambda kv: -len(kv[0]))


def linkify(text, used=None):
    """esc() then wrap the first occurrence of each known term in a data-explain span. Pass a shared 'used' set to dedupe across a page."""
    s = esc(text or "")
    if used is None:
        used = set()
    for term, key in _TERMS:
        if key in used:
            continue
        pat = _re.compile(r"(?<![\w-])(" + _re.escape(term) + r")(?![\w-])", _re.IGNORECASE)
        m = pat.search(s)
        if m:
            span = f'<span data-explain="{key}" tabindex="0">{m.group(1)}</span>'
            s = s[:m.start()] + span + s[m.end():]
            used.add(key)
    return s


CSS = r"""
    /* ── Governed Incident Dossier — editorial register (v2): forest-green + warm ivory,
       serif display, evidence-class provenance. Accent vars remapped so all components
       re-skin. AA-contrast in both themes. No gradients / glass / dot-grid (anti-slop). */
    :root:not([data-theme="dark"]) {
        --bg:#f4f1e7; --surface:#fffdf6; --surface-2:#efeadc; --line:rgba(26,45,36,0.16);
        --text:#1a2d24; --text-strong:#10201a; --text-body:#3b463d; --muted:#6a7367;
        --cyan:#2f6b4f; --amber:#87671b; --green:#2f7d54; --red:#9c3b32; --gold:#87671b;
        --hero-ink:#f4f1e7; --hero-bg:#183329; --shadow-deep:rgba(26,45,36,0.10);
    }
    [data-theme="dark"] {
        --bg:#0c1512; --surface:#11201a; --surface-2:#16281f; --line:rgba(233,229,216,0.15);
        --text:#e9e5d8; --text-strong:#f5f2e9; --text-body:#c6ccbc; --muted:#8b9484;
        --cyan:#6aa588; --amber:#c9a559; --green:#6aa588; --red:#cf9384; --gold:#c9a559;
        --hero-ink:#e9e5d8; --hero-bg:#0f221a; --shadow-deep:rgba(0,0,0,0.5);
    }
    * { box-sizing:border-box; }
    html,body { margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:'IBM Plex Sans',system-ui,sans-serif; line-height:1.62; }
    a { color:var(--cyan); }
    h1,h2,.serif { font-family:'Fraunces','Newsreader',Georgia,serif; font-weight:600; letter-spacing:-0.01em; }
    .wrap { max-width:1120px; margin:0 auto; padding:1.5rem 1.1rem 3rem; }
    .navbar { display:flex; align-items:center; justify-content:space-between; padding:0.7rem 1.1rem; border-bottom:1px solid var(--line); background:var(--surface); position:sticky; top:0; z-index:50; }
    .nav-container { display:flex; align-items:center; justify-content:space-between; width:100%; max-width:1120px; margin:0 auto; }
    .nav-logo { display:flex; align-items:center; }
    .nav-avatar { width:34px; height:34px; border-radius:50%; }
    .nav-menu { display:flex; gap:1rem; list-style:none; margin:0; padding:0; }
    .nav-menu a { color:var(--text-body); text-decoration:none; font-size:0.85rem; font-weight:600; }
    .nav-menu a:hover { color:var(--cyan); }
    .nav-right { display:flex; align-items:center; gap:0.6rem; }
    .theme-btn { background:none; border:1px solid var(--line); color:var(--text); border-radius:4px; padding:0.35rem 0.5rem; cursor:pointer; font-size:0.8rem; }
    .lock-tag { font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.06em; text-transform:uppercase; color:var(--red); border:1px solid var(--red); border-radius:2px; padding:0.12rem 0.5rem; }
    h1 { font-size:2.4rem; color:var(--text-strong); margin:0.35rem 0 0.5rem; line-height:1.12; }
    h2 { font-size:1.4rem; color:var(--text-strong); margin:2rem 0 0.7rem; }
    .eyebrow { font-family:'JetBrains Mono',monospace; font-size:0.72rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--muted); }
    .lede { color:var(--text-body); font-size:0.98rem; max-width:70ch; }
    .chips { display:flex; flex-wrap:wrap; gap:0.4rem; margin:0.7rem 0; }
    .chip { font-family:'JetBrains Mono',monospace; font-size:0.7rem; padding:0.2rem 0.55rem; border-radius:2px; border:1px solid var(--line); color:var(--text-body); background:var(--surface-2); white-space:nowrap; }
    .chip.cyan { color:var(--cyan); border-left:2px solid var(--cyan); }
    .chip.amber { color:var(--amber); border-left:2px solid var(--amber); }
    .chip.green { color:var(--green); border-left:2px solid var(--green); }
    .chip.red { color:var(--red); border-left:2px solid var(--red); }
    .metabar { font-family:'JetBrains Mono',monospace; font-size:0.72rem; letter-spacing:0.04em; color:var(--muted); margin:0.7rem 0; display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center; font-variant-numeric:tabular-nums slashed-zero; }
    .metabar b { color:var(--text-body); font-weight:600; }
    .metabar .sep { color:var(--line); }
    .chip.muted { color:var(--muted); }
    .card { background:var(--surface); border:1px solid var(--line); border-radius:4px; padding:1rem 1.1rem; margin-top:0.9rem; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:4px; margin-top:0.9rem; }
    table.inc-index { width:100%; border-collapse:collapse; font-size:0.86rem; min-width:760px; font-variant-numeric:tabular-nums slashed-zero; }
    table.inc-index th { text-align:left; font-family:'JetBrains Mono',monospace; font-size:0.68rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); padding:0.6rem 0.7rem; border-bottom:1px solid var(--line); background:var(--surface-2); }
    table.inc-index td { padding:0.6rem 0.7rem; border-bottom:1px solid var(--line); color:var(--text-body); vertical-align:top; }
    table.inc-index tr:hover td { background:var(--surface-2); }
    table.inc-index a { font-weight:700; color:var(--text-strong); text-decoration:none; }
    table.inc-index a:hover { color:var(--cyan); text-decoration:underline; }
    /* rich incident table (reference-2 style) */
    table.itbl { min-width:1120px; }
    table.itbl td { vertical-align:middle; }
    .itr { cursor:pointer; }
    .itr:hover td { background:var(--surface-2); }
    .c-id .itid { font-family:'JetBrains Mono',monospace; font-size:0.7rem; color:var(--muted); white-space:nowrap; }
    .c-title { max-width:300px; }
    .c-title .itt { display:block; font-weight:700; color:var(--text-strong); text-decoration:none; font-size:0.9rem; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .itr:hover .itt { color:var(--cyan); }
    .c-title .its { color:var(--muted); font-size:0.76rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:0.1rem; }
    .sev-chip { font-family:'JetBrains Mono',monospace; font-size:0.66rem; font-weight:600; padding:0.12rem 0.5rem; border-radius:2px; border:1px solid; white-space:nowrap; }
    .sev-b-critical { color:var(--red); border-color:var(--red); }
    .sev-b-high { color:var(--amber); border-color:var(--amber); }
    .sev-b-medium { color:var(--green); border-color:var(--green); }
    .sev-b-low { color:var(--muted); border-color:var(--line); }
    .st-chip { font-family:'JetBrains Mono',monospace; font-size:0.64rem; padding:0.12rem 0.45rem; border-radius:2px; border:1px solid var(--line); white-space:nowrap; }
    .st-off { color:var(--green); border-color:color-mix(in srgb, var(--green) 45%, var(--line)); }
    .st-press { color:var(--amber); border-color:color-mix(in srgb, var(--amber) 45%, var(--line)); }
    .c-region { min-width:170px; }
    .c-region .iflag { font-size:1.05rem; margin-right:0.45rem; vertical-align:middle; }
    .c-region .ireg { display:inline-flex; flex-direction:column; vertical-align:middle; }
    .c-region .ireg b { color:var(--text-body); font-weight:600; font-size:0.82rem; }
    .c-region .ireg i { color:var(--muted); font-style:normal; font-size:0.72rem; }
    .c-mono { font-family:'JetBrains Mono',monospace; font-size:0.78rem; color:var(--text-body); white-space:nowrap; }
    .c-blast { color:var(--text-strong); font-weight:600; } .c-blast .c-u { color:var(--muted); font-weight:400; font-size:0.68rem; }
    .ibars { display:inline-flex; gap:2px; }
    .ibars i { width:7px; height:9px; border-radius:1px; display:block; }
    .itags { display:flex; gap:0.25rem; max-width:150px; flex-wrap:wrap; }
    .c-go { color:var(--muted); font-size:1rem; text-align:center; }
    .itr:hover .c-go { color:var(--cyan); }
    /* incident-view tabs (List / Risk map / Semantic / Analytics) */
    .iv-tabs { display:flex; gap:1.2rem; border-bottom:1px solid var(--line); margin:0.4rem 0 0.2rem; flex-wrap:wrap; }
    .iv-tabs a { font-family:'JetBrains Mono',monospace; font-size:0.74rem; letter-spacing:0.03em; color:var(--muted); text-decoration:none; padding:0.5rem 0.1rem; border-bottom:2px solid transparent; }
    .iv-tabs a:hover { color:var(--text-strong); }
    .iv-tabs a.on { color:var(--text-strong); border-bottom-color:var(--cyan); }
    .rank-badge { font-family:'JetBrains Mono',monospace; font-weight:700; color:var(--amber); font-variant-numeric:tabular-nums slashed-zero; }
    .mag-bar { height:5px; border-radius:0; background:var(--line); margin-top:0.35rem; overflow:hidden; }
    .mag-bar > span { display:block; height:4px; background:var(--amber); }
    ul.tight { margin:0.4rem 0 0; padding-left:1.15rem; }
    ul.tight li { color:var(--text-body); margin:0.3rem 0; font-size:0.92rem; }
    .soe { list-style:none; margin:0.6rem 0 0; padding:0; }
    .soe li { display:grid; grid-template-columns:170px 1fr; gap:0.7rem; padding:0.5rem 0; border-bottom:1px solid var(--line); }
    .soe time { font-family:'JetBrains Mono',monospace; font-size:0.76rem; color:var(--muted); font-variant-numeric:tabular-nums slashed-zero; }
    .soe .ev { color:var(--text-body); font-size:0.9rem; }
    .phase-chip { font-family:'JetBrains Mono',monospace; font-size:0.62rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--amber); border:1px solid var(--line); border-radius:2px; padding:0.05rem 0.4rem; margin-right:0.4rem; white-space:nowrap; font-variant-numeric:tabular-nums; }
    table.metrics { width:100%; border-collapse:collapse; font-size:0.88rem; font-variant-numeric:tabular-nums slashed-zero; }
    table.metrics td { padding:0.5rem 0.7rem; border-bottom:1px solid var(--line); vertical-align:top; }
    table.metrics .mlabel { color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:0.76rem; width:38%; white-space:nowrap; }
    table.metrics .mval { color:var(--text-body); }
    .ca-block { background:var(--surface); border:1px solid var(--line); border-left:2px solid var(--cyan); border-radius:0 2px 2px 0; padding:0.7rem 1rem; margin-top:0.7rem; }
    .ca-block h3 { margin:0 0 0.3rem; font-size:0.92rem; color:var(--text-strong); }
    .ca-block p { margin:0; color:var(--text-body); font-size:0.9rem; }
    /* reading column — constrain prose to a comfortable measure, justified like RZ articles */
    .reading-col { max-width:820px; margin:0 auto; }
    .reading-col p.lede, .reading-col .card p, .reading-col .ca-block p, .reading-col ul.tight li { text-align:justify; -webkit-hyphens:auto; hyphens:auto; }
    .card p { margin:0; }
    .card > p + p, .card p + p { margin-top:0.7rem; }
    .mag-trace { font-family:'JetBrains Mono',monospace; font-size:0.74rem; color:var(--text-body); background:var(--surface-2); border:1px solid var(--line); border-left:2px solid var(--cyan); border-radius:0 2px 2px 0; padding:0.5rem 0.7rem; margin-top:0.5rem; font-variant-numeric:tabular-nums slashed-zero; }
    .mag-trace b { color:var(--text-strong); }
    .imp-tag { font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.04em; text-transform:uppercase; color:var(--cyan); font-weight:700; margin-right:0.35rem; }
    .coe-meta { display:inline-block; font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:var(--muted); background:var(--surface-2); border:1px solid var(--line); border-radius:2px; padding:0.05rem 0.4rem; margin-left:0.2rem; white-space:normal; }
    /* FAQ / methodology */
    details.faq { border:1px solid var(--line); border-radius:4px; background:var(--surface); margin:0.8rem 0 0.4rem; }
    details.faq > summary { cursor:pointer; padding:0.7rem 0.9rem; font-family:'JetBrains Mono',monospace; font-size:0.74rem; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-strong); list-style:none; }
    details.faq > summary::-webkit-details-marker { display:none; }
    details.faq > summary::before { content:"+ "; color:var(--cyan); }
    details.faq[open] > summary::before { content:"– "; }
    details.faq .faq-body { padding:0 0.9rem 0.9rem; }
    details.faq h4 { font-family:'Fraunces',Georgia,serif; font-size:0.98rem; color:var(--text-strong); margin:0.8rem 0 0.2rem; }
    details.faq p, details.faq li { color:var(--text-body); font-size:0.88rem; }
    /* share bar (RZ standard) — editorial thin buttons */
    .share-buttons { display:flex; align-items:center; gap:0.5rem; margin:1.4rem 0 0.4rem; padding-top:1rem; border-top:1px solid var(--line); }
    .share-label { font-family:'JetBrains Mono',monospace; font-size:0.68rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); margin-right:0.2rem; }
    .share-btn { width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; background:var(--surface-2); border:1px solid var(--line); border-radius:4px; color:var(--text-body); cursor:pointer; padding:0; }
    .share-btn:hover { border-color:var(--cyan); color:var(--cyan); }
    .share-btn svg { width:15px; height:15px; }
    /* ── inline-SVG visualizations (theme-aware via vars) ── */
    .inc-map { height:410px; margin-top:0.4rem; border:1px solid var(--line); border-radius:4px; overflow:hidden; background:#0f1a16; z-index:1; }
    .inc-map .leaflet-container { background:#0f1a16; font-family:'IBM Plex Sans',sans-serif; }
    .inc-map .leaflet-popup-content-wrapper { background:#12211b !important; color:#e6efe9 !important; border:1px solid #2c4438 !important; border-radius:10px !important; box-shadow:0 8px 24px rgba(0,0,0,0.45) !important; }
    .inc-map .leaflet-popup-tip { background:#12211b !important; border:1px solid #2c4438 !important; }
    .inc-map .leaflet-popup-content { margin:9px 12px !important; }
    .inc-map .leaflet-control-attribution { background:rgba(15,26,22,0.8) !important; color:#7d8f86 !important; font-size:9px !important; }
    .inc-map .leaflet-control-attribution a { color:#9fb3a8 !important; }
    .inc-map .leaflet-bar a { background:#12211b !important; color:#cfe0d7 !important; border-color:#2c4438 !important; }
    .leaflet-tooltip.inc-tip { background:#12211b; color:#e6efe9; border:1px solid #2c4438; border-radius:3px; font-family:'JetBrains Mono',monospace; font-size:0.66rem; padding:2px 7px; box-shadow:0 6px 18px rgba(0,0,0,0.5); }
    .leaflet-tooltip.inc-tip:before { border-top-color:#2c4438; }
    /* ── Incident Intelligence dashboard (editorial, no neon) ── */
    .iid { margin:1.4rem 0 1rem; }
    .iid-head { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:0.9rem; }
    .iid-title { font-size:1.6rem; margin:0; color:var(--text-strong); }
    .iid-sub { margin:0.15rem 0 0; color:var(--muted); font-size:0.86rem; }
    .iid-range { font-family:'JetBrains Mono',monospace; font-size:0.7rem; letter-spacing:0.05em; color:var(--muted); border:1px solid var(--line); border-radius:3px; padding:0.3rem 0.6rem; white-space:nowrap; }
    .iid-num { font-variant-numeric:tabular-nums slashed-zero; }
    .iid-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:0.7rem; margin-bottom:0.9rem; }
    .iid-kpi { background:var(--surface); border:1px solid var(--line); border-top:2px solid var(--cyan); border-radius:0 0 4px 4px; padding:0.75rem 0.85rem; transition:transform 0.18s ease, box-shadow 0.18s ease; }
    .iid-kpi:hover { transform:translateY(-2px); box-shadow:0 10px 24px var(--shadow-deep); }
    .iid-kpi-l { font-family:'JetBrains Mono',monospace; font-size:0.62rem; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted); }
    .iid-kpi-v { display:flex; align-items:baseline; gap:0.3rem; margin:0.25rem 0 0.15rem; }
    .iid-kpi-v .iid-num, .iid-kpi-v > span:first-child { font-family:'Fraunces',Georgia,serif; font-size:1.8rem; font-weight:600; color:var(--text-strong); line-height:1; }
    .iid-kpi-u { font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:var(--muted); }
    .iid-kpi-s { font-size:0.72rem; color:var(--muted); }
    .iid-grid { display:grid; grid-template-columns:290px 1fr 300px; gap:0.9rem; align-items:start; }
    .iid-col-l, .iid-col-c, .iid-col-r { display:flex; flex-direction:column; gap:0.9rem; min-width:0; }
    .iid-panel { background:var(--surface); border:1px solid var(--line); border-radius:4px; padding:0.85rem 0.95rem; }
    .iid-panel-map { padding:0.85rem 0.95rem 0.6rem; }
    .iid-panel-map .inc-map { height:360px; margin-top:0.5rem; }
    .iid-ph { font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); margin-bottom:0.5rem; }
    .iid-note { font-size:0.74rem; color:var(--muted); margin:0 0 0.5rem; }
    .iid-donut-wrap { display:flex; align-items:center; gap:0.9rem; }
    .iid-donut { width:130px; height:130px; flex:0 0 auto; }
    .iid-arc { transition:stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1); }
    .iid-donut-c { font-family:'Fraunces',Georgia,serif; font-size:19px; font-weight:600; fill:var(--text-strong); }
    .iid-donut-t { font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:0.1em; text-transform:uppercase; fill:var(--muted); }
    .iid-legend { list-style:none; margin:0; padding:0; flex:1; min-width:0; }
    .iid-legend li { display:flex; align-items:center; gap:0.45rem; font-size:0.82rem; color:var(--text-body); padding:0.16rem 0; }
    .iid-legend b { margin-left:auto; color:var(--text-strong); font-family:'JetBrains Mono',monospace; font-size:0.82rem; }
    .iid-legend .iid-pct { color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:0.72rem; width:2.4em; text-align:right; }
    .iid-dot { width:9px; height:9px; border-radius:50%; flex:0 0 auto; }
    .iid-catbars, .iid-durbars, .iid-sigs { list-style:none; margin:0; padding:0; }
    .iid-catbars li, .iid-durbars li, .iid-sigs li { display:grid; grid-template-columns:1fr 90px auto; align-items:center; gap:0.5rem; padding:0.24rem 0; font-size:0.82rem; }
    .iid-sigs li { grid-template-columns:1fr 64px auto auto; }
    .iid-catbars li { cursor:pointer; }
    .iid-catbars li:hover .iid-cbl { color:var(--cyan); }
    .iid-cbl, .iid-dbl, .iid-sig-n { color:var(--text-body); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .iid-cbar, .iid-dbar, .iid-sig-bar { height:7px; background:var(--surface-2); border-radius:0; overflow:hidden; }
    .iid-cbar i, .iid-sig-bar i { display:block; height:100%; width:var(--w); background:var(--amber); transform:scaleX(0); transform-origin:left; transition:transform 0.9s cubic-bezier(0.22,1,0.36,1); }
    .iid-dbar i { display:block; height:100%; width:var(--w); background:var(--cyan); transform:scaleX(0); transform-origin:left; transition:transform 0.9s cubic-bezier(0.22,1,0.36,1); }
    .iid-in .iid-cbar i, .iid-in .iid-dbar i, .iid-in .iid-sig-bar i { transform:scaleX(1); }
    .iid-catbars b, .iid-durbars b, .iid-sigs b { font-family:'JetBrains Mono',monospace; color:var(--text-strong); font-size:0.82rem; text-align:right; }
    .iid-durbars b { color:var(--muted); }
    .iid-sig-m { font-family:'JetBrains Mono',monospace; font-size:0.66rem; color:var(--muted); }
    .iid-recent { display:flex; flex-direction:column; }
    .iid-rec { display:flex; align-items:center; gap:0.55rem; padding:0.45rem 0; border-bottom:1px solid var(--line); text-decoration:none; }
    .iid-rec:last-child { border-bottom:none; }
    .iid-rec-sev { width:8px; height:8px; border-radius:50%; flex:0 0 auto; }
    .iid-rec-b { display:flex; flex-direction:column; min-width:0; flex:1; }
    .iid-rec-t { color:var(--text-strong); font-size:0.84rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .iid-rec:hover .iid-rec-t { color:var(--cyan); }
    .iid-rec-m { color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:0.68rem; }
    .iid-rec-tag { font-family:'JetBrains Mono',monospace; font-size:0.58rem; letter-spacing:0.04em; padding:0.1rem 0.35rem; border:1px solid var(--line); border-radius:2px; flex:0 0 auto; }
    .sev-critical { background:var(--red); } .iid-rec-tag.sev-critical { color:var(--red); background:transparent; border-color:var(--red); }
    .sev-high { background:var(--amber); } .iid-rec-tag.sev-high { color:var(--amber); background:transparent; border-color:var(--amber); }
    .sev-medium { background:var(--green); } .iid-rec-tag.sev-medium { color:var(--green); background:transparent; border-color:var(--green); }
    .sev-low { background:var(--muted); } .iid-rec-tag.sev-low { color:var(--muted); background:transparent; border-color:var(--line); }
    .iid-graph { width:100%; height:auto; display:block; }
    .iid-edge { stroke:var(--line); stroke-width:1; opacity:0.55; transition:stroke 0.15s, opacity 0.15s; }
    .iid-edge.on { stroke:var(--cyan); opacity:0.9; stroke-width:1.3; }
    .iid-node circle { transition:transform 0.15s ease, opacity 0.15s; transform-origin:center; }
    .iid-node:hover circle { stroke:var(--text-strong); stroke-width:1.4; }
    .iid-graph.iid-focus .iid-node.dim circle { opacity:0.22; }
    .iid-maplegend { display:flex; flex-wrap:wrap; gap:0.4rem 1rem; margin-top:0.5rem; font-family:'JetBrains Mono',monospace; font-size:0.66rem; color:var(--muted); }
    .iid-maplegend span { display:inline-flex; align-items:center; gap:0.35rem; }
    .iid-maplegend i { width:10px; height:10px; border-radius:50%; }
    .iid-maplegend .iid-mln { font-style:italic; opacity:0.8; }
    .iid-foot { display:flex; flex-wrap:wrap; gap:0.5rem 1.4rem; align-items:center; margin-top:0.9rem; padding-top:0.8rem; border-top:1px solid var(--line); font-family:'JetBrains Mono',monospace; font-size:0.68rem; color:var(--muted); }
    .iid-foot b { color:var(--text-body); font-weight:600; margin-right:0.3rem; }
    .iid-foot-link { margin-left:auto; color:var(--cyan); text-decoration:none; }
    @media (max-width:1000px){ .iid-grid { grid-template-columns:1fr; } .iid-kpis { grid-template-columns:repeat(2,1fr); } }
    @media (max-width:520px){ .iid-kpis { grid-template-columns:1fr 1fr; } .iid-kpi-v .iid-num, .iid-kpi-v > span:first-child { font-size:1.5rem; } }
    @media (prefers-reduced-motion:reduce){ .iid-arc,.iid-cbar i,.iid-dbar i,.iid-sig-bar i,.iid-kpi,.iid-node circle,.iid-edge { transition:none !important; } .iid-cbar i,.iid-dbar i,.iid-sig-bar i { transform:scaleX(1); } }
    .viz { overflow-x:auto; margin-top:0.9rem; background:var(--surface); border:1px solid var(--line); border-radius:4px; padding:0.9rem 1rem; }
    .viz svg { display:block; max-width:100%; height:auto; }
    .viz-radar svg { max-width:320px; margin:0 auto; }
    .vz-num { font-variant-numeric:tabular-nums slashed-zero; }
    .vz-box-t, .vz-box-s, .vz-lbl, .vz-hb-lbl, .vz-tl-t, .vz-pt, .vz-tick { pointer-events:auto; }
    .vz-grid { fill:none; stroke:var(--line); stroke-width:1; }
    .vz-accent-fill { fill:var(--cyan); fill-opacity:0.16; stroke:var(--cyan); stroke-width:1.4; }
    .vz-accent-dot { fill:var(--cyan); }
    .vz-accent-bar { fill:var(--cyan); }
    .vz-cat-bar { fill:var(--amber); }
    .vz-lbl { font-family:'JetBrains Mono',monospace; font-size:9px; fill:var(--muted); }
    .vz-box-trigger { fill:color-mix(in srgb, var(--red) 12%, var(--surface)); stroke:var(--red); stroke-width:1.2; }
    .vz-box-fault { fill:color-mix(in srgb, var(--amber) 12%, var(--surface)); stroke:var(--amber); stroke-width:1.2; }
    .vz-box-down { fill:color-mix(in srgb, var(--cyan) 10%, var(--surface)); stroke:var(--cyan); stroke-width:1; }
    .vz-box-t { font-family:'IBM Plex Sans',sans-serif; font-size:11px; font-weight:600; fill:var(--text-strong); }
    .vz-box-s { font-family:'JetBrains Mono',monospace; font-size:9px; fill:var(--muted); }
    .vz-flow { stroke:var(--muted); stroke-width:1.3; fill:none; }
    .vz-arrhead { fill:var(--muted); }
    .vz-tl-ph { font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:0.04em; text-transform:uppercase; fill:var(--amber); }
    .vz-tl-t { font-family:'JetBrains Mono',monospace; font-size:8.5px; fill:var(--muted); }
    .vz-hb-lbl { font-family:'IBM Plex Sans',sans-serif; font-size:11px; fill:var(--text-body); }
    .vz-hb-val { font-family:'JetBrains Mono',monospace; font-size:10px; fill:var(--muted); font-variant-numeric:tabular-nums slashed-zero; }
    .vz-tick { font-family:'JetBrains Mono',monospace; font-size:8.5px; fill:var(--muted); }
    .vz-quad { font-family:'JetBrains Mono',monospace; font-size:8px; letter-spacing:0.05em; text-transform:uppercase; fill:var(--muted); opacity:0.7; }
    .vz-pt { font-family:'JetBrains Mono',monospace; font-size:8px; fill:var(--text-body); }
    .viz a { text-decoration:none; }
    .viz a:hover .vz-pt { fill:var(--cyan); font-weight:600; }
    .viz a:hover circle { stroke:var(--text-strong); stroke-width:1.4; }
    .vz-legend { display:flex; flex-wrap:wrap; gap:0.5rem 1.1rem; margin-top:0.7rem; padding-top:0.6rem; border-top:1px solid var(--line); }
    .vz-key { display:inline-flex; align-items:center; gap:0.4rem; font-family:'JetBrains Mono',monospace; font-size:0.68rem; color:var(--muted); }
    .vz-key i { width:11px; height:11px; border-radius:50%; display:inline-block; }
    .vz-key-note { font-style:italic; opacity:0.8; }
    .viz-grid3 { display:grid; grid-template-columns:1fr 1fr; gap:0.9rem; }
    @media (max-width:720px){ .viz-grid3 { grid-template-columns:1fr; } }
    .filterbar { display:flex; flex-wrap:wrap; align-items:center; gap:0.4rem 0.6rem; margin:0.9rem 0 0.2rem; }
    .fb-group { display:flex; flex-wrap:wrap; gap:0.35rem; }
    .fb-chip { font-family:'JetBrains Mono',monospace; font-size:0.72rem; padding:0.28rem 0.6rem; border-radius:2px; border:1px solid var(--line); background:var(--surface); color:var(--text-body); cursor:pointer; }
    .fb-chip:hover { border-color:var(--cyan); }
    .fb-chip.active { background:var(--surface-2); border-color:var(--line); border-bottom:2px solid var(--cyan); color:var(--text-strong); font-weight:700; }
    .fb-search { flex:1 1 200px; min-width:160px; font-family:'IBM Plex Sans',sans-serif; font-size:0.82rem; padding:0.3rem 0.6rem; border-radius:4px; border:1px solid var(--line); background:var(--surface); color:var(--text); }
    .fb-count { font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:var(--muted); margin-left:auto; }
    .kv { display:grid; grid-template-columns:180px 1fr; gap:0.5rem 0.9rem; margin-top:0.5rem; font-size:0.9rem; }
    .kv dt { color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:0.76rem; }
    .kv dd { margin:0; color:var(--text-body); }
    .refs { list-style:none; margin:0.6rem 0 0; padding:0; }
    .refs li { padding:0.55rem 0; border-bottom:1px solid var(--line); }
    .refs .rtitle { color:var(--text-strong); font-weight:600; font-size:0.9rem; }
    .refs .rquote { color:var(--muted); font-size:0.84rem; font-style:italic; margin-top:0.2rem; display:block; }
    .refs a { font-size:0.78rem; word-break:break-all; }
    .backlink { display:inline-block; margin-bottom:0.6rem; font-size:0.82rem; color:var(--cyan); text-decoration:none; }
    footer { border-top:1px solid var(--line); margin-top:2.5rem; padding:1.4rem 1.1rem; text-align:center; }
    footer .ver { font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:var(--muted); }
    .disclaimer { font-size:0.76rem; color:var(--muted); margin-top:0.8rem; max-width:80ch; }
    .skip-link { position:absolute; top:-50px; left:0; background:var(--cyan); color:var(--hero-bg); padding:10px 20px; text-decoration:none; font-weight:600; z-index:10000; border-radius:0 0 4px 0; transition:top 0.2s; }
    .skip-link:focus { top:0; }
    .root-gate { position:fixed; inset:0; z-index:99999; display:none; align-items:center; justify-content:center; background:rgba(2,6,23,0.74); padding:1rem; backdrop-filter:blur(6px); }
    body.locked .root-gate { display:flex; }
    body.locked .wrap { filter:blur(4px); pointer-events:none; user-select:none; }
    .root-card { max-width:430px; width:100%; background:var(--surface); border:1px solid var(--cyan); border-radius:4px; padding:1.3rem 1.15rem; text-align:center; box-shadow:0 18px 36px var(--shadow-deep); }
    .root-card h2 { margin:0 0 0.4rem; font-size:1.1rem; color:var(--text-strong); }
    .root-card p { font-size:0.86rem; color:var(--text-body); }
    .root-actions { margin-top:0.9rem; display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; }
    .root-actions button, .root-actions a { border-radius:4px; padding:0.5rem 0.85rem; font-size:0.8rem; font-weight:700; border:1px solid var(--line); text-decoration:none; cursor:pointer; color:var(--text); font-family:inherit; }
    .root-actions button { background:var(--cyan); color:var(--hero-bg); border:none; }
    .rz-nav-burger { display:none; }
    /* v1.8.0 — mobile responsive patch */
    @media (max-width:768px) {
        html,body { overflow-x:hidden; max-width:100vw; }
        img { max-width:100%; height:auto; display:block; }
        .nav-menu, .nav-links { display:none; }
        .navbar { padding:0.5rem 0.75rem; }
        footer .footer-grid { grid-template-columns:1fr; gap:1.25rem; padding:1rem; }
        button, a.btn, [role="button"] { min-height:44px; }
        h1 { font-size:1.4rem; }
        .soe li { grid-template-columns:1fr; gap:0.15rem; }
        .kv { grid-template-columns:1fr; }
        .root-card { max-width:92vw; }
    }
    @media print { body.locked .wrap { filter:none !important; pointer-events:auto !important; } }
"""

SCRIPTS_TMPL = """
    <script src="{base}js/rz-version.js?v={ver}"></script>
    <script src="{base}js/rz-feature-flags.js?v={ver}" defer></script>
    <script src="{base}auth.js?v={ver}" defer></script>
    <script src="{base}js/rz-mobile-nav.js?v={ver}" defer></script>
    <script src="{base}js/rz-cookie-consent.js?v={ver}" defer></script>
    <script src="{base}js/rz-explain-db.js?v={ver}" defer></script>
    <script src="{base}js/rz-explain.js?v={ver}" defer></script>
    <script>
    (function(){{var t=document.getElementById('themeToggle');function a(theme){{document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('theme',theme);var m=document.querySelector('meta[name=\\"theme-color\\"]');if(m)m.setAttribute('content',theme==='dark'?'#0c1512':'#f4f1e7');}}a(localStorage.getItem('theme')||'dark');if(t)t.addEventListener('click',function(){{var c=document.documentElement.getAttribute('data-theme');a(c==='dark'?'light':'dark');}});}})();
    (function(){{function ag(){{if(window._rzAuth&&typeof window._rzAuth.enforceTierFeatureAccess==='function'){{window._rzAuth.enforceTierFeatureAccess('dc-incidents');}}else{{try{{var s=JSON.parse(localStorage.getItem('rz_premium_session')||'null');var r=s&&s.role,t=s&&s.tier;var passes=!!s&&(r==='root'||t==='root');document.body.classList.toggle('locked',!passes);}}catch(e){{document.body.classList.add('locked');}}}}}}var b=document.getElementById('rootLoginBtn');if(b)b.addEventListener('click',function(){{if(window._rzAuth&&typeof window._rzAuth.showRootGatePrompt==='function'){{window._rzAuth.showRootGatePrompt('Root account required for the DC Incidents dossier.');}}else if(window._rzAuth&&typeof window._rzAuth.showModal==='function'){{window._rzAuth.showModal();}}}});window.addEventListener('rz-auth-change',function(){{setTimeout(ag,50);}});window.addEventListener('storage',function(e){{if(e.key==='rz_premium_session')ag();}});ag();setTimeout(ag,60);setTimeout(ag,550);setTimeout(ag,1600);}})();
    (function(){{var el=document.getElementById('versionStamp');if(!el)return;var v=window.RZ_VERSION||'1.x.x',d=window.RZ_VERSION_DATE||'',cn=window.RZ_VERSION_CODENAME||'';el.textContent='· ResistanceZero · v'+v+(d?' · '+d:'')+(cn?' · '+cn:'')+' ·';}})();
    (function(){{var n=0;function sc(){{if(window.RZExplain&&window.RZExplain.scanText&&window.RZ_EXPLAIN_DB){{var m=document.getElementById('main-content');if(m)window.RZExplain.scanText(m,140);}}else if(n++<40){{setTimeout(sc,200);}}}}setTimeout(sc,350);}})();
    </script>
"""


def page_shell(title, desc, canonical_path, body_html, base="", head_extra=""):
    head = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{esc(title)} | ResistanceZero</title>
    <meta name="description" content="{esc(desc)}">
    <meta name="robots" content="noindex, nofollow">
    <meta name="ai-content-declaration" content="human-curated, sourced from public post-incident reports">
    <meta name="author" content="Bagus Dwi Permana">
    <link rel="canonical" href="https://resistancezero.com/{esc(canonical_path)}">
    <meta name="theme-color" content="#0c1512">
    <link rel="icon" type="image/png" href="{base}assets/Favicon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
    <style>{CSS}</style>
    {head_extra}
</head>
<body class="locked">
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <nav class="navbar"><div class="nav-container">
        <a href="{base}index.html" class="nav-logo"><img loading="lazy" src="{base}assets/profile-photo.jpg" alt="Bagus Dwi Permana" class="nav-avatar" width="400" height="400"></a>
        <ul class="nav-menu" id="navMenu">
            <li><a href="{base}index.html">Home</a></li>
            <li><a href="{base}dc-incidents.html">DC Incidents</a></li>
            <li><a href="{base}datacenter-solutions.html">DC Solutions</a></li>
        </ul>
        <div class="nav-right">
            <span class="lock-tag" title="Root-only module">ROOT</span>
            <button class="theme-btn" id="themeToggle" type="button" aria-label="Toggle theme">◐</button>
        </div>
    </div></nav>
    <main class="wrap" id="main-content">
{body_html}
    </main>
    <footer><div class="footer-grid"></div><span class="ver" id="versionStamp"></span></footer>
    <div class="root-gate">
        <div class="root-card">
            <h2>Root access required</h2>
            <p>The DC Incidents dossier is a root-only module. Sign in with an authorized account to continue.</p>
            <div class="root-actions">
                <button id="rootLoginBtn" type="button">Sign In</button>
                <a href="{base}index.html">Back to Home</a>
            </div>
        </div>
    </div>
"""
    scripts = SCRIPTS_TMPL.format(base=base, ver=VER_TAG)
    return head + scripts + "\n</body>\n</html>\n"


def cat_chips(cats):
    return "".join(f'<span class="chip {CATEGORY_TONE.get(c,"muted")}">{esc(CATEGORY_LABEL.get(c,c))}</span>' for c in cats)


FILTER_JS = r"""<script>
        (function(){
          var FAC={power:1,cooling:1,fire:1,flood:1}, LOG={network:1,software:1,human:1};
          var st={domain:null,cat:null,pm:false,q:''};
          var bar=document.getElementById('filterbar'), tbl=document.getElementById('incTable'), cnt=document.getElementById('fbCount');
          if(!bar||!tbl)return;
          var rows=[].slice.call(tbl.querySelectorAll('tbody tr'));
          var search=document.getElementById('fbSearch');
          function apply(){
            var shown=0;
            rows.forEach(function(r){
              var cats=(r.getAttribute('data-cats')||'').split(' ');
              var ok=true;
              if(st.cat) ok=ok&&cats.indexOf(st.cat)>=0;
              if(st.domain){var set=st.domain==='facility'?FAC:LOG; ok=ok&&cats.some(function(c){return set[c];});}
              if(st.pm) ok=ok&&r.getAttribute('data-pm')==='1';
              if(st.q) ok=ok&&(r.getAttribute('data-search')||'').indexOf(st.q)>=0;
              r.style.display=ok?'':'none'; if(ok)shown++;
            });
            cnt.textContent=shown+' of '+rows.length+' shown';
          }
          bar.addEventListener('click',function(e){
            var b=e.target.closest('.fb-chip'); if(!b)return;
            if(b.getAttribute('data-f')==='all'){st.domain=null;st.cat=null;st.pm=false;
              bar.querySelectorAll('.fb-chip').forEach(function(x){x.classList.remove('active');}); b.classList.add('active'); apply(); return;}
            bar.querySelector('[data-f=all]').classList.remove('active');
            if(b.hasAttribute('data-domain')){st.domain=st.domain===b.getAttribute('data-domain')?null:b.getAttribute('data-domain'); st.cat=null;
              bar.querySelectorAll('[data-cat]').forEach(function(x){x.classList.remove('active');});
              bar.querySelectorAll('[data-domain]').forEach(function(x){x.classList.toggle('active',x===b&&!!st.domain);});}
            else if(b.hasAttribute('data-cat')){st.cat=st.cat===b.getAttribute('data-cat')?null:b.getAttribute('data-cat'); st.domain=null;
              bar.querySelectorAll('[data-domain]').forEach(function(x){x.classList.remove('active');});
              bar.querySelectorAll('[data-cat]').forEach(function(x){x.classList.toggle('active',x===b&&!!st.cat);});}
            else if(b.hasAttribute('data-pm')){st.pm=!st.pm; b.classList.toggle('active',st.pm);}
            if(!st.domain&&!st.cat&&!st.pm&&!st.q) bar.querySelector('[data-f=all]').classList.add('active');
            apply();
          });
          if(search)search.addEventListener('input',function(){st.q=search.value.toLowerCase();apply();});
          apply();
        })();
        </script>"""


def render_hub(incidents):
    _CLUSTER_SVG = hub_cluster_svg()
    _pm_count = sum(1 for x in incidents if (x.get('sourcing',{}) or {}).get('officialPostmortem') or x.get('officialPostmortem'))
    rows = []
    for i, inc in enumerate(incidents, 1):
        loc = inc.get("location", {})
        loc_s = ", ".join(x for x in [loc.get("city"), loc.get("country")] if x)
        mag = inc["_score"]
        cats = inc.get("category", [])
        band = _severity_band(mag)
        pm = bool((inc.get("sourcing", {}) or {}).get("officialPostmortem") or inc.get("officialPostmortem"))
        st_txt, st_cls = ("Official RCA", "st-off") if pm else ("Press-sourced", "st-press")
        iid = f"INC-{(inc.get('date','') or '----')[:4]}-{i:03d}"
        blast = float((inc.get("magnitude", {}) or {}).get("blastRadiusScore", 0))
        brief = inc.get("brief", "") or ""
        href = f"incident-{esc(inc['slug'])}.html"
        search = (inc.get("title", "") + " " + inc.get("operator", "") + " " + inc.get("dcName", "") + " " + (loc.get("country", "") or "")).lower().replace('"', "")
        rows.append(
            f'<tr class="itr" data-cats="{esc(" ".join(cats))}" data-score="{mag:.2f}" data-pm="{1 if pm else 0}" data-search="{esc(search)}" onclick="location.href=\'{href}\'">'
            f'<td class="c-id"><span class="itid">{esc(iid)}</span></td>'
            f'<td class="c-title"><a href="{href}" class="itt" onclick="event.stopPropagation()">{esc(inc["title"])}</a>'
            f'<div class="its">{esc(brief[:88])}{"…" if len(brief) > 88 else ""}</div></td>'
            f'<td><span class="sev-chip sev-b-{band}">{_SEV_LABEL[band]}</span></td>'
            f'<td><span class="st-chip {st_cls}">{st_txt}</span></td>'
            f'<td class="c-region"><span class="iflag">{_flag(loc.get("country",""))}</span>'
            f'<span class="ireg"><b>{esc(inc.get("dcName","")[:30])}</b><i>{esc(loc_s)}</i></span></td>'
            f'<td class="c-mono">{esc(inc.get("date",""))}</td>'
            f'<td class="c-mono">{esc(_dur(inc.get("durationMin")))}</td>'
            f'<td class="c-mono c-blast">{blast:.1f}<span class="c-u">/10</span></td>'
            f'<td>{_impact_bars(mag)}</td>'
            f'<td><div class="itags">{cat_chips(cats)}</div></td>'
            f'<td class="c-go" aria-hidden="true">→</td></tr>'
        )
    body = f"""        <a class="backlink" href="index.html">← Home</a>
        <div class="eyebrow">Root-only · Post-incident dossier</div>
        <h1>Data-Center Incidents — Case Library</h1>
        <p class="lede">A structured, source-cited library of major data-center and cloud-infrastructure incidents worldwide — ranked by magnitude, each with a full sequence of events, root-cause analysis, correction-of-errors (COE), lessons learnt and engineering improvements. Every fact is traced to a public post-incident report.</p>
        <div class="metabar"><b>{len(incidents)}</b> catalogued<span class="sep">·</span><b>{_pm_count}</b> with official RCA<span class="sep">·</span>provenance-mandatory<span class="sep">·</span>root access</div>
        <details class="faq" id="faq-methodology"><summary>About this library · how to read it</summary><div class="faq-body">
            <h4>What this is</h4>
            <p>A root-gated, source-cited engineering reference on major data-center and cloud-infrastructure incidents worldwide — each a structured post-incident dossier (sequence of events, root-cause analysis, correction-of-errors, lessons learnt, engineering improvements). It exists for internal engineering education; every material fact is traced to a public post-incident report, and where an authoritative cause was never published the dossier says so rather than invent one.</p>
            <h4>How incidents are ranked</h4>
            <p>By a transparent <b>magnitude composite</b> — a weighted sum of four sourced sub-scores (each 0–10): <b>blast radius 0.35 · users 0.25 · financial 0.20 · duration 0.20</b>. Hover any magnitude bar or a dossier's radar for the exact breakdown. Ranking never uses a hidden score.</p>
            <h4>What “official RCA” means</h4>
            <p>The <b>official-RCA</b> filter and the count above mark incidents backed by a genuine vendor post-incident review, regulator/government report, or court record — not press reporting. The provenance gate refuses to set that flag unless such a source is actually cited.</p>
            <h4>Reading the visualizations</h4>
            <ul class="tight">
            <li><b>Where these happened</b> — a real map at each incident's origin site; gold = facility failures (power/cooling/fire), green = network/logical. Co-located incidents are fanned onto a small ring; hover a marker for the brief.</li>
            <li><b>Ranked bars</b> — magnitude, coloured by severity (red = most severe).</li>
            <li><b>Risk map</b> — blast radius (x) × outage duration (y); top-right is the worst quadrant. Dots sit at their true scores; hover any dot for its values.</li>
            <li><b>Semantic map</b> — a projection of the research vector-index: incidents near each other share a failure signature.</li>
            <li><b>Per dossier</b> — a failure-cascade block diagram, a magnitude radar, and a phased SOE timeline; hover elements for detail, and hover underlined terms for definitions.</li>
            </ul>
            <h4>Access</h4>
            <p>Root-only. The library is excluded from the public sitemap and search index.</p>
        </div></details>
        <nav class="iv-tabs"><a href="#dashboard" class="on">Overview</a><a href="#incMap">Risk map</a><a href="#semantic">Semantic map</a><a href="#all-incidents">Incident list</a></nav>
        {hero_dashboard(incidents)}

        <h2 id="all-incidents">All incidents</h2>
        <div class="filterbar" id="filterbar">
            <div class="fb-group" role="group" aria-label="Filter by domain">
                <button class="fb-chip active" data-f="all">All</button>
                <button class="fb-chip" data-domain="facility" title="Power · cooling · fire · flood">Facility</button>
                <button class="fb-chip" data-domain="logical" title="Network · software · human error">Network / logical</button>
                <button class="fb-chip" data-pm="1" title="Has an official post-mortem / regulatory report">Official RCA</button>
            </div>
            <div class="fb-group" role="group" aria-label="Filter by category">
                <button class="fb-chip" data-cat="power">Power</button>
                <button class="fb-chip" data-cat="cooling">Cooling</button>
                <button class="fb-chip" data-cat="fire">Fire</button>
                <button class="fb-chip" data-cat="network">Network</button>
                <button class="fb-chip" data-cat="software">Software</button>
                <button class="fb-chip" data-cat="human">Human error</button>
                <button class="fb-chip" data-cat="flood">Flood</button>
            </div>
            <input class="fb-search" id="fbSearch" type="search" placeholder="Search operator / DC / country…" aria-label="Search incidents">
            <span class="fb-count" id="fbCount"></span>
        </div>
        <div class="table-wrap">
            <table class="inc-index itbl" id="incTable">
                <thead><tr><th>Incident ID</th><th>Title</th><th>Severity</th><th>Status</th><th>Data center / region</th><th>Start</th><th>Duration</th><th>Blast</th><th>Impact</th><th>Tags</th><th></th></tr></thead>
                <tbody>
{chr(10).join(rows)}
                </tbody>
            </table>
        </div>
        <p class="disclaimer">Ranking is a transparent composite of sourced sub-scores (blast radius 35% · users 25% · financial 20% · duration 20%). Summaries are original and substantially shorter than their sources; short attributed excerpts on each incident page are provenance only. This library is for engineering education and does not reproduce source material in full.</p>
        {FILTER_JS}
"""
    return page_shell("DC Incidents — Case Library", "Root-only ranked library of major data-center and cloud incidents with full RCA, COE, SOE and lessons learnt, each source-cited.", "dc-incidents.html", body, base="", head_extra=LEAFLET_HEAD)


def _dur(mins):
    if not mins:
        return "—"
    mins = int(mins)
    h, m = divmod(mins, 60)
    return f"{h}h {m}m" if h else f"{m}m"


# ─────────── inline-SVG visualizations (data-driven, theme-aware, no runtime lib) ───────────
import math as _math

_OP_ABBR = [
    ("amazon", "AWS"), ("aws", "AWS"), ("azure", "Azure"), ("microsoft", "Azure"),
    ("google", "Google"), ("gcp", "Google"), ("meta", "Meta"), ("facebook", "Meta"),
    ("cloudflare", "Cloudflare"), ("ovh", "OVHcloud"), ("kakao", "SK/Kakao"), ("sk c", "SK/Kakao"),
    ("delta", "Delta"), ("british airways", "BA"), ("equinix", "Equinix"), ("dyn", "Dyn"),
    ("northc", "NorthC"), ("stt", "STT/Tata"), ("tata", "STT/Tata"), ("unisuper", "UniSuper"),
    ("crowdstrike", "CrowdStrike"), ("nirs", "NIRS"), ("national info", "NIRS"), ("rogers", "Rogers"),
    ("red sea", "Red Sea"), ("aae", "Red Sea"), ("alibaba", "Alibaba"), ("optus", "Optus"),
]
_FACILITY = {"power", "cooling", "fire", "flood"}


def _sevcol(score):
    s = float(score or 0)
    return "var(--red)" if s >= 8.5 else ("var(--amber)" if s >= 7.5 else "var(--green)")


_MAG_W = [("Blast radius", "blastRadiusScore", 0.35), ("Users", "usersScore", 0.25),
          ("Financial", "financialScore", 0.20), ("Duration", "durationScore", 0.20)]


def _mag_trace(mag, score):
    parts = " + ".join(f'{lbl.split()[0].lower()} {int(round(float(mag.get(k,0))))}×{w:.2f}' for lbl, k, w in _MAG_W)
    return f'<div class="mag-trace">Magnitude <b>{score:.1f}</b> = {parts} <span style="opacity:0.7">(sub-scores 0–10 · weighted composite)</span></div>'


_IMP_TAGS = ("Safety", "Maintenance", "Design", "Process", "Operational", "Governance")


def _imp_render(imps):
    out = []
    for x in imps:
        x = (x or "").strip()
        tag = ""
        for t in _IMP_TAGS:
            if x.lower().startswith(t.lower() + ":"):
                tag = f'<span class="imp-tag">{t}</span>'; x = x[len(t) + 1:].strip(); break
        out.append(f"<li>{tag}{esc(x)}</li>")
    return "".join(out)


SHARE_BAR = (
    '<aside class="share-buttons" aria-label="Share this dossier"><span class="share-label">Share</span>'
    '<button class="share-btn" onclick="rzShare(\'li\')" aria-label="Share on LinkedIn" title="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 11 0-4.124 2.062 2.062 0 010 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/></svg></button>'
    '<button class="share-btn" onclick="rzShare(\'x\')" aria-label="Share on X" title="X"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></button>'
    '<button class="share-btn" onclick="rzShare(\'wa\')" aria-label="Share on WhatsApp" title="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg></button>'
    '<button class="share-btn" onclick="rzShare(\'copy\',this)" aria-label="Copy link" title="Copy link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
    '</aside>'
    '<script>function rzShare(k,btn){var u=encodeURIComponent(location.href),t=encodeURIComponent(document.title);'
    'if(k==="li")open("https://www.linkedin.com/sharing/share-offsite/?url="+u,"_blank","noopener");'
    'else if(k==="x")open("https://twitter.com/intent/tweet?url="+u+"&text="+t,"_blank","noopener");'
    'else if(k==="wa")open("https://wa.me/?text="+t+"%20"+u,"_blank","noopener");'
    'else if(k==="copy"){navigator.clipboard&&navigator.clipboard.writeText(location.href);if(btn){var o=btn.getAttribute("title");btn.setAttribute("title","Copied");setTimeout(function(){btn.setAttribute("title",o);},1500);}}}</script>'
)


def op_abbrev(operator):
    o = (operator or "").lower()
    for key, ab in _OP_ABBR:
        if key in o:
            return ab
    return (operator or "?").split("(")[0].split(",")[0].strip()[:12]


def _domain(cats):
    return "facility" if any(c in _FACILITY for c in (cats or [])) else "logical"


def _pts(vals, cx, cy, r):
    n = len(vals); out = []
    for i, v in enumerate(vals):
        a = -_math.pi / 2 + i * 2 * _math.pi / n
        out.append(f"{cx + _math.cos(a) * r * v:.1f},{cy + _math.sin(a) * r * v:.1f}")
    return " ".join(out)


_RADAR_DESC = {
    "usersScore": "Users affected (0–10) — breadth of the user/customer population impacted.",
    "financialScore": "Financial impact (0–10) — direct + consequential cost.",
    "durationScore": "Outage duration (0–10) — how long service was degraded/down.",
    "blastRadiusScore": "Blast radius (0–10) — how wide the fault propagated across systems/regions.",
}


def radar_svg(mag):
    axes = [("Users", "usersScore"), ("Financial", "financialScore"), ("Duration", "durationScore"), ("Blast", "blastRadiusScore")]
    # wide viewBox + centred origin so no axis label clips at the edges
    cx, cy, R = 145, 105, 64
    vals = [max(0.0, min(10.0, float(mag.get(k, 0)))) / 10 for _, k in axes]
    rings = "".join(f'<polygon class="vz-grid" points="{_pts([f, f, f, f], cx, cy, R)}"/>' for f in (0.34, 0.67, 1.0))
    spokes = labels = ""
    anchors = ["middle", "start", "middle", "end"]
    dys = [-7, 4, 15, 4]
    for i, (lbl, k) in enumerate(axes):
        a = -_math.pi / 2 + i * 2 * _math.pi / 4
        ex, ey = cx + _math.cos(a) * R, cy + _math.sin(a) * R
        spokes += f'<line class="vz-grid" x1="{cx}" y1="{cy}" x2="{ex:.1f}" y2="{ey:.1f}"/>'
        lx, ly = cx + _math.cos(a) * (R + 14), cy + _math.sin(a) * (R + 14) + dys[i]
        val = int(round(float(mag.get(k, 0))))
        labels += (f'<text class="vz-lbl vz-num" x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchors[i]}">{esc(lbl)} {val}'
                   f'<title>{esc(_RADAR_DESC.get(k, lbl))} — scored {val}/10.</title></text>')
    poly = f'<polygon class="vz-accent-fill" points="{_pts(vals, cx, cy, R)}"><title>Magnitude sub-scores (0–10)</title></polygon>'
    dots = "".join(f'<circle class="vz-accent-dot" cx="{p.split(",")[0]}" cy="{p.split(",")[1]}" r="2.4"/>' for p in _pts(vals, cx, cy, R).split(" "))
    return f'<div class="viz viz-radar"><svg viewBox="0 0 290 215" role="img" aria-label="Magnitude sub-scores radar chart"><title>Magnitude sub-scores (0–10)</title>{rings}{spokes}{poly}{dots}{labels}</svg></div>'


def _clean_op(operator):
    """A short, clean node label — no parentheticals/semicolons, <=22 chars."""
    o = (operator or "").split("(")[0].split(";")[0].split(",")[0].strip()
    return o[:22] if o else "Operator"


def _clean_svc(s):
    """A clean short downstream-node label from a (possibly verbose) servicesDown string —
    drop parenthetical example-lists, keep up to ~5 words / 34 chars; full text lives in <title>."""
    s = str(s or "").split("(")[0].strip().rstrip(":;,")
    words = s.split()
    out = ""
    for w in words:
        if len(out) + len(w) + 1 > 34:
            break
        out = (out + " " + w).strip()
    return out or s[:34]


def _wrap(text, width, maxlines=2):
    """Greedy word-wrap into <=maxlines lines of ~width chars (for SVG tspans)."""
    words = str(text or "").split()
    lines, cur = [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= width or not cur:
            cur = (cur + " " + w).strip()
        else:
            lines.append(cur); cur = w
            if len(lines) == maxlines - 1:
                break
    rest = " ".join(words[sum(len(l.split()) for l in lines):]) if lines else cur
    if len(lines) < maxlines:
        lines.append((cur if not lines else rest).strip())
    out = [l for l in lines if l][:maxlines]
    if len("".join(out)) < len(str(text or "")):  # truncated → ellipsis on last line
        out[-1] = out[-1][: width - 1].rstrip() + "…"
    return out


def cascade_svg(inc):
    cat = (inc.get("category") or ["software"])[0]
    trigger = CATEGORY_LABEL.get(cat, cat)
    op_full = inc.get("operator", "") or ""
    op = inc.get("operatorShort") or _clean_op(op_full)
    dc_full = inc.get("dcName", "") or ""
    downs = ((inc.get("severity", {}) or {}).get("servicesDown", []) or [])
    shown = downs[:4]
    more = len(downs) - len(shown)

    def box(x, y, w, h, cls, title, head, sub=None, sub_full=None):
        # head wraps to <=2 lines; sub is one small line; full text in <title> (hover)
        hlines = _wrap(head, int((w - 20) / 6.6), 2)
        ty = y + 17
        parts = [f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="2"><title>{esc(title)}</title></rect>']
        for j, ln in enumerate(hlines):
            parts.append(f'<text class="vz-box-t" x="{x+10}" y="{ty + j*13}">{esc(ln)}</text>')
        if sub:
            sy = ty + len(hlines) * 13 + 1
            parts.append(f'<text class="vz-box-s" x="{x+10}" y="{sy}"><title>{esc(sub_full or sub)}</title>{esc(str(sub)[:34])}</text>')
        return "".join(parts)

    W = 760
    rows = max(1, len(shown))
    H = max(158, 52 + rows * 44)
    midY = H / 2 - 28
    svg = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Failure cascade block diagram"><title>Failure cascade: trigger → fault → downstream impact</title>']
    svg.append('<defs><marker id="ic-ar" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path class="vz-arrhead" d="M0,0 L6,3 L0,6 Z"/></marker></defs>')
    svg.append(f'<text class="vz-tl-ph" x="8" y="12">Trigger</text><text class="vz-tl-ph" x="248" y="12">Primary fault</text><text class="vz-tl-ph" x="516" y="12">Downstream impact</text>')
    svg.append(box(8, midY, 176, 56, "vz-box-trigger", f"Trigger — {trigger} ({inc.get('date','')})", f"Trigger · {trigger}", inc.get("date", ""), inc.get("date", "")))
    svg.append(box(240, midY, 224, 56, "vz-box-fault", f"Primary fault at {op_full} — {dc_full}", op, _clean_svc(dc_full), dc_full))
    svg.append(f'<line class="vz-flow" x1="184" y1="{midY+28}" x2="238" y2="{midY+28}" marker-end="url(#ic-ar)"/>')
    for i, d in enumerate(shown):
        by = 26 + i * 44
        svg.append(box(516, by, 236, 36, "vz-box-down",
                       f"Downstream service degraded by the fault: {d}", _clean_svc(d)))
        svg.append(f'<line class="vz-flow" x1="464" y1="{midY+28}" x2="514" y2="{by+18}" marker-end="url(#ic-ar)"/>')
    if more > 0:
        svg.append(f'<text class="vz-box-s" x="516" y="{26 + rows * 44 + 6}">+{more} more downstream services</text>')
    svg.append('</svg>')
    return f'<div class="viz viz-cascade">{"".join(svg)}</div>'


def soe_timeline_svg(soe):
    if not soe:
        return ""
    n = len(soe)
    W = max(560, 40 + n * 92)
    H = 96
    x0, x1 = 30, W - 30
    step = (x1 - x0) / max(1, n - 1)
    parts = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Sequence-of-events timeline"><title>Phased sequence of events</title>']
    parts.append(f'<line class="vz-grid" x1="{x0}" y1="48" x2="{x1}" y2="48"/>')
    for i, e in enumerate(soe):
        x = x0 + i * step
        ph = (e.get("phase", "") or "")
        tip = f'{e.get("t","")} · {ph} — {e.get("event","")}'.strip(" ·—")
        parts.append(f'<circle class="vz-accent-dot" cx="{x:.0f}" cy="48" r="4.5"><title>{esc(tip)}</title></circle>')
        parts.append(f'<text class="vz-tl-ph" x="{x:.0f}" y="30" text-anchor="middle">{esc(ph[:12])}</text>')
        t = (e.get("t", "") or "")
        t = t.split("T")[0] if "T" in t else t[:16]
        parts.append(f'<text class="vz-tl-t" x="{x:.0f}" y="68" text-anchor="middle">{esc(t)}</text>')
    parts.append('</svg>')
    return f'<div class="viz viz-timeline">{"".join(parts)}</div>'


def hub_magnitude_svg(incidents):
    top = incidents[:12]
    if not top:
        return ""
    mx = max((x["_score"] for x in top), default=10) or 10
    rowH = 26; W = 640; H = len(top) * rowH + 16
    bars = []
    for i, x in enumerate(top):
        y = 8 + i * rowH
        w = (x["_score"] / mx) * 380
        yr = (x.get("date", "") or "")[:4]
        lbl = op_abbrev(x.get("operator", "") or x.get("slug", ""))
        if yr:
            lbl = f"{lbl} · {yr}"
        href = f'incident-{esc(x.get("slug",""))}.html'
        bars.append(f'<a href="{href}"><text class="vz-hb-lbl" x="8" y="{y+14}">{esc(lbl[:28])}</text>'
                    f'<rect x="230" y="{y+3}" width="{w:.0f}" height="15" rx="0" fill="{_sevcol(x["_score"])}"><title>{esc(op_abbrev(x.get("operator","")))} — magnitude {x["_score"]:.1f}/10</title></rect>'
                    f'<text class="vz-hb-val" x="{230+w+6:.0f}" y="{y+14}">{x["_score"]:.1f}</text></a>')
    return f'<div class="viz"><svg viewBox="0 0 {W} {H}" role="img" aria-label="Incidents ranked by magnitude"><title>Ranked by magnitude score</title>{"".join(bars)}</svg></div>'


def hub_category_svg(incidents):
    from collections import Counter
    c = Counter()
    for x in incidents:
        for cat in x.get("category", []):
            c[cat] += 1
    if not c:
        return ""
    items = c.most_common()
    mx = max(v for _, v in items)
    rowH = 26; W = 460; H = len(items) * rowH + 16
    bars = []
    for i, (cat, v) in enumerate(items):
        y = 8 + i * rowH
        w = (v / mx) * 260
        bars.append(f'<text class="vz-hb-lbl" x="8" y="{y+14}">{esc(CATEGORY_LABEL.get(cat, cat))}</text>')
        bars.append(f'<rect class="vz-cat-bar" x="140" y="{y+3}" width="{w:.0f}" height="15" rx="0"><title>{esc(CATEGORY_LABEL.get(cat, cat))} — {v} incident(s)</title></rect>')
        bars.append(f'<text class="vz-hb-val" x="{140+w+6:.0f}" y="{y+14}">{v}</text>')
    return f'<div class="viz"><svg viewBox="0 0 {W} {H}" role="img" aria-label="Incidents by category"><title>Incidents by failure category</title>{"".join(bars)}</svg></div>'


_FAC_COL = "#c9a559"   # facility (power/cooling/fire/flood) — gold
_LOG_COL = "#6aa588"   # network / logical (software/network/human) — sage
_DOMAIN_LEGEND = (
    '<div class="vz-legend">'
    f'<span class="vz-key"><i style="background:{_FAC_COL}"></i>Facility · power / cooling / fire</span>'
    f'<span class="vz-key"><i style="background:{_LOG_COL}"></i>Network / logical · software / network / human</span>'
    '<span class="vz-key vz-key-note">bigger dot = higher magnitude · tap a dot to open the incident</span>'
    '</div>'
)


def hub_quadrant_svg(incidents):
    if not incidents:
        return ""
    W, H = 444, 336
    L, R, T, B = 48, 74, 18, 42   # wide right margin reserves the label gutter
    plotW, plotH = W - L - R, H - T - B

    def px(v):
        return L + (v / 10) * plotW

    def py(v):
        return T + plotH - (v / 10) * plotH

    g = [f'<rect x="{L}" y="{T}" width="{plotW}" height="{plotH}" class="vz-grid" fill="none"/>']
    for t in (0, 5, 10):
        g.append(f'<line class="vz-grid" x1="{px(t):.0f}" y1="{T}" x2="{px(t):.0f}" y2="{T+plotH}" stroke-dasharray="2 3"/>')
        g.append(f'<line class="vz-grid" x1="{L}" y1="{py(t):.0f}" x2="{L+plotW}" y2="{py(t):.0f}" stroke-dasharray="2 3"/>')
        g.append(f'<text class="vz-tick" x="{px(t):.0f}" y="{T+plotH+13}" text-anchor="middle">{t}</text>')
        g.append(f'<text class="vz-tick" x="{L-7}" y="{py(t)+3:.0f}" text-anchor="end">{t}</text>')
    g.append(f'<text class="vz-lbl" x="{L+plotW/2:.0f}" y="{H-5}" text-anchor="middle">Blast radius (0–10) →</text>')
    g.append(f'<text class="vz-lbl" x="13" y="{T+plotH/2:.0f}" text-anchor="middle" transform="rotate(-90 13 {T+plotH/2:.0f})">Outage duration (0–10) →</text>')
    g.append(f'<text class="vz-quad" x="{L+plotW-5:.0f}" y="{T+12}" text-anchor="end">worst · wide + long</text>')
    g.append(f'<text class="vz-quad" x="{L+5}" y="{T+plotH-6:.0f}">contained</text>')

    # honest axes: plot at true coordinates. Only nudge EXACT ties apart by a hair
    # (deterministic, sub-0.4-unit) so overlapping dots stay separable without lying.
    seen = {}
    recs = []
    for x in sorted(incidents, key=lambda i: -i["_score"]):
        m = x.get("magnitude", {})
        bs, ds = float(m.get("blastRadiusScore", 0)), float(m.get("durationScore", 0))
        key = (round(bs), round(ds))
        k = seen.get(key, 0); seen[key] = k + 1
        ang = k * 2.399           # golden-angle spread for ties only
        off = 0 if k == 0 else 3.2 + 1.4 * k
        cx = min(L + plotW - 3, max(L + 3, px(bs) + _math.cos(ang) * off))
        cy = min(T + plotH - 3, max(T + 3, py(ds) + _math.sin(ang) * off))
        r = 3.0 + (x["_score"] / 10) * 3.4
        recs.append({
            "cx": cx, "cy": cy, "r": r,
            "col": _FAC_COL if _domain(x.get("category")) == "facility" else _LOG_COL,
            "ab": op_abbrev(x.get("operator", "")), "href": f'incident-{esc(x.get("slug",""))}.html',
            "op": x.get("operator", ""), "b": m.get("blastRadiusScore", 0), "d": m.get("durationScore", 0),
            "sc": x["_score"],
        })
    # every dot carries a hover title; only the top-6 by magnitude get a printed label,
    # placed in a de-collided column just right of the plot with a thin leader
    labelled = sorted(recs, key=lambda d: -d["sc"])[:6]
    lab_ids = {id(d) for d in labelled}
    labels_svg = []
    lx = L + plotW + 6
    ys = sorted((d["cy"] for d in labelled))
    slots, last = [], -999.0
    for yv in ys:
        yv = max(yv, last + 12); slots.append(yv); last = yv
    yslot = {}
    for d, yv in zip(sorted(labelled, key=lambda d: d["cy"]), slots):
        yslot[id(d)] = yv
    for d in labelled:
        yv = yslot[id(d)]
        labels_svg.append(f'<line class="vz-grid" x1="{d["cx"]+d["r"]:.0f}" y1="{d["cy"]:.0f}" x2="{lx-2:.0f}" y2="{yv:.0f}" opacity="0.35"/>')
        labels_svg.append(f'<text class="vz-pt" x="{lx:.0f}" y="{yv+3:.0f}">{esc(d["ab"])}</text>')
    dots = []
    for d in sorted(recs, key=lambda d: -d["r"]):
        dots.append(
            f'<a href="{d["href"]}"><circle cx="{d["cx"]:.0f}" cy="{d["cy"]:.0f}" r="{d["r"]:.1f}" fill="{d["col"]}" fill-opacity="0.9" stroke="var(--bg)" stroke-width="0.8">'
            f'<title>{esc(d["op"])} — blast {d["b"]}/10 · duration {d["d"]}/10 · magnitude {d["sc"]:.1f}</title></circle></a>'
        )
    dots.extend(labels_svg)
    return (f'<div class="viz"><svg viewBox="0 0 {W} {H}" role="img" aria-label="Blast radius vs duration risk map">'
            f'<title>Risk map: blast radius × outage duration</title>{"".join(g)}{"".join(dots)}</svg>{_DOMAIN_LEGEND}</div>')


def hub_cluster_svg():
    """Semantic-similarity map from the vector index (_cluster.json, if built)."""
    path = os.path.join(DATA_DIR, "_cluster.json")
    if not os.path.exists(path):
        return ""
    try:
        pts = json.load(open(path)).get("incidents", [])
    except Exception:
        return ""
    if not pts:
        return ""
    W, H = 384, 300
    pad = 26
    recs = []
    for p in pts:
        recs.append({
            "x": pad + p["x"] * (W - 2 * pad), "y": pad + (1 - p["y"]) * (H - 2 * pad),
            "col": _FAC_COL if _domain(p.get("category")) == "facility" else _LOG_COL,
            "r": 3.2 + (float(p.get("score", 0)) / 10) * 3.2,
            "ab": op_abbrev(p.get("operator", "")), "op": p.get("operator", ""),
            "href": f'incident-{esc(p.get("slug",""))}.html', "sc": float(p.get("score", 0)),
        })
    top_ids = {id(d) for d in sorted(recs, key=lambda d: -d["sc"])[:6]}
    dots = []
    for d in sorted(recs, key=lambda d: -d["r"]):
        label = ""
        if id(d) in top_ids:
            if d["x"] > W * 0.62:
                tx, anc = d["x"] - d["r"] - 3, ' text-anchor="end"'
            else:
                tx, anc = d["x"] + d["r"] + 3, ''
            label = f'<text class="vz-pt" x="{tx:.0f}" y="{d["y"]+3:.0f}"{anc}>{esc(d["ab"])}</text>'
        dots.append(
            f'<a href="{d["href"]}"><circle cx="{d["x"]:.0f}" cy="{d["y"]:.0f}" r="{d["r"]:.1f}" fill="{d["col"]}" fill-opacity="0.88" stroke="var(--bg)" stroke-width="0.8">'
            f'<title>{esc(d["op"])} — near-by incidents share a failure signature (magnitude {d["sc"]:.1f})</title></circle>{label}</a>'
        )
    return (f'<div class="viz"><svg viewBox="0 0 {W} {H}" role="img" aria-label="Semantic similarity map of incidents">'
            f'<title>Semantic map — incidents near each other share a failure signature</title>'
            f'<rect x="1" y="1" width="{W-2}" height="{H-2}" class="vz-grid" fill="none" rx="2"/>{"".join(dots)}</svg>{_DOMAIN_LEGEND}</div>')


# Approx. incident-origin coordinates (data-center / region where the fault began).
# Global logical failures are anchored to the operator's origin region.
INCIDENT_COORDS = {
    "aws-kinesis-thread-limit-outage-2020": [39.04, -77.49],
    "aws-s3-us-east-1-2017": [39.04, -77.49],
    "aws-us-east-1-dynamodb-dns-2025": [39.04, -77.49],
    "aws-us-east-1-network-outage-2021": [39.04, -77.49],
    "aws-us-east-1-thermal-2025": [39.04, -77.49],
    "azure-active-directory-2020": [47.64, -122.13],
    "azure-front-door-config-change-2025": [47.64, -122.13],
    "azure-south-central-us-texas-cooling-2018": [29.42, -98.49],
    "british-airways-heathrow-power-2017": [51.47, -0.45],
    "cloudflare-bot-management-feature-file-2025": [37.77, -122.42],
    "cloudflare-flexential-pdx-power-2023": [45.52, -122.99],
    "crowdstrike-falcon-global-outage-2024": [30.27, -97.74],
    "delta-atlanta-switchgear-2016": [33.64, -84.43],
    "dyn-mirai-ddos-2016": [42.99, -71.46],
    "equinix-ld8-london-ups-2020": [51.51, -0.02],
    "facebook-meta-bgp-dns-2021": [37.48, -122.15],
    "gcp-global-auth-quota-2020": [37.42, -122.08],
    "gcp-global-service-control-2025": [37.42, -122.08],
    "gcp-stt-gdc-delhi-fire-2026": [28.61, 77.21],
    "kakao-sk-cc-pangyo-fire-2022": [37.40, 127.11],
    "nirs-daejeon-battery-fire-2025": [36.35, 127.38],
    "northc-almere-fire-2026": [52.37, 5.22],
    "ovhcloud-sbg2-fire-2021": [48.58, 7.75],
    "red-sea-subsea-cables-2024": [12.58, 43.33],
    "unisuper-gcp-account-deletion-2024": [-37.81, 144.96],
    "rogers-canada-nationwide-2022": [43.65, -79.38],
    "cyrusone-cme-chicago-cooling-2025": [41.76, -88.32],
    "cloudflare-june-2022-config-19dc": [37.77, -122.42],
    "google-council-bluffs-arcflash-2022": [41.26, -95.86],
    "london-heatwave-cooling-2022": [51.51, -0.13],
    "x-twitter-oregon-fire-2025": [45.52, -122.99],
    "digital-realty-la-el-segundo-fire-2023": [33.92, -118.42],
    "digital-realty-singapore-liion-fire-2024": [1.35, 103.82],
    "azure-china-north3-regional-2024": [39.9, 116.4],
    "azure-west-us2-thermal-2026": [47.23, -119.85],
    "virginia-dc-alley-heatdome-2022": [39.04, -77.49],
}

LEAFLET_HEAD = (
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" crossorigin="">'
    '<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js" crossorigin="" defer></script>'
)


def hub_geo_map(incidents):
    """A real Leaflet world map. Co-located incidents are deterministically fanned onto a
    small ring (spiderfied) with a connector back to the true site, so nothing overlaps."""
    raw = []
    for inc in incidents:
        c = INCIDENT_COORDS.get(inc.get("slug"))
        if not c:
            continue
        loc = inc.get("location", {})
        raw.append({
            "s": inc.get("slug", ""), "o": inc.get("operator", ""), "d": inc.get("date", ""),
            "lat0": float(c[0]), "lng0": float(c[1]),
            "dom": _domain(inc.get("category")), "sc": round(float(inc.get("_score", 0)), 1),
            "loc": ", ".join(x for x in [loc.get("city"), loc.get("country")] if x),
            "cat": " · ".join(CATEGORY_LABEL.get(x, x) for x in inc.get("category", [])),
            "ab": op_abbrev(inc.get("operator", "")), "yr": (inc.get("date", "") or "")[:4],
            "b": (inc.get("brief", "") or "")[:150],
        })
    if not raw:
        return ""
    # greedy proximity clustering (~1.3° threshold)
    groups = []
    for p in sorted(raw, key=lambda x: x["s"]):
        for g in groups:
            if abs(g["clat"] - p["lat0"]) < 1.3 and abs(g["clng"] - p["lng0"]) < 1.3:
                g["members"].append(p)
                g["clat"] = sum(m["lat0"] for m in g["members"]) / len(g["members"])
                g["clng"] = sum(m["lng0"] for m in g["members"]) / len(g["members"])
                break
        else:
            groups.append({"clat": p["lat0"], "clng": p["lng0"], "members": [p]})
    pts = []
    for g in groups:
        n = len(g["members"])
        if n == 1:
            m = g["members"][0]
            m.update({"lat": round(m["lat0"], 3), "lng": round(m["lng0"], 3), "cx": None, "cy": None})
            pts.append(m)
            continue
        r = 1.4 + 0.28 * (n - 2)           # ring radius in degrees, grows with count
        for i, m in enumerate(sorted(g["members"], key=lambda x: -x["sc"])):
            a = -_math.pi / 2 + i * 2 * _math.pi / n
            m.update({
                "lat": round(g["clat"] + _math.sin(a) * r, 3),
                "lng": round(g["clng"] + _math.cos(a) * r / max(0.3, _math.cos(_math.radians(g["clat"]))), 3),
                "cx": round(g["clat"], 3), "cy": round(g["clng"], 3),
            })
            pts.append(m)
    for p in pts:
        p.pop("lat0", None); p.pop("lng0", None)
    data = json.dumps(pts, ensure_ascii=False).replace("</", "<\\/")
    js = ('<script>(function(){var PTS=' + data + ',FAC=' + json.dumps(_FAC_COL) + ',LOG=' + json.dumps(_LOG_COL) + ';'
          'function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];});}'
          'function init(){var el=document.getElementById("incMap");'
          'if(!el||typeof L==="undefined"){return setTimeout(init,150);} if(el._leaflet_id)return;'
          'var map=L.map("incMap",{center:[25,0],zoom:1,minZoom:1,maxZoom:8,worldCopyJump:true,scrollWheelZoom:false});'
          'L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:19,attribution:"&copy; CARTO &copy; OpenStreetMap"}).addTo(map);'
          'PTS.forEach(function(p){var col=p.dom==="facility"?FAC:LOG;'
          'if(p.cx!=null){L.polyline([[p.cx,p.cy],[p.lat,p.lng]],{color:col,weight:0.8,opacity:0.4,interactive:false}).addTo(map);}'
          'var mk=L.circleMarker([p.lat,p.lng],{radius:Math.max(4,Math.min(11,3+p.sc*0.8)),fillColor:col,color:"#0c1512",weight:1,opacity:0.9,fillOpacity:0.85}).addTo(map);'
          'mk.bindTooltip(esc(p.ab)+" · "+esc(p.yr)+" · "+esc(p.cat),{direction:"top",opacity:0.95,className:"inc-tip"});'
          'var html="<div style=\\"min-width:190px\\"><div style=\\"font-weight:700;font-size:0.86rem;color:#f1f5f9\\">"+esc(p.o)'
          '+"</div><div style=\\"font-size:0.7rem;color:#94a3b8;margin-bottom:5px\\">"+esc(p.d)+" &middot; "+esc(p.loc)+" &middot; "+esc(p.cat)'
          '+"</div><div style=\\"font-size:0.72rem;color:#cbd5e1;margin-bottom:7px\\">"+esc(p.b)+"&hellip;</div>"'
          '+"<a href=\\"incident-"+p.s+".html\\" style=\\"font-size:0.72rem;color:#6aa588;font-weight:600;text-decoration:none\\">Open dossier &rarr;</a></div>";'
          'mk.bindPopup(html,{maxWidth:250});'
          'mk.on("mouseover",function(){this.setStyle({fillOpacity:1,weight:2});});'
          'mk.on("mouseout",function(){this.setStyle({fillOpacity:0.85,weight:1});});});'
          'var bb=null;try{bb=L.latLngBounds(PTS.map(function(p){return [p.lat,p.lng];}));}catch(e){}'
          'function frame(){map.invalidateSize();if(bb){try{map.fitBounds(bb,{padding:[22,22],maxZoom:4});}catch(e){}}}'
          'try{new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)frame();});}).observe(el);}catch(e){}'
          'setTimeout(frame,400);setTimeout(frame,1000);}'
          'if(document.readyState!=="loading")init();else document.addEventListener("DOMContentLoaded",init);})();</script>')
    return ('<div id="incMap" class="inc-map" role="img" aria-label="World map of data-center incident locations"></div>'
            + _DOMAIN_LEGEND + js)


# ─────────── "Incident Intelligence" hero dashboard (editorial, no neon) ───────────
def _severity_band(score):
    s = float(score or 0)
    return "critical" if s >= 8.5 else ("high" if s >= 7.5 else ("medium" if s >= 6 else "low"))


_SEV_LABEL = {"critical": "Critical", "high": "High", "medium": "Medium", "low": "Low"}
_FLAG = {
    "united states": "🇺🇸", "usa": "🇺🇸", "canada": "🇨🇦", "united kingdom": "🇬🇧", "uk": "🇬🇧",
    "germany": "🇩🇪", "france": "🇫🇷", "netherlands": "🇳🇱", "singapore": "🇸🇬", "south korea": "🇰🇷",
    "china": "🇨🇳", "india": "🇮🇳", "japan": "🇯🇵", "australia": "🇦🇺", "brazil": "🇧🇷", "yemen": "🇾🇪",
}


def _flag(country):
    return _FLAG.get((country or "").strip().lower(), "🌐")


def _impact_bars(score):
    n = max(1, min(5, round(float(score or 0) / 2)))
    col = _sevcol(score)
    segs = "".join(f'<i style="background:{col if k < n else "var(--surface-2)"}"></i>' for k in range(5))
    return f'<span class="ibars" title="Impact {float(score or 0):.1f} / 10">{segs}</span>'


_SEV = [("critical", "Critical", "var(--red)"), ("high", "High", "var(--amber)"),
        ("medium", "Medium", "var(--green)"), ("low", "Low", "var(--muted)")]

_THEMES = [
    ("Power / electrical", ["power", "switchgear", " ups", "electrical", "transformer", "generator", "static switch", "de-energis"]),
    ("Cooling / thermal", ["cooling", "thermal", "chiller", "overheat", "temperature", "hvac"]),
    ("Fire / battery", ["fire", "ignition", "lithium", "battery", "combust", "thermal runaway"]),
    ("Network / BGP / DNS", ["bgp", " dns", "routing", "peering", "backbone", "subsea", "cable"]),
    ("Software / config / deploy", ["config", "deployment", "deploy", "software", "code defect", "feature file", "channel file", "content"]),
    ("Human error / procedure", ["human error", "typo", "mistyped", "uncontrolled", "operator", "misconfigur", "blank parameter", "wrong"]),
    ("Capacity / scaling / quota", ["capacity", "thread", "scaling", "quota", "exhaust", "limit", "congest", "ddos", "overwhelm"]),
]


def _dash_stats(incidents):
    from collections import Counter
    bands = Counter(_severity_band(x["_score"]) for x in incidents)
    countries = {(x.get("location", {}) or {}).get("country", "").strip() for x in incidents}
    countries.discard("")
    countries.discard("Global")
    blasts = [float((x.get("magnitude", {}) or {}).get("blastRadiusScore", 0)) for x in incidents]
    durs = [int(x.get("durationMin") or 0) for x in incidents if x.get("durationMin")]
    pm = sum(1 for x in incidents if (x.get("sourcing", {}) or {}).get("officialPostmortem") or x.get("officialPostmortem"))
    years = sorted({(x.get("date", "") or "")[:4] for x in incidents if x.get("date")})
    return {
        "total": len(incidents), "bands": bands,
        "critical": bands.get("critical", 0), "high": bands.get("high", 0),
        "countries": len(countries), "official": pm,
        "avg_blast": (sum(blasts) / len(blasts)) if blasts else 0,
        "avg_dur": (sum(durs) / len(durs)) if durs else 0,
        "span": f"{years[0]}–{years[-1]}" if years else "—",
    }


def iid_kpis(stats):
    def card(label, to, unit, sub, fmt="int"):
        return (f'<div class="iid-kpi"><div class="iid-kpi-l">{esc(label)}</div>'
                f'<div class="iid-kpi-v"><span class="iid-num" data-to="{to}" data-fmt="{fmt}">0</span>'
                f'<span class="iid-kpi-u">{esc(unit)}</span></div>'
                f'<div class="iid-kpi-s">{esc(sub)}</div></div>')
    h, m = divmod(int(stats["avg_dur"]), 60)
    dur = f"{h}h {m}m" if h else f"{m}m"
    return ('<div class="iid-kpis">'
            + card("Incidents catalogued", stats["total"], "", f"deep dossiers · span {stats['span']}")
            + card("Critical (magnitude ≥ 8.5)", stats["critical"], "", f"{stats['high']} more rated High")
            + card("Countries affected", stats["countries"], "", "distinct national jurisdictions")
            + card("Avg blast radius", round(stats["avg_blast"], 1), "/ 10", "weighted spread of impact", "dec")
            + f'<div class="iid-kpi"><div class="iid-kpi-l">Avg outage duration</div>'
              f'<div class="iid-kpi-v"><span class="iid-durval">{esc(dur)}</span></div>'
              f'<div class="iid-kpi-s">core-impact window (mean)</div></div>'
            + '</div>')


def iid_donut(stats):
    total = max(1, stats["total"])
    R, cx, cy, W = 52, 70, 70, 16
    C = 2 * _math.pi * R
    segs, legend, off = [], [], 0.0
    for key, label, col in _SEV:
        n = stats["bands"].get(key, 0)
        frac = n / total
        arc = frac * C
        segs.append(f'<circle class="iid-arc" cx="{cx}" cy="{cy}" r="{R}" fill="none" stroke="{col}" stroke-width="{W}" '
                    f'stroke-dasharray="0 {C:.1f}" data-arc="{arc:.1f} {C-arc:.1f}" stroke-dashoffset="{-off:.1f}" '
                    f'transform="rotate(-90 {cx} {cy})"><title>{esc(label)}: {n} ({frac*100:.0f}%)</title></circle>')
        off += arc
        legend.append(f'<li><span class="iid-dot" style="background:{col}"></span>{esc(label)}'
                      f'<b class="iid-num" data-to="{n}">0</b><span class="iid-pct">{frac*100:.0f}%</span></li>')
    return ('<div class="iid-donut-wrap"><svg class="iid-donut" viewBox="0 0 140 140" role="img" aria-label="Severity breakdown">'
            f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="none" stroke="var(--line)" stroke-width="{W}"/>'
            + "".join(segs)
            + f'<text x="{cx}" y="{cy-3}" text-anchor="middle" class="iid-donut-c iid-num" data-to="{stats["total"]}">0</text>'
            + f'<text x="{cx}" y="{cy+13}" text-anchor="middle" class="iid-donut-t">total</text></svg>'
            + f'<ul class="iid-legend">{"".join(legend)}</ul></div>')


def iid_catbars(incidents):
    from collections import Counter
    c = Counter()
    for x in incidents:
        for cat in x.get("category", []):
            c[cat] += 1
    items = c.most_common()
    mx = max((v for _, v in items), default=1)
    tot = sum(v for _, v in items) or 1
    rows = "".join(
        f'<li data-cat="{esc(cat)}"><span class="iid-cbl">{esc(CATEGORY_LABEL.get(cat, cat))}</span>'
        f'<span class="iid-cbar"><i style="--w:{v/mx*100:.0f}%"></i></span>'
        f'<b class="iid-num" data-to="{v}">0</b></li>'
        for cat, v in items
    )
    return f'<ul class="iid-catbars" role="list">{rows}</ul>'


def iid_durbars(incidents):
    bins = [("< 15m", 0, 15), ("15–60m", 15, 60), ("1–6h", 60, 360), ("6–24h", 360, 1440),
            ("1–3d", 1440, 4320), ("> 3d", 4320, 10**9)]
    counts = [0] * len(bins)
    tot = 0
    for x in incidents:
        d = int(x.get("durationMin") or 0)
        if not d:
            continue
        tot += 1
        for i, (_, lo, hi) in enumerate(bins):
            if lo <= d < hi:
                counts[i] += 1
                break
    mx = max(counts) or 1
    rows = "".join(
        f'<li><span class="iid-dbl">{esc(lbl)}</span><span class="iid-dbar"><i style="--w:{counts[i]/mx*100:.0f}%"></i></span>'
        f'<b>{(counts[i]/tot*100 if tot else 0):.0f}%</b></li>'
        for i, (lbl, _, _) in enumerate(bins)
    )
    return f'<ul class="iid-durbars" role="list">{rows}</ul>'


def iid_signatures(incidents):
    rows = []
    for name, kws in _THEMES:
        hits = []
        for x in incidents:
            blob = (x.get("title", "") + " " + x.get("rootCause", "") + " " + x.get("technicalDeepDive", "")
                    + " " + " ".join(x.get("category", []))).lower()
            if any(k in blob for k in kws):
                hits.append(x)
        if hits:
            avg = sum(h["_score"] for h in hits) / len(hits)
            rows.append((len(hits), name, avg))
    rows.sort(reverse=True)
    tot = max(1, len(incidents))
    body = "".join(
        f'<li><span class="iid-sig-n">{esc(name)}</span>'
        f'<span class="iid-sig-bar"><i style="--w:{n/tot*100:.0f}%"></i></span>'
        f'<b class="iid-num" data-to="{n}">0</b><span class="iid-sig-m">mag {avg:.1f}</span></li>'
        for n, name, avg in rows[:7]
    )
    return f'<ul class="iid-sigs" role="list">{body}</ul>'


def iid_recent(incidents):
    recent = sorted(incidents, key=lambda x: x.get("date", ""), reverse=True)[:5]
    rows = ""
    for x in recent:
        band = _severity_band(x["_score"])
        loc = (x.get("location", {}) or {})
        where = ", ".join(v for v in [loc.get("city"), loc.get("country")] if v) or "Global"
        rows += (f'<a class="iid-rec" href="incident-{esc(x["slug"])}.html">'
                 f'<span class="iid-rec-sev sev-{band}"></span>'
                 f'<span class="iid-rec-b"><span class="iid-rec-t">{esc(x.get("title","")[:52])}</span>'
                 f'<span class="iid-rec-m">{esc(x.get("date",""))} · {esc(where)}</span></span>'
                 f'<span class="iid-rec-tag sev-{band}">{band.upper()}</span></a>')
    return f'<div class="iid-recent">{rows}</div>'


def iid_semantic_graph():
    path = os.path.join(DATA_DIR, "_cluster.json")
    if not os.path.exists(path):
        return ""
    try:
        pts = json.load(open(path)).get("incidents", [])
    except Exception:
        return ""
    if len(pts) < 3:
        return ""
    W, H, pad = 460, 300, 24
    nodes = []
    for p in pts:
        nodes.append({
            "x": pad + p["x"] * (W - 2 * pad), "y": pad + (1 - p["y"]) * (H - 2 * pad),
            "col": _FAC_COL if _domain(p.get("category")) == "facility" else _LOG_COL,
            "r": 3.5 + (float(p.get("score", 0)) / 10) * 3.5, "ab": op_abbrev(p.get("operator", "")),
            "op": p.get("operator", ""), "slug": p.get("slug", ""),
        })
    # nearest-2 edges
    edges = []
    for i, a in enumerate(nodes):
        d = sorted(((( a["x"]-b["x"])**2+(a["y"]-b["y"])**2, j) for j, b in enumerate(nodes) if j != i))
        for _, j in d[:2]:
            key = tuple(sorted((i, j)))
            if key not in edges:
                edges.append(key)
    eg = "".join(f'<line class="iid-edge" data-a="{i}" data-b="{j}" x1="{nodes[i]["x"]:.0f}" y1="{nodes[i]["y"]:.0f}" '
                 f'x2="{nodes[j]["x"]:.0f}" y2="{nodes[j]["y"]:.0f}"/>' for i, j in edges)
    nd = "".join(
        f'<a class="iid-node" href="incident-{esc(n["slug"])}.html" data-i="{i}">'
        f'<circle cx="{n["x"]:.0f}" cy="{n["y"]:.0f}" r="{n["r"]:.1f}" fill="{n["col"]}" stroke="var(--bg)" stroke-width="0.8">'
        f'<title>{esc(n["op"])}</title></circle></a>'
        for i, n in enumerate(nodes)
    )
    return (f'<svg class="iid-graph" viewBox="0 0 {W} {H}" role="img" aria-label="Semantic incident-relationship graph">'
            f'<g class="iid-edges">{eg}</g><g class="iid-nodes">{nd}</g></svg>')


def hero_dashboard(incidents):
    stats = _dash_stats(incidents)
    legend = ('<div class="iid-maplegend"><span><i style="background:' + _FAC_COL + '"></i>Facility</span>'
              '<span><i style="background:' + _LOG_COL + '"></i>Network / logical</span>'
              '<span class="iid-mln">bubble size = magnitude · tap for the dossier</span></div>')
    footer = (f'<div class="iid-foot"><span><b>Source</b> public post-incident reports</span>'
              f'<span><b>Coverage</b> {esc(stats["span"])}</span>'
              f'<span><b>Catalogued</b> {stats["total"]} incidents</span>'
              f'<span><b>Official RCA</b> {stats["official"]} of {stats["total"]}</span>'
              f'<a href="#faq-methodology" class="iid-foot-link">Methodology →</a></div>')
    return (
        '<section class="iid" id="dashboard" aria-label="Incident intelligence dashboard">'
        '<div class="iid-head"><div><h2 class="iid-title">Incident Intelligence</h2>'
        '<p class="iid-sub">Global data-center incident landscape · risk map &amp; semantic analysis</p></div>'
        '<span class="iid-range">All-time · ' + esc(stats["span"]) + '</span></div>'
        + iid_kpis(stats)
        + '<div class="iid-grid">'
        + '<div class="iid-col-l">'
        + '<div class="iid-panel"><div class="iid-ph">Severity overview</div>' + iid_donut(stats) + '</div>'
        + '<div class="iid-panel"><div class="iid-ph">Top categories</div>' + iid_catbars(incidents) + '</div>'
        + '<div class="iid-panel"><div class="iid-ph">Most recent incidents</div>' + iid_recent(incidents) + '</div>'
        + '</div>'
        + '<div class="iid-col-c">'
        + '<div class="iid-panel iid-panel-map"><div class="iid-ph">Risk map · blast radius × severity</div>'
        + hub_geo_map(incidents) + '</div>'
        + '<div class="iid-panel" id="semantic"><div class="iid-ph">Semantic map · incident relationships</div>'
        + '<p class="iid-note">Incidents linked to their nearest failure-signature neighbours (from the research vector index). Hover a node to trace its cluster.</p>'
        + iid_semantic_graph() + '</div>'
        + '</div>'
        + '<div class="iid-col-r">'
        + '<div class="iid-panel"><div class="iid-ph">Failure signatures</div>' + iid_signatures(incidents) + '</div>'
        + '<div class="iid-panel"><div class="iid-ph">Duration distribution</div>' + iid_durbars(incidents) + '</div>'
        + '</div>'
        + '</div>'
        + footer
        + IID_SCRIPT
        + '</section>'
    )


IID_SCRIPT = ('<script>(function(){'
              'var rm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;'
              'function num(el){var to=parseFloat(el.getAttribute("data-to"))||0,dec=el.getAttribute("data-fmt")==="dec";'
              'if(rm){el.textContent=dec?to.toFixed(1):to;return;}var t0=null,dur=900;'
              'function step(ts){if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/dur),v=to*(1-Math.pow(1-k,3));'
              'el.textContent=dec?v.toFixed(1):Math.round(v);if(k<1)requestAnimationFrame(step);}requestAnimationFrame(step);}'
              'function reveal(root){root.querySelectorAll(".iid-num").forEach(num);'
              'root.querySelectorAll(".iid-arc").forEach(function(a){a.style.strokeDasharray=rm?a.getAttribute("data-arc"):"0 9999";'
              'if(!rm)setTimeout(function(){a.style.strokeDasharray=a.getAttribute("data-arc");},60);});'
              'root.querySelectorAll("[style*=--w]").forEach(function(b){var i=b.querySelector?b.querySelector("i"):null;});'
              'root.classList.add("iid-in");}'
              'var sec=document.querySelector(".iid");if(!sec)return;'
              'if("IntersectionObserver" in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){'
              'if(e.isIntersecting){reveal(sec);io.disconnect();}});},{threshold:0.12});io.observe(sec);}else{reveal(sec);}'
              'var g=sec.querySelector(".iid-graph");if(g){var nodes=[].slice.call(g.querySelectorAll(".iid-node")),'
              'edges=[].slice.call(g.querySelectorAll(".iid-edge"));'
              'nodes.forEach(function(n){n.addEventListener("mouseenter",function(){var i=n.getAttribute("data-i");'
              'g.classList.add("iid-focus");var keep={};keep[i]=1;'
              'edges.forEach(function( e){if(e.getAttribute("data-a")===i||e.getAttribute("data-b")===i){e.classList.add("on");'
              'keep[e.getAttribute("data-a")]=1;keep[e.getAttribute("data-b")]=1;}});'
              'nodes.forEach(function(m){m.classList.toggle("dim",!keep[m.getAttribute("data-i")]);});});'
              'n.addEventListener("mouseleave",function(){g.classList.remove("iid-focus");'
              'edges.forEach(function(e){e.classList.remove("on");});nodes.forEach(function(m){m.classList.remove("dim");});});});}'
              '})();</script>')


def render_incident(inc, rank):
    loc = inc.get("location", {})
    loc_s = ", ".join(x for x in [loc.get("city"), loc.get("country"), loc.get("az")] if x)
    sev = inc.get("severity", {})

    def soe_li(e):
        ph = f'<span class="phase-chip">{esc(e["phase"])}</span> ' if e.get("phase") else ""
        return f'<li><time>{esc(e.get("t",""))}</time><span class="ev">{ph}{esc(e.get("event",""))}</span></li>'
    soe = "".join(soe_li(e) for e in inc.get("sequenceOfEvents", []))

    metrics_rows = "".join(
        f'<tr><td class="mlabel">{esc(m.get("label",""))}</td><td class="mval">{esc(m.get("value",""))}</td></tr>'
        for m in inc.get("metrics", [])
    )
    metrics_html = (
        f'<h2>Impact data &amp; metrics</h2><div class="table-wrap"><table class="metrics"><tbody>{metrics_rows}</tbody></table></div>'
        if metrics_rows else ""
    )

    _used = set()
    cascade_html = cascade_svg(inc)
    radar_html = radar_svg(inc.get("magnitude", {}))
    timeline_html = soe_timeline_svg(inc.get("sequenceOfEvents", []))
    mag_note = esc((inc.get("magnitude", {}) or {}).get("note", ""))

    ca = inc.get("comprehensiveAnalysis", [])
    analysis_html = ""
    if ca:
        blocks = "".join(
            f'<div class="ca-block"><h3>{esc(s.get("heading",""))}</h3><p>{linkify(s.get("body",""), _used)}</p></div>'
            for s in ca
        )
        analysis_html = f'<h2>Comprehensive analysis</h2>{blocks}'

    cf = "".join(f"<li>{esc(x)}</li>" for x in inc.get("contributingFactors", []))
    coe = "".join(f'<li>{esc(c.get("action",""))} <span class="coe-meta">{esc(c.get("owner",""))} · {esc(c.get("status",""))}</span></li>' for c in inc.get("coe", []))
    lessons = "".join(f"<li>{esc(x)}</li>" for x in inc.get("lessonsLearnt", []))
    imps = _imp_render(inc.get("improvements", []))
    down = "".join(f"<li>{esc(x)}</li>" for x in sev.get("servicesDown", []))
    refs = "".join(
        f'<li><span class="chip {REF_TONE.get(r.get("type"),"muted")}">{esc(r.get("type",""))}</span> '
        f'<span class="rtitle">{esc(r.get("title",""))}</span>'
        + (f'<span class="rquote">“{esc(r.get("quote",""))}”</span>' if r.get("quote") else "")
        + f'<a href="{esc(r.get("url",""))}" target="_blank" rel="noopener nofollow">{esc(r.get("url",""))}</a></li>'
        for r in inc.get("references", [])
    )
    body = f"""        <div class="reading-col">
        <a class="backlink" href="dc-incidents.html">← All incidents</a>
        <div class="eyebrow">Incident dossier · Rank #{rank}</div>
        <h1>{esc(inc['title'])}</h1>
        <div class="chips">
            <span class="chip">{esc(inc.get('operator',''))}</span>
            <span class="chip cyan">{esc(inc.get('date',''))}</span>
            <span class="chip amber">{esc(_dur(inc.get('durationMin')))} core impact</span>
            {cat_chips(inc.get('category',[]))}
        </div>
        <p class="lede">{linkify(inc.get('brief',''), _used)}</p>

        <h2>Failure cascade</h2>
        {cascade_html}
        <p class="disclaimer">Trigger → primary fault → downstream blast radius, derived from the sourced root cause and affected-services record.</p>

        <h2>Facility &amp; location</h2>
        <dl class="kv">
            <dt>Operator</dt><dd>{esc(inc.get('operator',''))}</dd>
            <dt>Data center</dt><dd>{esc(inc.get('dcName',''))}</dd>
            <dt>Location</dt><dd>{esc(loc_s)}</dd>
            <dt>Date</dt><dd>{esc(inc.get('date',''))}</dd>
        </dl>

        <h2>Impact &amp; scale</h2>
        <dl class="kv">
            <dt>Users affected</dt><dd>{esc(sev.get('usersAffected','—'))}</dd>
            <dt>Financial</dt><dd>{esc(sev.get('impactUsd','—'))}</dd>
            <dt>Scope</dt><dd>{esc(sev.get('tier','—'))}</dd>
        </dl>
        <div class="card"><strong>Services / systems down</strong><ul class="tight">{down}</ul></div>
        {metrics_html}

        <h2>Magnitude profile</h2>
        {radar_html}
        {_mag_trace(inc.get('magnitude',{}) or {}, inc['_score'])}
        <p class="disclaimer">{mag_note}</p>

        <h2>Sequence of events (SOE)</h2>
        {timeline_html}
        <ul class="soe">{soe}</ul>

        <h2>Root cause</h2>
        <div class="card">{linkify(inc.get('rootCause',''), _used)}</div>

        <h2>Contributing factors</h2>
        <ul class="tight">{cf}</ul>

        <h2>Correction of errors (COE)</h2>
        <ul class="tight">{coe}</ul>

        <h2>Lessons learnt</h2>
        <ul class="tight">{lessons}</ul>

        <h2>Improvements &amp; remediation</h2>
        <ul class="tight">{imps}</ul>

        {analysis_html}

        <h2>Technical deep-dive</h2>
        <div class="card">{linkify(inc.get('technicalDeepDive',''), _used)}</div>

        <h2>References &amp; provenance</h2>
        <ul class="refs">{refs}</ul>
        <p class="disclaimer">Sourced from public post-incident reports. Quotes are short attributed excerpts for provenance only; the analysis above is original and substantially shorter than its sources. Last verified {esc(inc.get('sourcing',{}).get('lastVerified','—'))}.</p>
        {SHARE_BAR}
        </div>
"""
    return page_shell(inc["title"], inc.get("brief", "")[:180], f"incident-{inc['slug']}.html", body, base="")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write files (else dry-run)")
    args = ap.parse_args()

    files = sorted(f for f in glob.glob(os.path.join(DATA_DIR, "*.json")) if not os.path.basename(f).startswith("_"))
    incidents = []
    for f in files:
        with open(f, encoding="utf-8") as fh:
            inc = json.load(fh)
        inc["_score"] = magnitude_score(inc)
        incidents.append(inc)
    incidents.sort(key=lambda x: x["_score"], reverse=True)

    outputs = {"dc-incidents.html": render_hub(incidents)}
    for i, inc in enumerate(incidents, 1):
        outputs[f"incident-{inc['slug']}.html"] = render_incident(inc, i)

    if args.apply:
        for name, content in outputs.items():
            with open(os.path.join(ROOT, name), "w", encoding="utf-8") as fh:
                fh.write(content)
        print(f"[build-incidents] wrote {len(outputs)} pages from {len(incidents)} incident(s)")
        # auto-update the count marker on the Articles landing page (root-gated feature card)
        import re as _re
        n = len(incidents)
        pm = sum(1 for x in incidents if (x.get("sourcing", {}) or {}).get("officialPostmortem") or x.get("officialPostmortem"))
        txt = f"{n} major incidents catalogued \u00b7 {pm} with official post-mortems"
        ap = os.path.join(ROOT, "articles.html")
        try:
            a = open(ap, encoding="utf-8").read()
            a2 = _re.sub(r"<!--INC_COUNT-->.*?<!--/INC_COUNT-->", f"<!--INC_COUNT-->{txt}<!--/INC_COUNT-->", a, flags=_re.S)
            if a2 != a:
                open(ap, "w", encoding="utf-8").write(a2)
                print(f"[build-incidents] articles.html count updated: {txt}")
        except FileNotFoundError:
            pass

    else:
        print(f"[build-incidents] DRY RUN — {len(incidents)} incident(s) → {len(outputs)} pages")
        for i, inc in enumerate(incidents, 1):
            print(f"  #{i}  score {inc['_score']:.2f}  {inc['slug']}")


if __name__ == "__main__":
    main()
