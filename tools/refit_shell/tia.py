"""tia-942-checklist.html: strings and the page-specific hooks.

Refit IN PLACE; the page stays on tools/apply-tool-register.py's list (keep_register). `pre` adds the template anchors the
shell expects (body data-rz-calc, Navigation and Hero comments, an empty Independence block) and drops the floating manual
link; the page had no footer, the shell adds the hub footer. The hero chip strip goes, but #statItemCount and #statDcType
(written by the page JS) move into the .basis line. Tier and facility type are inputs: they sit at the top of the inputs
column as aria-pressed chips, over the checklist. The six Full overlays become ONE .tool-full row (the first section keeps
it; the other locked sections are simply not drawn). Category colours, tiles and inline paint become classes, amber + greys.
"""
import re

from .shell import PDF_INK, balanced, js_replace, js_swap_between

AMBER = 'rgb(212, 154, 42)'   # SERIES_AMBER as rgb() so shell.series_palette (hex only) leaves it alone
GREY = 'rgba(125, 135, 148, 0.55)'


# ---------------------------------------------------------------- pre: onto the template anchors
def pre(src):
    s = src
    for old, new in (('\n<body>\n', '\n<body data-rz-calc="tia">\n'),
                     ('    <nav class="navbar">', '    <!-- Navigation -->\n    <nav class="navbar">'),
                     ('        <section class="hero">', '        <!-- Hero -->\n        <section class="hero">'),
                     ('<!-- Calculator Disclaimer -->', '<!-- Independence Disclaimer -->\n    <div></div>\n    <!-- Calculator Disclaimer -->')):
        assert s.count(old) == 1, old
        s = s.replace(old, new)
    # the floating "Technical Manual" link after the scripts (its own <style>); the manual is linked from .tool-ref
    s, n = re.subn(r'\n\s*<div class="rz-manual-link"[^>]*>.*?</div>', '', s, count=1, flags=re.S)
    assert n == 1
    return s


# ---------------------------------------------------------------- 4 toolbar
def toolbar(s, cfg):
    """Free | Full segment, Reset, Export PDF (4 controls). Tier and facility type move to the inputs column (results hook)."""
    a = s.index('<!-- Toolbar -->')
    e = s.index('<!-- Calculator Grid -->', a)
    bar = '''<div class="wrap">
        <div class="tool-bar" role="toolbar" aria-label="Mode and actions">
            <div class="seg" role="group" aria-label="Assessment depth">
                <button type="button" class="tia-toolbar-btn tia-btn-free active" id="btnFreeMode" aria-pressed="true" onclick="setMode('free')">Free</button>
                <button type="button" class="tia-toolbar-btn tia-btn-pro locked-hint" id="btnProMode" aria-pressed="false" onclick="setMode('pro')">Full</button>
            </div>
            <span class="tia-mode-indicator free-active" id="modeIndicator" hidden>FREE MODE</span>
            <span class="spacer"></span>
            <button type="button" class="tool-btn tia-btn-reset" onclick="resetChecklist()">Reset</button>
            <button type="button" class="tool-btn tia-btn-pdf disabled" id="btnExportPDF" onclick="exportPDF()">Export PDF</button>
        </div>
        </div>

        '''
    return s[:a] + bar + s[e:]


# ---------------------------------------------------------------- before the inline-style strip
PANEL_TITLES = {'Gap Analysis': 'Gap analysis · unchecked items by priority', 'Monte Carlo Simulation': 'Monte Carlo range',
                'Tier Comparison': 'Score by tier', 'Remediation Roadmap': 'Remediation roadmap · first 15 gaps',
                'Sensitivity — Top 10 Impact Items': 'Sensitivity · the ten items that move the score most'}


