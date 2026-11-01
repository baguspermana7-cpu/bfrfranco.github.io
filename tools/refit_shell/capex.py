"""capex-calculator.html: strings and the page-specific hooks.

The page is refit IN PLACE and stays on tools/apply-tool-register.py's list, so it keeps html[data-rz-register="tool"]
(css/rz-tool.css PART 2 skips a body.tool page). Its <style> blocks go; every component it still draws is styled by
css/rz-tool.css PART 1 (/* capex */). The results column is rebuilt as fact lists with every JS-bound id kept; the inline
JS that painted colours, gradients, icons and tiles into the DOM is edited to write classes and plain text instead.
"""
import re

from .shell import balanced, js_replace, js_swap_between


# ---------------------------------------------------------------- 4 toolbar
def toolbar(s, cfg):
    """Simple | Advanced segment, then Save as A, Export PDF, Export CSV, Save (6 controls). The Full sign-in is the
    .tool-full row in the results; Clear sits with the comparison it clears."""
    a = s.index('<!-- Mode Tabs -->')
    b = s.index('<div id="capexModeTabs"', a)
    e = balanced(s, b)
    bar = '''<div class="tool-bar" role="toolbar" aria-label="Input depth and actions">
                <div class="seg" role="group" aria-label="Input depth" id="capexModeTabs">
                    <button type="button" class="capex-mode-btn active" data-mode="simple" aria-pressed="true" onclick="switchCapexMode('simple')">Simple</button>
                    <button type="button" class="capex-mode-btn" data-mode="advanced" aria-pressed="false" onclick="switchCapexMode('advanced')">Advanced</button>
                </div>
                <span id="premiumBadge" hidden></span>
                <span class="spacer"></span>
                <button type="button" class="tool-btn" id="btnSaveA" onclick="gatedAction('save')"><span id="btnSaveLabel">Save as A</span></button>
                <button type="button" class="tool-btn" id="btnExportPDF" onclick="gatedAction('pdf')"><span id="btnPdfLabel">Export PDF</span></button>
                <button type="button" class="tool-btn" id="btnExportCSV" onclick="exportCapexCSV()">Export CSV</button>
                <button type="button" class="tool-btn" id="btnSaveAccount" onclick="saveToAccount()"><span id="btnSaveAccountLabel">Save</span></button>
            </div>
            <p class="tool-msg" id="acctSaveMsg" style="display:none;"></p>'''
    return s[:a] + bar + s[e:]


# ---------------------------------------------------------------- inputs (before the inline-style strip)
ADV_HEAD = re.compile(r'<div style="font-size:0\.8rem;font-weight:700;color:#[0-9a-fA-F]{6};text-transform:uppercase;[^"]*">\s*'
                      r'<i class="fas [^"]*"></i>\s*(.*?)\s*</div>', re.S)
ADV_SECTION = re.compile(r'<div style="border-top:1px solid rgba\([^)]*\);padding-top:1\.5rem;[^"]*">')


def _head(title):
    return '<div class="section-header"><span class="section-title">%s</span></div>' % title


def pre_clean(main, cfg):
    main, n = ADV_HEAD.subn(lambda m: _head(m.group(1).replace('&', 'and').replace(' / ', ' and ')), main)
    assert n == 7, n
    main, n = ADV_SECTION.subn('<div class="input-section adv-section">', main)
    assert n == 7, n
    # 2N+1's caption read "Full access" (a tier word from a site-wide rename), not a redundancy description
    assert main.count('<small>Full access</small>') == 1
    main = main.replace('<small>Full access</small>', '<small>Full + spare</small>')
    # Scenario B banner: a lettered tile + two lines -> one plain note
    a, e = _block(main, '<div id="scenarioBBanner"')
    main = main[:a] + ('<p id="scenarioBBanner" class="in-note" style="display:none;"><b>Scenario B.</b> Change the inputs '
                       'below; the comparison with A updates under the results.</p>') + main[e:]
    # simple-mode groups: a muted mono label + hairline over each run of fields
    for anchor, box, title in (('id="itLoad"', '<div class="input-row">', 'Load and building'),
                               ('id="rackStd"', '<div class="input-group">', 'Density, cooling and redundancy'),
                               ('id="fireType"', '<div class="input-row">', 'Fire, UPS and generators'),
                               ('id="locationFactor"', '<div class="input-row">', 'Location')):
        row = main.rfind(box, 0, main.index(anchor))
        main = main[:row] + _head(title) + '\n                    ' + main[row:]
    return main


