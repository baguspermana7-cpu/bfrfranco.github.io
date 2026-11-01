#!/usr/bin/env python3
"""refit-tool-shell — move one template-family calculator onto the tool shell (css/rz-hub.css + css/rz-tool.css).

v1: pue-calculator.html only.   usage:
    python3 tools/refit-tool-shell.py --page pue-calculator.html --out pue-calculator1.html [--noindex]
    python3 tools/refit-tool-shell.py --page pue-calculator1.html --out pue-calculator1.html --check   # exit 0 when a re-run changes nothing

Steps (plan Phase 2, 1-7):
  1 head: drop styles.min.css and every page <style>, load rz-hub.css + rz-tool.css, drop the register attribute
  2 nav: hub nav, auth ids kept (navLoginBtn / navUserBtn / navUserDropdown / navThemeBtn / themeIcon)
  3 hero: header.tool-head built from the page's own H1, meta description and a basis line (hero image, badge, explainer, chips go)
  4 toolbar: .tool-bar with the Free/Full segment, Reset, Export PDF, Export CSV, Save (same ids and handlers)
  5 results: data-rz-fact-list on every .metric-grid, the headline PUE as the first (amber) row, charts in .fig with a mono caption
  6 pro: .pro-overlay becomes a .tool-full row; locked content is not drawn (CSS), never blurred; .pro-section.locked contract kept
  8 charts: series palette amber (primary) + grey ramp in the inline JS; red kept as a state colour; theme-color graphite
  7 footer: hub footer; manual FAB, scroll-top button, hero-fit script, share rail, page footer and the two disclaimers go (the
    disclaimers become .notice paragraphs in .tool-ref; the manual link moves to .tool-ref)
Idempotent: a page that already carries <body class="hub tool"> is returned unchanged.
"""
import argparse, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HUB = (ROOT / 'datacenter-solutions.html').read_text(encoding='utf-8')

CONFIG = {
    'pue-calculator.html': {
        'eyebrow': 'DC Solutions · <b>Calculator</b> · PUE',
        'h1': 'Power usage effectiveness <span class="muted">from cooling, UPS and climate</span>',
        'basis': 'engine RZEngine · basis ASHRAE TC 9.9, The Green Grid · updated 2026-10',
        'crumb': '<a href="datacenter-solutions.html">DC Solutions</a> → Calculator → PUE',
        'res_basis': 'PUE = P<sub>facility</sub> / P<sub>IT</sub>',
        'manual': ('manual/pue.html', 'Technical manual and methodology'),
        'lede': 'PUE, DCiE, facility power, annual energy and cost from IT load, rack density, cooling type, containment, '
                'UPS and climate, computed in your browser by RZEngine. Change any input and every figure follows.',
        'full_title': 'Full analysis',
        'full_desc': 'CO₂ per year, free-cooling hours, peer percentile and Green Grid rating',
        'formulas': [
            ('PUE', 'P_facility / P_IT'),
            ('P_facility', 'P_IT + P_cooling + P_UPS loss + P_transformer + P_PDU + P_lighting, security, fire'),
            ('UPS loss', 'P_IT · (1 / η(load) − 1) · redundancy factor'),
            ('DCiE', '100 / PUE, in percent'),
            ('Annual energy', 'P_facility · 8,760 h'),
        ],
        'against': ['ASHRAE TC 9.9', 'The Green Grid', 'ISO/IEC 30134-2', 'Uptime Institute 2026 survey'],
        'links': [('glossary.html', 'Glossary'), ('capex-calculator.html', 'CAPEX calculator'), ('opex-calculator.html', 'OPEX calculator'), ('datacenter-solutions.html', 'DC Solutions'), ('account.html', 'My account and saved scenarios')],
    },
}


def balanced(s, start, tag='div'):
    """index just past the closing tag that balances the opening <tag at s[start]"""
    depth, i = 0, start
    pat = re.compile(r'<(/?)%s\b[^>]*?(/?)>' % tag, re.I)
    for m in pat.finditer(s, start):
        if m.group(2) == '/':
            continue
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m.end()
    raise ValueError('unbalanced <%s> at %d' % (tag, start))


def strip_inline(m):
    keep = [d.strip() for d in m.group(1).split(';') if re.match(r'\s*display\s*:\s*none', d)]
    return ' style="%s"' % (';'.join(keep) + ';') if keep else ''


