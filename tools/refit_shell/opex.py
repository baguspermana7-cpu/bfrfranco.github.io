"""opex-calculator.html: strings and the page-specific hooks.

Refit IN PLACE, like capex: the page stays on tools/apply-tool-register.py's list and keeps html[data-rz-register="tool"]
(css/rz-tool.css PART 2 skips a body.tool page). The page's own nav auth ids (opexNav*) are kept on the hub nav. The results
column is rebuilt as fact lists and hairline tables with every JS-bound id kept; the inline JS that painted colours, icons,
gradients and blur into the DOM writes classes and words instead. #opexActionToolbar keeps its button order: the gating
script finds Export PDF as `#opexActionToolbar button:nth-child(2)`.
"""
import re

from .shell import balanced, js_replace, js_swap_between
from .capex import HIST_FN


# ---------------------------------------------------------------- 4 toolbar
def toolbar(s, cfg):
    """Simple | Advanced, then Save as A, Export PDF, Export CSV, Save (6 controls). The Full sign-in is the .tool-full row
    in the results; Clear sits with the comparison it clears."""
    a = s.index('<!-- Mode Tabs -->')
    b = s.index('<div id="opexModeTabs"', a)
    e = balanced(s, b)
    bar = '''<div class="wrap">
            <div class="tool-bar" role="toolbar" aria-label="Input depth and actions">
                <div class="seg" role="group" aria-label="Input depth" id="opexModeTabs">
                    <button type="button" class="opex-mode-btn active" data-mode="simple" aria-pressed="true" onclick="switchOpexMode('simple')">Simple</button>
                    <button type="button" class="opex-mode-btn" data-mode="advanced" aria-pressed="false" onclick="opexTryAdvanced()">Advanced</button>
                </div>
                <span id="opexPremiumBadge" hidden></span>
                <span class="spacer"></span>
                <div class="tool-acts" id="opexActionToolbar"><button type="button" class="tool-btn" id="btnSaveOpexA" onclick="saveOpexScenarioA()">Save as A</button><button type="button" class="tool-btn" onclick="exportOpexPDF()">Export PDF</button><button type="button" class="tool-btn" id="btnExportOpexCSV" onclick="exportOpexCSV()">Export CSV</button><button type="button" class="tool-btn" id="btnSaveAccount" onclick="rzScenario&&rzScenario.saveToAccount('opex',{msgEl:'acctSaveMsg'})">Save</button></div>
            </div>
            <p class="tool-msg" id="acctSaveMsg" style="display:none;"></p>
        </div>'''
    return s[:a] + bar + s[e:]


# ---------------------------------------------------------------- inputs (before the inline-style strip)
def pre_clean(main, cfg):
    # the global tooltip system and the shell's hover rules both read the trigger: it carries both classes
    # a staffing card carried its own "?" box over the card name; the section title's one explains all three
    main, n = re.subn(r'\s*<span class="info-tooltip" style="position:absolute;top:4px;right:4px;">.*?</span>\s*</span>', '', main, flags=re.S)
    assert n == 3, n
    main = re.sub(r'(<span class="info-tooltip"[^>]*>)\s*<i class="fas fa-question"[^>]*></i>', r'\1?', main)
    main = main.replace('<span class="info-tooltip"', '<span class="tooltip-trigger info-tooltip"')
    # a tier word from a site-wide rename landed inside a label
    assert main.count('Overtime & Holiday Full access:') == 1
    main = main.replace('Overtime & Holiday Full access:', 'Overtime and holiday premium')
    # Scenario B banner: a lettered tile + two lines -> one plain note
    a = main.index('<div id="opexScenarioBBanner"')
    e = balanced(main, a)
    main = main[:a] + ('<p id="opexScenarioBBanner" class="in-note" style="display:none;"><b>Scenario B.</b> Change the inputs '
                       'below; the comparison with A updates under the results.</p>') + main[e:]
    # country and climate read-outs: a muted line, not a filled box
    main = main.replace('<div id="countryInfo" style=', '<div id="countryInfo" class="in-note" style=', 1)
    main = main.replace('<div id="climateInfo" style=', '<div id="climateInfo" class="in-note" style=', 1)
    # PUE slider end labels
    main = re.sub(r'<div style="display: flex; justify-content: space-between; font-size: 0\.7rem;[^"]*">\s*<span>1\.1 \(Best\)</span>',
                  '<div class="range-ends"><span>1.1 (Best)</span>', main, count=1)
    return main