def _block(s, anchor, tag='div'):
    a = s.index(anchor)
    return a, balanced(s, a, tag)


# ---------------------------------------------------------------- 5 results (after the strip)
RESULTS = '''<div class="simulator-results tool-results">
                    <div class="res-head"><h2>Results</h2><span class="basis">%(res_basis)s</span></div>
                    <div class="rz-calc-validation tool-valid" id="capexValidation" role="alert" aria-live="polite" hidden></div>
                    <div class="res-group"><h3>Headline</h3><div data-rz-fact-list>
                        <div class="metric-box is-key"><div class="metric-label">Total CAPEX</div><div class="metric-value total-value" id="totalCost">$12,500,000</div><div class="metric-sub" id="advInfoBadge" style="display:none;"></div></div>
                    </div></div>
                    <p id="savedIndicator" class="tool-note" style="display:none;">Scenario A saved. Change the inputs to build scenario B; the comparison is under the results.</p>
                    <div class="res-group"><h3>Per kW, tier and energy</h3><div data-rz-fact-list>
                        <div class="metric-box is-gated" id="perKwSection" onclick="if(!isPremiumUser)handlePremiumTab()"><div class="metric-label">Cost per kW of IT load</div><div class="metric-value per-kw-value" id="perKwCost">$12,500/kW</div><div class="metric-sub"><span id="perKwGateBadge" class="gated-badge" onclick="event.stopPropagation();handlePremiumTab()">Sign in to see</span></div></div>
                        <div class="metric-box"><div class="metric-label" data-explain="tier">Tier classification</div><div class="metric-value" id="tierClass">Tier III</div></div>
                        <div class="metric-box"><div class="metric-label" data-explain="pue">Estimated PUE</div><div class="metric-value" id="pueValue">1.45</div></div>
                        <div class="metric-box"><div class="metric-label" data-explain="uptime">Legacy tier availability</div><div class="metric-value" id="uptimeValue">99.982%%</div></div>
                        <div class="metric-box is-gated" id="energySection" onclick="if(!isPremiumUser)handlePremiumTab()"><div class="metric-label" data-explain="annual-energy">Annual energy cost</div><div class="metric-value" id="energyCost">$1.2M</div><div class="metric-sub"><span id="energyGateBadge" class="gated-badge" onclick="event.stopPropagation();handlePremiumTab()">Sign in to see</span></div></div>
                    </div></div>
                    <div class="res-group"><h3>Cost by system</h3><div class="cost-breakdown" id="costBreakdown"></div></div>
                    <div class="res-group" id="spacePanel" style="display:none;"><h3>Rack density and white space</h3><div id="spaceGrid" class="kv-list" data-rz-fact-list></div></div>
                    <div class="res-group" id="refrigerantPanel" style="display:none;"><h3>Refrigerant</h3><div id="refGrid" class="kv-list" data-rz-fact-list></div><div id="refFlags" class="res-fine"></div></div>
                    <div class="res-group" id="deepSeaPanel" style="display:none;"><h3>Deep sea water cooling — design</h3>
                        <p class="res-states"><span class="state" id="dsEnvChip">ΔT ≤ 5 °C compliant</span><span class="state">WUE ≈ 0</span></p>
                        <div id="dsGrid" class="kv-list" data-rz-fact-list></div>
                        <div id="dsCapexRows"></div>
                        <div id="dsWarnings" class="res-fine"></div>
                        <p class="res-fine">Three separated loops: rack CDU (direct-to-chip, 20–25 °C), closed facility water, open seawater through titanium Gr2 plate exchangers. N+1 pumps, filters and exchangers; trim chillers as backup. A budgetary estimate, not a marine engineering design.</p>
                    </div>
                    <div class="res-group" id="renewPanel" style="display:none;"><h3>On-site renewables screen</h3><div id="renewGrid" class="kv-list" data-rz-fact-list></div><p class="res-fine">Screening-level day and night simplification; not an interconnection or reliability study.</p></div>
                    <div class="res-group" id="uncertaintyPanel" style="display:none;"><h3>Cost uncertainty</h3>
                        <div data-rz-fact-list>
                            <div class="metric-box"><div class="metric-label">P10, optimistic</div><div class="metric-value" id="uncP10">—</div></div>
                            <div class="metric-box"><div class="metric-label">P50, median</div><div class="metric-value" id="uncP50">—</div></div>
                            <div class="metric-box"><div class="metric-label">P90, conservative</div><div class="metric-value" id="uncP90">—</div></div>
                            <div class="metric-box"><div class="metric-label">P90 to P10 spread</div><div class="metric-value" id="uncSpread">—</div></div>
                        </div>
                        <figure class="fig res-fig"><div id="uncHist"></div><figcaption><b>FIG. 1</b> · Total CAPEX over 4,000 seeded Monte Carlo runs · bid spread, escalation and scope growth around the point estimate · RZEngine sim</figcaption></figure>
                        <figure class="fig res-fig"><div id="uncTornado"></div><figcaption><b>FIG. 2</b> · What moves total CAPEX most · one driver at a time across its range, the others at base</figcaption></figure>
                    </div>
                    <div id="freeWatermark" class="tool-full"><p><b>%(full_title)s</b> — %(full_desc)s</p><button type="button" class="pro-overlay-btn" id="premiumTabBtn" onclick="handlePremiumTab()">Sign in</button></div>
                    <div class="res-group" id="comparePanel" style="display:none;"><h3>Scenario comparison</h3>
                        <div id="compareGrid" class="cmp-grid"><div id="scenarioACard" class="cmp-card"></div><div id="deltaColumn" class="cmp-delta"></div><div id="scenarioBCard" class="cmp-card"></div></div>
                        <div id="btnClearRow" class="cmp-clear" style="display:none;"><button type="button" class="tool-btn" id="btnClearCompare" onclick="clearComparison()">Clear comparison</button></div>
                    </div>
                    <div class="res-group" id="premiumOutput" style="display:none;"><h3>Full analysis</h3>
                        <div data-rz-fact-list id="premiumKpiGrid">
                            <div class="metric-box"><div class="metric-label">Estimated racks</div><div class="metric-value" id="premRackCount">167</div></div>
                            <div class="metric-box"><div class="metric-label">White space</div><div class="metric-value" id="premFloorSpace">418 m²</div></div>
                            <div class="metric-box"><div class="metric-label">Design to COD</div><div class="metric-value" id="premTimeline">29 mo</div></div>
                        </div>
                        <h3>$/kW against the industry range</h3>
                        <div class="bench"><div id="benchmarkBar" class="bench-track"><div id="benchmarkMarker" class="bench-mark"></div><div id="benchmarkLabel" class="bench-label"></div></div>
                            <div class="bench-scale"><span>$5k/kW low</span><span>$15k/kW typical</span><span>$30k/kW high</span></div></div>
                        <h3>Construction timeline</h3>
                        <div id="timelineChart" class="gantt"></div>
                        <h3>Sustainability and efficiency</h3>
                        <div id="sustainMetrics" data-rz-fact-list></div>
                        <p class="res-fine">Full report · resistancezero.com · generated <span id="premReportDate"></span></p>
                    </div>
                </div>'''