def hub_nav():
    a = HUB.index('<nav class="navbar hub-nav"')
    nav = HUB[a:HUB.index('</nav>', a) + 6]
    auth = '''      <div class="nav-auth-wrap" id="navAuthWrap">
        <button class="nav-login-btn" id="navLoginBtn" onclick="handlePremiumTab()"><span class="nav-login-text">Login</span></button>
        <button class="nav-user-btn" id="navUserBtn" style="display:none;" onclick="toggleUserDropdown()"><span class="nav-user-avatar" id="navUserAvatar">U</span><span class="nav-user-email" id="navUserEmail"></span></button>
        <div class="nav-user-dropdown" id="navUserDropdown">
          <div class="nav-dd-header"><div class="nav-dd-tier-badge pro" id="navDdTierBadge">FULL</div><div class="nav-dd-email" id="navDdEmail"></div></div>
          <a class="nav-dd-link" href="account.html">My account and saved scenarios</a>
          <button class="nav-dd-logout" onclick="logoutPremium()">Logout</button>
        </div>
      </div>
'''
    theme = '<button class="nav-icon theme-toggle" id="navThemeBtn" onclick="toggleCalcTheme()" aria-label="Toggle dark mode" title="Toggle dark/light mode"><i id="themeIcon" class="fas fa-moon"></i></button>'
    nav = re.sub(r'<button class="nav-icon theme-toggle" id="themeToggle".*?</button>', lambda _: auth + '    ' + theme, nav, flags=re.S)
    assert 'navAuthWrap' in nav
    return nav


def hub_footer():
    c = HUB.index('<footer class="hub-foot">')
    return HUB[c:HUB.index('</footer>', c) + 9]


