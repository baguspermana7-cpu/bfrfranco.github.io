"""tco-calculator.html: strings and the page-specific hooks.

Refit IN PLACE; the page stays on tools/apply-tool-register.py's list (keep_register). The page logic is its own inline
<script> (script.min.js is the shared site script: nav, scroll, contact form; nothing in it targets a tco- selector).
`pre` maps the page onto the template anchors (Navigation comment, section.hero, Footer, the disclaimer as an Independence
+ Calculator pair) and drops the page background, the brief, the floating manual link and the scroll-top button.
The Free / Full buttons keep class tco-mode-btn and data-mode (setMode() reads both) inside a .seg with aria-pressed; the
free tier sees the Full analysis as one .tool-full row (#tcoFreeWatermark, #tcoPremiumTabBtn = its Sign in button).
The page's own cookie-banner code (the shared js/rz-cookie-consent.js already runs) and scroll-top code go.
"""
import re

from .shell import PDF_INK, balanced, js_replace, js_swap_between

AMBER = 'rgb(212, 154, 42)'   # SERIES_AMBER as rgb() so shell.series_palette (hex only) leaves it alone
TICK = '#8C96A3'              # neutral grey that reads on both themes (the old labels were white on a forced-dark panel)


# ---------------------------------------------------------------- pre: onto the template anchors
def pre(src):
    s = src
    for old, new in (('<!-- ═══ Navigation ═══ -->', '<!-- Navigation -->'), ('<section class="tco-hero">', '<section class="hero">'),
                     ('<!-- ═══ Footer ═══ -->', '<!-- Footer -->'), ('    <div class="tco-page-background"></div>\n', '')):
        assert s.count(old) == 1, old
        s = s.replace(old, new)
    s, n = re.subn(r'\s*<!-- Scroll to Top -->\s*<button class="tco-scroll-top-btn" id="tcoScrollTopBtn".*?</button>', '', s, count=1, flags=re.S)
    assert n == 1
    # the disclaimer: one paragraph of text + three source/vintage/advice spans -> the template's Calculator Disclaimer pair
    a = s.index('<!-- Disclaimer -->')
    b = s.index('<div class="tco-disclaimer"', a)
    e = balanced(s, b)
    block = s[b:e]
    main_txt = re.search(r'<strong>Disclaimer:</strong>\s*(.*?)\s*<div', block, re.S).group(1)
    s = s[:a] + ('<!-- Independence Disclaimer -->\n        <div></div>\n        <!-- Calculator Disclaimer -->\n'
                 '        <div><p>%s</p><p>Data vintage: 2025–2026 market benchmarks. For investment decisions, consult a qualified data '
                 'center infrastructure advisor.</p></div>') % main_txt + s[e:]
    return s


# ---------------------------------------------------------------- 4 toolbar
def toolbar(s, cfg):
    """Free | Full segment (tco-mode-btn, data-mode kept), Export PDF, Export CSV, Save, Reset (6 controls)"""
    save = re.search(r'id="btnSaveAccount" class="tco-action-btn" onclick="([^"]*)"', s).group(1)
    a = s.index('<!-- Mode Tabs -->')
    e = s.index('<!-- Login handled by shared auth.js modal', a)
    bar = '''<div class="tool-bar" role="toolbar" aria-label="Mode and actions">
                <div class="seg" role="group" aria-label="Assessment depth" id="tcoModeTabs">
                    <button type="button" class="tco-mode-btn active" data-mode="free" aria-pressed="true" onclick="setMode('free')">Free</button>
                    <button type="button" class="tco-mode-btn" data-mode="pro" aria-pressed="false" onclick="setMode('pro')">Full</button>
                </div>
                <span id="tcoPremiumBadge" hidden></span>
                <span class="spacer"></span>
                <button type="button" class="tool-btn" id="tcoExportPdf" onclick="exportPDF()">Export PDF</button>
                <button type="button" class="tool-btn" onclick="exportTcoCSV()">Export CSV</button>
                <button type="button" class="tool-btn" id="btnSaveAccount" onclick="%s">Save</button>
                <button type="button" class="tool-btn" onclick="resetInputs()">Reset</button>
            </div>
            <p class="tool-msg" id="acctSaveMsg" style="display:none;"></p>

            ''' % save
    return s[:a] + bar + s[e:]