def results(main, cfg):
    a = main.index('<div class="simulator-results">')
    e = balanced(main, a)
    return main[:a] + RESULTS % cfg + main[e:]


# ---------------------------------------------------------------- inline JS
HIST_FN = r"""        // FIG. 1 / FIG. 2 — drawn at the container's own width so the 10 px axis text stays 10 px on a phone
        function capexHistSvg(samples, mc, cw) {
            var W = Math.max(280, Math.round(cw || 480)), H = W < 420 ? 164 : 184, L = 8, R = 8, T = 32, B = 24, bins = W < 420 ? 20 : 28;
            if (!samples || !samples.length) return '';
            var lo = samples[0], hi = samples[samples.length - 1], span = (hi - lo) || 1, counts = [], i;
            for (i = 0; i < bins; i++) counts.push(0);
            samples.forEach(function (v) { counts[Math.min(bins - 1, Math.floor((v - lo) / span * bins))]++; });
            var mx = Math.max.apply(null, counts) || 1, bw = (W - L - R) / bins, sx = function (v) { return L + (v - lo) / span * (W - L - R); };
            var o = '<svg class="capex-fig" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Distribution of total CAPEX over 4,000 Monte Carlo runs with P10, P50 and P90 marked">';
            o += '<line class="gr" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/>';
            for (i = 0; i < bins; i++) { var bh = counts[i] / mx * (H - T - B); o += '<rect class="b" x="' + (L + i * bw + 0.5).toFixed(1) + '" y="' + (H - B - bh).toFixed(1) + '" width="' + Math.max(1, bw - 1).toFixed(1) + '" height="' + bh.toFixed(1) + '"/>'; }
            // P50 on its own line, centred; P10 runs left of its marker, P90 right of it: the three labels never collide
            [['P10', mc.p10, 'end', 24], ['P50', mc.p50, 'middle', 10], ['P90', mc.p90, 'start', 24]].forEach(function (p) {
                var x = sx(p[1]), t = p[0] + ' ' + formatCurrency(p[1]), tw = t.length * 6.1, tx = x;
                if (p[2] === 'end') tx = Math.max(L + tw, x - 3); else if (p[2] === 'start') tx = Math.min(W - R - tw, x + 3); else tx = Math.min(W - R - tw / 2, Math.max(L + tw / 2, x));
                o += '<line class="' + (p[0] === 'P50' ? 'mk key' : 'mk') + '" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (p[3] + 4) + '" y2="' + (H - B) + '"/>';
                o += '<text x="' + tx.toFixed(1) + '" y="' + p[3] + '" text-anchor="' + p[2] + '">' + t + '</text>';
            });
            o += '<text x="' + L + '" y="' + (H - 7) + '" text-anchor="start">' + formatCurrency(lo) + '</text><text x="' + (W - R) + '" y="' + (H - 7) + '" text-anchor="end">' + formatCurrency(hi) + '</text>';
            return o + '</svg>';
        }
        function capexTornadoSvg(rows, cw) {
            var W = Math.max(280, Math.round(cw || 480)), LBL = W < 420 ? 104 : 136, R = 8, rh = 18, gap = 14, T = 6;
            if (!rows || !rows.length) return '';
            var H = T + rows.length * (rh + gap) + 18, base = rows[0].base;
            var sw = Math.max.apply(null, rows.map(function (r) { return Math.max(Math.abs(r.high - base), Math.abs(r.low - base)); })) || 1;
            var half = (W - LBL - R - 8) / 2, mid = LBL + 8 + half;
            var o = '<svg class="capex-fig" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sensitivity of total CAPEX to each cost driver">';
            rows.forEach(function (r, k) {
                var y = T + k * (rh + gap), a = mid + (Math.min(r.low, r.high) - base) / sw * half, b = mid + (Math.max(r.low, r.high) - base) / sw * half;
                o += '<text class="lb" x="' + (LBL - 4) + '" y="' + (y + rh / 2 + 4) + '" text-anchor="end">' + r.key + '</text>';
                o += '<rect class="b" x="' + a.toFixed(1) + '" y="' + y + '" width="' + Math.max(1, b - a).toFixed(1) + '" height="' + rh + '"/>';
                // one range label under the bar, centred on it and kept inside the plot: two end labels collide on a short bar
                var rg = formatCurrency(Math.min(r.low, r.high)) + ' – ' + formatCurrency(Math.max(r.low, r.high)), rw = rg.length * 6.1;
                var cx = Math.min(W - R - rw / 2, Math.max(LBL + 8 + rw / 2, (a + b) / 2));
                o += '<text x="' + cx.toFixed(1) + '" y="' + (y + rh + 11) + '" text-anchor="middle">' + rg + '</text>';
            });
            // the base line runs through the bar rows only, never through a range label
            rows.forEach(function (r, k) { var y = T + k * (rh + gap); o += '<line class="gr" x1="' + mid + '" x2="' + mid + '" y1="' + (y - 3) + '" y2="' + (y + rh + 2) + '"/>'; });
            return o + '</svg>';
        }
"""