def refit_pue(src, cfg, noindex):
    s = src
    # --- 1 head
    head_end = s.index('</head>')
    head, body = s[:head_end], s[head_end:]
    head = head.replace(' data-rz-register="tool"', '', 1)
    head = re.sub(r'\s*<link rel="stylesheet" href="styles\.min\.css[^>]*>', '', head)
    head = re.sub(r'\s*<link rel="stylesheet" href="css/rz-tool\.css[^>]*>', '', head)
    head = re.sub(r'\s*<style\b[^>]*>.*?</style>', '', head, flags=re.S)
    head += '\n    <link rel="stylesheet" href="css/rz-hub.css">\n    <link rel="stylesheet" href="css/rz-tool.css">\n'
    if noindex:
        head = re.sub(r'<meta name="robots" content="[^"]*">', '<meta name="robots" content="noindex, nofollow">', head)
    desc = re.search(r'<meta name="description" content="([^"]*)"', head).group(1)
    s = head + body

    # --- body open, background layer
    s = re.sub(r'<body data-rz-calc="pue">', '<body class="hub tool" data-rz-calc="pue" data-rz-account-pill="off">', s, count=1)
    s = s.replace('<div class="page-background"></div>', '')

    # --- disclaimers, taken from the ORIGINAL markup before any style is stripped
    notes = []
    for marker in ('<!-- Independence Disclaimer -->', '<!-- Calculator Disclaimer -->'):
        a = s.index(marker)
        b = s.index('<div', a)
        e = balanced(s, b)
        block = s[b:e]
        for p in re.findall(r'<p\b[^>]*>(.*?)</p>', block, flags=re.S):
            p = re.sub(r'\s*style="[^"]*"', '', p).strip()
            if p:
                notes.append(p)
        s = s[:a] + s[e:]
    # --- 7 footer + manual link + scroll-top + fab + hero-fit
    s = re.sub(r'<!-- Footer -->.*?</footer>', '', s, flags=re.S)
    s = re.sub(r'<!-- Scroll to Top -->\s*<button class="scroll-top-btn".*?</button>', '', s, flags=re.S)
    s = re.sub(r'\s*<script src="js/rz-manual-fab\.js[^>]*></script>', '', s)
    s = re.sub(r'\s*<script src="js/rz-hero-fit\.js[^>]*></script>', '', s)

    # --- 2 nav
    s = re.sub(r'<!-- Navigation -->\s*<nav class="navbar">.*?</nav>', lambda _: hub_nav(), s, count=1, flags=re.S)

    # --- 3 hero -> tool-head
    head_html = '''<header class="tool-head">
            <div class="wrap">
                <p class="eyebrow">%s</p>
                <h1>%s</h1>
                <p class="lede">%s</p>
                <p class="basis">%s</p>
                <p class="crumb">%s</p>
            </div>
        </header>''' % (cfg['eyebrow'], cfg['h1'], cfg.get('lede', desc), cfg['basis'], cfg['crumb'])
    s = re.sub(r'<!-- Hero -->\s*<section class="hero">.*?</section>', lambda _: head_html, s, count=1, flags=re.S)

    # --- 4 toolbar
    save = re.search(r'id="btnSaveAccount" onclick="([^"]*)"', s).group(1)
    t0 = s.index('<!-- Toolbar Row -->')
    t1 = s.index('<div id="acctSaveMsg"')
    bar = '''<div class="wrap">
        <div class="tool-bar" role="toolbar" aria-label="Mode and actions">
            <div class="seg" role="group" aria-label="Assessment depth">
                <button class="pue-toolbar-btn pue-btn-free active" id="btnFreeMode" onclick="setMode('free')">Free</button>
                <button class="pue-toolbar-btn pue-btn-pro locked-hint" id="btnProMode" onclick="setMode('pro')">Full</button>
            </div>
            <span class="pue-mode-indicator free-active" id="modeIndicator" hidden>FREE MODE</span>
            <span class="spacer"></span>
            <button class="tool-btn pue-btn-reset" onclick="resetDefaults()">Reset</button>
            <button class="tool-btn pue-btn-pdf disabled" id="btnExportPDF" onclick="exportPDF()">Export PDF</button>
            <button class="tool-btn pue-btn-reset" id="btnExportCSV" onclick="exportPueCSV()">Export CSV</button>
            <button class="tool-btn" id="btnSaveAccount" onclick="%s">Save</button>
        </div>
        ''' % save
    s = s[:t0] + bar + s[t1:]
    # close the .wrap after the validation div, open the bench wrap
    s = re.sub(r'(<div class="rz-calc-validation" id="pueValidation"[^>]*></div>)', r'\1\n        </div>', s, count=1)

    # --- calculator shell
    s = s.replace('<section class="calculator-section">', '<section class="calculator-section wrap">', 1)
    s = s.replace('<div class="calculator-grid">', '<div class="calculator-grid tool-bench">', 1)
    s = s.replace('<div class="input-panel">', '<div class="input-panel tool-inputs">', 1)
    s = s.replace('<div class="results-panel">', '<div class="results-panel tool-results">', 1)
    s = s.replace('<section class="charts-section">', '<section class="charts-section wrap">', 1)

    # --- pro (before the global style strip so the overlay text is intact)
    def tool_full(m):
        title = cfg.get('full_title') or re.sub(r'<[^>]+>', '', m.group(1)).strip()
        desc_ = cfg.get('full_desc') or re.sub(r'<[^>]+>', '', m.group(2) or '').strip()
        return ('<div class="pro-overlay tool-full" onclick="handlePremiumTab()"><p><b>%s</b>%s</p>'
                '<button class="pro-overlay-btn">Sign in</button></div>') % (title, (' — ' + desc_) if desc_ else '')
    s = re.sub(r'<div class="pro-overlay" onclick="handlePremiumTab\(\)">\s*(?:<i[^>]*></i>\s*)?<div class="pro-overlay-title">(.*?)</div>'
               r'(?:\s*<div class="pro-overlay-desc">(.*?)</div>)?\s*<button class="pro-overlay-btn">.*?</button>\s*</div>', tool_full, s, flags=re.S)
    s = re.sub(r'\s*<span class="pro-badge">.*?</span>', '', s, flags=re.S)

    # --- main region: icons and inline styles go
    m0, m1 = s.index('<main'), s.index('</main>')
    main = s[m0:m1]
    main = re.sub(r'<div class="section-icon"[^>]*>\s*<i[^>]*></i>\s*</div>', '', main)
    main = re.sub(r'<i class="fas?s? [^"]*"[^>]*></i>\s*', '', main)
    main = re.sub(r'<i class="fa[a-z]? fa-[^"]*"[^>]*></i>\s*', '', main)
    main = re.sub(r'\s+style="([^"]*)"', strip_inline, main)
    # --- 5 results
    main = re.sub(r'<div class="pue-display">\s*<div class="pue-value" id="pueValue">([^<]*)</div>\s*<div class="pue-label">([^<]*)</div>\s*'
                  r'<div class="pue-rating" id="pueRating">\s*<span id="ratingText">([^<]*)</span>\s*</div>\s*</div>',
                  lambda m: ('<div class="res-head"><h2>Results</h2><span class="basis">%s</span></div>\n'
                             '<div class="res-group"><h3>Headline</h3><div data-rz-fact-list>'
                             '<div class="metric-box is-key"><div class="metric-label">%s</div><div class="metric-value pue-value" id="pueValue">%s</div>'
                             '<div class="metric-sub pue-rating" id="pueRating"><span class="state" id="ratingText">%s</span></div></div></div></div>')
                  % (cfg['res_basis'], m.group(2), m.group(1), m.group(3)), main)
    # first metric-grid: its own group; every grid is a fact list
    g = main.index('<div class="metric-grid"')
    ge = balanced(main, g)
    main = main[:g] + '<div class="res-group"><h3>Power and energy</h3>' + main[g:ge].replace('<div class="metric-grid"', '<div class="metric-grid" data-rz-fact-list', 1) + '</div>' + main[ge:]
    main = main.replace('<div class="metric-grid">', '<div class="metric-grid" data-rz-fact-list>')
    main = re.sub(r'(<span class="tooltip-trigger")[^>]*>', r'\1>', main)
    # industry comparison / recommendations / partial-load panel
    main = re.sub(r'<div>\s*<div>\s*Industry Comparison\s*</div>\s*<div id="industryComparison"></div>\s*</div>',
                  '<div class="res-group"><h3>Industry comparison</h3><div id="industryComparison" class="res-pad"></div></div>', main)
    main = re.sub(r'<div class="rec-title">\s*Recommendations</div>', '<div class="rec-title">Recommendations</div>', main)
    p0 = main.index('<div id="pueCurvePanel"')
    p1 = balanced(main, p0)
    main = main[:p0] + ('<div id="pueCurvePanel" class="res-group" style="display:none;"><h3>Partial load and water</h3><div data-rz-fact-list>'
                        '<div class="metric-box"><div class="metric-label">PUE at 50 % load</div><div class="metric-value" id="pueAt50">—</div></div>'
                        '<div class="metric-box"><div class="metric-label">WUE</div><div class="metric-value" id="wueVal">—</div></div>'
                        '<div class="metric-box"><div class="metric-label">Annual water</div><div class="metric-value" id="waterVal">—</div></div>'
                        '</div><div id="pueCurveChart" class="res-pad"></div></div>') + main[p1:]
    # charts -> .fig
    n = [1]  # FIG. 1 is the partial-load curve in the results panel (pue_curve)

    def fig(m):
        n[0] += 1
        title = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        return ('<figure class="fig chart-card">%s<figcaption><b>FIG. %d</b> %s · computed from the inputs above</figcaption></figure>'
                % (m.group(2), n[0], title))
    main = re.sub(r'<div class="chart-card">\s*<div class="chart-title">(.*?)</div>\s*(<div class="chart-container"><canvas id="[^"]+"></canvas></div>)\s*</div>', fig, main, flags=re.S)
    # reference section
    manual_href, manual_text = cfg['manual']
    ref = '''
        <section class="tool-ref" aria-labelledby="ref-h">
            <div class="wrap">
                <p class="eyebrow" id="ref-h">02 / Reference</p>
                <div class="ref-grid">
                    <div>
                        <h3>Method</h3>
                        <ul class="formulas">
%s
                        </ul>
                    </div>
                    <div>
                        <h3>Computed against</h3>
                        <p class="against">%s</p>
                        <h3>Read further</h3>
                        <p class="links"><a href="%s">%s</a>%s</p>
                    </div>
                </div>
%s
            </div>
        </section>
''' % ('\n'.join('                            <li><span>%s</span><code>%s</code></li>' % f for f in cfg['formulas']),
       ''.join('<span>%s</span>' % a for a in cfg['against']),
       manual_href, manual_text, ''.join('<a href="%s">%s</a>' % l for l in cfg['links']),
       '\n'.join('                <p class="notice">%s</p>' % x for x in notes))
    s = s[:m0] + main + ref + s[m1:]

    # --- footer, after </main>
    s = s.replace('</main>', '</main>\n' + hub_footer(), 1)

    # --- JS: the colours the page wrote into the DOM
    s = re.sub(r"\n\s*document\.getElementById\('pueValue'\)\.style\.color = ratingColor;", '', s)
    s = re.sub(r"\n\s*document\.getElementById\('pueRating'\)\.style\.background = ratingBg;", '', s)
    s = re.sub(r"\n\s*document\.getElementById\('pueRating'\)\.style\.color = ratingColor;", '', s)
    f0 = s.index('function renderIndustryComparison')
    f1 = s.index('document.getElementById(\'industryComparison\').innerHTML = html;', f0)
    seg = s[f0:f1]
    seg = seg.replace("color: '#06b6d4'", "color: 'var(--rzt-accent)'")
    seg = re.sub(r"color: '#[0-9a-fA-F]{6}'", "color: 'var(--rzt-muted)'", seg)
    seg = seg.replace("font-weight:600;color:' + b.color + ';", "font-weight:600;color:var(--rzt-text);")
    s = s[:f0] + seg + s[f1:]
    s = s.replace('<div class="rec-icon"><i class="fas fa-\' + r.icon + \'"></i></div>', '')
    s = re.sub(r"<div style=\"text-align:center;padding:1rem;color:var\(--accent-emerald\);font-size:0\.82rem;\"><i class=\"fas fa-check-circle\" style=\"margin-right:6px;\"></i>(Excellent efficiency![^<]*)</div>",
               r"<p class=\"tool-note\">\1</p>", s)
    return series_palette(pdf_palette(pue_curve(s)))