# ---------------------------------------------------------------- inputs (before the inline-style strip)
SNAPSHOT = [('snapshotBuild', 'Build cost'), ('snapshotColo', 'Colocation rate'), ('snapshotPower', 'Power rate'), ('snapshotStaff', 'Staff cost'),
            ('snapshotLand', 'Land cost'), ('snapshotCagr', 'Market growth'), ('snapshotTax', 'Corporate tax'), ('snapshotCurrency', 'Currency')]


def pre_clean(main, cfg):
    # Full inputs: a plain group heading, no FULL pill
    main, n = re.subn(r'<div class="tco-section-divider">\s*<div class="tco-section-heading">.*?</div>\s*</div>',
                      '<div class="section-header"><span class="section-title">Full analysis inputs</span></div>', main, count=1, flags=re.S)
    assert n == 1
    # region snapshot: a fact list and a captioned figure, no tile grid
    a = main.index('<div class="tco-region-snapshot" id="tcoRegionSnapshot">')
    e = balanced(main, a)
    rows = '\n'.join('                            <div class="metric-box"><div class="metric-label">%s</div><div class="metric-value" id="%s">--</div></div>' % (l, i)
                     for i, l in SNAPSHOT)
    main = main[:a] + '''<div class="tco-region-snapshot" id="tcoRegionSnapshot">
                        <div class="section-header"><span class="section-title"><span id="snapshotRegionName">N. Virginia</span> · market data</span></div>
                        <div class="kv-list" data-rz-fact-list>
%s
                        </div>
                        <figure class="fig tco-mkt-fig"><div class="tco-market-chart-body"><canvas id="tcoMarketChart" role="img" aria-label="Build, colocation and power rates indexed to year 1"></canvas></div><figcaption><b>FIG. 1</b> · Market rate outlook <span id="marketChartRegion"></span> · indexed to year 1 = 100</figcaption></figure>
                        <p class="in-note" id="snapshotProvenance"></p>
                        <p class="in-note" id="snapshotNote">Source: Turner &amp; Townsend DCCI 2025, CBRE H1 2025, IEA Electricity 2025</p>
                    </div>''' % rows + main[e:]
    # tornado legend: words, no red/green swatches
    main, n = re.subn(r'<div style="margin-top:1\.25rem;padding-top:1rem;border-top:[^"]*">\s*<span[^>]*><span[^>]*></span> Higher cost vs\. baseline</span>.*?</div>',
                      '<p class="res-fine">Left bar (amber): the ±20 % end that widens the cost gap between options. Right bar (grey): the end that narrows it.</p>',
                      main, count=1, flags=re.S)
    assert n == 1
    main, n = re.subn(r'<div style="[^"]*" id="tcoTornadoInsight">\s*<i [^>]*></i>\s*(.*?)\s*</div>',
                      r'<p class="tool-note" id="tcoTornadoInsight">\1</p>', main, count=1, flags=re.S)
    assert n == 1
    return main


