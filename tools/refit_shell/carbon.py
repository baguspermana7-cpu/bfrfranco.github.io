"""carbon-footprint.html: strings and the page-specific hooks.

Refit IN PLACE; the page stays on tools/apply-tool-register.py's list (keep_register). Its markup predates the template
comments the shell anchors on, so `pre` renames them (NAVBAR, HERO, FOOTER, SCROLL TO TOP) and gives step_disclaimers the
empty Independence block it expects; the duplicate chart.js tag goes. The three scope tabs (Operational, Life-cycle,
Carbon budget) become a .tool-tabs row under the bar; the bar keeps Free | Full, Reset, Export PDF, Export CSV, Save.
Results and the four Full panels are rebuilt as fact lists with every JS-bound id kept; chart colours are amber + greys.
"""
import re

from .shell import PDF_INK, balanced, js_replace

AMBER = 'rgb(212, 154, 42)'   # SERIES_AMBER written as rgb() so shell.series_palette (hex only) leaves it alone
G = ['#7D8794', '#A0AEC0', '#5E6673', '#C9CFD8', '#4A5160', '#8C96A3']   # shell.SERIES_GREYS


# ---------------------------------------------------------------- pre: onto the template anchors
def pre(src):
    s = src
    for old, new in (('<!-- ═══ NAVBAR ═══ -->', '<!-- Navigation -->'), ('<!-- ═══ HERO ═══ -->', '<!-- Hero -->'),
                     ('<!-- ═══ FOOTER ═══ -->', '<!-- Footer -->'), ('<!-- ═══ SCROLL TO TOP ═══ -->', '<!-- Scroll to Top -->'),
                     ('<!-- Calculator Disclaimer -->', '<!-- Independence Disclaimer -->\n    <div></div>\n    <!-- Calculator Disclaimer -->')):
        assert s.count(old) == 1, old
        s = s.replace(old, new)
    # chart.js was loaded twice (head + body); the head copy stays
    tag = re.compile(r'\n\s*<script src="https://cdn\.jsdelivr\.net/npm/chart\.js@[^"]*"[^>]*></script>')
    body = s.index('<body')
    m = tag.search(s, body)
    assert m and tag.search(s, 0).start() < body
    return s[:m.start()] + s[m.end():]


# ---------------------------------------------------------------- 4 toolbar
def toolbar(s, cfg):
    """Free | Full segment, Reset, Export PDF, Export CSV, Save (6 controls); the scope tabs sit under it as .tool-tabs"""
    save = re.search(r'id="btnSaveAccount" onclick="([^"]*)"', s).group(1)
    a = s.index('<!-- ═══ TAB BAR ═══ -->')
    v = s.index('<div class="rz-calc-validation" id="carbonValidation"', a)
    e = s.index('</div>', v) + 6
    bar = '''<div class="wrap">
        <div class="tool-bar" role="toolbar" aria-label="Mode and actions">
            <div class="seg" role="group" aria-label="Assessment depth">
                <button type="button" class="cf-toolbar-btn cf-btn-free active" id="btnFreeMode" aria-pressed="true" onclick="setMode('free')">Free</button>
                <button type="button" class="cf-toolbar-btn cf-btn-pro locked-hint" id="btnProMode" aria-pressed="false" onclick="setMode('pro')">Full</button>
            </div>
            <span class="cf-mode-indicator free-active" id="modeIndicator" hidden>FREE MODE</span>
            <span class="spacer"></span>
            <button type="button" class="tool-btn cf-btn-reset" onclick="resetDefaults()">Reset</button>
            <button type="button" class="tool-btn cf-btn-pdf disabled" id="btnExportPDF" onclick="exportPDF()">Export PDF</button>
            <button type="button" class="tool-btn" id="btnExportCSV" onclick="exportCarbonCSV()">Export CSV</button>
            <button type="button" class="tool-btn" id="btnSaveAccount" onclick="%s">Save</button>
        </div>
        <p class="tool-msg" id="acctSaveMsg" style="display:none;"></p>
        <div class="tool-tabs cf-tab-bar" role="tablist" aria-label="Assessment scope">
            <button type="button" role="tab" class="cf-tab-btn active" data-tab="operational" aria-selected="true" onclick="switchTab('operational')">Operational</button>
            <button type="button" role="tab" class="cf-tab-btn" data-tab="lifecycle" aria-selected="false" onclick="switchTab('lifecycle')">Life-cycle</button>
            <button type="button" role="tab" class="cf-tab-btn" data-tab="budget" aria-selected="false" onclick="switchTab('budget')">Carbon budget</button>
        </div>
        <div class="rz-calc-validation tool-valid" id="carbonValidation" role="alert" aria-live="polite" hidden></div>
    </div>''' % save
    return s[:a] + bar + s[e:]