def pre_clean(main, cfg):
    # one Full row: the first locked section (charts) keeps its overlay, the other five are not drawn while locked
    rows = list(re.finditer(r'\s*<div class="pro-overlay tool-full" onclick="handlePremiumTab\(\)"><p>.*?</p><button class="pro-overlay-btn">Sign in</button></div>', main))
    assert len(rows) == 6, len(rows)
    for m in reversed(rows[1:]):
        main = main[:m.start()] + main[m.end():]
    # Full panels: a results panel with a plain heading
    def head(m):
        t = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        return '<div class="pro-panel tool-results"><div class="res-head"><h2>%s</h2></div>' % PANEL_TITLES[t]
    main, n = re.subn(r'<div class="pro-panel">\s*<h3>(.*?)</h3>', head, main, flags=re.S)
    assert n == 5, n
    main, n = re.subn(r'<p style="[^"]*">10,000 iterations with ±15% weight variance\. Shows probability distribution of compliance scores\.</p>\s*'
                      r'<div id="mcResults" style="[^"]*"></div>',
                      '<p class="res-fine">10,000 runs, each item weight varied ±15 %. The spread of the compliance score.</p>'
                      '<div id="mcResults" data-rz-fact-list></div>', main)
    assert n == 1, n
    for old, new in (('Compliance Overview', 'Share of weighted items in place'),
                     ('Category Comparison', 'Score by category against the 75 % target · amber = weakest'),
                     ('Tier Radar', 'Score by category for each tier · amber = selected tier'),
                     ('Monte Carlo Distribution', 'Compliance score over 10,000 runs · amber = median bin')):
        main, n = re.subn(r'(<div class="chart-title">(?:\s*<i [^>]*></i>)?\s*)%s' % old, lambda m: m.group(1) + new, main)
        assert n == 1, old
    main = main.replace('<table class="gap-table" id="gapTable">', '<div class="tia-tbl"><table class="gap-table" id="gapTable">', 1)
    main = main.replace('<table class="gap-table" id="roadmapTable">', '<div class="tia-tbl"><table class="gap-table" id="roadmapTable">', 1)
    main = re.sub(r'(<tbody id="(?:gapTableBody|roadmapBody)"></tbody>\s*</table>)', r'\1</div>', main)
    return main


# ---------------------------------------------------------------- 5 results (after the strip)
TIERS = [('1', 'Basic'), ('2', 'Redundant'), ('3', 'Concurrently maintainable'), ('4', 'Fault tolerant')]
TYPES = [('ent', 'Enterprise'), ('colo', 'Colocation'), ('hyper', 'Hyperscale'), ('edge', 'Edge'), ('mod', 'Modular')]

BENCH = '''<section class="calculator-section wrap">
            <div class="calculator-grid tool-bench">
                <div class="tool-inputs tia-inputs">
                    <div class="input-section"><div class="section-header"><span class="section-title">Tier level</span></div>
                        <div class="preset-row tier-bar" role="group" aria-label="Tier level">
%(tiers)s
                        </div></div>
                    <div class="input-section"><div class="section-header"><span class="section-title">Facility type</span></div>
                        <div class="preset-row dctype-bar" role="group" aria-label="Facility type">
%(types)s
                        </div></div>
                    <div class="input-section"><div class="section-header"><span class="section-title">Checklist</span><div class="section-subtitle">Tick what the facility has. W3 critical, W2 important, W1 standard.</div></div>
                        <div class="checklist-panel" id="checklistPanel"></div></div>
                </div>
                <div class="results-panel tool-results">
                    <div class="res-head"><h2>Results</h2><span class="basis">%(res_basis)s</span></div>
                    <div class="res-group"><h3>Headline</h3><div data-rz-fact-list>
                        <div class="metric-box is-key"><div class="metric-label">Overall compliance</div><div class="metric-value" id="scoreValue">0%%</div><div class="metric-sub"><span class="state" id="scoreGrade">F — Incomplete</span></div></div>
                    </div></div>
                    <div class="res-group"><h3>Detail</h3><div class="metric-grid" data-rz-fact-list>
                        <div class="metric-box"><div class="metric-label">Items checked</div><div class="metric-value" id="metricChecked">0</div></div>
                        <div class="metric-box"><div class="metric-label">Items applicable</div><div class="metric-value" id="metricApplicable">0</div></div>
                        <div class="metric-box"><div class="metric-label">Risk index</div><div class="metric-value" id="metricCRI">0</div></div>
                        <div class="metric-box"><div class="metric-label">Tier level</div><div class="metric-value" id="metricTier">3</div></div>
                        <div class="metric-box"><div class="metric-label">Weakest category</div><div class="metric-value" id="metricWeakest">0%%</div></div>
                        <div class="metric-box"><div class="metric-label">Maturity</div><div class="metric-value" id="metricMaturity">L1</div></div>
                        <div class="metric-box"><div class="metric-label">Facility type</div><div class="metric-value" id="metricDcType">Enterprise</div></div>
                    </div></div>
                    <div class="res-group"><h3>Category scores</h3><div class="cat-bars" id="catBars"></div></div>
                    <div class="rec-section" id="recSection"><div class="rec-title">Top gaps</div><div id="recCards"></div></div>
                </div>
            </div>
        </section>'''