# ---------------------------------------------------------------- 5 results (after the strip)
RESULTS = '''<div class="tco-simulator-results tool-results">
                    <div class="res-head"><h2>Results</h2><span class="basis">%(res_basis)s</span></div>
                    <p class="tool-note tco-where" id="tcoRegionIndicator"><span id="tcoRegionLabel">N. Virginia</span> · <span id="tcoRegionDetails">5 MW, 5 years, Tier III</span></p>
                    <div class="res-group"><h3>Headline</h3><div data-rz-fact-list>
                        <div class="metric-box is-key" id="kpiBestCard"><div class="metric-label" data-explain="tco-best-option">Lowest TCO</div><div class="metric-value" id="tcoBestValue">--</div><div class="metric-sub"><span id="kpiBestOption">--</span> · <span id="kpiBestSub"></span></div></div>
                    </div></div>
                    <div class="res-group"><h3>By option</h3><div id="tcoKpiGrid" data-rz-fact-list>
                        <div class="metric-box"><div class="metric-label" data-explain="tco-build-tco">Build TCO</div><div class="metric-value" id="kpiBuildTco">--</div><div class="metric-sub" id="kpiBuildSub"></div></div>
                        <div class="metric-box"><div class="metric-label" data-explain="tco-colo-tco">Colocation TCO</div><div class="metric-value" id="kpiColoTco">--</div><div class="metric-sub" id="kpiColoSub"></div></div>
                        <div class="metric-box"><div class="metric-label" data-explain="tco-cloud-tco">Cloud TCO</div><div class="metric-value" id="kpiCloudTco">--</div><div class="metric-sub" id="kpiCloudSub"></div></div>
                        <div class="metric-box"><div class="metric-label" data-explain="tco-build-capex">Build CAPEX</div><div class="metric-value" id="kpiBuildCapex">--</div><div class="metric-sub">initial investment</div></div>
                        <div class="metric-box"><div class="metric-label" data-explain="tco-yr-1-opex-build">Year 1 OPEX, build</div><div class="metric-value" id="kpiAnnualOpex">--</div><div class="metric-sub">annual operating cost</div></div>
                        <div class="metric-box"><div class="metric-label" data-explain="tco-cost-per-kw">Cost per kW</div><div class="metric-value" id="kpiCostPerKw">--</div><div class="metric-sub" id="kpiCostPerKwSub">lowest option, effective</div></div>
                        <div class="metric-box"><div class="metric-label" data-explain="tco-breakeven-year">Breakeven year</div><div class="metric-value" id="kpiBreakeven">--</div><div class="metric-sub">build against colocation</div></div>
                    </div></div>
                    <div class="res-group"><h3>Period total</h3><div id="tcoInlineBars"></div></div>
                    <figure class="fig res-fig"><div class="chart-container tco-chart-canvas-wrap"><canvas id="tcoStackedChart" role="img" aria-label="TCO by cost category for build, colocation and cloud"></canvas></div><figcaption><b>FIG. 2</b> · TCO by cost category over the period · amber = CAPEX or setup</figcaption></figure>
                    <p class="tool-note" id="tcoNarrative"><span id="tcoNarrativeText">Change any input to compare the options.</span></p>
                    <p class="tool-note" id="tcoSavingsHighlight" style="display:none;"><span id="tcoSavingsText"></span></p>
                    <div class="res-group" id="tcoAssumptions"><h3>Key assumptions</h3><div id="tcoAssumptionsList" class="kv-list" data-rz-fact-list></div></div>
                    <div class="rz-calc-validation tool-valid" id="tcoValidation" role="alert" aria-live="polite" hidden></div>
                    <div class="tool-full" id="tcoFreeWatermark"><p><b>%(full_title)s</b> — %(full_desc)s</p><button type="button" class="pro-overlay-btn" id="tcoPremiumTabBtn" onclick="handlePremiumTab()">Sign in</button></div>
                </div>'''

