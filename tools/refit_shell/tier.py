"""tier-advisor.html: strings and the page-specific hooks.

Refit IN PLACE (stays on tools/apply-tool-register.py's list, keeps html[data-rz-register="tool"]). The page predates the
template's anchors, so pre() adds them (Navigation / Hero comments, body data-rz-calc). Four locked sections each carried
a sign-in overlay; one Full-analysis row remains (in the results), the other locked sections are simply not drawn.
The hub nav keeps this page's own theme button id (#themeToggle, toggleTheme()) and #navLinks (toggleMobileMenu()).

Behaviour: the IT load did not reach the results (gate T17). calculate() now writes the assessed facility (load and type)
into the results; the classification numbers are unchanged.
"""
import re

from .shell import balanced, js_replace


def pre(src):
    for old, new in (('</head>\n\n<body>\n', '</head>\n\n<body data-rz-calc="tier">\n'),
                     ('<div class="page-background"></div>\n    <nav class="navbar">', '<div class="page-background"></div>\n    <!-- Navigation -->\n    <nav class="navbar">'),
                     ('<main class="main-content" id="main-content">\n        <section class="hero">', '<main class="main-content" id="main-content">\n        <!-- Hero -->\n        <section class="hero">')):
        assert src.count(old) == 1, old
        src = src.replace(old, new)
    # one sign-in row per page: the overlays on the regional inputs and the two locked chart / panel sections go
    src, n = re.subn(r'\s*<div class="pro-overlay" onclick="handlePremiumTab\(\)">\s*<i class="fas fa-lock"></i>\s*<div class="pro-overlay-title">'
                     r'(?:Regional Compliance|Full access Charts|Full access Deep Dive)</div>.*?</button>\s*</div>', '', src, flags=re.S)
    assert n == 3, n
    return src


# ---------------------------------------------------------------- 4 toolbar
def toolbar(s, cfg):
    a = s.index('<div class="pue-toolbar">')
    e = balanced(s, a)
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
        </div>
        </div>'''
    return s[:a] + bar + s[e:]


# ---------------------------------------------------------------- 5 results (after the strip)
RESULTS = '''<div class="results-panel tool-results">
                    <div class="res-head"><h2>Results</h2><span class="basis">%(res_basis)s</span></div>
                    <div class="res-group"><h3>Headline</h3><div data-rz-fact-list>
                        <div class="metric-box is-key"><div class="metric-label">Classification</div><div id="tierDisplay" class="metric-value tier-value">Tier III</div><div class="metric-sub"><span id="tierBadge" class="state"><span id="tierBadgeText">Concurrently Maintainable</span></span></div></div>
                    </div></div>
                    <div class="res-group"><h3>Score</h3><div data-rz-fact-list>
                        <div class="metric-box"><div class="metric-label">Composite score</div><div class="metric-value" id="scoreValue">72</div><div class="metric-sub">of 100</div></div>
                        <div class="metric-box"><div class="metric-label">Grade</div><div class="metric-value" id="gradeValue">B</div></div>
                        <div class="metric-box"><div class="metric-label">Confidence</div><div class="metric-value" id="confidenceValue">88%%</div><div class="metric-sub">spread of the five subsystem scores</div></div>
                        <div class="metric-box"><div class="metric-label">Facility assessed</div><div class="metric-value" id="facilityLoad">2,000 kW</div><div class="metric-sub" id="facilityKind">Colocation</div></div>
                    </div></div>
                    <div class="res-group"><h3>Framework mapping</h3><div class="metric-grid" data-rz-fact-list>
                        <div class="metric-box"><div class="metric-label">Uptime Institute</div><div class="metric-value" id="uptimeTier">Tier III</div></div>
                        <div class="metric-box"><div class="metric-label">TIA-942-B</div><div class="metric-value" id="tia942Rating">Rated 3</div></div>
                        <div class="metric-box"><div class="metric-label">EN 50600</div><div class="metric-value" id="en50600Class">VK3</div></div>
                        <div class="metric-box"><div class="metric-label">BICSI 002</div><div class="metric-value" id="bicsiClass">Class F3</div></div>
                    </div></div>
                    <div class="res-group subsystem-scores"><h3>Subsystem scores, 0–100</h3>