def results(main, cfg):
    tiers = '\n'.join('                            <button type="button" class="preset-btn tier-btn%s" aria-pressed="%s" onclick="setTier(%s)">Tier %s · %s</button>'
                      % (' active' if n == '3' else '', 'true' if n == '3' else 'false', n, n, t) for n, t in TIERS)
    types = '\n'.join('                            <button type="button" class="preset-btn dctype-btn%s" aria-pressed="%s" onclick="setDcType(\'%s\')" data-dc="%s">%s</button>'
                      % (' active' if k == 'ent' else '', 'true' if k == 'ent' else 'false', k, k, t) for k, t in TYPES)
    a = main.index('<section class="calculator-section">')
    e = balanced(main, a, 'section')
    return main[:a] + BENCH % dict(cfg, tiers=tiers, types=types) + main[e:]


# ---------------------------------------------------------------- inline JS
SENS_JS = r"""sensItems.slice(0, 10).forEach(function(s, idx) {
            var barW = maxImpact > 0 ? Math.min(100, s.impact / maxImpact * 100) : 0;
            sensHtml += '<div class="sens-row' + (idx === 0 ? ' is-key' : '') + '"><span class="sens-n">' + (idx + 1) + '</span>' +
                '<span class="sens-item">' + s.item.label + (s.item.w === 3 ? ' <small>P1</small>' : (s.item.w === 2 ? ' <small>P2</small>' : '')) + '</span>' +
                '<span class="sens-track"><span class="sens-fill" style="width:' + barW + '%"></span></span>' +
                '<span class="sens-val">+' + s.impact.toFixed(2) + ' %</span></div>';
        });
        document.getElementById('sensitivityBars').innerHTML = sensHtml || '<p class="res-fine">No gaps to analyse.</p>';"""
MC_JS = r"""document.getElementById('mcResults').innerHTML =
            '<div class="metric-box"><div class="metric-label">Mean</div><div class="metric-value">' + mcResults.mean.toFixed(1) + '%</div></div>' +
            '<div class="metric-box"><div class="metric-label">Standard deviation</div><div class="metric-value">±' + mcResults.stddev.toFixed(1) + '%</div></div>' +
            '<div class="metric-box"><div class="metric-label">P5, low case</div><div class="metric-value">' + mcResults.p5.toFixed(1) + '%</div></div>' +
            '<div class="metric-box"><div class="metric-label">P25</div><div class="metric-value">' + mcResults.p25.toFixed(1) + '%</div></div>' +
            '<div class="metric-box is-key"><div class="metric-label">P50, median</div><div class="metric-value">' + mcResults.p50.toFixed(1) + '%</div></div>' +
            '<div class="metric-box"><div class="metric-label">P75</div><div class="metric-value">' + mcResults.p75.toFixed(1) + '%</div></div>' +
            '<div class="metric-box"><div class="metric-label">P95, high case</div><div class="metric-value">' + mcResults.p95.toFixed(1) + '%</div></div>' +
            '<div class="metric-box"><div class="metric-label">90 % interval</div><div class="metric-value">' + mcResults.p5.toFixed(0) + '–' + mcResults.p95.toFixed(0) + '%</div></div>';

        """