COMPARE_FN = r"""function renderComparison() {
            if (!savedScenario || !lastResult) return;
            const b = lastResult;
            const a = savedScenario;
            const delta = ((b.total - a.total) / a.total * 100);
            const sign = delta >= 0 ? '+' : '−';
            const dKw = (b.total / b.itLoad) - (a.total / a.itLoad);
            document.getElementById('scenarioACard').innerHTML = renderScenarioCard('A', a);
            document.getElementById('scenarioBCard').innerHTML = renderScenarioCard('B', b);
            document.getElementById('deltaColumn').innerHTML = '<h4 class="res-sub">B against A</h4><div data-rz-fact-list>' +
                '<div class="metric-box"><div class="metric-label">Total CAPEX</div><div class="metric-value">' + sign + Math.abs(delta).toFixed(1) + '%</div><div class="metric-sub">' + sign + formatCurrency(Math.abs(b.total - a.total)) + '</div></div>' +
                '<div class="metric-box"><div class="metric-label">Cost per kW</div><div class="metric-value">' + (dKw >= 0 ? '+' : '−') + formatCurrency(Math.abs(dKw)) + '</div></div></div>';
        }

        """

CARD_FN = r"""function renderScenarioCard(label, data) {
            // the five largest systems, shown in a fixed order so A and B line up row for row
            const topKeys = Object.entries(data.costs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
            const topCosts = costKeyOrder.filter(k => topKeys.includes(k)).map(k => [k, data.costs[k]]);
            let metaInfo = data.tierInfo.tier + ' · PUE ' + data.pue;
            if (data.yearLabel !== '2025') metaInfo += ' · ' + data.yearLabel;
            if (data.cityLabel) metaInfo += ' · ' + data.cityLabel;
            return '<h4 class="res-sub">Scenario ' + label + ' · ' + metaInfo + '</h4><div data-rz-fact-list>' +
                '<div class="metric-box"><div class="metric-label">Total CAPEX</div><div class="metric-value">' + formatCurrency(data.total) + '</div><div class="metric-sub">' + formatCurrency(data.total / data.itLoad) + '/kW · ' + data.itLoad.toLocaleString() + ' kW</div></div>' +
                topCosts.map(([key, cost]) => '<div class="metric-box"><div class="metric-label">' + costFactors[key].label + '</div><div class="metric-value">' + formatCurrency(cost) + '</div></div>').join('') + '</div>';
        }

        """

