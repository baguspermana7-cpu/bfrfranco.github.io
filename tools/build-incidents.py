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
VER_TAG = "2026-07-31-inc2"

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
        --cyan:#7fd1a8; --amber:#d8b25c; --green:#7fd1a8; --red:#e0917f; --gold:#d8b25c;
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
    .theme-btn { background:none; border:1px solid var(--line); color:var(--text); border-radius:8px; padding:0.35rem 0.5rem; cursor:pointer; font-size:0.8rem; }
    .lock-tag { font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.06em; text-transform:uppercase; color:var(--red); border:1px solid var(--red); border-radius:999px; padding:0.12rem 0.5rem; }
    h1 { font-size:2.4rem; color:var(--text-strong); margin:0.35rem 0 0.5rem; line-height:1.12; }
    h2 { font-size:1.4rem; color:var(--text-strong); margin:2rem 0 0.7rem; }
    .eyebrow { font-family:'JetBrains Mono',monospace; font-size:0.72rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--muted); }
    .lede { color:var(--text-body); font-size:0.98rem; max-width:70ch; }
    .chips { display:flex; flex-wrap:wrap; gap:0.4rem; margin:0.7rem 0; }
    .chip { font-family:'JetBrains Mono',monospace; font-size:0.7rem; padding:0.2rem 0.55rem; border-radius:999px; border:1px solid var(--line); color:var(--text-body); background:var(--surface-2); white-space:nowrap; }
    .chip.cyan { color:var(--cyan); border-color:var(--cyan); }
    .chip.amber { color:var(--amber); border-color:var(--amber); }
    .chip.green { color:var(--green); border-color:var(--green); }
    .chip.red { color:var(--red); border-color:var(--red); }
    .chip.muted { color:var(--muted); }
    .card { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:1rem 1.1rem; margin-top:0.9rem; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:12px; margin-top:0.9rem; }
    table.inc-index { width:100%; border-collapse:collapse; font-size:0.86rem; min-width:760px; }
    table.inc-index th { text-align:left; font-family:'JetBrains Mono',monospace; font-size:0.68rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); padding:0.6rem 0.7rem; border-bottom:1px solid var(--line); background:var(--surface-2); }
    table.inc-index td { padding:0.6rem 0.7rem; border-bottom:1px solid var(--line); color:var(--text-body); vertical-align:top; }
    table.inc-index tr:hover td { background:var(--surface-2); }
    table.inc-index a { font-weight:700; color:var(--text-strong); text-decoration:none; }
    table.inc-index a:hover { color:var(--cyan); text-decoration:underline; }
    .rank-badge { font-family:'JetBrains Mono',monospace; font-weight:700; color:var(--amber); }
    .mag-bar { height:4px; border-radius:3px; background:var(--line); margin-top:0.35rem; overflow:hidden; }
    .mag-bar > span { display:block; height:4px; background:var(--amber); }
    ul.tight { margin:0.4rem 0 0; padding-left:1.15rem; }
    ul.tight li { color:var(--text-body); margin:0.3rem 0; font-size:0.92rem; }
    .soe { list-style:none; margin:0.6rem 0 0; padding:0; }
    .soe li { display:grid; grid-template-columns:170px 1fr; gap:0.7rem; padding:0.5rem 0; border-bottom:1px dashed var(--line); }
    .soe time { font-family:'JetBrains Mono',monospace; font-size:0.76rem; color:var(--cyan); }
    .soe .ev { color:var(--text-body); font-size:0.9rem; }
    .phase-chip { font-family:'JetBrains Mono',monospace; font-size:0.62rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--amber); border:1px solid var(--amber); border-radius:999px; padding:0.05rem 0.4rem; margin-right:0.4rem; white-space:nowrap; }
    table.metrics { width:100%; border-collapse:collapse; font-size:0.88rem; }
    table.metrics td { padding:0.5rem 0.7rem; border-bottom:1px solid var(--line); vertical-align:top; }
    table.metrics .mlabel { color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:0.76rem; width:38%; white-space:nowrap; }
    table.metrics .mval { color:var(--text-body); }
    .ca-block { background:var(--surface); border:1px solid var(--line); border-left:2px solid var(--cyan); border-radius:0 10px 10px 0; padding:0.7rem 1rem; margin-top:0.7rem; }
    .ca-block h3 { margin:0 0 0.3rem; font-size:0.92rem; color:var(--text-strong); }
    .ca-block p { margin:0; color:var(--text-body); font-size:0.9rem; }
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
    .skip-link { position:absolute; top:-50px; left:0; background:#0e7490; color:#fff; padding:10px 20px; text-decoration:none; font-weight:600; z-index:10000; border-radius:0 0 8px 0; transition:top 0.2s; }
    .skip-link:focus { top:0; }
    .root-gate { position:fixed; inset:0; z-index:99999; display:none; align-items:center; justify-content:center; background:rgba(2,6,23,0.74); padding:1rem; backdrop-filter:blur(6px); }
    body.locked .root-gate { display:flex; }
    body.locked .wrap { filter:blur(4px); pointer-events:none; user-select:none; }
    .root-card { max-width:430px; width:100%; background:var(--surface); border:1px solid var(--cyan); border-radius:14px; padding:1.3rem 1.15rem; text-align:center; box-shadow:0 18px 36px var(--shadow-deep); }
    .root-card h2 { margin:0 0 0.4rem; font-size:1.1rem; color:var(--text-strong); }
    .root-card p { font-size:0.86rem; color:var(--text-body); }
    .root-actions { margin-top:0.9rem; display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; }
    .root-actions button, .root-actions a { border-radius:9px; padding:0.5rem 0.85rem; font-size:0.8rem; font-weight:700; border:1px solid var(--line); text-decoration:none; cursor:pointer; color:var(--text); font-family:inherit; }
    .root-actions button { background:var(--cyan); color:#04121a; border:none; }
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
    (function(){{var n=0;function sc(){{if(window.RZExplain&&window.RZExplain.scanText){{var m=document.getElementById('main-content');if(m)window.RZExplain.scanText(m,120);}}else if(n++<25){{setTimeout(sc,200);}}}}setTimeout(sc,350);}})();
    </script>
"""


def page_shell(title, desc, canonical_path, body_html, base=""):
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
            <span class="lock-tag" title="Root-only module">🔒 Root</span>
            <button class="theme-btn" id="themeToggle" type="button" aria-label="Toggle theme">◐</button>
        </div>
    </div></nav>
    <main class="wrap" id="main-content" data-explain-scan>
{body_html}
    </main>
    <footer><div class="footer-grid"></div><span class="ver" id="versionStamp"></span></footer>
    <div class="root-gate">
        <div class="root-card">
            <h2>🔒 Root access required</h2>
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


def render_hub(incidents):
    rows = []
    for i, inc in enumerate(incidents, 1):
        loc = inc.get("location", {})
        loc_s = ", ".join(x for x in [loc.get("city"), loc.get("country")] if x)
        mag = inc["_score"]
        rows.append(f"""            <tr>
                <td><span class="rank-badge">#{i}</span></td>
                <td><a href="incident-{esc(inc['slug'])}.html">{esc(inc['title'])}</a>
                    <div style="font-size:0.78rem;color:var(--muted)">{esc(inc.get('operator',''))}</div></td>
                <td>{esc(inc.get('date',''))}</td>
                <td>{esc(inc.get('dcName',''))}<div style="font-size:0.76rem;color:var(--muted)">{esc(loc_s)}</div></td>
                <td><div class="chips">{cat_chips(inc.get('category',[]))}</div></td>
                <td>{esc(_dur(inc.get('durationMin')))}<div class="mag-bar"><span style="width:{min(100,mag*10):.0f}%"></span></div></td>
                <td style="max-width:320px">{esc(inc.get('brief',''))[:220]}{'…' if len(inc.get('brief',''))>220 else ''}</td>
            </tr>""")
    body = f"""        <a class="backlink" href="index.html">← Home</a>
        <div class="eyebrow">Root-only · Post-incident dossier</div>
        <h1>Data-Center Incidents — Case Library</h1>
        <p class="lede">A structured, source-cited library of major data-center and cloud-infrastructure incidents worldwide — ranked by magnitude, each with a full sequence of events, root-cause analysis, correction-of-errors (COE), lessons learnt and engineering improvements. Every fact is traced to a public post-incident report.</p>
        <div class="chips">
            <span class="chip amber">{len(incidents)} incident{'s' if len(incidents)!=1 else ''} catalogued</span>
            <span class="chip green">Provenance-mandatory</span>
            <span class="chip red">Root access</span>
        </div>
        <div class="table-wrap">
            <table class="inc-index">
                <thead><tr><th>Rank</th><th>Incident</th><th>Date</th><th>DC / Location</th><th>Category</th><th>Duration · Magnitude</th><th>Brief</th></tr></thead>
                <tbody>
{chr(10).join(rows)}
                </tbody>
            </table>
        </div>
        <p class="disclaimer">Ranking is a transparent composite of sourced sub-scores (blast radius 35% · users 25% · financial 20% · duration 20%). Summaries are original and substantially shorter than their sources; short attributed excerpts on each incident page are provenance only. This library is for engineering education and does not reproduce source material in full.</p>
"""
    return page_shell("DC Incidents — Case Library", "Root-only ranked library of major data-center and cloud incidents with full RCA, COE, SOE and lessons learnt, each source-cited.", "dc-incidents.html", body, base="")


def _dur(mins):
    if not mins:
        return "—"
    mins = int(mins)
    h, m = divmod(mins, 60)
    return f"{h}h {m}m" if h else f"{m}m"


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

    ca = inc.get("comprehensiveAnalysis", [])
    analysis_html = ""
    if ca:
        blocks = "".join(
            f'<div class="ca-block"><h3>{esc(s.get("heading",""))}</h3><p>{esc(s.get("body",""))}</p></div>'
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
        <p class="lede">{esc(inc.get('brief',''))}</p>

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

        <h2>Sequence of events (SOE)</h2>
        <ul class="soe">{soe}</ul>

        <h2>Root cause</h2>
        <div class="card">{esc(inc.get('rootCause',''))}</div>

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
        <div class="card">{esc(inc.get('technicalDeepDive',''))}</div>

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
    else:
        print(f"[build-incidents] DRY RUN — {len(incidents)} incident(s) → {len(outputs)} pages")
        for i, inc in enumerate(incidents, 1):
            print(f"  #{i}  score {inc['_score']:.2f}  {inc['slug']}")


if __name__ == "__main__":
    main()