# ---------------------------------------------------------------- inputs (before the inline-style strip)
def pre_clean(main, cfg):
    main, n = re.subn(r'<div style="font-size:0\.78rem;color:#94a3b8;[^"]*">\s*<i [^>]*></i>\s*(.*?)\s*</div>',
                      lambda m: '<p class="in-note">%s</p>' % m.group(1).replace('100%', '100 %'), main, flags=re.S)
    assert n == 1, n
    main, n = re.subn(r'<div style="display:flex;align-items:center;gap:0\.5rem;padding:0\.75rem;[^"]*">\s*<i [^>]*></i>\s*'
                      r'Same as Location &amp; Grid tab &mdash; (<strong id="budgetCountryName">[^<]*</strong>)\s*</div>',
                      r'<p class="in-note">Country as set on the Operational tab: \1</p>', main)
    assert n == 1, n
    return main


# ---------------------------------------------------------------- 5 results (after the strip)
def _tip(t):
    return '<span class="tooltip-trigger">?<span class="tooltip-content">%s</span></span>' % t


def results(main, cfg):
    rows = re.findall(r'<div class="metric-box"><div class="metric-value" id="(\w+)">--</div><div class="metric-label">(.*?) '
                      r'<span class="tip" tabindex="0" data-tip="([^"]*)"[^>]*>ⓘ</span></div></div>', main)
    assert len(rows) == 8, len(rows)
    facts = '\n'.join('                        <div class="metric-box"><div class="metric-value" id="%s">--</div>'
                      '<div class="metric-label">%s%s</div></div>' % (i, lbl, _tip(t)) for i, lbl, t in rows)
    a = main.index('<div class="results-panel tool-results">')
    e = balanced(main, a)
    res = '''<div class="results-panel tool-results">
                    <div class="res-head"><h2>Results</h2><span class="basis">%(res_basis)s</span></div>
                    <div class="res-group"><h3>Headline</h3><div data-rz-fact-list id="resultsDisplay">
                        <div class="metric-box is-key"><div class="metric-label" id="primaryLabel">Annual carbon emissions</div><div class="metric-value" id="primaryValue">0</div><div class="metric-sub"><span id="primaryUnit">tCO&#8322;e/yr</span> · <span class="state" id="scoreGrade"><span id="gradeText">--</span></span></div></div>
                    </div></div>
                    <div class="res-group"><h3>Detail</h3><div class="metric-grid" id="metricGrid" data-rz-fact-list>
%(facts)s
                    </div></div>
                    <figure class="fig res-fig"><div class="chart-container"><canvas id="scopeChart" role="img" aria-label="Emissions split for the selected tab"></canvas></div><figcaption><b>FIG. 1</b> · <span id="figScopeCap">Emissions by GHG Protocol scope, tCO&#8322;e/yr</span></figcaption></figure>
                    <figure class="fig res-fig"><div class="chart-container"><canvas id="comparisonChart" role="img" aria-label="Comparison for the selected tab"></canvas></div><figcaption><b>FIG. 2</b> · <span id="figCmpCap">Your facility against the industry average (0.475 kgCO&#8322;/kWh) and best practice (30 %% of it), tCO&#8322;e/yr</span></figcaption></figure>
                </div>''' % dict(cfg, facts=facts)
    main = main[:a] + res + main[e:]

    g = main.index('<div class="charts-grid">', main.index('id="proPanelsSection"'))
    ge = balanced(main, g)
    return main[:g] + PRO_PANELS + main[ge:]