PRO = '''<section class="tco-premium-section wrap" id="tcoPremiumOutput" style="display:none;">
            <div class="tco-premium-grid">
                <div class="tco-pro-panel tool-results" id="tcoMcPanel">
                    <div class="res-head"><h2>TCO range</h2><span class="basis">10,000 Monte Carlo runs, lowest option</span></div>
                    <div class="res-group"><div id="tcoMcKpis" data-rz-fact-list>
                        <div class="metric-box"><div class="metric-label">P5, low case</div><div class="metric-value" id="mcP5">--</div></div>
                        <div class="metric-box is-key"><div class="metric-label">P50, median</div><div class="metric-value" id="mcP50">--</div></div>
                        <div class="metric-box"><div class="metric-label">P95, high case</div><div class="metric-value" id="mcP95">--</div></div>
                    </div></div>
                    <figure class="fig res-fig"><div class="chart-container"><canvas id="tcoMcChart" role="img" aria-label="Distribution of TCO over 10,000 runs"></canvas></div><figcaption><b>FIG. 3</b> · TCO of the lowest option over 10,000 runs · amber = above P95</figcaption></figure>
                </div>
                <div class="tco-pro-panel tool-results" id="tcoProjectionPanel">
                    <div class="res-head"><h2>Cumulative cost by year</h2><span class="basis">WACC-adjusted NPV</span></div>
                    <div class="res-group"><div id="tcoProjectionKpis" data-rz-fact-list>
                        <div class="metric-box"><div class="metric-label">Breakeven year</div><div class="metric-value" id="projBreakeven">--</div></div>
                        <div class="metric-box is-key"><div class="metric-label">10-year saving</div><div class="metric-value" id="projSavings">--</div></div>
                        <div class="metric-box"><div class="metric-label">NPV difference</div><div class="metric-value" id="projNpv">--</div></div>
                    </div></div>
                    <figure class="fig res-fig"><div class="chart-container"><canvas id="tcoProjectionChart" role="img" aria-label="Cumulative cost of build, colocation and cloud by year"></canvas></div><figcaption><b>FIG. 4</b> · Cumulative cost by year · amber = build</figcaption></figure>
                    <div class="tco-tbl"><table class="tco-yearly-table" id="tcoYearlyTable">
                        <thead><tr><th scope="col">Year</th><th scope="col">Build</th><th scope="col">Colocation</th><th scope="col">Cloud</th><th scope="col">Lowest</th></tr></thead>
                        <tbody id="tcoYearlyBody"></tbody>
                    </table></div>
                </div>
                <div class="tco-pro-panel tool-results" id="tcoTornadoPanel">
                    <div class="res-head"><h2>Sensitivity</h2><span class="basis">each input ±20 %, effect on the gap between options</span></div>
                    @TORNADO@
                </div>
                <div class="tco-pro-panel tool-results" id="tcoStrategyPanel">
                    <div class="res-head"><h2>Strategy and roadmap</h2><span class="basis">for the lowest-cost option</span></div>
                    <div id="tcoStrategyContent"></div>
                </div>
            </div>
        </section>'''


def results(main, cfg):
    a = main.index('<div class="tco-simulator-results">')
    e = balanced(main, a)
    main = main[:a] + RESULTS % cfg + main[e:]
    # Full panels: keep the tornado body pre_clean wrote, rebuild the rest around the same ids
    p = main.index('<section class="tco-premium-section" id="tcoPremiumOutput"')
    pe = balanced(main, p, 'section')
    t0 = main.index('<div id="tcoTornadoBars"></div>', p)
    t1 = main.index('</p>', main.index('id="tcoTornadoInsight"', t0)) + 4
    main = main[:p] + PRO.replace('@TORNADO@', main[t0:t1]) + main[pe:]
    # market chips: the page JS writes #mkt* unguarded, so the ids stay; the same figures show in the region snapshot
    m = main.index('<section class="tco-calculator-section" id="tcoMarketDataSection"')
    me = balanced(main, m, 'section')
    chips = ''.join('<span id="%s"></span>' % i for i in re.findall(r'id="(mkt\w+)"', main[m:me]))
    main = main[:m] + '<div id="tcoMarketDataSection" hidden>%s</div>' % chips + main[me:]
    # detailed comparison: a results panel around the same table; the methodology moves to .tool-ref
    c = main.index('<section class="tco-calculator-section" id="tcoCompareSection"')
    ce = balanced(main, c, 'section')
    body = re.search(r'<tbody id="tcoCompareBody">.*?</tbody>', main[c:ce], re.S).group(0)
    main = main[:c] + '''<section class="tco-calculator-section wrap" id="tcoCompareSection">
            <div class="tool-results">
                <div class="res-head"><h2>Cost by category</h2><span class="basis">period totals, lowest option per row in bold</span></div>
                <div class="tco-tbl"><table class="tco-compare-table" id="tcoCompareTable">
                    <thead><tr><th scope="col">Cost category</th><th scope="col" class="num">Build</th><th scope="col" class="num">Colocation</th><th scope="col" class="num">Cloud</th></tr></thead>
                    %s
                </table></div>
            </div>
        </section>''' % body + main[ce:]
    m0 = main.index('<section class="tco-calculator-section" id="tcoMethodologySection"')
    return main[:m0] + main[balanced(main, m0, 'section'):]