# ---------------------------------------------------------------- 5 results (after the strip)
def _span_after(panel, anchor, start=0):
    a = panel.index(anchor, start)
    t = panel.index('<span class="tooltip-trigger info-tooltip"', a)
    return panel[t:balanced(panel, t, 'span')]


def _row(label, vid, value, tip='', sub='', cls='metric-box', rid=''):
    return ('<div class="%s"%s><div class="metric-label">%s%s</div><div class="metric-value" id="%s">%s</div>%s</div>'
            % (cls, (' id="%s"' % rid) if rid else '', label, (' ' + tip) if tip else '', vid, value, sub))


def _table_group(block):
    title = re.search(r'<div class="chart-title">\s*([^<]*?)\s*<', block).group(1).replace('&', 'and')
    tip = block[block.index('<span class="tooltip-trigger info-tooltip"'):]
    tip = tip[:balanced(tip, 0, 'span')]
    lab = re.search(r'</span>\s*<span id="(\w+)">([^<]*)</span>\s*</div>', block)
    t0 = re.search(r'<table class="(?:breakdown|staffing)-table"', block).start()  # not the tooltip's own table
    table = block[t0:block.rindex('</table>') + 8]
    note = ('<p class="res-fine" id="%s">%s</p>' % lab.groups()) if lab else ''
    return '<div class="res-group res-table"><h3>%s %s</h3>%s<div class="tbl-wrap">%s</div></div>' % (title, tip, note, table)


