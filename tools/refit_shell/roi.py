"""roi-calculator.html: strings and the page-specific hooks.

Refit IN PLACE (stays on tools/apply-tool-register.py's list, keeps html[data-rz-register="tool"]). The page predates the
template's comment anchors, so pre() renames them (and adds the empty independence block step_disclaimers expects).
DOM order the inline JS depends on is kept: `.input-section:nth-child(4) .preset-btn` (the occupancy ramp is the 4th
child of the input panel) and setPreset's `bar.nextElementSibling === input` (each preset bar sits right before its field).
"""
import re

from .shell import balanced, js_replace, js_swap_between


def pre(src):
    for old, new in (('<!-- ═══ NAVBAR ═══ -->', '<!-- Navigation -->'), ('<!-- ═══ HERO ═══ -->', '<!-- Hero -->'),
                     ('<!-- ═══ FOOTER ═══ -->', '<!-- Footer -->'), ('<!-- ═══ SCROLL TO TOP ═══ -->', '<!-- Scroll to Top -->'),
                     ('<!-- Calculator Disclaimer -->', '<!-- Independence Disclaimer -->\n    <div></div>\n    <!-- Calculator Disclaimer -->')):
        assert src.count(old) == 1, old
        src = src.replace(old, new)
    return src


# ---------------------------------------------------------------- 4 toolbar
def toolbar(s, cfg):
    """Free | Full segment, Reset, Export PDF, Export CSV, Save (same ids and handlers as before)"""
    t0 = s.index('<!-- ═══ TOOLBAR ═══ -->')
    v = s.index('<div class="rz-calc-validation" id="roiValidation"', t0)
    t1 = s.index('</div>', v) + 6
    bar = '''<div class="wrap">
        <div class="tool-bar" role="toolbar" aria-label="Mode and actions">
            <div class="seg" role="group" aria-label="Assessment depth">
                <button class="roi-toolbar-btn roi-btn-free active" id="btnFreeMode" onclick="setMode('free')">Free</button>
                <button class="roi-toolbar-btn roi-btn-pro locked-hint" id="btnProMode" onclick="setMode('pro')">Full</button>
            </div>
            <span class="roi-mode-indicator free-active" id="modeIndicator" hidden>FREE MODE</span>
            <span class="spacer"></span>
            <button class="tool-btn roi-btn-reset" onclick="resetDefaults()">Reset</button>
            <button class="tool-btn roi-btn-pdf disabled" id="btnExportPDF" onclick="exportPDF()">Export PDF</button>
            <button class="tool-btn roi-btn-pdf" id="btnExportCSV" onclick="exportRoiCSV()">Export CSV</button>
            <button class="tool-btn" id="btnSaveAccount" onclick="rzScenario&&rzScenario.saveToAccount('roi',{msgEl:'acctSaveMsg'})">Save</button>
        </div>
        <p class="tool-msg" id="acctSaveMsg" style="display:none;"></p>
        <div class="rz-calc-validation tool-valid" id="roiValidation" role="alert" aria-live="polite" hidden></div>
        </div>'''
    return s[:t0] + bar + s[t1:]


# ---------------------------------------------------------------- inputs (before the inline-style strip)
def pre_clean(main, cfg):
    main, n = re.subn(r'<div class="section-header"[^>]*>\s*<i[^>]*></i>\s*(.*?)\s*</div>',
                      lambda m: '<div class="section-header"><span class="section-title">%s</span></div>' % m.group(1).replace('&amp;', 'and'), main)
    assert n == 6, n
    main = main.replace('<div class="preset-bar">', '<div class="preset-bar preset-row">')
    # a tier word from a site-wide rename landed on a tariff preset
    assert main.count('$0.20 Full access</button>') == 1
    main = main.replace('$0.20 Full access</button>', '$0.20 Very high</button>')
    return main


# ---------------------------------------------------------------- 5 results (after the strip)
def _tip(m):
    return '<span class="tooltip-trigger">?<span class="tooltip-content">%s</span></span>' % m.group(1)