PRO_PANELS = '''<div class="charts-grid">
            <div class="cf-pro-panel tool-results" id="panelMonteCarlo">
                <div class="res-head"><h2>Emissions uncertainty</h2><span class="basis">10,000 Monte Carlo runs</span></div>
                <div class="res-group"><div data-rz-fact-list id="mcKpiGrid">
                    <div class="metric-box"><div class="metric-label">P5, low case</div><div class="metric-value" id="mcP5">--</div><div class="metric-sub">tCO&#8322;e/yr</div></div>
                    <div class="metric-box is-key"><div class="metric-label">P50, median</div><div class="metric-value" id="mcP50">--</div><div class="metric-sub">tCO&#8322;e/yr</div></div>
                    <div class="metric-box"><div class="metric-label">P95, high case</div><div class="metric-value" id="mcP95">--</div><div class="metric-sub">tCO&#8322;e/yr</div></div>
                    <div class="metric-box"><div class="metric-label">Standard deviation</div><div class="metric-value" id="mcStdDev">--</div><div class="metric-sub">tCO&#8322;e/yr</div></div>
                </div></div>
                <figure class="fig res-fig"><div class="chart-container"><canvas id="histogramChart" role="img" aria-label="Distribution of annual emissions over 10,000 runs"></canvas></div><figcaption><b>FIG. 3</b> · Annual emissions over 10,000 runs · PUE ±10 %, grid factor ±15 %, generator hours ±30 % · amber = above P95</figcaption></figure>
            </div>
            <div class="cf-pro-panel tool-results" id="panelTornado">
                <div class="res-head"><h2>Sensitivity</h2><span class="basis">each input ±20 %, the others at base</span></div>
                <figure class="fig res-fig"><div class="chart-container"><canvas id="tornadoChart" role="img" aria-label="Swing in annual emissions per input"></canvas></div><figcaption><b>FIG. 4</b> · Swing in annual emissions per input, tCO&#8322;e · amber = the largest driver</figcaption></figure>
            </div>
            <div class="cf-pro-panel tool-results" id="panelScenarios">
                <div class="res-head"><h2>Reduction path</h2><span class="basis">measures applied in order, cumulative</span></div>
                <div class="res-group"><div id="scenarioResults" data-rz-fact-list></div></div>
                <figure class="fig res-fig"><div class="chart-container"><canvas id="scenarioChart" role="img" aria-label="Remaining annual emissions after each measure"></canvas></div><figcaption><b>FIG. 5</b> · Remaining annual emissions after each measure, tCO&#8322;e/yr</figcaption></figure>
            </div>
            <div class="cf-pro-panel tool-results" id="panelCompliance">
                <div class="res-head"><h2>Cost and compliance</h2><span class="basis">offset $35/t · EU ETS $65/t</span></div>
                <div class="res-group"><div data-rz-fact-list id="complianceKpiGrid">
                    <div class="metric-box"><div class="metric-label">Offset cost per year</div><div class="metric-value" id="compOffset">--</div></div>
                    <div class="metric-box is-key"><div class="metric-label">EU ETS exposure per year</div><div class="metric-value" id="compTax">--</div></div>
                    <div class="metric-box"><div class="metric-label">CBAM risk</div><div class="metric-value" id="compCBAM">--</div></div>
                    <div class="metric-box"><div class="metric-label">SEC / CSRD reporting gaps</div><div class="metric-value" id="compSEC">--</div></div>
                </div></div>
                <div class="cf-narrative" id="narrativeBox"><p><strong>Assessment.</strong> Change any input to write the assessment.</p></div>
            </div>
        </div>'''