GANTT_JS = r"""// Gantt: one row per phase (parallel model), month ticks, the total on the last row
            const _gStep = totalMonths <= 18 ? 3 : totalMonths <= 30 ? 6 : 12;
            let _axis = '';
            for (let m = 0; m <= totalMonths; m += _gStep) { _axis += '<span style="left:' + (m / totalMonths * 100).toFixed(1) + '%">M' + m + '</span>'; }
            let tlHTML = '<div class="gantt-row gantt-head"><div class="gantt-name">Phase</div><div class="gantt-axis">' + _axis + '</div><div class="gantt-dur">Months</div></div>';
            phases.phases.forEach((p, i) => {
                const leftPct = (p.start / totalMonths * 100).toFixed(1);
                const widthPct = ((p.end - p.start) / totalMonths * 100).toFixed(1);
                tlHTML += '<div class="gantt-row"><div class="gantt-name">' + p.name + (notes[i] ? '<small>' + notes[i] + '</small>' : '') + '</div>' +
                    '<div class="gantt-track"><div class="gantt-bar" style="left:' + leftPct + '%;width:' + widthPct + '%"></div></div><div class="gantt-dur">' + (p.end - p.start) + '</div></div>';
            });
            const serialTotal = phases.design + phases.permit + phases.procurement + phases.civil + phases.mep + phases.commission;
            const savedPct = Math.round((serialTotal - totalMonths) / serialTotal * 100);
            tlHTML += '<div class="gantt-row is-total"><div class="gantt-name">Design to COD' + (savedPct > 0 ? '<small>parallel phases save about ' + savedPct + '% against serial</small>' : '') + '</div>' +
                '<div class="gantt-track"><div class="gantt-bar" style="left:0;width:100%"></div></div><div class="gantt-dur">' + totalMonths + '</div></div>';
            tlEl.innerHTML = tlHTML;

            """

SUSTAIN_JS = r"""smEl.innerHTML = [
                ['PUE', r.pue.toFixed(2), 'DCiE ' + dcie + '% · ' + (r.pue <= 1.3 ? 'excellent' : r.pue <= 1.5 ? 'good' : r.pue <= 1.7 ? 'average' : 'below average')],
                ['Annual energy', (annualMWh / 1000).toFixed(1) + ' GWh', annualMWh.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' MWh/yr'],
                ['Scope 2 CO₂', (co2Tons >= 1000 ? (co2Tons / 1000).toFixed(1) + 'k' : Math.round(co2Tons)) + ' t', emFactor.toFixed(2) + ' tCO₂/MWh, ' + (effRegion || 'avg').toUpperCase()],
                ['Water and refrigerant', 'WUE ' + wue.toFixed(1), refrig.type + (refrig.gwp > 0 ? ', GWP ' + refrig.gwp : '')]
            ].map(function (k) { return '<div class="metric-box"><div class="metric-label">' + k[0] + '</div><div class="metric-value">' + k[1] + '</div><div class="metric-sub">' + k[2] + '</div></div>'; }).join('');

            """


