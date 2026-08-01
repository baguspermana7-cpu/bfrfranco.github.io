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
        search = (inc.get("title", "") + " " + inc.get("operator", "") + " " + inc.get("dcName", "") + " " + (loc.get("country", "") or "")).lower().replace('"', "")
        rows.append(f"""            <tr data-cats="{esc(' '.join(cats))}" data-score="{mag:.2f}" data-pm="{1 if (inc.get('sourcing',{}) or {}).get('officialPostmortem') or inc.get('officialPostmortem') else 0}" data-search="{esc(search)}">
                <td><span class="rank-badge">#{i}</span></td>
                <td><a href="incident-{esc(inc['slug'])}.html">{esc(inc['title'])}</a>
                    <div style="font-size:0.78rem;color:var(--muted)">{esc(inc.get('operator',''))}</div></td>
                <td>{esc(inc.get('date',''))}</td>
                <td>{esc(inc.get('dcName',''))}<div style="font-size:0.76rem;color:var(--muted)">{esc(loc_s)}</div></td>
                <td><div class="chips">{cat_chips(inc.get('category',[]))}</div></td>
                <td>{esc(_dur(inc.get('durationMin')))}<div class="mag-bar" title="Magnitude {mag:.1f}/10"><span style="width:{min(100,mag*10):.0f}%;background:{_sevcol(mag)}"></span></div></td>
                <td style="max-width:320px">{esc(inc.get('brief',''))[:220]}{'…' if len(inc.get('brief',''))>220 else ''}</td>
            </tr>""")
    body = f"""        <a class="backlink" href="index.html">← Home</a>
        <div class="eyebrow">Root-only · Post-incident dossier</div>
        <h1>Data-Center Incidents — Case Library</h1>
        <p class="lede">A structured, source-cited library of major data-center and cloud-infrastructure incidents worldwide — ranked by magnitude, each with a full sequence of events, root-cause analysis, correction-of-errors (COE), lessons learnt and engineering improvements. Every fact is traced to a public post-incident report.</p>
        <div class="metabar"><b>{len(incidents)}</b> catalogued<span class="sep">·</span><b>{_pm_count}</b> with official RCA<span class="sep">·</span>provenance-mandatory<span class="sep">·</span>root access</div>
        <h2>Where these happened</h2>
        <p class="lede" style="margin-bottom:0.4rem">Every incident plotted at the data center or region where the fault began. Facility failures (power, cooling, fire) in gold; network / logical failures in green. Tap a marker for the brief and a link to the full dossier.</p>
        {hub_geo_map(incidents)}
        <h2>Portfolio analytics</h2>
        {hub_magnitude_svg(incidents)}
        <div class="viz-grid3">
            <div><div class="eyebrow" style="margin-bottom:0.3rem">By category</div>{hub_category_svg(incidents)}</div>
            <div><div class="eyebrow" style="margin-bottom:0.3rem">Risk map · blast radius × duration</div>{hub_quadrant_svg(incidents)}</div>
        </div>
        {('<div class="eyebrow" style="margin:0.6rem 0 0.3rem">Semantic map · incidents near each other share a failure signature</div>' + _CLUSTER_SVG) if _CLUSTER_SVG else ''}

        <h2>All incidents</h2>
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
            <table class="inc-index" id="incTable">
                <thead><tr><th>Rank</th><th>Incident</th><th>Date</th><th>DC / Location</th><th>Category</th><th>Duration · Magnitude</th><th>Brief</th></tr></thead>
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
    svg.append(box(240, midY, 224, 56, "vz-box-fault", f"Primary fault at {op_full} — {dc_full}", op, dc_full, dc_full))
    svg.append(f'<line class="vz-flow" x1="184" y1="{midY+28}" x2="238" y2="{midY+28}" marker-end="url(#ic-ar)"/>')
    for i, d in enumerate(shown):
        by = 26 + i * 44
        svg.append(box(516, by, 236, 36, "vz-box-down",
                       f"Downstream service degraded by the fault: {d}", d))
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
        parts.append(f'<circle class="vz-accent-dot" cx="{x:.0f}" cy="48" r="4.5"/>')
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
          'var map=L.map("incMap",{center:[30,15],zoom:2,minZoom:2,maxZoom:8,worldCopyJump:true,scrollWheelZoom:false});'
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
          'try{new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)map.invalidateSize();});}).observe(el);}catch(e){}'
          'setTimeout(function(){map.invalidateSize();},350);}'
          'if(document.readyState!=="loading")init();else document.addEventListener("DOMContentLoaded",init);})();</script>')
    return ('<div id="incMap" class="inc-map" role="img" aria-label="World map of data-center incident locations"></div>'
            + _DOMAIN_LEGEND + js)


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
    coe = "".join(f'<li>{esc(c.get("action",""))} <span class="chip muted">{esc(c.get("owner",""))} · {esc(c.get("status",""))}</span></li>' for c in inc.get("coe", []))
    lessons = "".join(f"<li>{esc(x)}</li>" for x in inc.get("lessonsLearnt", []))
    imps = "".join(f"<li>{esc(x)}</li>" for x in inc.get("improvements", []))
    down = "".join(f"<li>{esc(x)}</li>" for x in sev.get("servicesDown", []))
    refs = "".join(
        f'<li><span class="chip {REF_TONE.get(r.get("type"),"muted")}">{esc(r.get("type",""))}</span> '
        f'<span class="rtitle">{esc(r.get("title",""))}</span>'
        + (f'<span class="rquote">“{esc(r.get("quote",""))}”</span>' if r.get("quote") else "")
        + f'<a href="{esc(r.get("url",""))}" target="_blank" rel="noopener nofollow">{esc(r.get("url",""))}</a></li>'
        for r in inc.get("references", [])
    )
    body = f"""        <a class="backlink" href="dc-incidents.html">← All incidents</a>
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