# ---------------------------------------------------------------- inline JS
SCENARIO_HTML = r"""var html = '';
        var cumReduction = 0;
        scenarios.forEach(function(s, i) {
            cumReduction += s.reduction;
            var remaining = Math.max(0, baseEmissions - cumReduction);
            html += '<div class="metric-box' + (i === scenarios.length - 1 ? ' is-key' : '') + '"><div class="metric-label">' + s.name + '</div><div class="metric-value">' + Math.round(remaining).toLocaleString() + '<small>tCO₂e/yr</small></div></div>';
        });
        document.getElementById('scenarioResults').innerHTML = html;"""
CAPTIONS = r"""var _cap = {
            operational: ['Emissions by GHG Protocol scope, tCO₂e/yr', 'Your facility against the industry average (0.475 kgCO₂/kWh) and best practice (30 % of it), tCO₂e/yr'],
            lifecycle: ['Embodied carbon by source over the project life, tCO₂e', 'Embodied carbon by EN 15978 stage, tCO₂e (D = recycling credit)'],
            budget: ['Workload allocation, share of IT load', 'Renewable share on a straight line to the net-zero year']
        }[currentTab];
        if (_cap) { document.getElementById('figScopeCap').textContent = _cap[0]; document.getElementById('figCmpCap').textContent = _cap[1]; }
        if (window.Chart && !updateCharts._styled) { Chart.defaults.color = '#8C96A3'; Chart.defaults.borderColor = 'rgba(140,150,163,0.18)'; Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif"; updateCharts._styled = true; }
        // Scope/LCA Donut Chart"""