%(subs)s
                    </div>
                    <div class="res-group gap-section" id="gapSection"><h3>Gap to the next tier</h3><div id="gapContent"><p>Calculating.</p></div></div>
                    <div class="res-group"><h3>Recommendations</h3><div id="recommendations"></div></div>
                    <div class="pro-section locked" id="proResultsCard">
                        <div class="pro-overlay tool-full" onclick="handlePremiumTab()"><p><b>%(full_title)s</b> — %(full_desc)s</p><button class="pro-overlay-btn">Sign in</button></div>
                        <div class="res-group"><h3>Full analysis</h3><div class="metric-grid" data-rz-fact-list>
                            <div class="metric-box"><div class="metric-label">Regional score</div><div class="metric-value" id="regionalScoreVal">—</div></div>
                            <div class="metric-box"><div class="metric-label">Upgrade cost estimate</div><div class="metric-value" id="upgradeCostVal">—</div></div>
                            <div class="metric-box"><div class="metric-label">Monte Carlo P50 score</div><div class="metric-value" id="mcP50Val">—</div></div>
                            <div class="metric-box"><div class="metric-label">Probability of the target tier</div><div class="metric-value" id="tierProbVal">—</div></div>
                        </div></div>
                    </div>
                </div>'''

SUBS = [('Power', 'power', 'powerVal'), ('Cooling', 'cooling', 'coolingVal'), ('Network', 'network', 'networkVal'),
        ('Physical', 'physical', 'physicalVal'), ('Monitoring', 'monitor', 'monitorVal')]


def results(main, cfg):
    a = main.index('<div class="results-panel">')
    e = balanced(main, a)
    subs = '\n'.join('                        <div class="subsystem-row"><span class="subsystem-label">%s</span><div class="subsystem-bar-bg"><div class="subsystem-bar-fill" id="%sBar"></div></div><span class="subsystem-val" id="%s">—</span></div>'
                     % (label, bar, val) for label, bar, val in SUBS)
    for _, bar, val in SUBS:
        assert 'id="%sBar"' % bar in main[a:e] and 'id="%s"' % val in main[a:e], bar
    main = main[:a] + RESULTS % dict(cfg, subs=subs) + main[e:]
    return main


# ---------------------------------------------------------------- inline JS
AMBER = 'rgb(212,154,42)'   # rgb(): the series palette step maps only quoted 6-digit hex
GREY = '#7D8794'


def js(s, cfg):
    s = js_replace(s, [
        # the classification is the one amber figure (CSS); the tier colour is kept for the PDF only
        ("""        document.getElementById('tierDisplay').style.color = tierColor;
        document.getElementById('tierBadge').style.background = tierColor+'1a';
        document.getElementById('tierBadge').style.color = tierColor;
""", """        document.getElementById('tierDisplay').setAttribute('data-color', tierColor);
        document.getElementById('tierBadge').setAttribute('data-state', tierNum >= 3 ? 'ok' : tierNum === 2 ? 'watch' : 'hazard');
"""),
        ("        document.getElementById('gradeValue').style.color = tierColor;\n", ''),
        # the IT load reaches the results: the facility the classification describes
        ("        document.getElementById('bicsiClass').textContent = bicsi;\n",
         "        document.getElementById('bicsiClass').textContent = bicsi;\n"
         "        var _ft = document.getElementById('facilityType');\n"
         "        document.getElementById('facilityLoad').textContent = (parseFloat(gv('itLoad')) || 0).toLocaleString('en-US') + ' kW';\n"
         "        document.getElementById('facilityKind').textContent = _ft && _ft.selectedIndex >= 0 ? _ft.options[_ft.selectedIndex].text : '';\n"),
        ("var tierColor = document.getElementById('tierDisplay').style.color;", "var tierColor = document.getElementById('tierDisplay').getAttribute('data-color') || '#111827';"),
        # gap list and recommendations: words, no icon tiles
        ("""html = '<p style="font-size:0.82rem;color:#10b981;font-weight:600;"><i class="fas fa-check-circle" style="margin-right:4px;"></i>Your facility meets Tier IV (Fault Tolerant) requirements.</p>';""",
         """html = '<p>Your facility meets Tier IV (fault tolerant) requirements.</p>';"""),
        ("""html = '<p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px;">Current: """, """html = '<p>Current: """),
        ("<li>Sign in for dual utility feeds (same or diverse substations)</li>", "<li>Add dual utility feeds (same or diverse substations)</li>"),
        ("<li>Sign in for dual diverse utility feeds (separate substations)</li>", "<li>Add dual diverse utility feeds (separate substations)</li>"),
        ("""recs.push('<div class="rec-card"><div class="rec-icon" style="background:'+color+'1a;color:'+color+';"><i class="fas fa-'+icon+'"></i></div><div class="rec-text">""",
         """recs.push('<div class="rec-card"><div class="rec-text">"""),
        # an empty gap list read as a broken sentence: say what is left when no single component is missing
        ("            html += '</ul>';\n", "            html += '</ul>';\n            html = html.replace('<ul class=\"gap-list\"></ul>', '<p>No single component is missing: raise the weakest subsystem scores below; the composite needs ' + (tierNum < 3 ? 75 : 90) + '.</p>');\n"),
        # the four charts are rebuilt or updated on every input: drawn without animation (a screenshot or a quick reader saw empty plots)
        ("function onChartsReady() { chartJsReady = true;", "function onChartsReady() { if (window.Chart) Chart.defaults.animation = false; chartJsReady = true;"),
        # charts: the facility series amber, references and thresholds grey
        ("{ label: 'Your Facility', data: data, backgroundColor: 'rgba(100, 116, 139,0.2)', borderColor: '#64748b', borderWidth: 2, pointBackgroundColor: '#64748b', pointRadius: 4 },",
         "{ label: 'Your facility', data: data, backgroundColor: 'rgba(212,154,42,0.16)', borderColor: '%s', borderWidth: 2, pointBackgroundColor: '%s', pointRadius: 3 }," % (AMBER, AMBER)),
        ("{ label: 'Tier III Benchmark', data: t3Bench, backgroundColor: 'rgba(59,130,246,0.08)', borderColor: '#3b82f6', borderWidth: 1.5, borderDash: [5,5], pointRadius: 0 }",
         "{ label: 'Tier III benchmark', data: t3Bench, backgroundColor: 'rgba(125,135,148,0.06)', borderColor: '%s', borderWidth: 1.5, borderDash: [5,5], pointRadius: 0 }" % GREY),
        ("var barColors = ['#f59e0b','#3b82f6','#10b981','#ef4444','#0891b2'];", "var barColors = '%s';" % AMBER),
        ("borderColor: '#f59e0b', borderWidth: 1.5, borderDash: [4,4], label: { content: 'T-II', display: true, position: 'start', font: {size:9}, color: '#f59e0b' }",
         "borderColor: '%s', borderWidth: 1, borderDash: [4,4], label: { content: 'T-II', display: true, position: 'start', font: {size:9}, color: '%s' }" % (GREY, GREY)),
        ("borderColor: '#3b82f6', borderWidth: 1.5, borderDash: [4,4], label: { content: 'T-III', display: true, position: 'start', font: {size:9}, color: '#3b82f6' }",
         "borderColor: '%s', borderWidth: 1, borderDash: [4,4], label: { content: 'T-III', display: true, position: 'start', font: {size:9}, color: '%s' }" % (GREY, GREY)),
        ("borderColor: '#10b981', borderWidth: 1.5, borderDash: [4,4], label: { content: 'T-IV', display: true, position: 'start', font: {size:9}, color: '#10b981' }",
         "borderColor: '%s', borderWidth: 1, borderDash: [4,4], label: { content: 'T-IV', display: true, position: 'start', font: {size:9}, color: '%s' }" % (GREY, GREY)),
        ("var colors = bins.map(function(_,i) { var mid = i*5+2.5; return mid>=90?'#10b981':mid>=75?'#3b82f6':mid>=45?'#f59e0b':'#ef4444'; });",
         "var colors = bins.map(function(_,i) { var mid = i*5+2.5; return mid>=75?'%s':'%s'; });" % (AMBER, GREY)),
        ("p5: {type:'line',xMin:p5/5,xMax:p5/5,borderColor:'#ef4444',borderWidth:1.5,borderDash:[4,4],label:{content:'P5: '+p5,display:true,position:'start',font:{size:9},color:'#ef4444'}},",
         "p5: {type:'line',xMin:p5/5,xMax:p5/5,borderColor:'%s',borderWidth:1,borderDash:[4,4],label:{content:'P5: '+p5,display:true,position:'start',font:{size:9},color:'%s'}}," % (GREY, GREY)),
        ("p95: {type:'line',xMin:p95/5,xMax:p95/5,borderColor:'#10b981',borderWidth:1.5,borderDash:[4,4],label:{content:'P95: '+p95,display:true,position:'start',font:{size:9},color:'#10b981'}}",
         "p95: {type:'line',xMin:p95/5,xMax:p95/5,borderColor:'%s',borderWidth:1,borderDash:[4,4],label:{content:'P95: '+p95,display:true,position:'start',font:{size:9},color:'%s'}}" % (GREY, GREY)),
        # P50 label on top: three labels at the foot of the plot overprinted each other
        ("p50: {type:'line',xMin:p50/5,xMax:p50/5,borderColor:'#64748b',borderWidth:2,label:{content:'P50: '+p50,display:true,position:'start'",
         "p50: {type:'line',xMin:p50/5,xMax:p50/5,borderColor:'%s',borderWidth:2,label:{content:'P50: '+p50,display:true,position:'end'" % AMBER),
        ("ticks: { stepSize: 25, color: labelColor, font: {size:10} }", "ticks: { stepSize: 25, color: labelColor, font: {size:10}, showLabelBackdrop: false }"),
        # locked panels: a state word per regional check, no coloured icons; totals as one line
        ("""rhtml += '<i class="fas fa-'+(pass?'check-circle':'times-circle')+'" style="color:'+(pass?'#10b981':'#ef4444')+';"></i>';""",
         """rhtml += '<span class="state"'+(pass?'':' data-state="hazard"')+'>'+(pass?'Met':'Gap')+'</span>';"""),
        ("""document.getElementById('costTotal').innerHTML = '<i class="fas fa-calculator" style="color:#10b981;margin-right:6px;"></i>Estimated Total: """,
         """document.getElementById('costTotal').innerHTML = 'Estimated total: """),
        ("color:#10b981;font-weight:600;\">'+c.impac", "font-weight:600;\">'+c.impac"),
    ])
    s = re.sub(r"""recs\.push\('<div style="text-align:center;padding:1rem;color:#10b981;font-size:0\.82rem;"><i class="fas fa-check-circle" style="margin-right:6px;"></i>(All subsystems scoring well\.[^<]*)</div>'\);""",
               r"""recs.push('<p class="res-fine">\1</p>');""", s, count=1)
    assert "All subsystems scoring well" in s and '<p class="res-fine">All subsystems' in s
    return s


def post(s):
    """the hub nav keeps this page's theme button (#themeToggle -> toggleTheme) and #navLinks (toggleMobileMenu)"""
    s = js_replace(s, [('<button class="nav-icon theme-toggle" id="navThemeBtn" onclick="toggleCalcTheme()"', '<button class="nav-icon theme-toggle" id="themeToggle" onclick="toggleTheme()"')])
    a = s.index('<nav class="navbar hub-nav"')
    b = s.index('<div class="nav-links">', a)
    return s[:b] + '<div class="nav-links" id="navLinks">' + s[b + len('<div class="nav-links">'):]


CONFIG = {
    'keep_register': True,
    'pre': pre,
    'eyebrow': 'DC Solutions · <b>Calculator</b> · Tier',
    'h1': 'Data center tier classification <span class="muted">from power, cooling, network and site</span>',
    'lede': 'Maps the infrastructure you enter to Uptime Institute Tier I–IV, TIA-942 Ratings 1–4, EN 50600 availability '
            'classes and BICSI 002, names the subsystem that limits the result and lists what reaching the next tier takes. '
            'Computed in your browser.',
    'basis': 'model weighted subsystem scores with Tier III / IV floor rules · basis Uptime Institute, TIA-942-B, EN 50600, BICSI 002 · updated 2026-10',
    'crumb': '<a href="datacenter-solutions.html">DC Solutions</a> → Calculator → Tier',
    'res_basis': 'score = Σ subsystem score · weight, capped by the Tier III / IV topology rules',
    'manual': ('manual/tier-advisor.html', 'Technical manual and methodology'),
    'full_title': 'Full analysis',
    'full_desc': 'regional compliance for 12+ jurisdictions, upgrade cost estimate, Monte Carlo confidence, sensitivity and the PDF report',
    'formulas': [
        ('Power', '0.20 utility + 0.25 generators + 0.20 UPS + 0.10 topology + 0.10 ATS + 0.10 PDU + 0.05 fuel autonomy'),
        ('Cooling', '0.50 redundancy + 0.30 distribution + 0.20 type'),
        ('Network', '0.45 entry points + 0.30 carriers + 0.25 meet-me room'),
        ('Physical', '0.35 fire suppression + 0.35 access control + 0.30 monitoring'),
        ('Composite', 'Σ subsystem score · weight, regional 50 unless set'),
        ('Floor rules', 'score ≥ 75 needs dual feeds, N+1 generators and UPS, dual cooling paths; ≥ 90 needs 2N throughout'),
        ('Tier', '≥ 90 IV · ≥ 75 III · ≥ 60 II+ · ≥ 45 II · ≥ 25 I+ · else I'),
    ],
    'against': ['Uptime Institute Tier Standard', 'ANSI/TIA-942-B', 'EN 50600', 'BICSI 002'],
    'links': [('glossary.html', 'Glossary'), ('tia-942-checklist.html', 'TIA-942 checklist'), ('capex-calculator.html', 'CAPEX calculator'),
              ('pue-calculator.html', 'PUE calculator'), ('datacenter-solutions.html', 'DC Solutions')],
    'head_drop': [r'\s*<link rel="preload" as="image" href="assets/tier-advisor-hero\.webp" type="image/webp">',
                  r'\s*<link rel="preload" as="image" href="assets/tier-advisor-hero\.jpg">'],
    'shell': [
        ('<section class="calculator-section">', '<section class="calculator-section wrap">'),
        ('<div class="calculator-grid">', '<div class="calculator-grid tool-bench">'),
        ('<div class="input-panel">', '<div class="input-panel tool-inputs">'),
        ('<!-- Charts Section -->\n        <section class="charts-section">', '<!-- Charts Section -->\n        <section class="charts-section wrap">'),
        ('<!-- Pro Panels -->\n        <section class="charts-section">', '<!-- Pro Panels -->\n        <section class="charts-section wrap">'),
    ],
    'toolbar': toolbar, 'results': results, 'js': js, 'post': post,
}