# ---------------------------------------------------------------- inline JS
STACK = [('CAPEX / Setup', 'rgba(212, 154, 42, 0.9)'), ('Power / Compute', 'rgba(125, 135, 148, 0.9)'), ('Staffing', 'rgba(160, 174, 192, 0.9)'),
         ('Maintenance / Insurance', 'rgba(94, 102, 115, 0.9)'), ('Network / Egress', 'rgba(201, 207, 216, 0.9)'), ('Other', 'rgba(74, 81, 96, 0.9)')]
OLD_STACK = ['rgba(251, 191, 36, 0.85)', 'rgba(59, 130, 246, 0.85)', 'rgba(16, 185, 129, 0.85)', 'rgba(14, 116, 144, 0.85)',
             'rgba(6, 182, 212, 0.85)', 'rgba(156, 163, 175, 0.85)']
ASSUME_JS = """assHtml += '<div class="metric-box"><div class="metric-label">' + a[0] + '</div><div class="metric-value">' + a[1] + '</div></div>';"""


def js(s, cfg):
    A = "'%s'" % AMBER
    pairs = [
        # Free | Full report their state (setMode itself is unchanged)
        ("                b.classList.toggle('active', b.getAttribute('data-mode') === mode);",
         "                b.classList.toggle('active', b.getAttribute('data-mode') === mode);\n                b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode ? 'true' : 'false');"),
        # the headline figure is the amount; the option name sits in the note
        ("el('tcoBestValue').textContent = r.winner.name + ' ' + fmtM(r.winner.tco);", "el('tcoBestValue').textContent = fmtM(r.winner.tco);"),
        ("el('kpiBestSub').textContent = r.savingsPct.toFixed(1) + '% cheaper than #2';", "el('kpiBestSub').textContent = r.savingsPct.toFixed(1) + ' % below the next option';"),
        ("savingsEl.style.display = 'flex';", "savingsEl.style.display = 'block';"),
        ("""assHtml += '<div class="tco-assumption-item"><span>' + a[0] + '</span><span>' + a[1] + '</span></div>';""", ASSUME_JS),
        # tables: classes, not painted cells
        ("var style = row.isTotal ? 'font-weight:700;border-top:2px solid rgba(15, 118, 110,0.2);' : '';\n", ""),
        ("html += '<tr style=\"' + style + '\">';", "html += '<tr' + (row.isTotal ? ' class=\"is-total\"' : '') + '>';"),
        ("html += '<td style=\"text-align:right;font-family:JetBrains Mono,monospace;\"' + cls + '>' + (val > 0 ? fmtM(val) : '--') + '</td>';",
         "html += '<td class=\"num' + (cls ? ' tco-winner-cell' : '') + '\">' + (val > 0 ? fmtM(val) : '--') + '</td>';"),
        ("html += '<tr style=\"font-size:0.72rem;color:var(--text-muted);\">';", "html += '<tr class=\"is-pct\">';"),
        ("html += '<td style=\"text-align:right;font-family:JetBrains Mono,monospace;\">' + pct + '%</td>';", "html += '<td class=\"num\">' + pct + '%</td>';"),
        ("yrHtml += '<td style=\"font-weight:600;color:#10b981;\">' + bestName + '</td>';", "yrHtml += '<td class=\"tco-yr-best\">' + bestName + '</td>';"),
        ("insightEl.innerHTML = '<i class=\"fas fa-lightbulb\" style=\"color:var(--tco-primary);margin-right:4px;\"></i>'\n                    + '<strong>'",
         "insightEl.innerHTML = '<strong>'"),
        ("html += '<div style=\"margin-top:1.5rem;padding-top:1rem;border-top:1px solid rgba(0,0,0,0.08);\">';", "html += '<div class=\"tco-roadmap\">';"),
        ("html += '<div class=\"tco-strategy-title\" style=\"margin-bottom:1rem;\"><i class=\"fas fa-route\"></i> Implementation Roadmap</div>';",
         "html += '<h3 class=\"res-sub\">Implementation roadmap</h3>';"),
        # premium state: words, no crown, no PRO ACTIVE pill; the Full row is a flex row ('' keeps the CSS display)
        ("""            premBtn.innerHTML = '<i class="fas fa-crown" style="margin-right:6px;"></i>Premium Active';

            var premBadge = el('tcoPremiumBadge');
            premBadge.textContent = 'PRO ACTIVE';
            premBadge.style.display = 'inline-flex';
            premBadge.style.background = '#64748b';
            premBadge.style.color = 'white';
""", """            premBtn.textContent = 'Full analysis on';
"""),
    ]
    s = js_replace(s, pairs)
    s = js_replace(s, [
        ("premBtn.innerHTML = '<i class=\"fas fa-crown\" style=\"margin-right:6px;\"></i>Premium';", "premBtn.textContent = 'Sign in';"),
        ("el('tcoFreeWatermark').style.display = 'block';", "el('tcoFreeWatermark').style.display = '';"),
        ("color: 'rgba(255,255,255,0.7)'", "color: '%s'" % TICK),
        ("color: 'rgba(255,255,255,0.5)'", "color: '%s'" % TICK),
        ("grid: { color: 'rgba(255,255,255,0.05)' }", "grid: { color: 'rgba(140,150,163,0.15)' }"),
    ], where='all')
    for old, (_, new) in zip(OLD_STACK, STACK):
        s = js_replace(s, [("backgroundColor: '%s',\n                    borderRadius: 4" % old, "backgroundColor: '%s',\n                    borderRadius: 0" % new)])
    s = js_replace(s, [
        ("""                if (val <= p5) return 'rgba(52, 211, 153, 0.7)';
                if (val >= p95) return 'rgba(239, 68, 68, 0.7)';
                return 'rgba(45, 212, 191, 0.7)';""", """                if (val >= p95) return %s;
                return val <= p5 ? 'rgba(125, 135, 148, 0.85)' : 'rgba(125, 135, 148, 0.5)';""" % A),
        ("""                            borderColor: '#f97316',
                            backgroundColor: 'rgba(249, 115, 22, 0.1)',""", """                            borderColor: %s,
                            backgroundColor: 'rgba(212, 154, 42, 0.08)',""" % A),
        ("""                            borderColor: '#06b6d4',
                            backgroundColor: 'rgba(6, 182, 212, 0.1)',""", """                            borderColor: 'rgb(160, 174, 192)',
                            backgroundColor: 'rgba(160, 174, 192, 0.05)',"""),
        ("""                            borderColor: '#94a3b8',
                            backgroundColor: 'rgba(148, 163, 184, 0.1)',""", """                            borderColor: 'rgb(94, 102, 115)',
                            backgroundColor: 'rgba(94, 102, 115, 0.05)',"""),
        # market outlook: Build amber, colocation and power grey
        ("line('Build $/MW', idxSeries(pj.buildCostByYear, mkt.buildCost), '#f59e0b'),", "line('Build $/MW', idxSeries(pj.buildCostByYear, mkt.buildCost), 'rgb(212, 154, 42)'),"),
        ("line('Colo $/kW', idxSeries(pj.coloPriceByYear, mkt.coloKW), '#0f766e'),", "line('Colo $/kW', idxSeries(pj.coloPriceByYear, mkt.coloKW), 'rgb(160, 174, 192)'),"),
        ("line('Power $/kWh', idxSeries(pj.powerCostByYear, mkt.power), '#14b8a6'),", "line('Power $/kWh', idxSeries(pj.powerCostByYear, mkt.power), 'rgb(94, 102, 115)'),"),
        ("borderColor: color, backgroundColor: color + '22',", "borderColor: color, backgroundColor: 'rgba(0, 0, 0, 0)',"),
    ])
    # the page's own cookie-banner and scroll-top code: js/rz-cookie-consent.js is the banner; the scroll-top button is gone
    s = js_swap_between(s, '    <!-- ═══ Cookie + Scroll IIFE ═══ -->\n    <script>\n    (function(){\n        // Cookie Banner', '    // ── Dark Mode Toggle ──',
                        '    <script>\n')
    return s