METRICS = [('metIRR', 'IRR'), ('metPayback', 'Payback, years'), ('metPI', 'Profitability index'), ('metROIC', 'ROIC'),
           ('metRevenue', 'Peak revenue'), ('metNOI', 'Peak NOI'), ('metYield', 'Yield on cost'), ('metTerminal', 'Terminal value')]


def results(main, cfg):
    a = main.index('<div class="results-panel">')
    e = balanced(main, a)
    p = main[a:e]
    rows = []
    for vid, label in METRICS:
        m = re.search(r'<div class="metric-value" id="%s">--</div><div class="metric-label">[^<]*<span class="tip" tabindex="0" data-tip="([^"]*)"[^>]*>[^<]*</span>' % vid, p)
        assert m, vid
        rows.append('<div class="metric-box"><div class="metric-label">%s %s</div><div class="metric-value" id="%s">--</div></div>' % (label, _tip(m), vid))
    new = '''<div class="results-panel tool-results">
                <div class="res-head"><h2>Results</h2><span class="basis">%(res_basis)s</span></div>
                <div class="res-group"><h3>Headline</h3><div data-rz-fact-list>
                    <div class="metric-box is-key"><div class="metric-label" id="primaryLabel">Net present value</div><div class="metric-value" id="primaryValue">$0</div><div class="metric-sub"><span id="primaryUnit" hidden>NPV ($M)</span><span class="state" id="scoreGrade"><span id="gradeText">--</span></span></div></div>
                </div></div>
                <div class="res-group"><h3>Returns and income</h3><div class="metric-grid" id="metricGrid" data-rz-fact-list>
                    %(rows)s
                </div></div>
                <figure class="fig res-fig chart-card" data-rz-series-meaning><div class="chart-container"><canvas id="cashflowChart" width="400" height="300"></canvas></div><figcaption><b>FIG. 1</b> · Net cashflow per year (grey bars, red = a negative year) and cumulative cashflow (amber line), USD M · computed from the inputs above</figcaption></figure>
                <figure class="fig res-fig chart-card"><div class="chart-container"><canvas id="revenueChart" width="400" height="250"></canvas></div><figcaption><b>FIG. 2</b> · Revenue (amber) against OPEX (grey) per year, USD M · computed from the inputs above</figcaption></figure>
            </div>''' % dict(cfg, rows='\n                    '.join(rows))
    main = main[:a] + new + main[e:]
    # pro panels: one framed panel each, KPI cards -> a fact list, canvases -> captioned figures
    g = main.index('<div class="charts-grid">', main.index('id="proPanelsSection"'))
    ge = balanced(main, g)
    main = main[:g] + PRO + main[ge:]
    return main


PRO = '''<div class="charts-grid">
            <div class="roi-pro-panel" id="panelMonteCarlo"><h2 class="pro-h">Monte Carlo NPV distribution</h2>
                <div id="mcKpiGrid" data-rz-fact-list>
                    <div class="metric-box"><div class="metric-label">P5, best</div><div class="metric-value" id="mcP5">--</div></div>
                    <div class="metric-box"><div class="metric-label">P50, median</div><div class="metric-value" id="mcP50">--</div></div>
                    <div class="metric-box"><div class="metric-label">P95, worst</div><div class="metric-value" id="mcP95">--</div></div>
                    <div class="metric-box"><div class="metric-label">Probability NPV &gt; 0</div><div class="metric-value" id="mcProbPositive">--</div></div>
                </div>
                <figure class="fig res-fig chart-card" data-rz-series-meaning><div class="chart-container"><canvas id="histogramChart" width="600" height="280"></canvas></div><figcaption><b>FIG. 3</b> · NPV over 10,000 Monte Carlo runs · red bins = NPV below zero · RZEngine sim</figcaption></figure>
            </div>
            <div class="roi-pro-panel" id="panelTornado"><h2 class="pro-h">Sensitivity</h2>
                <figure class="fig res-fig chart-card"><div class="chart-container"><canvas id="tornadoChart" width="600" height="350"></canvas></div><figcaption><b>FIG. 4</b> · NPV swing per driver, USD M · the largest driver in amber</figcaption></figure>
            </div>
            <div class="roi-pro-panel" id="panelScenarios"><h2 class="pro-h">Scenarios</h2>
                <div id="scenarioResults"></div>
            </div>
            <div class="roi-pro-panel" id="panelCashflow"><h2 class="pro-h">Year-by-year cashflow</h2>
                <div class="tbl-wrap" id="cashflowTableWrap"></div>
                <div class="roi-narrative" id="narrativeBox">
                    <p><b>Summary.</b> Complete the calculation to generate the investment narrative.</p>
                </div>
            </div>
        </div>'''