def js(s, cfg):
    # breakdown rows: no tinted icon tile, no per-system bar colour (CSS: the largest bar amber, the rest grey)
    s, n = re.subn(r'\n\s*<div class="cost-icon" style="[^"]*"><i class="fas [^"]*"></i></div>', '', s)
    assert n == 3, n
    s = js_replace(s, [
        ('<div class="cost-bar" style="width: ${barWidth}%; background: ${factor.color};"></div>', '<div class="cost-bar" style="width: ${barWidth}%;"></div>'),
        ('<div class="cost-item" style="opacity: 0.7;">', '<div class="cost-item is-soft">'),
        ('<div class="cost-bar" style="width: ${(contingency / maxCost) * 100}%; background: rgba(255,255,255,0.5);"></div>', '<div class="cost-bar" style="width: ${(contingency / maxCost) * 100}%;"></div>'),
        ('<div class="cost-bar" style="width: ${(cost / maxCost) * 100}%; background: ${color};"></div>', '<div class="cost-bar" style="width: ${(cost / maxCost) * 100}%;"></div>'),
        # mode switch: aria-pressed, not painted styles; the advanced block is a column
        ("""                btn.style.background = isActive ? 'rgba(245,158,11,0.15)' : 'transparent';
                btn.style.borderColor = isActive ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.15)';
                btn.style.color = isActive ? '#f59e0b' : '#94a3b8';
                btn.style.fontWeight = isActive ? '600' : '500';
""", """                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
"""),
        ("advPanel.style.display = mode === 'advanced' ? 'flex' : 'none';", "advPanel.style.display = mode === 'advanced' ? 'block' : 'none';"),
        ("document.getElementById('fomInputs').style.display = this.checked ? 'flex' : 'none';", "document.getElementById('fomInputs').style.display = this.checked ? 'block' : 'none';"),
        # generated key/value tiles -> fact rows
        ("""return '<div style="background:var(--bg-primary);border:1px solid var(--bg-tertiary);border-radius:8px;padding:0.5rem 0.6rem;"><div class="metric-label" data-explain="' + _ek + '" style="font-size:0.62rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em;">' + label + '</div><div style="font-weight:700;font-family:\\'JetBrains Mono\\',monospace;font-size:0.85rem;color:var(--text-primary);">' + value + '</div></div>';""",
         """return '<div class="metric-box"><div class="metric-label" data-explain="' + _ek + '">' + label + '</div><div class="metric-value">' + value + '</div></div>';"""),
        ("""document.getElementById('dsCapexRows').innerHTML = '<div style="font-size:0.68rem;color:var(--text-secondary);margin-bottom:0.3rem;font-weight:700;">DEEP-SEA CAPEX BREAKDOWN</div>' + rows.map(r => '<div style="display:flex;justify-content:space-between;font-size:0.74rem;padding:2px 0;border-bottom:1px dashed var(--bg-tertiary);color:var(--text-primary);"><span>' + r[0] + '</span><span style="font-family:\\'JetBrains Mono\\',monospace;font-weight:600;">' + formatCurrency(r[1]) + '</span></div>').join('');""",
         """document.getElementById('dsCapexRows').innerHTML = '<h4 class="res-sub">Deep-sea CAPEX by item</h4><div class="kv-list" data-rz-fact-list>' + rows.map(r => '<div class="metric-box"><div class="metric-label">' + r[0] + '</div><div class="metric-value">' + formatCurrency(r[1]) + '</div></div>').join('') + '</div>';"""),
        ("(ds.warnings || []).map(w => '<div>⚠ ' + w + '</div>').join('')", "(ds.warnings || []).map(w => '<p>' + w + '</p>').join('')"),
        ("chip.style.background = ds.env.deltaTCompliant ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'; chip.style.color = ds.env.deltaTCompliant ? '#059669' : '#dc2626';",
         "chip.setAttribute('data-state', ds.env.deltaTCompliant ? 'ok' : 'hazard');"),
        ("chip.textContent = ds.env.deltaTCompliant ? 'ΔT ≤ 5 °C COMPLIANT' : 'ΔT EXCEEDS ENV LIMIT';", "chip.textContent = ds.env.deltaTCompliant ? 'ΔT ≤ 5 °C compliant' : 'ΔT over the environmental limit';"),
        # uncertainty: the panel is shown before the figures are drawn (they size to its width); own SVG figures
        ("            var base = result.total;\n            // Cost drivers", "            panel.style.display = 'block';\n            var base = result.total;\n            // Cost drivers"),
        ("document.getElementById('uncHist').innerHTML = E.charts.histogram(mc.samples, { width: 440, height: 150, accent: '#64748b', bins: 26 });",
         "document.getElementById('uncHist').innerHTML = capexHistSvg(mc.samples, mc, document.getElementById('uncHist').clientWidth);"),
        ("document.getElementById('uncTornado').innerHTML = E.charts.tornado(tor, { width: 440, accent: '#64748b' });",
         "tor.sort(function (x, y) { return Math.abs(y.high - y.low) - Math.abs(x.high - x.low); });\n                document.getElementById('uncTornado').innerHTML = capexTornadoSvg(tor, document.getElementById('uncTornado').clientWidth);"),
        ("        function renderExtraRow(icon, label, cost, color, maxCost, total) {", HIST_FN + "\n        function renderExtraRow(icon, label, cost, color, maxCost, total) {"),
        # compare: no painted buttons, the label span survives, B banner is a block note
        ("document.getElementById('scenarioBBanner').style.display = 'flex';", "document.getElementById('scenarioBBanner').style.display = 'block';"),
        ("""            btn.innerHTML = '<i class="fas fa-check-circle"></i> Scenario A Saved';
            btn.style.background = 'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.1))';
            btn.style.borderColor = 'rgba(16,185,129,0.5)';
            btn.style.color = '#34d399';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            btn.style.cursor = 'default';
""", """            btn.innerHTML = '<span id="btnSaveLabel">A saved</span>';
            btn.disabled = true;
"""),
        ("""            btn.innerHTML = '<i class="fas fa-bookmark"></i> Save Scenario A';
            btn.style.background = 'linear-gradient(135deg,rgba(251,191,36,0.25),rgba(245,158,11,0.15))';
            btn.style.borderColor = 'rgba(251,191,36,0.6)';
            btn.style.color = '#fbbf24';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
""", """            btn.innerHTML = '<span id="btnSaveLabel">Save as A</span>';
            btn.disabled = false;
"""),
        # premium output: a block of fact lists, the benchmark label stays inside the panel
        ("document.getElementById('premiumOutput').style.display = 'flex';", "document.getElementById('premiumOutput').style.display = 'block';"),
        ("document.getElementById('benchmarkLabel').style.left = pct + '%';", "document.getElementById('benchmarkLabel').style.left = Math.min(86, Math.max(14, pct)) + '%';"),
        # gating: text, not lock icons, opacity or blur
        ("if (btnSave) { btnSave.classList.add('gated-btn','clickable'); btnSave.style.opacity = '0.6'; }", "if (btnSave) btnSave.classList.add('gated-btn');"),
        ("if (btnPdf) { btnPdf.classList.add('gated-btn','clickable'); btnPdf.style.opacity = '0.6'; }", "if (btnPdf) btnPdf.classList.add('gated-btn');"),
        ("""if (btnSaveLabel) btnSaveLabel.innerHTML = '<i class="fas fa-lock" style="font-size:0.65rem;margin-right:3px;color:#94a3b8;"></i>Save Scenario A';""", "if (btnSaveLabel) btnSaveLabel.textContent = 'Save as A · Full';"),
        ("""if (btnPdfLabel) btnPdfLabel.innerHTML = '<i class="fas fa-lock" style="font-size:0.65rem;margin-right:3px;color:#94a3b8;"></i>Export PDF';""", "if (btnPdfLabel) btnPdfLabel.textContent = 'Export PDF · Full';"),
        ("if (btnSave) { btnSave.classList.remove('gated-btn','clickable'); btnSave.style.opacity = '1'; }", "if (btnSave) btnSave.classList.remove('gated-btn');"),
        ("if (btnPdf) { btnPdf.classList.remove('gated-btn','clickable'); btnPdf.style.opacity = '1'; }", "if (btnPdf) btnPdf.classList.remove('gated-btn');"),
        ("if (btnSaveLabel) btnSaveLabel.textContent = 'Save Scenario A';", "if (btnSaveLabel) btnSaveLabel.textContent = 'Save as A';"),
        ("if (watermark) watermark.style.display = isFree ? 'block' : 'none';", "if (watermark) watermark.style.display = isFree ? '' : 'none';"),
        ("""advBtn.insertAdjacentHTML('beforeend', '<i class="fas fa-lock gate-lock-icon" style="margin-left:6px;font-size:0.65rem;color:#94a3b8;"></i>');""",
         """advBtn.insertAdjacentHTML('beforeend', '<span class="gate-lock-icon"> · Full</span>');"""),
        ("""                    compareGrid.style.filter = 'blur(4px)';
                    compareGrid.style.pointerEvents = 'none';
                    compareGrid.style.opacity = '0.5';""", """                    compareGrid.hidden = true;"""),
        ("""                    compareGrid.style.filter = 'none';
                    compareGrid.style.pointerEvents = 'auto';
                    compareGrid.style.opacity = '1';""", """                    compareGrid.hidden = false;"""),
        # sign-in button and tier badge: words, no crown, no PRO ACTIVE pill
        ("""            premBtn.innerHTML = '<i class="fas fa-crown" style="margin-right:6px;"></i>Premium Active';
            // Show tier badge
            const premBadge = document.getElementById('premiumBadge');
            premBadge.textContent = 'PRO ACTIVE';
            premBadge.style.display = 'inline-flex';
            premBadge.style.background = '#64748b';
            premBadge.style.color = 'white';
""", """            premBtn.textContent = 'Full analysis on';
"""),
        ("msg.style.display = 'block'; msg.style.color = ok ? '#34d399' : '#f87171'; msg.textContent = t;", "msg.style.display = 'block'; msg.textContent = t;"),
    ])
    s = js_replace(s, [("""premBtn.innerHTML = '<i class="fas fa-crown" style="margin-right:6px;"></i>Premium';""", "premBtn.textContent = 'Sign in';")], where='all')
    s = js_swap_between(s, 'function renderComparison() {', '// Fixed order for consistent comparison display', COMPARE_FN)
    s = js_swap_between(s, 'function renderScenarioCard(label, data, accent) {', '// ═══ TIMELINE GANTT HTML BUILDER (for PDF) ═══', CARD_FN)
    s = js_swap_between(s, "let tlHTML = '';", '// 5. Sustainability Metrics (region-specific)', GANTT_JS)
    s = js_swap_between(s, 'smEl.innerHTML = `', '// Report date', SUSTAIN_JS)
    return s


