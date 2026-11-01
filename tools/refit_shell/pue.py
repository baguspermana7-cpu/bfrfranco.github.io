"""pue-calculator.html: strings and the page-specific hooks (toolbar, results, inline JS, partial-load curve)."""
import re

from .shell import balanced


def toolbar(s, cfg):
    """4 toolbar: .tool-bar with the Free/Full segment, Reset, Export PDF, Export CSV, Save (same ids and handlers)"""
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
    return re.sub(r'(<div class="rz-calc-validation" id="pueValidation"[^>]*></div>)', r'\1\n        </div>', s, count=1)


def results(main, cfg):
    """5 results: data-rz-fact-list on every .metric-grid, the headline PUE as the first (amber) row"""
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
    return main[:p0] + ('<div id="pueCurvePanel" class="res-group" style="display:none;"><h3>Partial load and water</h3><div data-rz-fact-list>'
                        '<div class="metric-box"><div class="metric-label">PUE at 50 % load</div><div class="metric-value" id="pueAt50">—</div></div>'
                        '<div class="metric-box"><div class="metric-label">WUE</div><div class="metric-value" id="wueVal">—</div></div>'
                        '<div class="metric-box"><div class="metric-label">Annual water</div><div class="metric-value" id="waterVal">—</div></div>'
                        '</div><div id="pueCurveChart" class="res-pad"></div></div>') + main[p1:]


def js(s, cfg):
    """the colours the page wrote into the DOM"""
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
    return re.sub(r"<div style=\"text-align:center;padding:1rem;color:var\(--accent-emerald\);font-size:0\.82rem;\"><i class=\"fas fa-check-circle\" style=\"margin-right:6px;\"></i>(Excellent efficiency![^<]*)</div>",
                  r"<p class=\"tool-note\">\1</p>", s)


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


def post(s):
    """pue: the engine sparkline (no axes, stretched to the panel) becomes a captioned figure with axes."""
    s = s.replace("E.charts.roiLine(pts, { width: 300, height: 120, accent: '#06b6d4' })", "pueCurveSvg(pts, document.getElementById('pueCurveChart').clientWidth)", 1)
    s = s.replace('        // Curve: PUE across 20%–100% IT utilization.', PUE_CURVE_FN + '        // Curve: PUE across 20%–100% IT utilization.', 1)
    s = s.replace('<div id="pueCurveChart" class="res-pad"></div>',
                  '<figure class="fig res-fig"><div id="pueCurveChart"></div><figcaption><b>FIG. 1</b> · PUE across IT load, '
                  '20–100 % · partial-load model, RZEngine · dot = 50 % load</figcaption></figure>', 1)
    return re.sub(r'>\s*FULL Analytics\s*<', '>Full analysis<', s)


CONFIG = {
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
    'shell': [
        ('<section class="calculator-section">', '<section class="calculator-section wrap">'),
        ('<div class="calculator-grid">', '<div class="calculator-grid tool-bench">'),
        ('<div class="input-panel">', '<div class="input-panel tool-inputs">'),
        ('<div class="results-panel">', '<div class="results-panel tool-results">'),
        ('<section class="charts-section">', '<section class="charts-section wrap">'),
    ],
    'fig_start': 1,  # FIG. 1 is the partial-load curve in the results panel (post)
    'toolbar': toolbar, 'results': results, 'js': js, 'post': post,
}
