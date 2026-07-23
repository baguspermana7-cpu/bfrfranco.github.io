/* ============================================================
   ltc-lab-ui.js — LTC Modelling Lab dashboard revamp UI
   ADDITIVE — does NOT replace existing engine functionality
   v2026-07-22-ltc
   ============================================================ */
(function () {
    'use strict';

    // Guard double init
    if (window.__ltcLabUI) return;
    window.__ltcLabUI = true;

    // ── Slider config ────────────────────────────────────────
    var SLIDERS = [
        { id: 'inItLoad',        label: 'IT Load',            min: 0.5, max: 80,  step: 0.5, unit: 'MW' },
        { id: 'inLiquidCapture', label: 'Liquid Capture',     min: 0,   max: 100, step: 1,   unit: '%' },
        { id: 'inSupplyTemp',    label: 'Supply Temperature', min: 16,  max: 42,  step: 0.1, unit: '°C' },
        { id: 'inReturnTemp',    label: 'Return Temperature', min: 16,  max: 60,  step: 0.1, unit: '°C' },
        { id: 'inPumpHead',      label: 'Pump Head',          min: 5,   max: 90,  step: 0.5, unit: 'm' },
        { id: 'inPumpEff',       label: 'Pump Efficiency',    min: 35,  max: 95,  step: 1,   unit: '%' }
    ];

    // ── Architecture presets ─────────────────────────────────
    var ARCHS = [
        { key: 'direct_liquid',  icon: '≋', name: 'Direct Liquid',   sub: 'Warm-Water LTC' },
        { key: 'hybrid',         icon: '⊕', name: 'Hybrid',          sub: 'Mixed Cooling' },
        { key: 'air_inrow_dahu', icon: '≈', name: 'Air In-Row/DAHU', sub: 'Air Cooling' }
    ];

    // ── Donut colours ────────────────────────────────────────
    var DONUT_COLORS = ['#0b5fea','#337eea','#e5484d','#f59e0b','#12a150','#8b5cf6'];

    // ── Init ─────────────────────────────────────────────────
    function init() {
        document.body.classList.add('ltc-revamp');
        document.body.classList.add('ltc-booting');   // one-time entrance stagger
        setTimeout(function () { document.body.classList.remove('ltc-booting'); }, 1400);
        buildDashboard();
        bindSliders();
        bindArchPresets();
        bindTabs();
        bindRunBtn();
        bindFlowScenarios();
        bindReportCompare();
        buildTopbar();
        // Swap the P&ID render (day/night) whenever the theme attribute changes.
        try {
            new MutationObserver(syncPidTheme).observe(document.documentElement,
                { attributes: true, attributeFilter: ['data-theme'] });
        } catch (e) {}
        patchApplyModelToUI();
        // Initial paint: the engine's first applyModelToUI runs BEFORE this scaffold
        // exists (both scripts are `defer`; the engine's DOMContentLoaded handler is
        // registered first), so its hook call hit empty DOM. Render the cached model
        // now that the scaffold is built. Fall back to a fresh run if none cached.
        if (window.__ltcLastModel) {
            ltcUiRender(window.__ltcLastModel);
        } else {
            var rc = document.getElementById('runCalc');
            if (rc) rc.click();
        }
        // Wire hover-explanations (RZExplain) across the freshly-built dashboard so
        // every glossary term (PUE, COP, WUE, CDU, ΔT, economizer…) is explainable.
        try {
            if (window.RZExplain && typeof window.RZExplain.scan === 'function') {
                window.RZExplain.scan(document.querySelector('.ltc-dashboard') || document.body);
            }
        } catch (e) {}
    }

    // ════════════════════════════════════════════════════════
    // buildDashboard — create 3-col scaffold
    // ════════════════════════════════════════════════════════
    function buildDashboard() {
        var mainEl = document.querySelector('main') || document.body;

        // ── LEFT RAIL ──────────────────────────────────────
        var leftRail = el('aside', { id: 'ltc-left', className: 'ltc-left-rail' });

        // Rail card
        var leftCard = el('div', { className: 'ltc-rail-card' });

        // Header
        var railHeader = el('div', { className: 'ltc-rail-header' });
        railHeader.appendChild(el('span', { className: 'ltc-rail-title', textContent: 'INPUTS' }));
        var resetBtn = el('button', { className: 'ltc-reset-btn', id: 'ltcResetBtn', textContent: '↻ Reset' });
        railHeader.appendChild(resetBtn);
        leftCard.appendChild(railHeader);

        // Primary sliders section
        var sliderSection = el('div', { className: 'ltc-primary-sliders' });
        var sliderSectionLbl = el('div', { className: 'ltc-section-label' });
        sliderSectionLbl.innerHTML = 'PRIMARY SLIDERS <span class="ltc-muted">(Flow-Driving Tier)</span>';
        sliderSection.appendChild(sliderSectionLbl);
        var slidersHost = el('div', { id: 'ltc-sliders-host' });
        sliderSection.appendChild(slidersHost);
        leftCard.appendChild(sliderSection);

        // Architecture preset
        var archSection = el('div', { className: 'ltc-arch-preset-section' });
        archSection.appendChild(el('div', { className: 'ltc-section-label', textContent: 'ARCHITECTURE PRESET' }));
        var archCards = el('div', { className: 'ltc-arch-cards', id: 'ltcArchCards' });
        archSection.appendChild(archCards);
        leftCard.appendChild(archSection);

        // Other params
        var otherParams = el('div', { className: 'ltc-other-params' });
        var collapseBtn = el('button', { className: 'ltc-collapse-btn', id: 'ltcOtherParamsBtn' });
        collapseBtn.innerHTML = 'OTHER PARAMETERS <span id="ltcOtherParamsCount"></span> <span class="ltc-chevron">▾</span>';
        var otherBody = el('div', { id: 'ltcOtherParamsBody', className: 'ltc-other-params-body' });
        otherBody.style.display = 'none';
        otherParams.appendChild(collapseBtn);
        otherParams.appendChild(otherBody);
        leftCard.appendChild(otherParams);

        collapseBtn.addEventListener('click', function () {
            var open = otherBody.style.display !== 'none';
            otherBody.style.display = open ? 'none' : 'block';
            collapseBtn.classList.toggle('open', !open);
        });

        // Run section
        var runSection = el('div', { className: 'ltc-run-section' });
        var runBtn = el('button', { className: 'ltc-run-btn', id: 'ltcRunBtn', textContent: '▶ Run Model' });
        var lastRun = el('div', { className: 'ltc-last-run', id: 'ltcLastRun', textContent: 'Last run: —' });
        runSection.appendChild(runBtn);
        runSection.appendChild(lastRun);
        leftCard.appendChild(runSection);

        leftRail.appendChild(leftCard);

        // ── CENTER ─────────────────────────────────────────
        var centerCol = el('div', { id: 'ltc-center', className: 'ltc-center-col' });

        // Breadcrumb
        centerCol.appendChild(el('div', { className: 'ltc-breadcrumb', textContent: 'Home › DC Solutions › Technical Manuals' }));

        // Title row
        var titleRow = el('div', { className: 'ltc-title-row' });
        titleRow.appendChild(el('h1', { className: 'ltc-page-title', textContent: 'Liquid-to-Chip System Modelling Lab' }));
        titleRow.appendChild(el('span', { className: 'ltc-edu-badge', textContent: 'SIMULATED / EDUCATIONAL MODEL ⓘ' }));
        centerCol.appendChild(titleRow);

        // Subtitle
        centerCol.appendChild(el('p', { className: 'ltc-subtitle', textContent: 'Steady-state modelling for design, analysis, and optimization of liquid-to-chip cooled data centers' }));

        // System overview card
        var overviewCard = el('div', { className: 'ltc-overview-card' });
        overviewCard.appendChild(el('div', { className: 'ltc-overview-label', textContent: '● SYSTEM OVERVIEW' }));
        var schematic = el('div', { className: 'ltc-schematic', id: 'ltcSchematic' });
        schematic.innerHTML = buildSystemOverviewSVG();
        overviewCard.appendChild(schematic);
        centerCol.appendChild(overviewCard);

        // KPI strip
        var kpiStrip = el('div', { className: 'ltc-kpi-strip', id: 'ltcKpiStrip' });
        kpiStrip.innerHTML = [
            kpiCard('kpiItLoad',  'IT Load',        '—', 'MW', ''),
            kpiCard('kpiLiquid',  'Liquid Cooling',  '—', 'MW', ''),
            kpiCard('kpiFlow',    'Total Flow',      '—', 'LPM', ''),
            kpiCard('kpiPump',    'Pump Power',      '—', 'kW', ''),
            kpiCard('kpiPue',     'PUE',             '—', '',   'ltc-kpi-good', 'ltc-kpi-green'),
            kpiCard('kpiCop',     'System COP',      '—', '',   'ltc-kpi-good', 'ltc-kpi-green')
        ].join('');
        centerCol.appendChild(kpiStrip);

        // Tabs bar
        var tabsBar = el('div', { className: 'ltc-tabs-bar' });
        var tabDefs = [
            { key: 'results',   label: 'RESULTS' },
            { key: 'detailed',  label: 'DETAILED CALCULATION' },
            { key: 'flow',      label: 'FLOW DIAGRAM' },
            { key: 'charts',    label: 'CHARTS' },
            { key: 'report',    label: 'REPORT' }
        ];
        tabDefs.forEach(function (t, i) {
            var btn = el('button', { className: 'ltc-tab-btn' + (i === 0 ? ' ltc-tab-active' : ''), textContent: t.label });
            btn.dataset.tab = t.key;
            tabsBar.appendChild(btn);
        });
        centerCol.appendChild(tabsBar);

        // Tab panels
        var panelResults   = el('div', { id: 'ltcTabResults',   className: 'ltc-tab-panel ltc-tab-panel-active' });
        var panelDetailed  = el('div', { id: 'ltcTabDetailed',  className: 'ltc-tab-panel' });
        var panelFlow      = el('div', { id: 'ltcTabFlow',      className: 'ltc-tab-panel' });
        var panelCharts    = el('div', { id: 'ltcTabCharts',    className: 'ltc-tab-panel' });
        var panelReport    = el('div', { id: 'ltcTabReport',    className: 'ltc-tab-panel' });

        [panelDetailed, panelFlow, panelCharts, panelReport].forEach(function (p) {
            p.style.display = 'none';
        });

        // Results grid placeholder
        panelResults.innerHTML = '<div class="ltc-results-grid" id="ltcResultsGrid"></div><div class="ltc-results-bottom" id="ltcResultsBottom"></div>';

        // Hosts for other tabs
        panelDetailed.appendChild(el('div', { id: 'ltcDetailedHost' }));
        // Living FLOW: scenario replay — drives the engine's real failureMode recompute.
        var scen = el('div', { className: 'ltc-overview-card ltc-scenario-card' });
        scen.innerHTML = '<div class="ltc-overview-label">● OPERATING SCENARIO <span class="ltc-muted">— engine recomputes the whole model under fault stress</span></div>' +
            '<div class="ltc-scenario-btns" id="ltcScenarioBtns">' +
            [['normal','Normal'],['pump_degraded','Pump Degraded'],['sensor_degraded','Sensor Degraded'],
             ['heatwave','Heatwave'],['grid_stress','Grid Stress'],['redundancy_degraded','Redundancy Degraded']]
             .map(function (s) { return '<button type="button" class="ltc-scenario-btn" data-scen="' + s[0] + '">' + s[1] + '</button>'; }).join('') +
            '</div>' +
            '<div class="ltc-scenario-readout" id="ltcScenarioReadout"></div>';
        panelFlow.appendChild(scen);
        panelFlow.appendChild(el('div', { id: 'ltcFlowHost' }));
        // Sensitivity TORNADO (two-directional, engine-computed) — comprehensiveness add
        var tornadoCard = el('div', { className: 'ltc-overview-card ltc-tornado-card' });
        tornadoCard.innerHTML = '<div class="ltc-overview-label">● SENSITIVITY TORNADO <span class="ltc-muted">— ΔPUE for ±1 step per input (engine-computed)</span></div>' +
            '<div id="ltcTornado" class="ltc-tornado"></div>';
        panelCharts.appendChild(tornadoCard);
        panelCharts.appendChild(el('div', { id: 'ltcChartsHost' }));
        // REPORT: A/B scenario compare — pin a design, compare current vs it (engine values).
        var cmp = el('div', { className: 'ltc-overview-card ltc-compare-card' });
        cmp.innerHTML = '<div class="ltc-overview-label">● SCENARIO COMPARE <span class="ltc-muted">— pin a design (A), tune inputs, compare vs current (B)</span></div>' +
            '<div class="ltc-compare-actions">' +
            '<button type="button" class="ltc-nav-btn ltc-nav-btn-primary" id="ltcPinA">📌 Pin current as A</button>' +
            '<button type="button" class="ltc-nav-btn ltc-nav-btn-outline" id="ltcClearA">Clear</button>' +
            '</div>' +
            '<div id="ltcCompareTable" class="ltc-compare-table"></div>';
        panelReport.appendChild(cmp);
        panelReport.appendChild(el('div', { id: 'ltcReportHost' }));

        centerCol.appendChild(panelResults);
        centerCol.appendChild(panelDetailed);
        centerCol.appendChild(panelFlow);
        centerCol.appendChild(panelCharts);
        centerCol.appendChild(panelReport);

        // ── RIGHT RAIL ─────────────────────────────────────
        var rightRail = el('aside', { id: 'ltc-right', className: 'ltc-right-rail' });

        // Compliance card
        var compCard = el('div', { className: 'ltc-rail-card' });
        var compHeader = el('div', { className: 'ltc-rail-header' });
        compHeader.appendChild(el('span', { className: 'ltc-rail-title', textContent: 'COMPLIANCE & STANDARDS' }));
        compHeader.appendChild(el('span', { className: 'ltc-pass-pill', id: 'ltcCompliancePill', textContent: '● PASS' }));
        compCard.appendChild(compHeader);
        compCard.appendChild(el('div', { className: 'ltc-compliance-list', id: 'ltcComplianceList' }));
        rightRail.appendChild(compCard);

        // Design Status card
        var dsCard = el('div', { className: 'ltc-rail-card' });
        var dsHeader = el('div', { className: 'ltc-rail-header' });
        dsHeader.appendChild(el('span', { className: 'ltc-rail-title', textContent: 'DESIGN STATUS' }));
        dsCard.appendChild(dsHeader);
        var dsBody = el('div', { className: 'ltc-design-status' });
        dsBody.innerHTML = [
            '<div class="ltc-design-top">',
            '<div class="ltc-radial-wrap">',
            '<svg class="ltc-radial-svg" viewBox="0 0 120 120" id="ltcRadialSvg">',
            '<circle class="ltc-radial-track" cx="60" cy="60" r="48" fill="none" stroke-width="10"/>',
            '<circle class="ltc-radial-bar" cx="60" cy="60" r="48" fill="none" stroke-width="10" stroke-linecap="round" transform="rotate(-90 60 60)" id="ltcRadialBar"/>',
            '<text class="ltc-radial-pct" x="60" y="68" text-anchor="middle" id="ltcRadialPct">—</text>',
            '</svg>',
            '</div>',
            '<div class="ltc-design-meta">',
            '<div class="ltc-design-scorelbl">Design Score</div>',
            '<div class="ltc-design-grade" id="ltcDesignGrade">—</div>',
            '</div>',
            '</div>',
            '<div class="ltc-sub-bars" id="ltcSubBars"></div>'
        ].join('');
        dsCard.appendChild(dsBody);
        rightRail.appendChild(dsCard);

        // Sensitivity card
        var sensCard = el('div', { className: 'ltc-rail-card' });
        var sensHeader = el('div', { className: 'ltc-rail-header' });
        sensHeader.appendChild(el('span', { className: 'ltc-rail-title', textContent: 'SENSITIVITY ANALYSIS' }));
        sensCard.appendChild(sensHeader);
        sensCard.appendChild(el('div', { className: 'ltc-sens-label', textContent: 'Top 5: Impact on PUE' }));
        sensCard.appendChild(el('div', { className: 'ltc-sens-bars', id: 'ltcSensBars' }));
        rightRail.appendChild(sensCard);

        // Scenario Info card
        var scenCard = el('div', { className: 'ltc-rail-card ltc-scenario-card' });
        var scenHeader = el('div', { className: 'ltc-rail-header' });
        scenHeader.appendChild(el('span', { className: 'ltc-rail-title', textContent: 'SCENARIO INFO' }));
        scenCard.appendChild(scenHeader);
        scenCard.appendChild(el('div', { className: 'ltc-scenario-list', id: 'ltcScenarioList' }));
        var scenNote = el('p', { className: 'ltc-scenario-note', textContent: 'This is a SIMULATED / educational model. For design and commissioning, use site-specific thermal & hydraulic analysis.' });
        scenCard.appendChild(scenNote);
        rightRail.appendChild(scenCard);

        // ── Assemble dashboard ─────────────────────────────
        var dashboard = el('div', { id: 'ltc-dashboard', className: 'ltc-dashboard' });
        dashboard.appendChild(leftRail);
        dashboard.appendChild(centerCol);
        dashboard.appendChild(rightRail);

        // Insert at beginning of main
        if (mainEl.firstChild) {
            mainEl.insertBefore(dashboard, mainEl.firstChild);
        } else {
            mainEl.appendChild(dashboard);
        }

        // Move existing content into tab hosts
        relocateExistingPanels();
    }

    // ── Helper: kpi card HTML ─────────────────────────────
    function kpiCard(id, label, val, unit, extraClass, valClass) {
        return '<div class="ltc-kpi-card ' + (extraClass || '') + '">' +
            '<div class="ltc-kpi-label">' + label + '</div>' +
            '<div class="ltc-kpi-value ' + (valClass || '') + '" id="' + id + '">' + val + '</div>' +
            (unit ? '<div class="ltc-kpi-unit">' + unit + '</div>' : '') +
            '</div>';
    }

    // ════════════════════════════════════════════════════════
    // relocateExistingPanels
    // ════════════════════════════════════════════════════════
    function relocateExistingPanels() {
        // Move pipeline/flow diagram section
        var flowSect = document.querySelector('.pipeline-section, #pipelineSection, .flow-section, [id*="pipeline"]');
        var flowHost = document.getElementById('ltcFlowHost');
        if (flowSect && flowHost) flowHost.appendChild(flowSect);

        // Move charts / sankey / pareto
        var chartSect = document.querySelector('.sankey-section, .pareto-section, [id*="sankey"], [id*="pareto"], [id*="monteCarlo"]');
        var chartsHost = document.getElementById('ltcChartsHost');
        if (chartSect && chartsHost) chartsHost.appendChild(chartSect);

        // Move calc output panel / detailed section
        var detailedSect = document.querySelector('.calc-output-section, [id*="calcOutput"], .detailed-section, [id*="detailed"]');
        var detailedHost = document.getElementById('ltcDetailedHost');
        if (detailedSect && detailedHost) detailedHost.appendChild(detailedSect);

        // Move report section
        var reportSect = document.querySelector('.report-section, [id*="report"], .pdf-section, [id*="pdf"]');
        var reportHost = document.getElementById('ltcReportHost');
        if (reportSect && reportHost) reportHost.appendChild(reportSect);
    }

    // ════════════════════════════════════════════════════════
    // buildSystemOverviewSVG — inline SVG schematic
    // ════════════════════════════════════════════════════════
    function pidThemeName() {
        return (document.documentElement.getAttribute('data-theme') === 'dark') ? 'night' : 'day';
    }
    function buildSystemOverviewSVG() {
        // Pixel-match P&ID: the reference equipment render (dry-cooler bank → pump →
        // plate heat-exchanger → cold-plate racks, blue supply / red return pipes) is
        // used verbatim as a theme-swapped image; only the Supply/Return temperature
        // chips are overlaid live-wired to the model (they cover the baked labels).
        return '' +
            '<div class="ltc-pid">' +
                '<img class="ltc-pid-img" id="ltcPidImg" alt="Liquid-to-Chip P&amp;ID: dry-cooler bank, pump, heat exchanger, cold-plate racks" ' +
                    'src="assets/ltc/pid-' + pidThemeName() + '.png?v=2026-07-23b">' +
                '<span class="ltc-pid-chip ltc-pid-supply" id="schSupplyT">Supply —&nbsp;°C</span>' +
                '<span class="ltc-pid-chip ltc-pid-return" id="schReturnT">Return —&nbsp;°C</span>' +
            '</div>';
    }
    function syncPidTheme() {
        var img = document.getElementById('ltcPidImg');
        if (!img) return;
        var want = 'assets/ltc/pid-' + pidThemeName() + '.png?v=2026-07-23b';
        if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    }

    // ════════════════════════════════════════════════════════
    // bindSliders — 6 two-way sliders
    // ════════════════════════════════════════════════════════
    function bindSliders() {
        var host = document.getElementById('ltc-sliders-host');
        if (!host) return;

        SLIDERS.forEach(function (cfg) {
            var origInput = document.getElementById(cfg.id);
            var initVal = origInput ? parseFloat(origInput.value) || cfg.min : cfg.min;

            // Build row
            var row = el('div', { className: 'ltc-slider-row' });
            var header = el('div', { className: 'ltc-slider-header' });

            var lbl = el('span', { className: 'ltc-slider-label', textContent: cfg.label + ' ⓘ' });
            var valBox = el('div', { className: 'ltc-slider-value-box' });
            var numbox = el('input', {
                type: 'number',
                className: 'ltc-slider-numbox',
                id: 'ltcNum_' + cfg.id,
                min: cfg.min,
                max: cfg.max,
                step: cfg.step,
                value: initVal
            });
            var unit = el('span', { className: 'ltc-slider-unit', textContent: cfg.unit });
            valBox.appendChild(numbox);
            valBox.appendChild(unit);
            header.appendChild(lbl);
            header.appendChild(valBox);

            var range = el('input', {
                type: 'range',
                className: 'ltc-range',
                id: 'ltcRange_' + cfg.id,
                min: cfg.min,
                max: cfg.max,
                step: cfg.step,
                value: initVal
            });

            row.appendChild(header);
            row.appendChild(range);
            host.appendChild(row);

            // Update range fill visual via CSS custom property
            function updateRangeFill(val) {
                var pct = ((val - cfg.min) / (cfg.max - cfg.min)) * 100;
                range.style.setProperty('--range-pct', pct.toFixed(1) + '%');
            }
            updateRangeFill(initVal);

            // range → numbox + orig
            range.addEventListener('input', function () {
                var v = parseFloat(range.value);
                numbox.value = v;
                updateRangeFill(v);
                if (origInput) {
                    origInput.value = v;
                    origInput.dispatchEvent(new Event('input', { bubbles: true }));
                    origInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            // numbox → range + orig
            numbox.addEventListener('input', function () {
                var v = parseFloat(numbox.value);
                if (!isNaN(v) && v >= cfg.min && v <= cfg.max) {
                    range.value = v;
                    updateRangeFill(v);
                    if (origInput) {
                        origInput.value = v;
                        origInput.dispatchEvent(new Event('input', { bubbles: true }));
                        origInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });

            // Keep numbox in sync if original input is changed externally
            if (origInput) {
                origInput.addEventListener('change', function () {
                    var v = parseFloat(origInput.value);
                    if (!isNaN(v)) {
                        numbox.value = v;
                        range.value = v;
                        updateRangeFill(v);
                    }
                });
            }
        });
    }

    // ════════════════════════════════════════════════════════
    // bindArchPresets
    // ════════════════════════════════════════════════════════
    function bindArchPresets() {
        var host = document.getElementById('ltcArchCards');
        if (!host) return;

        var archSelect = document.getElementById('inCoolingArchitecture');
        var currentArch = archSelect ? archSelect.value : 'direct_liquid';

        ARCHS.forEach(function (a) {
            var card = el('div', {
                className: 'ltc-arch-card' + (a.key === currentArch ? ' ltc-arch-active' : '')
            });
            card.dataset.arch = a.key;
            card.innerHTML = '<div class="ltc-arch-icon">' + a.icon + '</div>' +
                '<div class="ltc-arch-name">' + a.name + '</div>' +
                '<div class="ltc-arch-sub">' + a.sub + '</div>';

            card.addEventListener('click', function () {
                host.querySelectorAll('.ltc-arch-card').forEach(function (c) {
                    c.classList.remove('ltc-arch-active');
                });
                card.classList.add('ltc-arch-active');
                if (archSelect) {
                    archSelect.value = a.key;
                    archSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            host.appendChild(card);
        });

        // Keep arch cards in sync if select changes externally
        if (archSelect) {
            archSelect.addEventListener('change', function () {
                host.querySelectorAll('.ltc-arch-card').forEach(function (c) {
                    c.classList.toggle('ltc-arch-active', c.dataset.arch === archSelect.value);
                });
            });
        }
    }

    // ════════════════════════════════════════════════════════
    // bindTabs
    // ════════════════════════════════════════════════════════
    function bindTabs() {
        var tabsBar = document.querySelector('.ltc-tabs-bar');
        if (!tabsBar) return;

        var panelMap = {
            results:  'ltcTabResults',
            detailed: 'ltcTabDetailed',
            flow:     'ltcTabFlow',
            charts:   'ltcTabCharts',
            report:   'ltcTabReport'
        };

        tabsBar.querySelectorAll('.ltc-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                // Deactivate all
                tabsBar.querySelectorAll('.ltc-tab-btn').forEach(function (b) {
                    b.classList.remove('ltc-tab-active');
                });
                Object.values(panelMap).forEach(function (pid) {
                    var p = document.getElementById(pid);
                    if (p) p.style.display = 'none';
                });

                // Activate selected (with entrance animation)
                btn.classList.add('ltc-tab-active');
                var activePanel = document.getElementById(panelMap[btn.dataset.tab]);
                if (activePanel) {
                    activePanel.style.display = '';
                    activePanel.classList.remove('ltc-tab-anim');
                    void activePanel.offsetWidth;   // reflow to restart the animation
                    activePanel.classList.add('ltc-tab-anim');
                }
            });
        });
    }

    // ════════════════════════════════════════════════════════
    // activateLtcTab — programmatic tab switch (topbar shortcuts)
    // ════════════════════════════════════════════════════════
    function activateLtcTab(name) {
        var b = document.querySelector('.ltc-tab-btn[data-tab="' + name + '"]');
        if (b) b.click();
    }

    // ════════════════════════════════════════════════════════
    // buildTopbar — mockup topbar: center nav + right action cluster.
    // Non-destructive: keeps the existing theme toggle + auth widget +
    // hamburger. Actions wire to REAL existing handlers (no fake buttons).
    // ════════════════════════════════════════════════════════
    function buildTopbar() {
        var navContainer = document.querySelector('.navbar .nav-container');
        if (!navContainer || navContainer.querySelector('.ltc-nav-center')) return;
        var navLinks = navContainer.querySelector('.nav-links');

        // Center nav (real destinations)
        var center = el('div', { className: 'ltc-nav-center' });
        [
            ['Home', 'index.html', false],
            ['DC Solutions', 'datacenter-solutions.html', false],
            ['Technical Manuals', 'manual/index.html', false],
            ['LTC Modelling Lab', '#', true],
            ['Contact', 'index.html#contact', false]
        ].forEach(function (l) {
            var a = el('a', { href: l[1], textContent: l[0],
                className: 'ltc-nav-link' + (l[2] ? ' ltc-nav-link-active' : '') });
            if (l[2]) a.addEventListener('click', function (e) { e.preventDefault(); });
            center.appendChild(a);
        });
        if (navLinks) navContainer.insertBefore(center, navLinks);
        else navContainer.appendChild(center);

        // Right action cluster → real handlers
        var actions = el('div', { className: 'ltc-nav-actions' });
        var bell = el('a', { href: 'changelog.html', className: 'ltc-nav-icon',
            title: "What's new", innerHTML: '<i class="fas fa-bell"></i>' });
        var docBtn = el('button', { type: 'button', className: 'ltc-nav-icon',
            title: 'Report', innerHTML: '<i class="fas fa-file-lines"></i>' });
        docBtn.addEventListener('click', function () { activateLtcTab('report'); });
        var saveBtn = el('button', { type: 'button',
            className: 'ltc-nav-btn ltc-nav-btn-outline', textContent: 'Save Scenario' });
        saveBtn.addEventListener('click', function () {
            var nameEl = document.getElementById('scenarioName');
            if (nameEl && String(nameEl.value).trim()) {
                var b = document.getElementById('saveScenarioBtn'); if (b) b.click();
            } else {
                activateLtcTab('report'); if (nameEl) nameEl.focus();
            }
        });
        var expBtn = el('button', { type: 'button',
            className: 'ltc-nav-btn ltc-nav-btn-primary', textContent: 'Export Report' });
        expBtn.addEventListener('click', function () {
            var b = document.getElementById('exportExecutive');
            if (b) b.click(); else activateLtcTab('report');
        });
        actions.appendChild(bell);
        actions.appendChild(docBtn);
        actions.appendChild(saveBtn);
        actions.appendChild(expBtn);

        var theme = document.getElementById('themeToggle');
        if (theme && theme.parentNode) theme.parentNode.insertBefore(actions, theme);
        else if (navLinks) navLinks.insertBefore(actions, navLinks.firstChild);
    }

    // ════════════════════════════════════════════════════════
    // bindRunBtn — wire ltcRunBtn to existing runCalc
    // ════════════════════════════════════════════════════════
    function bindRunBtn() {
        var ltcRunBtn = document.getElementById('ltcRunBtn');
        if (!ltcRunBtn) return;

        ltcRunBtn.addEventListener('click', function () {
            var origRun = document.getElementById('runCalc');
            if (origRun) origRun.click();
            else if (typeof window.runModel === 'function') window.runModel();

            var lastRunEl = document.getElementById('ltcLastRun');
            if (lastRunEl) {
                var now = new Date();
                lastRunEl.textContent = 'Last run: ' + now.getHours() + ':' +
                    ('0' + now.getMinutes()).slice(-2) + ':' +
                    ('0' + now.getSeconds()).slice(-2);
            }
        });

        // Reset btn
        var resetBtn = document.getElementById('ltcResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                var origReset = document.getElementById('resetCalc');
                if (origReset) origReset.click();
            });
        }
    }

    // ════════════════════════════════════════════════════════
    // patchApplyModelToUI — register hook for model updates
    // ════════════════════════════════════════════════════════
    function patchApplyModelToUI() {
        // Strategy: the engine will call window.__ltcModelHook(model) if defined
        window.__ltcModelHook = ltcUiRender;

        // Fallback: MutationObserver on #quickPue to detect engine runs
        var quickPue = document.getElementById('quickPue');
        if (quickPue) {
            var obs = new MutationObserver(function () {
                // Try to get last model from engine's exposed lastModel ref
                if (window.__ltcLastModel) {
                    ltcUiRender(window.__ltcLastModel);
                } else {
                    // Fallback: read DOM values
                    ltcUiRenderFromDom();
                }
            });
            obs.observe(quickPue, { childList: true, characterData: true, subtree: true });
        }
    }

    // ════════════════════════════════════════════════════════
    // ltcUiRender — update all new UI from model object
    // ════════════════════════════════════════════════════════
    function ltcUiRender(model) {
        if (!model) return;
        window.__ltcLastModel = model; // store for fallback
        renderKpi(model);
        renderSchematic(model);
        renderCompliance(model);
        renderDesignStatus(model);
        renderSensitivity(model);
        renderTornado(model);
        renderScenarioReadout(model);
        renderReportCompare(model);
        renderScenarioInfo(model);
        renderResultsTab(model);
    }

    // ── ltcUiRenderFromDom — fallback reading existing DOM ──
    function ltcUiRenderFromDom() {
        // Build a partial model from DOM values the engine already set
        function domText(id) {
            var el = document.getElementById(id);
            return el ? el.textContent.trim() : '—';
        }
        function domNum(id) {
            var t = domText(id);
            var n = parseFloat(t.replace(/[^0-9.\-]/g, ''));
            return isNaN(n) ? 0 : n;
        }

        var pue = domNum('outPue') || domNum('quickPue');
        var cop = domNum('outCop') || domNum('quickCop');
        // If model hook was set but model not in window, just render KPIs from DOM
        setText2('kpiPue', pue ? pue.toFixed(3) : '—');
        setText2('kpiCop', cop ? cop.toFixed(2) : '—');
    }

    // ════════════════════════════════════════════════════════
    // renderKpi
    // ════════════════════════════════════════════════════════
    var _prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function _fmtNum(v, decimals, comma) {
        if (v === null || v === undefined || isNaN(v)) return '—';
        if (comma) return Number(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        return Number(v).toFixed(decimals);
    }
    // Eased count-up on KPI updates (respects prefers-reduced-motion).
    function animateNum(id, to, decimals, comma) {
        var node = document.getElementById(id);
        if (!node) return;
        if (to === null || to === undefined || isNaN(to)) { node.textContent = '—'; return; }
        var from = parseFloat(node.getAttribute('data-val'));
        if (isNaN(from)) from = 0;
        node.setAttribute('data-val', to);
        if (_prefersReduced || Math.abs(to - from) < 1e-9) { node.textContent = _fmtNum(to, decimals, comma); return; }
        var dur = 480, start = null;
        function step(ts) {
            if (start === null) start = ts;
            var p = Math.min((ts - start) / dur, 1);
            var e = 1 - Math.pow(1 - p, 3);           // ease-out cubic
            node.textContent = _fmtNum(from + (to - from) * e, decimals, comma);
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
    function renderKpi(model) {
        animateNum('kpiItLoad', model.itKw / 1000, 2);
        animateNum('kpiLiquid', model.liquidKw / 1000, 2);
        animateNum('kpiFlow',   model.flowLpm, 0, true);
        animateNum('kpiPump',   model.pumpPowerKw, 1);
        animateNum('kpiPue',    model.pue, 3);
        animateNum('kpiCop',    model.systemCop, 2);
    }

    // ════════════════════════════════════════════════════════
    // renderSchematic
    // ════════════════════════════════════════════════════════
    function renderSchematic(model) {
        setText2('schSupplyT', 'Supply ' + fmt(model.input.supplyTemp, 1) + ' °C');
        setText2('schReturnT', 'Return ' + fmt(model.input.returnTemp, 1) + ' °C');
        syncPidTheme();
    }

    // ════════════════════════════════════════════════════════
    // renderCompliance
    // ════════════════════════════════════════════════════════
    function renderCompliance(model) {
        var host = document.getElementById('ltcComplianceList');
        if (!host) return;

        var items = [
            { name: 'ASHRAE TC 9.9',    score: model.scores.ashrae },
            { name: 'ASHRAE 90.4',      score: model.scores.iso },
            { name: 'ISO 14644',        score: model.scores.iso },
            { name: 'ANSI/BICSI 002',   score: model.scores.ansi },
            { name: 'NFPA 75',          score: model.scores.nfpa },
            { name: 'Uptime Institute', score: model.scores.uptime }
        ];

        var allPass = items.every(function (it) { return it.score >= 60; });
        var pill = document.getElementById('ltcCompliancePill');
        if (pill) {
            pill.textContent = allPass ? '● PASS' : '● REVIEW';
            pill.classList.toggle('ltc-fail', !allPass);
        }

        host.innerHTML = items.map(function (it) {
            var ok = (it.score || 0) >= 60;
            return '<div class="ltc-comp-row">' +
                '<span class="ltc-comp-check' + (ok ? '' : ' ltc-comp-check-fail') + '">' +
                    '<i class="fas fa-' + (ok ? 'check' : 'exclamation') + '"></i></span>' +
                '<span class="ltc-comp-name">' + it.name + '</span>' +
                '<span class="ltc-comp-status' + (ok ? '' : ' ltc-comp-status-fail') + '">' +
                    (ok ? 'Compliant' : 'Review') + '</span>' +
                '</div>';
        }).join('');
    }

    // ════════════════════════════════════════════════════════
    // renderDesignStatus — radial gauge
    // ════════════════════════════════════════════════════════
    function renderDesignStatus(model) {
        var score = model.scores.total || 0;
        var r = 48;
        var circumference = 2 * Math.PI * r; // 301.6
        var filled = (score / 100) * circumference;

        var bar = document.getElementById('ltcRadialBar');
        if (bar) {
            bar.style.strokeDasharray = filled.toFixed(1) + ' ' + (circumference - filled).toFixed(1);
            bar.style.stroke = 'var(--ltc-accent)'; // reference ring is blue
        }
        setText2('ltcRadialPct', score.toFixed(0) + '%');

        var gradeEl = document.getElementById('ltcDesignGrade');
        if (gradeEl) gradeEl.textContent = gradeWord(score); // word grade, not letter

        // Sub-bars: Efficiency, Resilience, Sustainability, Operability
        var subBars = document.getElementById('ltcSubBars');
        if (!subBars) return;

        var ss = (window.RZEngine && window.RZEngine.models && window.RZEngine.models.ltc)
            ? window.RZEngine.models.ltc.designSubScores(model)
            : {
                efficiency:     model.scores.iso || 0,
                resilience:     model.scores.uptime || 0,
                sustainability: model.scores.iso || 0,
                operability:    model.confidence || 0
              };

        var rows = [
            { lbl: 'Efficiency',     val: ss.efficiency },
            { lbl: 'Resilience',     val: ss.resilience },
            { lbl: 'Sustainability', val: ss.sustainability },
            { lbl: 'Operability',    val: ss.operability }
        ];

        subBars.innerHTML = rows.map(function (r) {
            return '<div class="ltc-sub-bar-row">' +
                '<div class="ltc-sub-bar-head">' +
                '<span class="ltc-sub-bar-lbl">' + r.lbl + '</span>' +
                '<span class="ltc-sub-bar-val">' + r.val.toFixed(0) + '%</span>' +
                '</div>' +
                '<div class="ltc-sub-bar-track">' +
                '<div class="ltc-sub-bar-fill" style="width:' + r.val.toFixed(0) + '%"></div>' +
                '</div>' +
                '</div>';
        }).join('');
    }

    function gradeWord(s) {
        if (s >= 85) return 'Excellent';
        if (s >= 70) return 'Good';
        if (s >= 55) return 'Fair';
        return 'Needs Work';
    }

    // ════════════════════════════════════════════════════════
    // renderSensitivity — top-5 by |ΔPUE|, sourced from engine
    // ════════════════════════════════════════════════════════
    function renderSensitivity(model) {
        var host = document.getElementById('ltcSensBars');
        if (!host) return;

        var entries = [];

        // Primary: engine sensitivity (single source of truth)
        if (window.RZEngine && window.RZEngine.models && window.RZEngine.models.ltc && model.input) {
            var rows = window.RZEngine.models.ltc.sensitivity(model.input);
            entries = rows.map(function (r) { return { name: r.label, delta: r.dpue }; });
        }

        // Fallback: read the impact matrix table already rendered on the page
        if (entries.length === 0) {
            var impactRows = document.querySelectorAll('#impactRows tr, .impact-rows tr, [id*="impact"] tr');
            impactRows.forEach(function (row) {
                var cells = row.querySelectorAll('td, th');
                if (cells.length >= 3) {
                    var paramName = cells[0] ? cells[0].textContent.trim() : '';
                    var pueDelta  = cells[2] ? parseFloat(cells[2].textContent.replace(/[^0-9.\-]/g, '')) : 0;
                    if (paramName && !isNaN(pueDelta) && paramName !== 'Parameter') {
                        entries.push({ name: paramName, delta: pueDelta });
                    }
                }
            });
        }

        // If still nothing (e.g. page table not yet rendered), show placeholder
        if (entries.length === 0) {
            host.innerHTML = '<div class="ltc-sens-row"><span class="ltc-sens-name">—</span></div>';
            return;
        }

        // Sort by absolute ΔPUE descending, take top 5
        entries.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
        var top5 = entries.slice(0, 5);
        var maxAbs = top5.reduce(function (m, e) { return Math.max(m, Math.abs(e.delta)); }, 0.001);

        host.innerHTML = top5.map(function (e) {
            var pct = (Math.abs(e.delta) / maxAbs) * 100;
            var isPos = e.delta > 0;
            return '<div class="ltc-sens-row">' +
                '<div class="ltc-sens-head">' +
                '<span class="ltc-sens-name">' + e.name + '</span>' +
                '<span class="ltc-sens-delta ' + (isPos ? 'ltc-pos' : '') + '">' +
                (isPos ? '+' : '') + e.delta.toFixed(3) + '</span>' +
                '</div>' +
                '<div class="ltc-sens-track">' +
                '<div class="ltc-sens-fill ' + (isPos ? 'ltc-pos' : '') + '" style="width:' + pct.toFixed(0) + '%"></div>' +
                '</div>' +
                '</div>';
        }).join('');
    }

    // ════════════════════════════════════════════════════════
    // renderScenarioInfo
    // ════════════════════════════════════════════════════════
    // Two-directional sensitivity tornado — perturbs each engine impactParam
    // ±1 step through models.ltc.compute (single source; no hardcoded deltas).
    function renderTornado(model) {
        var host = document.getElementById('ltcTornado');
        if (!host || !model || !model.input) return;
        var eng = window.RZEngine && window.RZEngine.models && window.RZEngine.models.ltc;
        var data = window.RZEngine && window.RZEngine.data;
        if (!eng || typeof eng.compute !== 'function' || !data || !data.ltcCalibration || !data.ltcCalibration.impactParams) {
            host.innerHTML = '<div class="ltc-muted" style="padding:10px">Engine unavailable — tornado needs RZEngine.models.ltc.</div>';
            return;
        }
        var base = model.pue;
        function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
        var rows = data.ltcCalibration.impactParams.map(function (cfg) {
            var lo = Object.assign({}, model.input); lo[cfg.key] = clamp((lo[cfg.key] || 0) - cfg.step, cfg.min, cfg.max);
            var hi = Object.assign({}, model.input); hi[cfg.key] = clamp((hi[cfg.key] || 0) + cfg.step, cfg.min, cfg.max);
            var dLow = eng.compute(lo).pue - base;
            var dHigh = eng.compute(hi).pue - base;
            return { label: cfg.label, dLow: dLow, dHigh: dHigh, range: Math.abs(dHigh - dLow) };
        }).filter(function (r) { return r.range > 1e-9; })
          .sort(function (a, b) { return b.range - a.range; })
          .slice(0, 8);
        var maxAbs = rows.reduce(function (m, r) { return Math.max(m, Math.abs(r.dLow), Math.abs(r.dHigh)); }, 1e-6);
        host.innerHTML = rows.map(function (r) {
            var lo = Math.min(r.dLow, r.dHigh), hi = Math.max(r.dLow, r.dHigh);
            var leftPct = (lo + maxAbs) / (2 * maxAbs) * 100;
            var widthPct = (hi - lo) / (2 * maxAbs) * 100;
            return '<div class="ltc-tor-row">' +
                '<span class="ltc-tor-lbl">' + r.label + '</span>' +
                '<span class="ltc-tor-track">' +
                    '<span class="ltc-tor-zero"></span>' +
                    '<span class="ltc-tor-bar" style="left:' + leftPct.toFixed(1) + '%;width:' + Math.max(widthPct, 0.6).toFixed(1) + '%"></span>' +
                '</span>' +
                '<span class="ltc-tor-val">' + (hi >= 0 ? '+' : '') + hi.toFixed(3) + ' / ' + (lo >= 0 ? '+' : '') + lo.toFixed(3) + '</span>' +
                '</div>';
        }).join('') || '<div class="ltc-muted" style="padding:10px">No sensitivity range at current inputs.</div>';
    }

    function bindFlowScenarios() {
        var host = document.getElementById('ltcScenarioBtns');
        var sel = document.getElementById('inFailureMode');
        if (!host || !sel) return;
        host.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('.ltc-scenario-btn') : null;
            if (!btn) return;
            sel.value = btn.getAttribute('data-scen');
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
    // FLOW scenario readout — current model + Δ vs a normal-mode engine recompute.
    function renderScenarioReadout(model) {
        var host = document.getElementById('ltcScenarioReadout');
        if (!host || !model || !model.input) return;
        var cur = model.input.failureMode || 'normal';
        var btns = document.querySelectorAll('#ltcScenarioBtns .ltc-scenario-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].getAttribute('data-scen') === cur);
        var eng = window.RZEngine && window.RZEngine.models && window.RZEngine.models.ltc;
        var norm = null;
        if (eng && cur !== 'normal') { var ni = Object.assign({}, model.input); ni.failureMode = 'normal'; norm = eng.compute(ni); }
        function d(v, dec) { return norm == null ? '' : ' <span class="ltc-scenario-delta ' + (v > 0 ? 'up' : (v < 0 ? 'down' : '')) + '">' + (v >= 0 ? '+' : '') + v.toFixed(dec) + '</span>'; }
        host.innerHTML =
            '<div class="ltc-scenario-metric"><span>PUE</span><b>' + fmt(model.pue, 3) + '</b>' + (norm ? d(model.pue - norm.pue, 3) : '') + '</div>' +
            '<div class="ltc-scenario-metric"><span>System COP</span><b>' + fmt(model.systemCop, 2) + '</b>' + (norm ? d(model.systemCop - norm.systemCop, 2) : '') + '</div>' +
            '<div class="ltc-scenario-metric"><span>Risk Index</span><b>' + fmt(model.riskIndex, 1) + '</b>' + (norm ? d(model.riskIndex - norm.riskIndex, 1) : '') + '</div>' +
            '<div class="ltc-scenario-metric"><span>Pump Power</span><b>' + fmt(model.pumpPowerKw, 1) + ' kW</b>' + (norm ? d(model.pumpPowerKw - norm.pumpPowerKw, 1) : '') + '</div>';
    }

    // REPORT scenario-compare — snapshots are pure engine KPIs; deltas are computed.
    function _snapKpis(m) {
        return { pue: m.pue, cop: m.systemCop, flow: m.flowLpm, pump: m.pumpPowerKw,
                 risk: m.riskIndex, opex: m.netOpex, carbon: m.netCarbonTons };
    }
    var CMP_METRICS = [
        { k: 'pue',    lbl: 'PUE',              dec: 3, lowerBetter: true },
        { k: 'cop',    lbl: 'System COP',       dec: 2, lowerBetter: false },
        { k: 'flow',   lbl: 'Total Flow (LPM)', dec: 0, neutral: true },
        { k: 'pump',   lbl: 'Pump Power (kW)',  dec: 1, lowerBetter: true },
        { k: 'risk',   lbl: 'Risk Index',       dec: 1, lowerBetter: true },
        { k: 'opex',   lbl: 'Net OPEX ($/yr)',  dec: 0, lowerBetter: true, usd: true },
        { k: 'carbon', lbl: 'Carbon (tCO2e/yr)', dec: 0, lowerBetter: true }
    ];
    function bindReportCompare() {
        var pin = document.getElementById('ltcPinA'), clr = document.getElementById('ltcClearA');
        if (pin) pin.addEventListener('click', function () {
            if (window.__ltcLastModel) { window.__ltcCompareA = _snapKpis(window.__ltcLastModel); renderReportCompare(window.__ltcLastModel); }
        });
        if (clr) clr.addEventListener('click', function () { window.__ltcCompareA = null; renderReportCompare(window.__ltcLastModel); });
    }
    function renderReportCompare(model) {
        var host = document.getElementById('ltcCompareTable');
        if (!host || !model) return;
        var A = window.__ltcCompareA, B = _snapKpis(model);
        if (!A) { host.innerHTML = '<div class="ltc-muted" style="padding:10px">Pin a design as A, then adjust inputs — the delta vs current (B) appears here.</div>'; return; }
        function f(v, m) { return m.usd ? fmtUsd(v) : fmt(v, m.dec); }
        var rows = CMP_METRICS.map(function (m) {
            var a = A[m.k], b = B[m.k], d = b - a;
            var cls = (m.neutral || Math.abs(d) < 1e-9) ? '' : ((m.lowerBetter ? d < 0 : d > 0) ? 'down' : 'up');
            return '<div class="ltc-cmp-row"><span class="ltc-cmp-lbl">' + m.lbl + '</span>' +
                '<span>' + f(a, m) + '</span><span>' + f(b, m) + '</span>' +
                '<span class="ltc-cmp-d ' + cls + '">' + (d >= 0 ? '+' : '') + f(d, m) + '</span></div>';
        }).join('');
        host.innerHTML = '<div class="ltc-cmp-row ltc-cmp-head"><span>Metric</span><span>A (pinned)</span><span>B (current)</span><span>Δ</span></div>' + rows;
    }

    function renderScenarioInfo(model) {
        var host = document.getElementById('ltcScenarioList');
        if (!host) return;

        var inp = model.input || {};
        var items = [
            { key: 'Architecture',   val: inp.coolingArchitecture || '—' },
            { key: 'IT Load',        val: fmt(inp.itLoadMw, 2) + ' MW' },
            { key: 'Liquid Capture', val: fmt(inp.liquidCapture, 0) + '%' },
            { key: 'Supply Temp',    val: fmt(inp.supplyTemp, 1) + ' °C' },
            { key: 'Return Temp',    val: fmt(inp.returnTemp, 1) + ' °C' },
            { key: 'Pump Head',      val: fmt(inp.pumpHead, 0) + ' m' },
            { key: 'Pump Eff',       val: fmt(inp.pumpEff, 0) + '%' },
            { key: 'Risk Index',     val: fmt(model.riskIndex, 1) + '/100' },
            { key: 'Confidence',     val: fmt(model.confidence, 0) + '%' },
            { key: 'Grade',          val: grade(model.scores.total) }
        ];

        host.innerHTML = items.map(function (it) {
            return '<div class="ltc-scenario-item">' +
                '<span class="ltc-scenario-key">' + it.key + '</span>' +
                '<span class="ltc-scenario-val">' + it.val + '</span>' +
                '</div>';
        }).join('');
    }

    // ════════════════════════════════════════════════════════
    // renderResultsTab — RESULTS tab columns
    // ════════════════════════════════════════════════════════
    function renderResultsTab(model) {
        var grid = document.getElementById('ltcResultsGrid');
        var bottom = document.getElementById('ltcResultsBottom');
        if (!grid) return;

        var inp = model.input || {};
        var intern = model.internals || {};

        // Card 1: Flow & Temperature
        var c1 = resCard('FLOW & TEMPERATURE', [
            { lbl: 'Supply Temperature',  val: fmt(inp.supplyTemp, 1) + ' °C' },
            { lbl: 'Return Temperature',  val: fmt(inp.returnTemp, 1) + ' °C' },
            { lbl: 'ΔT',                  val: fmt(model.deltaT, 1) + ' K' },
            { lbl: 'Volumetric Flow',     val: fmt(model.flowLpm, 0) + ' LPM' },
            { lbl: 'Effective Capture',   val: fmt(model.effectiveCapture, 1) + '%' },
            { lbl: 'CDU Count',           val: model.cduCount + ' units' }
        ]);

        // Card 2: Pump & Hydraulic
        var c2 = resCard('PUMP & HYDRAULIC', [
            { lbl: 'Pump Head',           val: fmt(inp.pumpHead, 1) + ' m' },
            { lbl: 'Pump Power',          val: fmt(model.pumpPowerKw, 2) + ' kW' },
            { lbl: 'Pump Efficiency',     val: fmt(inp.pumpEff, 1) + '%' },
            { lbl: 'Pipe Loss Factor',    val: fmt(inp.coefPipeLoss, 3) + 'x' },
            { lbl: 'Hydraulic Margin',    val: fmt(inp.hydraulicMargin, 0) + '%' },
            { lbl: 'Liquid COP',          val: fmt(intern.liquidCop || model.liquidCop, 2) }
        ]);

        // Card 3: Performance
        var c3 = resCard('PERFORMANCE', [
            { lbl: 'System COP',          val: fmt(model.systemCop, 2) },
            { lbl: 'PUE',                 val: fmt(model.pue, 4) },
            { lbl: 'WUE',                 val: fmt(model.wue, 3) + ' L/kWh' },
            { lbl: 'Total Facility',      val: fmt(model.totalFacilityKw, 0) + ' kW' },
            { lbl: 'Annual Energy',       val: fmt(model.annualGwh, 2) + ' GWh/yr' },
            { lbl: 'Economizer %',        val: fmt((intern.economizerFraction || 0) * 100, 1) + '%' }
        ]);

        // Card 4: Power Breakdown donut
        var bd = model.breakdown || {};
        var c4 = donutCard(bd);

        grid.innerHTML = c1 + c2 + c3 + c4;

        // Bottom: temperature profile + energy balance table
        if (bottom) {
            bottom.innerHTML = tempProfileCard(model) + energyBalanceCard(model);
        }
    }

    function resCard(title, rows) {
        return '<div class="ltc-res-card">' +
            '<div class="ltc-res-card-title">' + title + '</div>' +
            rows.map(function (r) {
                return '<div class="ltc-res-row">' +
                    '<span class="ltc-res-lbl">' + r.lbl + '</span>' +
                    '<span class="ltc-res-val">' + r.val + '</span>' +
                    '</div>';
            }).join('') +
            '</div>';
    }

    function donutCard(bd) {
        var slices = [
            { lbl: 'IT',           kw: bd.it || 0 },
            { lbl: 'Liquid Cool', kw: bd.liquidCooling || 0 },
            { lbl: 'Air Cool',    kw: bd.airCooling || 0 },
            { lbl: 'Pump',        kw: bd.pump || 0 },
            { lbl: 'Elec Loss',   kw: bd.elecLoss || 0 },
            { lbl: 'Aux/Fan',     kw: bd.aux || 0 }
        ].filter(function (s) { return s.kw > 0; });

        var total = slices.reduce(function (sum, s) { return sum + s.kw; }, 0) || 1;

        // Build SVG arcs
        var r = 44, cx = 60, cy = 60;
        var circumference = 2 * Math.PI * r;
        var offset = 0;
        var arcs = '';
        slices.forEach(function (s, i) {
            var frac = s.kw / total;
            var dashLen = frac * circumference;
            var color = DONUT_COLORS[i % DONUT_COLORS.length];
            arcs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"' +
                ' stroke="' + color + '" stroke-width="12"' +
                ' stroke-dasharray="' + dashLen.toFixed(2) + ' ' + (circumference - dashLen).toFixed(2) + '"' +
                ' stroke-dashoffset="' + (-offset * circumference / 1).toFixed(2) + '"' +
                ' transform="rotate(-90 ' + cx + ' ' + cy + ')"' +
                '/>';
            offset += frac;
        });

        var legend = slices.map(function (s, i) {
            var color = DONUT_COLORS[i % DONUT_COLORS.length];
            var pct = (s.kw / total) * 100;
            return '<div class="ltc-donut-legend-row">' +
                '<div class="ltc-donut-dot" style="background:' + color + '"></div>' +
                '<span class="ltc-donut-lbl">' + s.lbl + '</span>' +
                '<span class="ltc-donut-val">' + fmt(s.kw, 0) + ' kW <span class="ltc-donut-pct">' + pct.toFixed(1) + '%</span></span>' +
                '</div>';
        }).join('');

        return '<div class="ltc-res-card">' +
            '<div class="ltc-res-card-title">POWER BREAKDOWN</div>' +
            '<div class="ltc-donut-wrap">' +
            '<div class="ltc-donut-ring">' +
            '<svg class="ltc-donut-svg" viewBox="0 0 120 120">' + arcs + '</svg>' +
            '<div class="ltc-donut-center"><b>' + fmt(total / 1000, 2) + '</b><span>MW Total</span></div>' +
            '</div>' +
            '<div class="ltc-donut-legend">' + legend + '</div>' +
            '</div>' +
            '</div>';
    }

    function tempProfileCard(model) {
        var supplyT = model.input.supplyTemp || 20;
        var returnT = model.input.returnTemp || 40;
        var w = 520, h = 172;
        var padL = 34, padR = 58, padT = 14, padB = 28;
        var plotW = w - padL - padR;
        var plotH = h - padT - padB;
        var minT = 20, maxT = 60;               // reference fixed axis 20–60 °C

        function fy(t) { return padT + plotH - ((t - minT) / (maxT - minT)) * plotH; }
        function fx(i) { return padL + (i / 4) * plotW; }

        var supPts = [], retPts = [], dots = '';
        for (var i = 0; i < 5; i++) {
            var sy = fy(supplyT);
            var rt = supplyT + (returnT - supplyT) * (i / 4);
            var ry = fy(rt);
            supPts.push(fx(i).toFixed(1) + ',' + sy.toFixed(1));
            retPts.push(fx(i).toFixed(1) + ',' + ry.toFixed(1));
            dots += '<circle cx="' + fx(i).toFixed(1) + '" cy="' + ry.toFixed(1) + '" r="3.4" fill="#e5484d"/>' +
                    '<circle cx="' + fx(i).toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="3.4" fill="#337eea"/>';
        }

        var grid = '', yl = '';
        [20, 40, 60].forEach(function (t) {
            var y = fy(t);
            grid += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (padL + plotW) + '" y2="' + y.toFixed(1) + '" stroke="currentColor" stroke-width="0.6" opacity="0.10"/>';
            yl += '<text x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="10" fill="currentColor" opacity="0.5">' + t + ' °C</text>';
        });
        var xl = '';
        ['0%', '25%', '50%', '75%', '100%'].forEach(function (lab, i) {
            xl += '<text x="' + fx(i).toFixed(1) + '" y="' + (padT + plotH + 16) + '" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">' + lab + '</text>';
        });
        // endpoint value pills
        function pill(t, color) {
            var y = fy(t);
            return '<rect x="' + (padL + plotW + 5) + '" y="' + (y - 8).toFixed(1) + '" width="48" height="16" rx="8" fill="' + color + '"/>' +
                   '<text x="' + (padL + plotW + 29) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff">' + t.toFixed(1) + '°C</text>';
        }

        var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" class="ltc-temp-profile-svg">' +
            grid + yl + xl +
            '<polyline points="' + retPts.join(' ') + '" fill="none" stroke="#e5484d" stroke-width="2.2" stroke-linejoin="round"/>' +
            '<polyline points="' + supPts.join(' ') + '" fill="none" stroke="#337eea" stroke-width="2.2" stroke-linejoin="round"/>' +
            dots + pill(returnT, '#e5484d') + pill(supplyT, '#337eea') +
            '</svg>';

        return '<div class="ltc-temp-profile-card">' +
            '<div class="ltc-tp-head">' +
                '<div class="ltc-res-card-title">TEMPERATURE PROFILE (LIQUID LOOP)</div>' +
                '<div class="ltc-tp-legend">' +
                    '<span class="ltc-tp-leg ltc-tp-sup">Supply Temp (°C)</span>' +
                    '<span class="ltc-tp-leg ltc-tp-ret">Return Temp (°C)</span>' +
                '</div>' +
            '</div>' + svg +
            '</div>';
    }

    function energyBalanceCard(model) {
        var bd = model.breakdown || {};
        var rows = [
            { lbl: 'IT Load',           kw: bd.it || model.itKw || 0,    note: '100% productive' },
            { lbl: 'Liquid Cooling',    kw: bd.liquidCooling || 0,        note: fmt((model.effectiveCapture||0), 1) + '% captured' },
            { lbl: 'Air Cooling',       kw: bd.airCooling || 0,           note: 'residual path' },
            { lbl: 'Pump Power',        kw: bd.pump || model.pumpPowerKw || 0, note: 'hydraulic losses incl.' },
            { lbl: 'Elec Losses',       kw: bd.elecLoss || 0,             note: 'UPS + distribution' },
            { lbl: 'Aux / Fan',         kw: bd.aux || 0,                   note: 'lighting, HVAC misc' }
        ];
        var total = rows.reduce(function (s, r) { return s + r.kw; }, 0);

        var tbody = rows.map(function (r) {
            var pct = total > 0 ? (r.kw / total * 100).toFixed(1) : '0.0';
            return '<tr><td>' + r.lbl + '</td>' +
                '<td class="ltc-mono">' + fmt(r.kw, 1) + '</td>' +
                '<td class="ltc-mono">' + pct + '%</td>' +
                '<td class="ltc-muted">' + r.note + '</td>' +
                '</tr>';
        }).join('');

        return '<div class="ltc-energy-table">' +
            '<div class="ltc-res-card-title">ENERGY BALANCE</div>' +
            '<table class="ltc-etable">' +
            '<thead><tr><th>Component</th><th>kW</th><th>Share</th><th>Note</th></tr></thead>' +
            '<tbody>' + tbody + '</tbody>' +
            '<tfoot><tr>' +
            '<td class="ltc-etotal">Total Facility</td>' +
            '<td class="ltc-mono ltc-etotal">' + fmt(model.totalFacilityKw, 1) + '</td>' +
            '<td class="ltc-mono">100%</td>' +
            '<td></td>' +
            '</tr></tfoot>' +
            '</table>' +
            '</div>';
    }

    // ════════════════════════════════════════════════════════
    // Helpers
    // ════════════════════════════════════════════════════════
    function el(tag, props) {
        var e = document.createElement(tag);
        if (props) Object.assign(e, props);
        return e;
    }

    function setText2(id, text) {
        var node = document.getElementById(id);
        if (node) node.textContent = text;
    }

    function fmt(v, decimals) {
        if (v === null || v === undefined || isNaN(v)) return '—';
        return Number(v).toFixed(decimals);
    }

    function fmtUsd(v) {
        if (!v && v !== 0) return '—';
        var abs = Math.abs(v);
        if (abs >= 1e6) return (v < 0 ? '-' : '') + '$' + (abs / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return (v < 0 ? '-' : '') + '$' + (abs / 1e3).toFixed(0) + 'K';
        return '$' + v.toFixed(0);
    }

    function grade(score) {
        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B+';
        if (score >= 60) return 'B';
        if (score >= 50) return 'C';
        return 'D';
    }

    // ── Register hook ─────────────────────────────────────
    window.__ltcModelHook = ltcUiRender;

    document.addEventListener('DOMContentLoaded', init);
})();