CONFIG = {
    'keep_register': True,
    'eyebrow': 'DC Solutions · <b>Calculator</b> · CAPEX',
    'h1': 'Data center construction cost <span class="muted">by system, tier and region</span>',
    'lede': 'Total CAPEX and its split by system — electrical, cooling, building, UPS, generators, fire, BMS, network and the rest — '
            'from IT load, rack density, cooling, redundancy, building type, seismic zone and region. RZEngine computes it in your '
            'browser; every figure follows the inputs.',
    'basis': 'engine RZEngine capex.detailed · basis Turner &amp; Townsend, JLL, CBRE cost benchmarks, Uptime Tier I–IV · updated 2026-10',
    'crumb': '<a href="datacenter-solutions.html">DC Solutions</a> → Calculator → CAPEX',
    'res_basis': 'total = Σ system cost + soft costs + contingency',
    'manual': ('manual/capex.html', 'Technical manual and methodology'),
    'full_title': 'Full analysis',
    'full_desc': 'rack count, white space, build schedule, $/kW benchmark, sustainability, scenario comparison and the PDF report',
    'formulas': [
        ('System cost', 'C_i = f_i ($/kW) · P_IT · M_location · M_i'),
        ('M_electrical', 'M_redundancy · M_rack · M_distribution · M_transformer'),
        ('M_cooling', 'M_cooling type · M_rack'),
        ('M_generator', 'M_redundancy · (1 + 0.008 · (h_fuel − 24)) · M_fuel type'),
        ('M_location', 'region factor, or city $/W ÷ 4.65 $/W'),
        ('Contingency', '(Σ C_i + design + PM) · 5 % simple, slider in advanced (10 % default)'),
        ('Total', 'Σ C_i + design + PM + contingency + front-of-meter + renewables'),
        ('Energy cost', 'P_IT · PUE(cooling, rack) · 8,760 h · tariff'),
        ('Cost per kW', 'total / P_IT'),
    ],
    'against': ['Turner &amp; Townsend Data Centre Cost Index', 'JLL Data Center Outlook', 'CBRE data center benchmarks',
                'Uptime Institute Tier I–IV', 'ASHRAE 34 refrigerant safety'],
    'links': [('glossary.html', 'Glossary'), ('opex-calculator.html', 'OPEX calculator'), ('tco-calculator.html', 'TCO calculator'),
              ('pue-calculator.html', 'PUE calculator'), ('datacenter-solutions.html', 'DC Solutions'), ('account.html', 'My account and saved scenarios')],
    'head_drop': [r'\s*<link rel="preload" as="image" href="assets/capex-og\.jpg">'],
    'hero_drop': [r'\s*<!-- Brief -->\s*<section class="brief-section">.*?</section>'],
    'shell': [
        ('<section class="calculator-section" data-explain-scan>', '<section class="calculator-section wrap" data-explain-scan>'),
        ('<div class="simulator-container">', '<div class="simulator-container tool-bench">'),
        ('<div class="simulator-inputs" data-explain-scan>', '<div class="simulator-inputs tool-inputs" data-explain-scan>'),
    ],
    'toolbar': toolbar, 'pre_clean': pre_clean, 'results': results, 'js': js,
}