def results(main, cfg):
    a = main.index('<div class="results-panel">')
    e = balanced(main, a)
    p = main[a:e]
    tables = []
    i = p.find('<div class="breakdown-card fade-in">')
    while i >= 0:
        j = balanced(p, i)
        tables.append(_table_group(p[i:j]))
        i = p.find('<div class="breakdown-card fade-in">', j)
    assert len(tables) == 5, len(tables)
    sc = p.index('<div class="scenario-section fade-in">')
    sc_tip = _span_after(p, 'Staffing Model Comparison', sc)
    rows = '\n                        '.join(
        _row(name, tid, val, _span_after(p, 'id="%s"' % cid), '<div class="metric-sub scenario-diff%s" id="%s">%s</div>' % (extra, did, diff),
             'metric-box scenario-card' + cur, cid)
        for name, cid, tid, val, did, diff, extra, cur in (
            ('Full in-house', 'scenarioInhouse', 'inhouseTotal', '$1,312,000', 'inhouseDiff', 'Baseline', '', ''),
            ('Partial, 70/30', 'scenarioPartial', 'partialTotal', '$1,245,000', 'partialDiff', '-5.1% vs In-House', ' savings', ' current'),
            ('Full contractor', 'scenarioContractor', 'contractorTotal', '$1,198,000', 'contractorDiff', '-8.7% vs In-House', ' savings', '')))
    unc_tip = _span_after(p, 'OPEX Uncertainty')
    new = '''<div class="results-panel tool-results">
                    <div class="res-head"><h2>Results</h2><span class="basis">%(res_basis)s</span></div>
                    <div class="rz-calc-validation tool-valid" id="opexValidation" role="alert" aria-live="polite" hidden></div>
                    <div class="res-group"><h3>Headline</h3><div data-rz-fact-list>
                        <div class="metric-box is-key"><div class="metric-label">Annual OPEX %(t_total)s</div><div class="metric-value" id="totalOpex">$1,245,000</div><div class="metric-sub"><span id="summaryFlag" hidden>🇮🇩</span><span id="summaryCountry">Indonesia</span></div></div>
                    </div></div>
                    <p id="opexSavedIndicator" class="tool-note" style="display:none;">Scenario A saved. Change the inputs to build scenario B; the comparison is under the results.</p>
                    <div class="res-group"><h3>Per month, per kW and staff</h3><div data-rz-fact-list>
                        %(r_month)s
                        %(r_kw)s
                        %(r_kwh)s
                        %(r_fte)s
                    </div></div>
                    <div class="res-group" id="opexUncPanel" style="display:none;"><h3>Cost uncertainty %(t_unc)s</h3>
                        <div data-rz-fact-list>
                            <div class="metric-box"><div class="metric-label">P10, optimistic</div><div class="metric-value" id="opexP10">—</div></div>
                            <div class="metric-box"><div class="metric-label">P50, median</div><div class="metric-value" id="opexP50">—</div></div>
                            <div class="metric-box"><div class="metric-label">P90, conservative</div><div class="metric-value" id="opexP90">—</div></div>
                            <div class="metric-box"><div class="metric-label">P90 to P10 spread</div><div class="metric-value" id="opexSpread">—</div></div>
                        </div>
                        <figure class="fig res-fig"><div id="opexHist"></div><figcaption><b>FIG. 1</b> · Annual OPEX over 4,000 seeded Monte Carlo runs · energy price, PUE drift and escalation around the point estimate · RZEngine sim</figcaption></figure>
                        <figure class="fig res-fig"><div id="opexTornado"></div><figcaption><b>FIG. 2</b> · What moves annual OPEX most · one driver at a time across its range, the others at base</figcaption></figure>
                    </div>
                    <div id="opexFreeWatermark" class="tool-full"><p><b>%(full_title)s</b> — %(full_desc)s</p><button type="button" class="pro-overlay-btn" id="opexPremiumTabBtn" onclick="opexHandlePremiumTab()">Sign in</button></div>
                    <div class="res-group" id="opexComparePanel" style="display:none;"><h3>Scenario comparison</h3>
                        <div id="opexCompareGrid" class="cmp-grid"><div id="opexScenarioACard" class="cmp-card"></div><div id="opexDeltaColumn" class="cmp-delta"></div><div id="opexScenarioBCard" class="cmp-card"></div></div>
                        <div class="cmp-clear"><button type="button" class="tool-btn" id="btnClearOpex" onclick="clearOpexComparison()" style="display:none;">Clear comparison</button></div>
                    </div>
                    <div class="res-group charts-grid"><h3>Cost by category</h3>
                        <figure class="fig res-fig chart-card"><div class="chart-container"><canvas id="breakdownChart"></canvas></div><figcaption><b>FIG. 3</b> · Share of annual OPEX by category · amber = energy · computed from the inputs above</figcaption></figure>
                        <figure class="fig res-fig chart-card"><div class="chart-container"><canvas id="comparisonChart"></canvas></div><figcaption><b>FIG. 4</b> · Annual cost by category, USD · computed from the inputs above</figcaption></figure>
                    </div>
                    %(tables)s
                    <div class="res-group scenario-section"><h3>Staffing model comparison %(t_sc)s</h3><div data-rz-fact-list>
                        %(rows)s
                    </div></div>
                </div>''' % dict(cfg, t_total=_span_after(p, 'Total Annual Operational Expenditure'),
                                 r_month=_row('Per month', 'monthlyOpex', '$103.8K', _span_after(p, 'Per Month')),
                                 r_kw=_row('Per kW per year', 'perKwOpex', '$1,245', _span_after(p, 'Per kW/Year')),
                                 r_kwh=_row('Per kWh', 'perKwhOpex', '$0.14', _span_after(p, 'Per kWh')),
                                 r_fte=_row('Total FTE', 'totalFte', '24', _span_after(p, 'Total FTE')),
                                 t_unc=unc_tip, t_sc=sc_tip, tables='\n                    '.join(tables), rows=rows)
    return main[:a] + new + main[e:]