def post(s):
    """script.min.js (the shared site script, loaded only here among the refit pages) appends a green "Latest version"
    chip to #rzVersionAnchor or else to <body>, under the hub footer that already prints the version. A hidden anchor
    takes it."""
    a = s.index('</footer>', s.index('<footer class="hub-foot">')) + len('</footer>')
    return s[:a] + '\n    <div id="rzVersionAnchor" hidden></div>' + s[a:]


CONFIG = {
    'keep_register': True,
    'pre': pre,
    'eyebrow': 'DC Solutions · <b>Calculator</b> · TCO',
    'h1': 'Total cost of ownership <span class="muted">build, colocation or cloud</span>',
    'lede': 'Five- or ten-year cost of building your own facility, leasing colocation or running in the cloud, from IT load, '
            'country, tier, PUE, utilisation, cooling and growth, with each country priced from the engine reference data. '
            'Computed in your browser; every figure follows the inputs.',
    'basis': 'engine RZEngine country reference · basis Turner &amp; Townsend DCCI 2025, CBRE H1 2025, IEA Electricity 2025 · updated 2026-10',
    'crumb': '<a href="datacenter-solutions.html">DC Solutions</a> → Calculator → TCO',
    'res_basis': 'TCO = CAPEX or setup + Σ yearly OPEX',
    'manual': ('manual/tco.html', 'Technical manual and methodology'),
    'full_title': 'Full analysis',
    'full_desc': 'Monte Carlo range, cumulative cost by year, sensitivity, strategy and roadmap',
    'formulas': [
        ('Build CAPEX', 'P_IT (MW) · regional cost/MW · tier multiplier (II 0.85, III 1.0, IV 1.35)'),
        ('Build OPEX', 'power P_IT · PUE · 8,760 h · $/kWh + staff · salary + maintenance 3 % and insurance 0.7 % of CAPEX + network $20k/MW/mo + 4 % overhead'),
        ('Colocation', 'P_IT (kW) · wholesale $/kW/mo · 12 + setup $50k/MW + 1.5 FTE/MW + network $15k/MW/mo + 3 % overhead, escalated yearly'),
        ('Cloud', 'P_IT (kW) · $420/kW/mo · 12 · (1 − discount) · (1 + 15 % egress + 10 % support + 2 % other), +2.5 %/yr'),
        ('Growth', 'capacity compounds at the growth rate; costs inflate per category each year'),
        ('Breakeven', 'first year cumulative build ≤ cumulative colocation'),
    ],
    'against': ['Turner &amp; Townsend DCCI 2025', 'CBRE H1 2025', 'Cushman &amp; Wakefield 2025', 'IEA Electricity 2025–2026',
                'Glassdoor / PayScale 2025', 'Uptime Institute Tier II–IV'],
    'links': [('glossary.html', 'Glossary'), ('capex-calculator.html', 'CAPEX calculator'), ('opex-calculator.html', 'OPEX calculator'),
              ('roi-calculator.html', 'ROI calculator'), ('dc-market-tracker.html', 'DC market tracker'), ('datacenter-solutions.html', 'DC Solutions'),
              ('account.html', 'My account and saved scenarios')],
    'hero_drop': [r'\s*<!-- Brief -->\s*<section class="tco-brief-section">.*?</section>'],
    'shell': [
        ('<section class="tco-calculator-section">', '<section class="tco-calculator-section wrap">'),
        ('<div class="tco-simulator-container">', '<div class="tco-simulator-container tool-bench">'),
        ('<div class="tco-simulator-inputs" data-explain-scan>', '<div class="tco-simulator-inputs tool-inputs" data-explain-scan>'),
    ],
    'series_primary': '0f766e',
    'pdf_ink': dict(PDF_INK, **{'#0f766e': '#8A5A00', '#10b981': '#374151'}),
    'toolbar': toolbar, 'pre_clean': pre_clean, 'results': results, 'js': js, 'post': post,
}