def js(s, cfg):
    A, g = "'%s'" % AMBER, ["'%s'" % c for c in G]
    s = js_replace(s, [
        # Free | Full and the tabs report their state
        ("""            btnFree.classList.add('active');
            btnPro.classList.remove('active');""", """            btnFree.classList.add('active');
            btnPro.classList.remove('active');
            btnFree.setAttribute('aria-pressed', 'true'); btnPro.setAttribute('aria-pressed', 'false');"""),
        ("""            btnPro.classList.add('active');
            btnFree.classList.remove('active');""", """            btnPro.classList.add('active');
            btnFree.classList.remove('active');
            btnPro.setAttribute('aria-pressed', 'true'); btnFree.setAttribute('aria-pressed', 'false');"""),
        ("btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);",
         "btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);\n            btn.setAttribute('aria-selected', btn.getAttribute('data-tab') === tab ? 'true' : 'false');"),
        # the grade is a state word, not a painted figure
        ("""            document.getElementById('primaryValue').style.color = ratingColor;
            document.getElementById('scoreGrade').style.background = ratingColor + '18';
            document.getElementById('scoreGrade').style.color = ratingColor;""",
         """            document.getElementById('scoreGrade').setAttribute('data-state', /^[EF]/.test(rating) ? 'hazard' : /^[CD]/.test(rating) ? 'watch' : 'ok');"""),
        ("document.getElementById('primaryLabel').textContent = 'Annual Carbon Emissions';", "document.getElementById('primaryLabel').textContent = 'Annual carbon emissions';"),
        ("document.getElementById('primaryLabel').textContent = 'Life-Cycle Embodied Carbon';", "document.getElementById('primaryLabel').textContent = 'Life-cycle embodied carbon';"),
        ("document.getElementById('primaryLabel').textContent = 'Allocated Carbon Budget';", "document.getElementById('primaryLabel').textContent = 'Allocated carbon budget';"),
        ("""                bar.style.background = 'rgba(34,197,94,0.1)';
                bar.style.color = '#22c55e';""", """                bar.setAttribute('data-state', 'ok');"""),
        ("""                bar.style.background = 'rgba(239,68,68,0.1)';
                bar.style.color = '#ef4444';""", """                bar.setAttribute('data-state', 'hazard');"""),
        # charts: one amber series, greys for the rest; no rounded bars, no white ring, sized by the figure
        ("        // Scope/LCA Donut Chart", CAPTIONS),
        ("chartColors = ['#ef4444', '#3b82f6', '#f59e0b'];", "chartColors = [%s, %s, %s];" % (g[0], A, g[1])),
        ("chartColors = ['#64748b', '#0e7490', '#64748b', '#0891b2', '#6b7280', '#ef4444', '#22c55e'];", "chartColors = [%s, %s];" % (A, ', '.join(g))),
        ("chartColors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#64748b'];", "chartColors = [%s, %s];" % (A, ', '.join(g[:4]))),
        ("backgroundColor: chartColors, borderWidth: 2, borderColor: '#ffffff' }] },", "backgroundColor: chartColors, borderWidth: 0 }] },"),
        ("interaction:{intersect:false}, maintainAspectRatio: true,", "interaction:{intersect:false}, maintainAspectRatio: false,"),
        ("backgroundColor: ['#22c55e', '#94a3b8', '#06b6d4'], borderRadius: 6", "backgroundColor: [%s, %s, %s], borderRadius: 0" % (A, g[0], g[1])),
        ("backgroundColor: ['#64748b', '#0e7490', '#6b7280', '#ef4444', '#22c55e'], borderRadius: 6", "backgroundColor: [%s, %s], borderRadius: 0" % (A, ', '.join(g[:4]))),
        ("borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true,", "borderColor: %s, backgroundColor: 'rgba(212,154,42,0.08)', fill: true," % A),
        ("""            if (v < p5) return 'rgba(34,197,94,0.6)';
            if (v > p95) return 'rgba(239,68,68,0.6)';
            return 'rgba(34,197,94,0.3)';""", """            if (v > p95) return %s;
            return v < p5 ? 'rgba(125,135,148,0.85)' : 'rgba(125,135,148,0.5)';""" % A),
        ("backgroundColor: sorted.map(function(s, i) { return i < 2 ? '#ef4444' : i < 4 ? '#f59e0b' : '#22c55e'; }),",
         "backgroundColor: sorted.map(function(s, i) { return i === 0 ? %s : %s; })," % (A, g[0])),
        ("datasets: [{ data: values, backgroundColor: scenarios.map(function(s) { return s.color; }), borderRadius: 6 }]",
         "datasets: [{ data: values, backgroundColor: values.map(function(v, i) { return i === values.length - 1 ? %s : %s; }), borderRadius: 0 }]" % (A, g[0])),
        ("{ name: 'Current State', reduction: 0,", "{ name: 'Current state', reduction: 0,"),
        ("{ name: '+ Solar PV (30%)',", "{ name: '+ Solar PV, 30 % of Scope 2',"),
        ("{ name: '+ Liquid Cooling',", "{ name: '+ Liquid cooling, 8 %',"),
        ("{ name: '+ 100% PPA',", "{ name: '+ 100 % PPA, 95 % of Scope 2',"),
        ("{ name: '+ Low-carbon Materials',", "{ name: '+ Low-carbon materials, 5 %',"),
        # the input tooltips are CSS (css/rz-tool.css): no fixed white panel appended to <body>
        ("        initTooltipSystem();\n", ""),
    ])
    s = js_replace(s, [("options: { responsive: true, interaction:{mode:'index',intersect:false},", "options: { responsive: true, maintainAspectRatio: false, interaction:{mode:'index',intersect:false},"),
                       ("document.getElementById('primaryValue').style.color = '#22c55e';", "document.getElementById('scoreGrade').removeAttribute('data-state');"),
                       ("borderRadius: 4\n", "borderRadius: 0\n")], where='all')
    a = s.index("var html = '<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem;\">';")
    b = s.index("document.getElementById('scenarioResults').innerHTML = html;", a) + len("document.getElementById('scenarioResults').innerHTML = html;")
    s = s[:a] + SCENARIO_HTML + s[b:]
    return s