# ---------------------------------------------------------------- inline JS
COMPARE_FN = r"""function renderOpexComparison() {
            if (!savedOpexScenario || !lastOpexResult) return;
            const b = lastOpexResult;
            const a = savedOpexScenario;
            const delta = ((b.total - a.total) / a.total * 100);
            const sign = delta >= 0 ? '+' : '−';
            const dKw = b.perKW - a.perKW;
            const renderCard = (label, data) => {
                const cats = ['energy','staffing','maintenance','software','insurance','utilities','other'];
                const catLabels = { energy:'Energy', staffing:'Staffing', maintenance:'Maintenance and spares', software:'Software', insurance:'Insurance', utilities:'Utilities', other:'Other' };
                return '<h4 class="res-sub">Scenario ' + label + '</h4><div data-rz-fact-list>' +
                    '<div class="metric-box"><div class="metric-label">Annual OPEX</div><div class="metric-value">' + formatCurrency(data.total) + '</div></div>' +
                    '<div class="metric-box"><div class="metric-label">Per kW per year</div><div class="metric-value">$' + Math.round(data.perKW).toLocaleString() + '</div></div>' +
                    cats.filter(c => data.breakdown[c] && data.breakdown[c].value > 0).map(c => '<div class="metric-box"><div class="metric-label">' + catLabels[c] + '</div><div class="metric-value">' + formatCurrency(data.breakdown[c].value, true) + '</div></div>').join('') + '</div>';
            };
            document.getElementById('opexScenarioACard').innerHTML = renderCard('A', a);
            document.getElementById('opexScenarioBCard').innerHTML = renderCard('B', b);
            document.getElementById('opexDeltaColumn').innerHTML = '<h4 class="res-sub">B against A</h4><div data-rz-fact-list>' +
                '<div class="metric-box"><div class="metric-label">Annual OPEX</div><div class="metric-value">' + sign + Math.abs(delta).toFixed(1) + '%</div><div class="metric-sub">' + sign + formatCurrency(Math.abs(b.total - a.total)) + '</div></div>' +
                '<div class="metric-box"><div class="metric-label">Cost per kW per year</div><div class="metric-value">' + (dKw >= 0 ? '+' : '−') + '$' + Math.abs(Math.round(dKw)).toLocaleString() + '</div></div></div>';
        }

        """