PUE_CURVE_FN = r"""        function pueCurveSvg(pts, cw) {
            // drawn at the container's own width so axis text stays 10 px on a phone (a fixed viewBox shrinks it)
            var W = Math.max(280, Math.round(cw || 560)), H = W < 420 ? 170 : 190, L = 40, R = 12, T = 12, B = 28;
            var ys = pts.map(function (p) { return p.y; }), mn = Math.min.apply(null, ys), mx = Math.max.apply(null, ys);
            var step = [0.05, 0.1, 0.2, 0.25, 0.5, 1].filter(function (st) { return (mx - mn) / st <= 4; })[0] || 1;
            var lo = Math.floor(mn / step) * step, hi = Math.ceil(mx / step) * step; if (hi === lo) hi = lo + step;
            var sx = function (x) { return L + (x - 20) / 80 * (W - L - R); }, sy = function (y) { return T + (hi - y) / (hi - lo) * (H - T - B); };
            var o = '<svg class="pue-curve" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="PUE across IT load from 20 to 100 percent">';
            for (var v = lo; v <= hi + 1e-9; v += step) { var y = sy(v); o += '<line class="gr" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + v.toFixed(Math.round(step * 100) % 10 ? 2 : 1) + '</text>'; }
            (W < 420 ? [20, 60, 100] : [20, 40, 60, 80, 100]).forEach(function (x) { o += '<text x="' + sx(x) + '" y="' + (H - 9) + '" text-anchor="' + (x === 100 ? 'end' : x === 20 ? 'start' : 'middle') + '">' + x + ' %</text>'; });
            o += '<polyline class="ln" points="' + pts.map(function (p) { return sx(p.x) + ',' + sy(p.y); }).join(' ') + '"/>';
            var p50 = pts.filter(function (p) { return p.x === 50; })[0];
            if (p50) o += '<circle class="pt" cx="' + sx(50) + '" cy="' + sy(p50.y) + '" r="3"/>';
            return o + '</svg>';
        }
"""