# ---------------------------------------------------------------- inline JS
AMBER = 'rgb(212,154,42)'   # written as rgb(): the series palette step maps only quoted 6-digit hex
SCEN_JS = r"""var html = '<div data-rz-fact-list>';
        scenarios.forEach(function(s) {
            var scenNPV = baseNPV * s.npvMult;
            var scenIRR = baseIRR * s.irrMult;
            html += '<div class="metric-box"><div class="metric-label">' + s.name + '</div><div class="metric-value">' + (scenNPV >= 0 ? '$' : '-$') + Math.abs(scenNPV / 1e6).toFixed(1) + 'M</div><div class="metric-sub">IRR ' + (scenIRR * 100).toFixed(1) + '%</div></div>';
        });
        html += '</div>';
        """


def js(s, cfg):
    s = js_replace(s, [
        # the grade is a state word; the headline figure is the one amber mark (CSS), not green / red
        ("""        document.getElementById('primaryValue').style.color = npv >= 0 ? '#10b981' : '#ef4444';
        document.getElementById('scoreGrade').style.background = ratingColor + '18';
        document.getElementById('scoreGrade').style.color = ratingColor;
""", """        document.getElementById('scoreGrade').setAttribute('data-state', irr > 0.08 ? 'ok' : irr > 0.04 ? 'watch' : 'hazard');
"""),
        # FIG. 1: net cashflow grey bars (a red bar for a negative year), cumulative line amber
        ("return v >= 0 ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)';", "return v >= 0 ? 'rgba(125,135,148,0.75)' : 'rgba(220,38,38,0.7)';"),
        ("backgroundColor: 'rgba(59,130,246,0.1)',", "backgroundColor: 'rgba(212,154,42,0.08)',"),
        # FIG. 2: revenue amber, OPEX grey
        ("backgroundColor: 'rgba(59,130,246,0.5)', borderRadius: 4 },", "backgroundColor: 'rgba(212,154,42,0.6)', borderRadius: 0 },"),
        ("backgroundColor: 'rgba(245,158,11,0.5)', borderRadius: 4 }", "backgroundColor: 'rgba(125,135,148,0.6)', borderRadius: 0 }"),
        # FIG. 3: positive bins amber, negative bins red (the caption names the meaning)
        ("return 'rgba(59,130,246,0.4)';", "return 'rgba(212,154,42,0.55)';"),
        ("data: { labels: labels, datasets: [{ data: counts, backgroundColor: colors, borderRadius: 2 }] },", "data: { labels: labels, datasets: [{ data: counts, backgroundColor: colors, borderRadius: 0 }] },"),
        ("                    borderRadius: 4\n                }]\n            },\n            options: { indexAxis: 'y'", "                    borderRadius: 0\n                }]\n            },\n            options: { indexAxis: 'y'"),
        ("options: { responsive: true, interaction: { intersect: false },", "options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { intersect: false },"),
        ("options: { indexAxis: 'y', responsive: true,", "options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,"),
        # FIG. 4: the largest driver amber, the rest grey
        ("backgroundColor: sorted.map(function(s, i) { return i < 2 ? '#ef4444' : i < 4 ? '#f59e0b' : '#3b82f6'; }),",
         "backgroundColor: sorted.map(function(s, i) { return i === 0 ? '%s' : '#7D8794'; })," % AMBER),
        # both result charts fill their figure (a fixed-height container) and are rebuilt on every keystroke: no re-animation
        ("                responsive: true, maintainAspectRatio: true,\n", "                responsive: true, maintainAspectRatio: false, animation: false,\n"),
        ("            options: {\n                responsive: true,\n                interaction: { mode: 'index', intersect: false },", "            options: {\n                responsive: true, maintainAspectRatio: false, animation: false,\n                interaction: { mode: 'index', intersect: false },"),
    ])
    s = js_swap_between(s, """var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">';""", "document.getElementById('scenarioResults').innerHTML = html;", SCEN_JS)
    s = s.replace("html += '<p><strong>Investment Summary:</strong> ", "html += '<p><b>Investment summary.</b> ", 1)
    s = s.replace("html += '<p><strong>Return Analysis:</strong> ", "html += '<p><b>Returns.</b> ", 1)
    s = s.replace("html += '<p><strong>Risk Factors:</strong> ", "html += '<p><b>Risk.</b> ", 1)
    return s