def js(s, cfg):
    # table rows: no tinted icon tile, no per-category bar colour (CSS: one neutral scale), state words not coloured spans
    s, n = re.subn(r'<span class="category-icon" style="[^"]*">\s*<i class="fas [^"]*"></i>\s*</span>\s*', '', s)
    assert n == 6, n
    s, n = re.subn(r'(<div class="progress-fill" style="width: \$\{percent\}%); background: \$\{[a-z.]+\}"', r'\1"', s)
    assert n == 4, n
    s, n = re.subn(r'<span style="font-size: 0\.75rem; color: var\(--accent-(?:emerald|purple)\);">\s*<i class="fas [^"]*"></i> (\w+)\s*</span>', r'\1', s)
    assert n == 2, n
    s = js_replace(s, [
        ('<td>Insurance Full access</td>', '<td>Insurance premium</td>'),
        ("""rows += `<tr style="background:rgba(14,116,144,0.06);"><td colspan="5" style="padding:8px 12px;font-weight:600;font-size:0.8rem;color:#0e7490;"><i class="fas fa-boxes" style="margin-right:6px;"></i>Spare Parts Inventory""",
         """rows += `<tr class="sub-head"><td colspan="5">Spare parts inventory"""),
        # mode switch: aria-pressed, not painted styles
        ("""                btn.style.background = isActive ? 'rgba(16,185,129,0.15)' : 'transparent';
                btn.style.borderColor = isActive ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.15)';
                btn.style.color = isActive ? '#10b981' : '#94a3b8';
                btn.style.fontWeight = isActive ? '600' : '500';
""", """                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
"""),
        # uncertainty: the panel is shown before the figures are drawn (they size to its width); own SVG figures
        ("            var mc = E.models.sim.monteCarlo(f, dists, 4000, 20260705);", "            var mc = E.models.sim.monteCarlo(f, dists, 4000, 20260705);\n            panel.style.display = 'block';"),
        ("document.getElementById('opexHist').innerHTML = E.charts.histogram(mc.samples, { width: 440, height: 150, accent: '#10b981', bins: 26 });",
         "document.getElementById('opexHist').innerHTML = capexHistSvg(mc.samples, mc, document.getElementById('opexHist').clientWidth);"),
        ("document.getElementById('opexTornado').innerHTML = E.charts.tornado(tor, { width: 440, accent: '#10b981' });",
         "tor.sort(function (x, y) { return Math.abs(y.high - y.low) - Math.abs(x.high - x.low); });\n                document.getElementById('opexTornado').innerHTML = capexTornadoSvg(tor, document.getElementById('opexTornado').clientWidth);"),
        ("        function formatCurrency(value, compact = false) {", HIST_FN + "\n        function formatCurrency(value, compact = false) {"),
        # scenario compare: a block note, no painted buttons
        ("document.getElementById('opexScenarioBBanner').style.display = 'flex';", "document.getElementById('opexScenarioBBanner').style.display = 'block';"),
        ("document.getElementById('btnClearOpex').style.display = 'flex';", "document.getElementById('btnClearOpex').style.display = '';"),
        ("""                btn.innerHTML = '<i class="fas fa-check-circle"></i> Scenario A Saved';
                btn.style.background = 'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.1))';
                btn.style.borderColor = 'rgba(16,185,129,0.5)';
                btn.style.color = '#34d399';
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.setAttribute('aria-disabled','true');
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
                btn.style.cursor = 'default';
""", """                btn.textContent = 'A saved';
                btn.setAttribute('aria-disabled','true');
                btn.disabled = true;
"""),
        ("""            btn.innerHTML = '<i class="fas fa-bookmark"></i> Save Scenario A';
            btn.style.background = 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05))';
            btn.style.borderColor = 'rgba(16,185,129,0.5)';
            btn.style.color = '#10b981';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
""", """            btn.textContent = 'Save as A';
            btn.removeAttribute('aria-disabled');
            btn.disabled = false;
"""),
        # staffing comparison rows keep their fact-list role class
        ("document.getElementById('inhouseDiff').className = 'scenario-diff';", "document.getElementById('inhouseDiff').className = 'metric-sub scenario-diff';"),
        # premium: words, no crown, no PRO ACTIVE pill
        ("""            premBtn.innerHTML = '<i class="fas fa-crown" style="margin-right:6px;"></i>Premium Active';
            premBtn.style.background = 'linear-gradient(135deg,rgba(100, 116, 139,0.25),rgba(100, 116, 139,0.1))';
            premBtn.style.borderColor = 'rgba(100, 116, 139,0.5)';
            premBtn.style.color = '#94a3b8';
            var badge = document.getElementById('opexPremiumBadge');
            badge.textContent = 'PRO ACTIVE';
            badge.style.display = 'inline-flex';
""", """            premBtn.textContent = 'Full analysis on';
"""),
        # gating: the locked content is not drawn (never blurred); the buttons say what they need
        ("""                if (isFree) {
                    cg.style.filter = 'blur(6px)';
                    cg.style.pointerEvents = 'none';
                    cg.style.opacity = '0.5';
                    cg.setAttribute('aria-hidden','true');
                } else {
                    cg.style.filter = 'none';
                    cg.style.pointerEvents = 'auto';
                    cg.style.opacity = '1';
                    cg.removeAttribute('aria-hidden');
                }""", """                cg.style.display = isFree ? 'none' : '';"""),
        ("""                if (isFree) {
                    sc.style.filter = 'blur(6px)';
                    sc.style.pointerEvents = 'none';
                    sc.style.opacity = '0.5';
                    sc.setAttribute('aria-hidden','true');
                } else {
                    sc.style.filter = 'none';
                    sc.style.pointerEvents = 'auto';
                    sc.style.opacity = '1';
                    sc.removeAttribute('aria-hidden');
                }""", """                sc.style.display = isFree ? 'none' : '';"""),
        ("""                if (isFree) {
                    compareGrid.style.filter = 'blur(4px)';
                    compareGrid.style.pointerEvents = 'none';
                    compareGrid.style.opacity = '0.5';
                    compareGrid.setAttribute('aria-hidden','true');
                } else {
                    compareGrid.style.filter = 'none';
                    compareGrid.style.pointerEvents = 'auto';
                    compareGrid.style.opacity = '1';
                    compareGrid.removeAttribute('aria-hidden');
                }""", """                compareGrid.hidden = isFree;"""),
        ("""                    btnSave.style.opacity = '0.6';
                    btnSave.innerHTML = '<i class="fas fa-lock" style="font-size:0.65rem;margin-right:3px;color:#94a3b8;"></i> Save Scenario A';""",
         """                    btnSave.classList.add('gated-btn');
                    btnSave.textContent = 'Save as A · Full';"""),
        ("""                    btnSave.style.opacity = '1';
                    btnSave.innerHTML = '<i class="fas fa-bookmark"></i> Save Scenario A';""",
         """                    btnSave.classList.remove('gated-btn');
                    btnSave.textContent = 'Save as A';"""),
        ("""                    pdfBtn.style.opacity = '1';
                    pdfBtn.innerHTML = '<i class="fas fa-lock" style="font-size:0.65rem;margin-right:3px;color:#94a3b8;"></i> Export PDF';""",
         """                    pdfBtn.classList.add('gated-btn');
                    pdfBtn.textContent = 'Export PDF · Full';"""),
        ("""                    pdfBtn.style.opacity = '1';
                    pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Export PDF';""",
         """                    pdfBtn.classList.remove('gated-btn');
                    pdfBtn.textContent = 'Export PDF';"""),
        ("""advBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-lock gate-lock-icon" style="margin-left:6px;font-size:0.65rem;color:#94a3b8;"></i>');""",
         """advBtn.insertAdjacentHTML('beforeend', '<span class="gate-lock-icon"> · Full</span>');"""),
        ("if (watermark) watermark.style.display = isFree ? 'block' : 'none';",
         "if (watermark) watermark.style.display = isFree ? '' : 'none';\n"
         "            // the cost tables are part of the full analysis: not drawn for free (a re-render would otherwise refill the dollar cells)\n"
         "            document.querySelectorAll('.res-table').forEach(function(t) { t.style.display = isFree ? 'none' : ''; });"),
        ("                        backgroundColor: colors,\n                        borderRadius: 6,", "                        backgroundColor: colors,\n                        borderRadius: 0,"),
        # the doughnut legend sits under the ring: on a phone a right-hand legend squeezes the ring to a dot
        ("position: 'right',\n                            labels: { font: { size: 11 }, padding: 15 }", "position: 'bottom',\n                            labels: { font: { size: 11 }, padding: 12, boxWidth: 12 }"),
    ])
    s = js_replace(s, [("className = 'scenario-diff ' + (", "className = 'metric-sub scenario-diff ' + ("),
                       ("""premBtn.innerHTML = '<i class="fas fa-crown" style="margin-right:6px;"></i>Premium';""", "premBtn.textContent = 'Sign in';")], where='all')
    s = js_swap_between(s, 'function renderOpexComparison() {', '// ═══ OPEX NARRATIVE CONCLUSION GENERATOR ═══', COMPARE_FN)
    return s