CONFIG = {
    'keep_register': True,
    'pre': pre,
    'eyebrow': 'DC Solutions · <b>Calculator</b> · Carbon',
    'h1': 'Data center carbon footprint <span class="muted">by scope and life cycle</span>',
    'lede': 'Annual Scope 1, 2 and 3 emissions from IT load, PUE, the country grid factor, refrigerant leakage, generator testing '
            'and renewable supply; embodied carbon over the project life; and a share of the national carbon budget. Computed in '
            'your browser; every figure follows the inputs.',
    'basis': 'model v1.0 · basis GHG Protocol, EN 15978, ICE v4.1, IEA 2026 and Ember grid factors · updated 2026-10',
    'crumb': '<a href="datacenter-solutions.html">DC Solutions</a> → Calculator → Carbon footprint',
    'res_basis': 'total = Scope 1 + Scope 2 + Scope 3',
    'manual': ('manual/carbon.html', 'Technical manual and methodology'),
    'full_title': 'Full analysis',
    'full_desc': 'Monte Carlo range, sensitivity, reduction path, carbon cost and compliance exposure',
    'formulas': [
        ('Scope 2', 'P_IT · PUE · 8,760 h · EF_grid · (1 − renewable share)'),
        ('Scope 1', 'P_IT · 0.3 L/kWh · test hours · EF_fuel + charge · leak rate · GWP'),
        ('Scope 3', '0.15 tCO₂e per kW IT per year (upstream estimate)'),
        ('Intensity', '(Scope 1 + 2 + 3) / (P_IT · 8,760 h), kgCO₂/kWh IT'),
        ('Embodied', 'A1–A3 materials + IT, battery and MEP + A4–A5 + C1–C4 − D recycling credit'),
        ('Budget per MW', 'national DC budget over the period / years / estimated national DC MW'),
        ('Carbon cost', 'total · $35/t offset; total · $65/t EU ETS'),
    ],
    'against': ['GHG Protocol Corporate Standard', 'IEA and EPA eGRID grid factors', 'EN 15978', 'ICE database v4.1',
                'IPCC AR4 GWP', 'SBTi', 'Paris Agreement 1.5 °C budget and NDCs'],
    'links': [('glossary.html', 'Glossary'), ('pue-calculator.html', 'PUE calculator'), ('capex-calculator.html', 'CAPEX calculator'),
              ('opex-calculator.html', 'OPEX calculator'), ('datacenter-solutions.html', 'DC Solutions'), ('account.html', 'My account and saved scenarios')],
    'hero_drop': [r'\s*<!-- ═══ PRIVACY BADGE \+ BENCHMARK META ═══ -->\s*<div style="[^"]*">\s*<div class="cf-privacy-badge">.*?</div>\s*'
                  r'<div class="cf-benchmark-meta">.*?</div>\s*</div>'],
    'shell': [
        ('<section class="calculator-section">', '<section class="calculator-section wrap">'),
        ('<div class="calculator-grid">', '<div class="calculator-grid tool-bench">'),
        ('<div class="input-panel">', '<div class="input-panel tool-inputs">'),
        ('<div class="results-panel">', '<div class="results-panel tool-results">'),
        ('<section class="charts-section pro-section locked" id="proPanelsSection"', '<section class="charts-section pro-section locked wrap" id="proPanelsSection"'),
    ],
    'series_primary': '22c55e',
    'pdf_ink': dict(PDF_INK, **{'#22c55e': '#8A5A00', '#16a34a': '#8A5A00', '#15803d': '#111827'}),
    'toolbar': toolbar, 'pre_clean': pre_clean, 'results': results, 'js': js,
}