def post(s):
    return s


CONFIG = {
    'keep_register': True,
    'pre': pre,
    'eyebrow': 'DC Solutions · <b>Calculator</b> · ROI',
    'h1': 'Data center investment return <span class="muted">NPV, IRR and payback from a cashflow model</span>',
    'lede': 'Net present value, IRR, payback, profitability index and a year-by-year cashflow from CAPEX, IT capacity, revenue '
            'per kW, operating costs, the occupancy ramp, financing and tax. Computed in your browser; every figure follows the inputs.',
    'basis': 'model discounted cashflow, IRR by Newton-Raphson · basis Uptime Institute, JLL, CBRE benchmarks · updated 2026-10',
    'crumb': '<a href="datacenter-solutions.html">DC Solutions</a> → Calculator → ROI',
    'res_basis': 'NPV = Σ CF_t / (1 + WACC)^t − CAPEX',
    'manual': ('manual/roi.html', 'Technical manual and methodology'),
    'full_title': 'Full analysis',
    'full_desc': 'Monte Carlo NPV distribution, sensitivity, scenarios, the year-by-year cashflow table and the PDF report',
    'formulas': [
        ('Revenue_t', 'P_IT · occupancy_t · revenue per kW · 12 · (1 + escalation)^t · (1 + ancillary)'),
        ('OPEX_t', '(energy + staffing + maintenance + insurance) · (1 + OPEX escalation)^t'),
        ('Energy_t', 'P_IT · occupancy_t · PUE · 8,760 h · tariff'),
        ('NOI_t', 'Revenue_t − OPEX_t'),
        ('CF_t', 'NOI_t − debt service_t − tax_t (+ terminal value in the last year)'),
        ('NPV', 'Σ CF_t / (1 + WACC)^t − equity'),
        ('IRR', 'rate r where Σ CF_t / (1 + r)^t = 0, Newton-Raphson'),
        ('PI', '1 + NPV / CAPEX'),
        ('Terminal value', 'NOI_final / exit cap rate'),
    ],
    'against': ['Uptime Institute', 'JLL Data Center Outlook', 'CBRE data center benchmarks', 'discounted cashflow practice'],
    'links': [('glossary.html', 'Glossary'), ('capex-calculator.html', 'CAPEX calculator'), ('opex-calculator.html', 'OPEX calculator'),
              ('tco-calculator.html', 'TCO calculator'), ('datacenter-solutions.html', 'DC Solutions'), ('account.html', 'My account and saved scenarios')],
    'hero_drop': [r'\s*<!-- ═══ PRIVACY BADGE \+ BENCHMARK META ═══ -->.*?(?=\s*</main>)'],
    'shell': [
        ('<section class="calculator-section">', '<section class="calculator-section wrap">'),
        ('<div class="calculator-grid">', '<div class="calculator-grid tool-bench">'),
        ('<div class="input-panel">', '<div class="input-panel tool-inputs">'),
        ('<section class="charts-section pro-section locked" id="proPanelsSection"', '<section class="charts-section pro-section locked wrap" id="proPanelsSection"'),
    ],
    'series_primary': '3b82f6',
    'toolbar': toolbar, 'pre_clean': pre_clean, 'results': results, 'js': js, 'post': post,
}