NAV_IDS = [('navAuthWrap', 'opexNavAuthWrap'), ('navLoginBtn', 'opexNavLoginBtn'), ('navUserBtn', 'opexNavUserBtn'),
           ('navUserAvatar', 'opexNavUserAvatar'), ('navUserEmail', 'opexNavUserEmail'), ('navUserDropdown', 'opexNavUserDropdown'),
           ('navDdTierBadge', 'opexNavDdTierBadge'), ('navDdEmail', 'opexNavDdEmail')]


def post(s):
    """the hub nav's auth cluster carries the ids and handlers this page's gating script binds (opexNav*)"""
    a = s.index('<div class="nav-auth-wrap" id="navAuthWrap">')
    e = balanced(s, a)
    blk = s[a:e]
    for old, new in NAV_IDS:
        blk, n = re.subn(r'id="%s"' % old, 'id="%s"' % new, blk)
        assert n == 1, old
    blk = js_replace(blk, [('onclick="handlePremiumTab()"', 'onclick="opexShowLogin()"'), ('onclick="toggleUserDropdown()"', 'onclick="opexToggleDropdown()"'),
                           ('onclick="logoutPremium()"', 'onclick="opexLogout()"')])
    s = s[:a] + blk + s[e:]
    # the floating free-tier strip outside <main> became the .tool-full row in the results
    s, n = re.subn(r'\s*<!-- Free Watermark -->\s*<div id="opexFreeWatermark" onclick="opexShowLogin\(\)">.*?</div>', '', s, count=1, flags=re.S)
    assert n == 1
    return s