def pue_curve(s):
    """pue: the engine sparkline (no axes, stretched to the panel) becomes a captioned figure with axes."""
    s = s.replace("E.charts.roiLine(pts, { width: 300, height: 120, accent: '#06b6d4' })", "pueCurveSvg(pts, document.getElementById('pueCurveChart').clientWidth)", 1)
    s = s.replace('        // Curve: PUE across 20%–100% IT utilization.', PUE_CURVE_FN + '        // Curve: PUE across 20%–100% IT utilization.', 1)
    s = s.replace('<div id="pueCurveChart" class="res-pad"></div>',
                  '<figure class="fig res-fig"><div id="pueCurveChart"></div><figcaption><b>FIG. 1</b> · PUE across IT load, '
                  '20–100 % · partial-load model, RZEngine · dot = 50 % load</figcaption></figure>', 1)
    return re.sub(r'>\s*FULL Analytics\s*<', '>Full analysis<', s)


PDF_INK = {'#06b6d4': '#8A5A00', '#1e3a5f': '#111827', '#ecfeff': '#F7F4EC', '#10b981': '#374151', '#3b82f6': '#4B5563', '#f97316': '#6B7280'}


def pdf_palette(s):
    """The PDF export is a sheet of paper: dark amber rules + graphite ink, no cyan rails or navy headings.
    On-page result strings that colour a figure green ('savings') take the text colour; the figure carries the meaning."""
    a = s.find('function exportPDF')
    if a >= 0:
        e = s.find('\n    function ', a + 20)
        e = len(s) if e < 0 else e
        blk = s[a:e]
        for k, v in PDF_INK.items():
            blk = re.sub(re.escape(k), v, blk, flags=re.I)
        s = s[:a] + blk + s[e:]
    return re.sub(r'color:#10b981', 'color:var(--rzt-text)', s, flags=re.I)