def js(s, cfg):
    A = "'%s'" % AMBER
    s = js_replace(s, [
        # checklist: no tinted category tile, no category-coloured fill, a text chevron; the tooltip is CSS (css/rz-tool.css)
        ("""'<div class="cat-icon" style="background:' + cat.color + '18;color:' + cat.color + ';"><i class="fas ' + cat.icon + '"></i></div>' +""", ""),
        ("""'%;background:' + cat.color + ';"></div></div>' +""", """'%;"></div></div>' +"""),
        ("""'<i class="fas fa-chevron-down cat-chevron"></i></div>' +""", """'<span class="cat-chevron" aria-hidden="true"></span></div>' +"""),
        ("""var tipHtml = it.tip ? '<span class="tooltip-trigger">?<div class="tooltip-data" data-title="' + it.label.replace(/"/g,'&quot;') + '" data-desc="' + it.tip.replace(/"/g,'&quot;') + '" data-ref="' + it.ref + '" data-weight="W' + it.w + ' — ' + wLabel + '" data-icon="' + catObj.icon + '"></div></span>' : '';""",
         """var tipHtml = it.tip ? '<span class="tooltip-trigger" tabindex="0">?<span class="tooltip-content"><span class="tooltip-title">' + it.label + '</span>' + it.tip + '<span class="tip-meta">' + it.ref + ' · W' + it.w + ' ' + wLabel.toLowerCase() + '</span></span></span>' : '';"""),
        ("        initTooltipSystem();\n", ""),
        # score: a state word, not a painted figure
        ("        sv.style.color = gradeColor;\n", ""),
        ("""        sg.style.background = gradeColor + '18';
        sg.style.color = gradeColor;""", """        sg.setAttribute('data-state', overall >= 75 ? 'ok' : overall >= 50 ? 'watch' : 'hazard');"""),
        ("        document.getElementById('metricWeakest').style.color = weakestLink >= 75 ? '#10b981' : (weakestLink >= 50 ? '#f59e0b' : '#ef4444');\n", ""),
        # category rows: name | bar | percent, the weakest bar amber (CSS reads data-weak)
        ("""var barsHtml = '<div class="cat-bars-title"><i class="fas fa-chart-bar" style="color:var(--accent-emerald);"></i> Category Scores</div>';""",
         """var barsHtml = '', _weak = Math.min.apply(null, CATEGORIES.map(function(c) { return catScores[c.id].pct; }));"""),
        ("""barsHtml += '<div class="cat-bar-row"><span class="cat-bar-label" title="' + cat.label + '">'""",
         """barsHtml += '<div class="cat-bar-row' + (s.pct === _weak ? ' is-weak' : '') + '"><span class="cat-bar-label" title="' + cat.label + '">'"""),
        ("""'<div class="cat-bar-track"><div class="cat-bar-fill" style="width:' + s.pct + '%;background:' + cat.color + ';"></div></div>' +
                '<span class="cat-bar-pct" style="color:' + cat.color + ';">' + Math.round(s.pct) + '%</span></div>';""",
         """'<div class="cat-bar-track"><div class="cat-bar-fill" style="width:' + s.pct + '%;"></div></div>' +
                '<span class="cat-bar-pct">' + Math.round(s.pct) + '%</span></div>';"""),
        ("""recHtml += '<div class="rec-card"><div class="rec-icon" style="background:' + cat.color + '15;color:' + cat.color + ';"><i class="fas ' + cat.icon + '"></i></div>' +""",
         """recHtml += '<div class="rec-card">' +"""),
        ("""'<p style="font-size:0.82rem;color:var(--text-muted);">All items checked!</p>'""", """'<p class="res-fine">Every applicable item is checked.</p>'"""),
        # charts: amber + greys; the weakest category is the amber bar, the median bin the amber bin, the chosen tier the amber trace
        ("""                backgroundColor: [gradeColor, '#e5e7eb'],
                hoverBackgroundColor: [gradeColor + 'dd', '#d1d5db'],
                borderWidth: 0, borderRadius: 4""", """                backgroundColor: [%s, 'rgba(140, 150, 163, 0.25)'],
                hoverBackgroundColor: [%s, 'rgba(140, 150, 163, 0.35)'],
                borderWidth: 0, borderRadius: 0""" % (A, A)),
        ("centerText: { text: Math.round(overall) + '%', color: gradeColor, sub: 'Compliance' }",
         "centerText: { text: Math.round(overall) + '%', color: getComputedStyle(document.body).color, sub: 'Compliance' }"),
        ("""        var bgColors = pcts.map(function(p, i) {
            var c = colors[i];
            return p >= 75 ? c + '50' : (p >= 50 ? c + '35' : c + '20');
        });""", """        var _minP = Math.min.apply(null, pcts);
        var bgColors = pcts.map(function(p) { return p === _minP ? %s : '%s'; });""" % (A, GREY)),
        ("backgroundColor: bgColors, borderColor: colors, borderWidth: 2, borderRadius: 8", "backgroundColor: bgColors, borderWidth: 0, borderRadius: 0"),
        ("thresholdLine: { value: 75, color: 'rgba(239,68,68,0.45)', label: '75% Target' },", "thresholdLine: { value: 75, color: 'rgba(140,150,163,0.9)', label: '75 % target' },"),
        ("""        var binColors = mcResults.bins.map(function(b) {
            var mid = parseInt(b.label); return mid >= 85 ? 'rgba(16,185,129,0.5)' : (mid >= 65 ? 'rgba(245,158,11,0.5)' : (mid >= 50 ? 'rgba(249,115,22,0.5)' : 'rgba(239,68,68,0.4)'));
        });
        var binBorders = mcResults.bins.map(function(b) {
            var mid = parseInt(b.label); return mid >= 85 ? '#10b981' : (mid >= 65 ? '#f59e0b' : (mid >= 50 ? '#f97316' : '#ef4444'));
        });""", """        var binColors = mcResults.bins.map(function(b) {
            var lo = parseInt(b.label); return (mcResults.p50 >= lo && mcResults.p50 < lo + 10) || (lo === 90 && mcResults.p50 >= 90) ? %s : '%s';
        });""" % (A, GREY)),
        ("backgroundColor: binColors, borderColor: binBorders, borderWidth: 1.5, borderRadius: 3", "backgroundColor: binColors, borderWidth: 0, borderRadius: 0"),
        ("""            var colors = ['rgba(107,114,128,','rgba(59,130,246,','rgba(16,185,129,','rgba(100, 116, 139,'];
            return { label: 'Tier ' + t, data: ds, borderColor: colors[t-1] + '0.8)', backgroundColor: colors[t-1] + '0.1)',""",
         """            var rgb = t === currentTier ? 'rgba(212,154,42,' : 'rgba(125,135,148,';
            return { label: 'Tier ' + t, data: ds, borderColor: rgb + (t === currentTier ? '1)' : '0.6)'), backgroundColor: rgb + (t === currentTier ? '0.12)' : '0.04)'), pointBackgroundColor: rgb + '1)',"""),
        ("""tcHtml += '<tr><td style="font-weight:600;">' + cat.label + '</td>';""", """tcHtml += '<tr><td>' + cat.label + '</td>';"""),
        ("""                var col = pct >= 80 ? '#10b981' : (pct >= 50 ? '#f59e0b' : '#ef4444');
                tcHtml += '<td style="font-family:\\'JetBrains Mono\\',monospace;color:' + col + ';font-weight:600;">' + pct + '%</td>';""",
         """                tcHtml += '<td class="num' + (t === currentTier ? ' is-cur' : '') + '">' + pct + '%</td>';"""),
        # selectors report their state
        ("document.querySelectorAll('.tier-btn').forEach(function(b, i) { b.classList.toggle('active', i + 1 === t); });",
         "document.querySelectorAll('.tier-btn').forEach(function(b, i) { b.classList.toggle('active', i + 1 === t); b.setAttribute('aria-pressed', i + 1 === t ? 'true' : 'false'); });"),
        ("            b.classList.toggle('active', b.getAttribute('data-dc') === type);",
         "            b.classList.toggle('active', b.getAttribute('data-dc') === type);\n            b.setAttribute('aria-pressed', b.getAttribute('data-dc') === type ? 'true' : 'false');"),
        ("btnFree.classList.remove('active'); btnPro.classList.add('active');",
         "btnFree.classList.remove('active'); btnPro.classList.add('active'); btnFree.setAttribute('aria-pressed', 'false'); btnPro.setAttribute('aria-pressed', 'true');"),
        ("btnFree.classList.add('active'); btnPro.classList.remove('active');",
         "btnFree.classList.add('active'); btnPro.classList.remove('active'); btnFree.setAttribute('aria-pressed', 'true'); btnPro.setAttribute('aria-pressed', 'false');"),
    ])
    s = js_swap_between(s, "document.getElementById('mcResults').innerHTML =", '// MC Chart', MC_JS)
    s = js_swap_between(s, 'sensItems.slice(0, 10).forEach(function(s, idx) {',
                        "document.getElementById('sensitivityBars').innerHTML = sensHtml || '<p style=\"color:var(--text-muted);font-size:0.82rem;\">No gaps to analyze.</p>';",
                        SENS_JS, include_end=True)
    return s