CONFIG = {
    'keep_register': True,
    'eyebrow': 'DC Solutions · <b>Calculator</b> · OPEX',
    'h1': 'Data center operating cost <span class="muted">by country, climate and staffing model</span>',
    'lede': 'Annual OPEX and its split into energy, staffing, maintenance and spares, software, insurance and compliance, '
            'utilities and other costs, from country, IT load, PUE, tier, facility age, climate, cooling, generators and the '
            'staffing model. Computed in your browser; every figure follows the inputs.',
    'basis': 'engine opex model + RZEngine sim · basis Uptime Institute, US EIA, BLS, JLL, CBRE benchmarks · 30+ countries · updated 2026-10',
    'crumb': '<a href="datacenter-solutions.html">DC Solutions</a> → Calculator → OPEX',
    'res_basis': 'OPEX = energy + staffing + maintenance + software + insurance + utilities + other',
    'manual': ('manual/opex.html', 'Technical manual and methodology'),
    'full_title': 'Full analysis',
    'full_desc': 'cost per kW and per kWh, the cost tables in dollars, both charts, the staffing model comparison, scenario A against B and the PDF report',
    'formulas': [
        ('Energy', '(P_IT + P_IT · (PUE − 1) · M_cooling · M_climate) · 8,760 h · utilisation · tariff'),
        ('PUE', 'PUE_input + cooling type adjustment'),
        ('Staffing', 'Σ roles FTE(P_IT, tier) · salary · labour multiplier, split in-house / contractor'),
        ('Maintenance', 'Σ systems P_IT · rate ($/kW) · M_generator · M_age · M_country · OEM factor + spares'),
        ('Insurance', 'property 0.25 % + business interruption 0.10 % of estimated CAPEX + liability + cyber'),
        ('Other', 'training 3.5 % of in-house staffing + 2 % of (energy + staffing)'),
        ('Per kW', 'OPEX / P_IT per year'),
    ],
    'against': ['Uptime Institute operational benchmarks', 'US EIA commercial electricity rates', 'BLS staffing data',
                'JLL Data Center Outlook', 'CBRE data center benchmarks'],
    'links': [('glossary.html', 'Glossary'), ('capex-calculator.html', 'CAPEX calculator'), ('tco-calculator.html', 'TCO calculator'),
              ('pue-calculator.html', 'PUE calculator'), ('datacenter-solutions.html', 'DC Solutions'), ('account.html', 'My account and saved scenarios')],
    'head_drop': [r'\s*<link rel="preload" as="image" href="assets/opex-og\.jpg">'],
    'hero_drop': [r'\s*<!-- Brief -->\s*<section class="brief-section">.*?</section>'],
    'shell': [
        ('<div class="calculator-container">', '<div class="calculator-container wrap tool-bench">'),
        ('<div class="input-panel">', '<div class="input-panel tool-inputs">'),
    ],
    'series_primary': 'f59e0b',
    'toolbar': toolbar, 'pre_clean': pre_clean, 'results': results, 'js': js, 'post': post,
}