SERIES_AMBER = '#D49A2A'   # reads on both themes (hue 38, inside the T19 amber band)
SERIES_GREYS = ['#A0AEC0', '#7D8794', '#5E6673', '#C9CFD8', '#4A5160', '#8C96A3']


def _hue_sat(hexv):
    r, g, b = (int(hexv[i:i + 2], 16) / 255 for i in (0, 2, 4))
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0
    d = mx - mn
    sat = d / (2 - mx - mn) if l > .5 else d / (mx + mn)
    h = ((g - b) / d + (6 if g < b else 0)) if mx == r else ((b - r) / d + 2) if mx == g else ((r - g) / d + 4)
    return h * 60, sat


def series_palette(s, primary='06b6d4'):
    """Step 8: chart series in the page's inline JS go amber (the page's primary series) + a grey ramp.
    Red stays (state colour); greys stay. Same input -> same output (ramp assigned in order of first appearance)."""
    assigned, ramp = {primary.lower(): SERIES_AMBER}, iter(SERIES_GREYS * 4)

    def recolor(js):
        def one(m):
            hv = m.group(2).lower()
            h, sat = _hue_sat(hv)
            if sat < 0.30 or h < 15 or h >= 340:
                return m.group(0)
            if hv not in assigned:
                assigned[hv] = next(ramp)
            return m.group(1) + assigned[hv] + m.group(1)
        js = re.sub(r"(['\"])#([0-9a-fA-F]{6})\1", one, js)
        return js.replace('rgba(6,182,212,', 'rgba(212,154,42,').replace('rgba(6, 182, 212,', 'rgba(212, 154, 42,')

    def block(m):
        if 'application/ld+json' in m.group(1) or 'src=' in m.group(1):
            return m.group(0)
        return '<script' + m.group(1) + '>' + recolor(m.group(2)) + '</script>'
    s = re.sub(r'<script\b([^>]*)>([\s\S]*?)</script>', block, s)
    return re.sub(r'<meta name="theme-color" content="#[0-9a-fA-F]{6}">', '<meta name="theme-color" content="#0b0c0e">', s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page', required=True)
    ap.add_argument('--out')
    ap.add_argument('--noindex', action='store_true')
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    src = (ROOT / a.page).read_text(encoding='utf-8')
    key = a.page if a.page in CONFIG else 'pue-calculator.html'  # a refit output keeps its source's config
    if '<body class="hub tool"' in src:
        out = src
    else:
        if a.page not in CONFIG:
            sys.exit('v1 supports pue-calculator.html only')
        out = refit_pue(src, CONFIG[key], a.noindex)
    if a.check:
        sys.exit(0 if out == src else 1)
    (ROOT / (a.out or a.page)).write_text(out, encoding='utf-8')
    print('refit-tool-shell: %s -> %s (%d lines)' % (a.page, a.out or a.page, out.count('\n')))


if __name__ == '__main__':
    main()