CONFIG = {
    'keep_register': True,
    'pre': pre,
    'eyebrow': 'DC Solutions · <b>Checklist</b> · TIA-942',
    'h1': 'TIA-942-C compliance <span class="muted">by tier and facility type</span>',
    'lede': 'Tick what the facility has against ANSI/TIA-942-C (2024) across site and architecture, electrical, mechanical, '
            'telecommunications, fire protection and physical security. The items shown follow the tier and facility type you '
            'pick; each item weighs W1 to W3 and each category by its share of risk. Scored in your browser.',
    'basis': 'basis ANSI/TIA-942-C (2024) · <span id="statItemCount">56</span> items for this tier and facility type · '
             'facility <span id="statDcType">Enterprise</span> · updated 2026-10',
    'crumb': '<a href="datacenter-solutions.html">DC Solutions</a> → Checklist → TIA-942',
    'res_basis': 'score = Σ category % · weight / Σ weights',
    'manual': ('manual/tia-942-checklist.html', 'Technical manual and methodology'),
    'full_title': 'Full analysis',
    'full_desc': 'tier radar, Monte Carlo range, gap analysis, score by tier, remediation roadmap and sensitivity',
    'formulas': [
        ('Category score', 'Σ w (checked) / Σ w (applicable) · 100, w = 1 to 3'),
        ('Overall', 'Σ (category score · category weight) / Σ category weights'),
        ('Category weight', 'electrical 1.5, mechanical 1.3, fire 1.1, site 1.0, telecom 1.0, security 0.9'),
        ('Risk index', 'overall · (1 − min(0.15, σ of category scores / 200))'),
        ('Maturity', 'L2 at risk index ≥ 40, L3 ≥ 60, L4 ≥ 80, L5 ≥ 95'),
        ('Grade', 'A+ ≥ 95, A ≥ 85, B ≥ 75, C ≥ 65, D ≥ 50, else F'),
        ('Monte Carlo', '10,000 runs, each item weight · U(0.85, 1.15)'),
    ],
    'against': ['ANSI/TIA-942-C (2024)', 'Uptime Institute Tier Classification', 'ANSI/BICSI 002-2024',
                'clause numbers follow TIA-942-B and are indicative'],
    'links': [('glossary.html', 'Glossary'), ('tier-advisor.html', 'Tier advisor'), ('capex-calculator.html', 'CAPEX calculator'),
              ('pue-calculator.html', 'PUE calculator'), ('datacenter-solutions.html', 'DC Solutions'), ('account.html', 'My account and saved scenarios')],
    'shell': [
        ('<section class="charts-section">', '<section class="charts-section wrap">'),
        ('<section class="charts-section">', '<section class="charts-section wrap">'),
    ],
    'series_primary': '10b981',
    'pdf_ink': dict(PDF_INK, **{'#10b981': '#8A5A00', '#065f46': '#111827', '#059669': '#8A5A00'}),
    'toolbar': toolbar, 'pre_clean': pre_clean, 'results': results, 'js': js,
}
