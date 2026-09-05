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
        { id: 'inLiquidCapture', label: 'Liquid Capture',     min: 0,   max: 100, step: 1,   unit: '%', preset: true },
        { id: 'inSupplyTemp',    label: 'Supply Temperature', min: 16,  max: 42,  step: 0.1, unit: '°C', preset: true },
        { id: 'inReturnTemp',    label: 'Return Temperature', min: 16,  max: 60,  step: 0.1, unit: '°C', preset: true },
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
    var DONUT_COLORS = ['#0b5fea','#337eea','#e5484d','#f59e0b','#12a150','#7B4FE0'];

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
        bindTraceDelegation();
        // Headline KPI cards become trace targets (DCMOC-style ƒx indicator)
        var KPI_TRACE = { kpiItLoad: 'itKw', kpiLiquid: 'liquidKw', kpiFlow: 'flowLpm',
                          kpiPump: 'pumpPowerKw', kpiPue: 'pue', kpiCop: 'systemCop' };
        Object.keys(KPI_TRACE).forEach(function (id) {
            var n = document.getElementById(id);
            var card = n && n.closest ? n.closest('.ltc-kpi-card') : null;
            var target = card || n;
            if (target) {
                target.setAttribute('data-ltc-trace', KPI_TRACE[id]);
                target.classList.add('ltc-traceable');
                target.setAttribute('role', 'button');
                target.setAttribute('tabindex', '0');
            }
        });
        // Affordance hint on the schematic
        var ovLbl = document.querySelector('.ltc-overview-label');
        if (ovLbl) ovLbl.innerHTML += ' <span class="ltc-muted" style="letter-spacing:0;text-transform:none;font-weight:500">— klik equipment / angka ƒx untuk trace perhitungan</span>';
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

        // Guided flow: how to use the lab, in one glance.
        var guide = el('div', { className: 'ltc-flow-guide' });
        guide.innerHTML = '<span><b>1</b> Set design</span><span class="ltc-fg-sep">→</span>' +
            '<span><b>2</b> Review auto-filled</span><span class="ltc-fg-sep">→</span>' +
            '<span><b>3</b> Tune &amp; optimize</span>';
        leftCard.appendChild(guide);

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
            { key: 'results',   label: 'RESULTS',              icon: 'fa-table-cells-large' },
            { key: 'detailed',  label: 'DETAILED CALCULATION', icon: 'fa-square-root-variable' },
            { key: 'flow',      label: 'FLOW DIAGRAM',         icon: 'fa-diagram-project' },
            { key: 'charts',    label: 'CHARTS',               icon: 'fa-chart-line' },
            { key: 'report',    label: 'REPORT',               icon: 'fa-file-lines' }
        ];
        tabDefs.forEach(function (t, i) {
            var btn = el('button', { className: 'ltc-tab-btn' + (i === 0 ? ' ltc-tab-active' : '') });
            btn.innerHTML = '<i class="fas ' + t.icon + '" aria-hidden="true"></i> ' + t.label;
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
        // One-line guide per tab (intuitiveness: tell the user what lives here).
        // Prepended so the lead always sits at the very top of its panel.
        [[panelDetailed, 'Full engineering output — every computed parameter, the model & control diagrams, calibration and self-test tools. Expand a section to dive in.'],
         [panelFlow, 'How energy and variables move through the system — replay fault scenarios and trace each processing stage.'],
         [panelCharts, 'Optimization & uncertainty — sensitivity tornado, target guidance, Pareto frontier, Monte-Carlo and the energy Sankey.'],
         [panelReport, 'Compare designs, manage saved scenarios, and export CSV / executive & engineering report packs.']
        ].forEach(function (pair) {
            pair[0].insertBefore(el('p', { className: 'ltc-tab-lead', textContent: pair[1] }), pair[0].firstChild);
        });

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

        // MODEL VALIDATION — the model's receipts: live values vs sourced
        // benchmark bands (ASHRAE / OCP / Uptime / corpus) from the engine.
        var mvCard = el('div', { className: 'ltc-rail-card' });
        var mvHeader = el('div', { className: 'ltc-rail-header' });
        mvHeader.appendChild(el('span', { className: 'ltc-rail-title', textContent: 'MODEL VALIDATION' }));
        var mvPill = el('span', { className: 'ltc-comp-pill', id: 'ltcValidPill', textContent: '—' });
        mvHeader.appendChild(mvPill);
        mvCard.appendChild(mvHeader);
        mvCard.appendChild(el('div', { className: 'ltc-valid-list', id: 'ltcValidList' }));
        mvCard.appendChild(el('p', { className: 'ltc-scenario-note', textContent: 'Live check vs ASHRAE TC9.9 / OCP cold-plate / Uptime bands from the shared engine. Out-of-band = review that aspect of the design.' }));
        rightRail.appendChild(mvCard);

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
        // Legal notice (replaces the hidden .legal-disclaimer-wrap — must survive)
        var legalNote = el('p', { className: 'ltc-scenario-note ltc-legal-note' });
        legalNote.innerHTML = 'Independent personal research; educational/planning context only — not legal, financial, procurement, safety, or engineering advice. Use is subject to our <a href="terms.html">Terms</a> and <a href="privacy.html">Privacy Policy</a>.';
        scenCard.appendChild(legalNote);
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
    // relocateExistingPanels — ONE-APP consolidation.
    // Routes EVERY child of the old .calc-output-panel into a dashboard tab
    // (catch-all → DETAILED, so nothing is ever orphaned below the dashboard),
    // moves fixed-position modals to <body>, folds the old input panel into
    // OTHER PARAMETERS, then flags body.ltc-consolidated so CSS can hide the
    // emptied old shells. Fail-safe: if anything throws, the flag is never
    // set and the original page remains fully usable.
    // ════════════════════════════════════════════════════════
    function relocateExistingPanels() {
        try {
            var detailedHost = document.getElementById('ltcDetailedHost');
            var flowHost     = document.getElementById('ltcFlowHost');
            var chartsHost   = document.getElementById('ltcChartsHost');
            var reportHost   = document.getElementById('ltcReportHost');
            var outPanel     = document.querySelector('.calc-output-panel');
            if (!detailedHost || !flowHost || !chartsHost || !reportHost || !outPanel) return;

            // Fixed-overlay modals must live under <body> (a display:none tab
            // panel would trap an open modal).
            ['blockDetailModal', 'sankeyDrillModal', 'modeHelpModal'].forEach(function (id) {
                var m = document.getElementById(id);
                if (m && m.parentNode !== document.body) document.body.appendChild(m);
            });

            function routeFor(node) {
                var cl = node.classList || { contains: function () { return false; } };
                var has = function (sel) { try { return !!node.querySelector(sel); } catch (e) { return false; } };
                if (cl.contains('pipeline-block') || cl.contains('fullmap-block') || cl.contains('flow-block')) return flowHost;
                if (cl.contains('target-block') || has('#paretoSamples') || has('#mcSamples') ||
                    has('#sankeyMode') || has('#conPueMax')) return chartsHost;
                if (cl.contains('method-block') || has('#pdfSingleSource') || has('#exportExecutive') ||
                    has('#scenarioName') || has('#refreshLedger') || has('[id*="Csv"]') || has('[id*="csv"]')) return reportHost;
                return detailedHost;                       // catch-all: nothing orphaned
            }

            // Route every remaining child (snapshot first — appendChild mutates the list).
            Array.prototype.slice.call(outPanel.children).forEach(function (node) {
                if (node.tagName === 'H3') { node.style.display = 'none'; return; } // old "Engineering Output" title
                routeFor(node).appendChild(node);
            });

            // Fold the full old input panel (30+ inputs, guardrails, calibration,
            // Run/Optimize/Reset) into the OTHER PARAMETERS collapsible.
            var inPanel = document.querySelector('.calc-input-panel');
            var otherBody = document.getElementById('ltcOtherParamsBody');
            if (inPanel && otherBody && inPanel.parentNode !== otherBody) {
                otherBody.appendChild(inPanel);
                var h3 = inPanel.querySelector('h3');
                if (h3) h3.style.display = 'none';
                var cnt = document.getElementById('ltcOtherParamsCount');
                if (cnt) cnt.textContent = inPanel.querySelectorAll('input, select').length + ' settings';
            }

            // FLOW: lead with the visual Energy + Loss Breakdown, not the raw
            // variable dump (the open-by-default block should be the intuitive one).
            var fb = flowHost.querySelector(':scope > .flow-block');
            if (fb) flowHost.insertBefore(fb, flowHost.firstChild);
            accordionizeHosts();
            tierizeInputs();
            addSteppersToPanel();
            traceifyDetailedGrid();
            document.body.classList.add('ltc-consolidated');
        } catch (e) {
            try { if (window.console) console.warn('LTC consolidation skipped:', e); } catch (_) {}
        }
    }

    // ════════════════════════════════════════════════════════
    // Input taxonomy — DESIGN (your decisions) / AUTO (preset-filled, override
    // anytime) / TUNE (optimization & calibration knobs). Answers the owner's
    // "mana input awal, mana auto-fill, mana untuk optimalisasi".
    // ════════════════════════════════════════════════════════
    var TIER_BY_INPUT = {
        inItLoad:'design', inRackCount:'design', inRackType:'design', inRackDensityTarget:'design',
        inHighDensityShare:'design', inModelYear:'design', inCountryProfile:'design',
        inCoolingArchitecture:'design', inCoolant:'design', inSupplyTemp:'design', inReturnTemp:'design',
        inPumpHead:'design', inPumpEff:'design', inLiquidCapture:'design', inHydraulicMargin:'design',
        inCduUnit:'design', inRedundancy:'design', inFireType:'design', inMonitoring:'design',
        inHeatReuse:'design', inFailureMode:'design',
        inClimate:['auto','country'], inElecPrice:['auto','country'], inWaterTariff:['auto','country'],
        inCarbonIntensity:['auto','country'], inUpsEff:['auto','country'], inDistLoss:['auto','country'],
        inAirCop:['auto','preset'], inEconomizerHours:['auto','preset'], inFanPower:['auto','preset'],
        inCoefHeatTransfer:['auto','preset'], inCoefPipeLoss:['auto','preset'],
        inTargetPue:'tune', inTargetCop:'tune', inControlQuality:'tune', inPredictiveGain:'tune',
        inCoefCduLoss:'tune', inCoefFutureTech:'tune'
    };
    var _autoSnap = {};

    function tierizeInputs() {
        var panel = document.querySelector('#ltcOtherParamsBody .calc-input-panel');
        var grid = panel && panel.querySelector('.input-grid');
        if (!grid || grid.dataset.tierized) return;
        grid.dataset.tierized = '1';

        function mkSec(cls, num, title, desc) {
            var wrap = el('div', { className: 'ltc-tier-sec ltc-tier-' + cls });
            wrap.innerHTML = '<div class="ltc-tier-head"><span class="ltc-tier-num">' + num + '</span>' +
                '<span class="ltc-tier-title">' + title + '</span></div>' +
                '<p class="ltc-tier-desc">' + desc + '</p>';
            // Keep the input-grid class so the page's advanced-mode selector
            // ('.input-grid .input-group.advanced-param') still matches.
            var g = el('div', { className: 'input-grid ltc-tier-grid' });
            wrap.appendChild(g);
            return { wrap: wrap, grid: g };
        }
        var secs = {
            design: mkSec('design', '1', 'Design inputs', 'Your decisions — set these first.'),
            auto:   mkSec('auto',   '2', 'Auto-filled', 'Filled from the country & architecture presets (sourced engine data). Override anytime — ↺ restores the preset value.'),
            tune:   mkSec('tune',   '3', 'Optimization & calibration', 'Targets and model-tuning knobs — adjust these when optimizing the design.')
        };
        grid.parentNode.insertBefore(secs.design.wrap, grid);
        grid.parentNode.insertBefore(secs.auto.wrap, grid);
        grid.parentNode.insertBefore(secs.tune.wrap, grid);

        Array.prototype.slice.call(grid.querySelectorAll('.input-group')).forEach(function (group) {
            var field = group.querySelector('input, select');
            if (!field) return;
            var spec = TIER_BY_INPUT[field.id];
            var tier = spec ? (typeof spec === 'string' ? spec : spec[0]) : 'tune';
            var src = (spec && spec[1]) || '';
            var label = group.querySelector('label');
            if (label) {
                var chip = el('span', { className: 'ltc-tier-chip ltc-chip-' + tier });
                chip.textContent = tier === 'auto' ? ('AUTO · ' + (src === 'country' ? 'country' : 'architecture')) :
                                   tier === 'design' ? 'DESIGN' : 'TUNE';
                chip.id = 'chip_' + field.id;
                label.appendChild(chip);
                if (tier === 'auto') {
                    var rb = el('button', { type: 'button', className: 'ltc-auto-reset', title: 'Reset to preset value', textContent: '↺' });
                    rb.id = 'reset_' + field.id;
                    rb.style.display = 'none';
                    rb.addEventListener('click', function () {
                        if (_autoSnap[field.id] !== undefined) {
                            field.value = _autoSnap[field.id];
                            field.dispatchEvent(new Event('input', { bubbles: true }));
                            field.dispatchEvent(new Event('change', { bubbles: true }));
                            setChipState(field.id, 'auto');
                        }
                    });
                    label.appendChild(rb);
                    field.addEventListener('input', function () {
                        setChipState(field.id, String(field.value) === String(_autoSnap[field.id]) ? 'auto' : 'overridden');
                    });
                }
            }
            secs[tier].grid.appendChild(group);
        });
        grid.style.display = 'none';

        snapshotAuto();
        ['inCountryProfile', 'inCoolingArchitecture'].forEach(function (id) {
            var s = document.getElementById(id);
            if (s) s.addEventListener('change', function () { setTimeout(snapshotAuto, 60); });
        });
    }
    function setChipState(fieldId, state) {
        var chip = document.getElementById('chip_' + fieldId);
        var rb = document.getElementById('reset_' + fieldId);
        if (chip) {
            chip.classList.toggle('ltc-chip-overridden', state === 'overridden');
            if (state === 'overridden') chip.textContent = 'OVERRIDDEN';
            else {
                var spec = TIER_BY_INPUT[fieldId];
                chip.textContent = 'AUTO · ' + ((spec && spec[1]) === 'country' ? 'country' : 'architecture');
            }
        }
        if (rb) rb.style.display = state === 'overridden' ? '' : 'none';
    }
    function snapshotAuto() {
        Object.keys(TIER_BY_INPUT).forEach(function (id) {
            var spec = TIER_BY_INPUT[id];
            if (typeof spec === 'string' || spec[0] !== 'auto') return;
            var f = document.getElementById(id);
            if (f) { _autoSnap[id] = f.value; setChipState(id, 'auto'); }
        });
    }

    // Firm-precision polish: thousand separators on ≥4-digit integers in the
    // high-visibility value nodes + ΔT glyph in diagram strings. Display only.
    function polishNumbers() {
        var sels = ['#ltcDetailedHost .result-card .value', '.model-block .diag-value',
                    '#ltcFlowHost .flow-row', '#ltcDetailedHost .quick-kpi .v'];
        document.querySelectorAll(sels.join(', ')).forEach(function (n) {
            var t = n.textContent;
            if (!t || t.indexOf('—') !== -1) return;
            var out = t.replace(/\bdT\b/g, 'ΔT').replace(/(^|[^\d.,])(\d{4,})(?=([^\d.]|$))/g, function (m, pre, num, post) {
                return pre + Number(num).toLocaleString('en-US');
            });
            if (out !== t) n.textContent = out;
        });
    }

    // ════════════════════════════════════════════════════════
    // accordionizeHosts — intuitiveness: the relocated legacy blocks are dense
    // engineering dumps; shown all-expanded they read as a wall. Wrap each in a
    // titled collapsible card (first one per tab open), so every tab becomes a
    // scannable index the user expands on demand. Element ids untouched.
    // ════════════════════════════════════════════════════════
    function accordionizeHosts() {
        ['ltcDetailedHost', 'ltcFlowHost', 'ltcChartsHost', 'ltcReportHost'].forEach(function (hostId) {
            var host = document.getElementById(hostId);
            if (!host) return;
            var blocks = Array.prototype.slice.call(host.children).filter(function (n) {
                return !n.classList.contains('ltc-overview-card') &&
                       !n.classList.contains('output-quickbar') &&
                       !n.classList.contains('result-grid') &&
                       !n.classList.contains('ltc-acc');
            });
            blocks.forEach(function (block, idx) {
                var heading = block.querySelector('h4, h3');
                var title = heading ? heading.textContent.replace(/\s+/g, ' ').trim() : 'Details';
                var open = idx === 0;
                var wrap = el('section', { className: 'ltc-acc' + (open ? ' open' : '') });
                var btn = el('button', { type: 'button', className: 'ltc-acc-head' });
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');
                btn.innerHTML = '<span class="ltc-acc-title">' + title + '</span><span class="ltc-acc-chev" aria-hidden="true">▾</span>';
                var body = el('div', { className: 'ltc-acc-body' });
                if (!open) body.style.display = 'none';
                host.insertBefore(wrap, block);
                wrap.appendChild(btn);
                wrap.appendChild(body);
                body.appendChild(block);
                if (heading) heading.style.display = 'none';
                btn.addEventListener('click', function () {
                    var isOpen = wrap.classList.toggle('open');
                    body.style.display = isOpen ? '' : 'none';
                    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                });
            });
        });
    }

    // ════════════════════════════════════════════════════════
    // buildSystemOverviewSVG — inline SVG schematic
    // ════════════════════════════════════════════════════════
    // ── Engineering symbols from the RZ Engineering Symbol Atlas ────────────
    // equinor PP001A (ISO P&ID centrifugal pump) + PV005A (gate valve) — solid
    // paths recolored via fill=currentColor; lucide fan + server — stroke
    // currentColor. Vendored verbatim; composed into one theme-aware schematic.
    var SYM = {
        pump: '<g fill="currentColor"><path d="M52 40.5C52 38.2909 50.2091 36.5 48 36.5C45.7909 36.5 44 38.2909 44 40.5C44 42.7091 45.7909 44.5 48 44.5C50.2091 44.5 52 42.7091 52 40.5ZM51 40.5C51 42.1569 49.6569 43.5 48 43.5C46.3431 43.5 45 42.1569 45 40.5C45 38.8431 46.3431 37.5 48 37.5C49.6569 37.5 51 38.8431 51 40.5Z"/><path d="M83 40.5C83 21.17 67.33 5.5 48 5.5C28.67 5.5 13 21.17 13 40.5C13 50.9622 17.5904 60.3522 24.8671 66.7659L13 90.5H83L71.1329 66.7659C78.4096 60.3522 83 50.9622 83 40.5ZM48 74.5C29.2223 74.5 14 59.2777 14 40.5C14 21.7223 29.2223 6.5 48 6.5C66.7777 6.5 82 21.7223 82 40.5C82 59.2777 66.7777 74.5 48 74.5ZM48 75.5C56.4973 75.5 64.2874 72.4719 70.3499 67.4359L81.382 89.5H14.618L25.6501 67.4359C31.7126 72.4719 39.5027 75.5 48 75.5Z"/></g>',
        valve: '<path fill="currentColor" d="M24 12.5L43 22V2L24 11.5L5 2V22L24 12.5ZM6 3.61803L22.7639 12L6 20.382V3.61803ZM42 20.382L25.2361 12L42 3.61803V20.382Z"/>',
        fan: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"/><path d="M12 12v.01"/></g>',
        server: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></g>'
    };
    function sym(name, x, y, w, h, vb) {
        return '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" viewBox="' + vb + '">' + SYM[name] + '</svg>';
    }
    function buildSystemOverviewSVG() {
        var eq = 'opacity=".8"';                       // equipment tone
        var lbl = 'font-size="11" font-weight="600" fill="currentColor" opacity=".55" text-anchor="middle" letter-spacing=".06em"';
        var val = 'font-size="12" font-weight="700" text-anchor="middle"';
        var chip = 'font-size="11.5" font-weight="700" text-anchor="middle" fill="currentColor"';
        var s = [];
        s.push('<svg class="ltc-pid-svg" viewBox="0 0 1000 252" role="img" aria-label="Liquid-to-chip cooling loop: dry cooler, pump, plate heat exchanger, IT racks">');
        s.push('<defs>',
            '<marker id="pidArrS" markerWidth="9" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" class="ltc-pid-fill-supply"/></marker>',
            '<marker id="pidArrR" markerWidth="9" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" class="ltc-pid-fill-return"/></marker>',
            '</defs>');

        // ── DRY COOLER (heat rejection) — clickable trace group ──
        s.push('<g class="ltc-pid-node" data-ltc-trace="totalCoolingKw" ' + eq + '>',
            '<rect x="38" y="72" width="150" height="92" rx="8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
            sym('fan', 56, 82, 44, 44, '0 0 24 24'), sym('fan', 122, 82, 44, 44, '0 0 24 24'),
            '<line x1="50" y1="140" x2="176" y2="140" stroke="currentColor" stroke-width="1.2" opacity=".5"/>',
            '<line x1="50" y1="150" x2="176" y2="150" stroke="currentColor" stroke-width="1.2" opacity=".5"/>',
            '<rect x="38" y="72" width="150" height="92" rx="8" fill="transparent"/>',
            '</g>');
        s.push('<text x="113" y="185" ' + lbl + '>DRY COOLER</text>');
        s.push('<text x="113" y="204" ' + chip + ' class="ltc-pid-chipval" id="schCoolerKw">— kW rejected</text>');

        // ── facility loop: dry cooler → valve → pump → HEX (hot to cooler on top, cooled back on bottom) ──
        s.push('<path d="M188 96 H 420" class="ltc-pid-return ltc-flow-return" marker-end="url(#pidArrR)" transform="rotate(180 304 96)"/>'); // HEX→cooler (hot)
        s.push('<path d="M188 140 H 236" class="ltc-pid-supply ltc-flow-supply"/>');
        s.push(sym('valve', 238, 131, 36, 18, '0 0 48 24'));
        s.push('<path d="M274 140 H 300" class="ltc-pid-supply ltc-flow-supply"/>');
        s.push('<g class="ltc-pid-node" data-ltc-trace="pumpPowerKw">' + sym('pump', 298, 96, 64, 64, '0 0 96 96') +
               '<rect x="296" y="94" width="68" height="68" fill="transparent"/></g>');
        s.push('<text x="330" y="185" ' + lbl + '>PUMP</text>');
        s.push('<text x="330" y="204" ' + chip + ' class="ltc-pid-chipval" id="schPumpKw">— kW</text>');
        s.push('<text x="330" y="221" font-size="10" text-anchor="middle" fill="currentColor" opacity=".55" id="schPumpHead">— m head · η —%</text>');
        s.push('<path d="M362 140 H 396" class="ltc-pid-supply ltc-flow-supply"/>');
        s.push(sym('valve', 396, 131, 36, 18, '0 0 48 24'));
        s.push('<path d="M432 140 H 470" class="ltc-pid-supply ltc-flow-supply" marker-end="url(#pidArrS)"/>');

        // ── CDU / PLATE HEX — clickable trace group ──
        s.push('<g class="ltc-pid-node" data-ltc-trace="cduCount" ' + eq + '><rect x="472" y="66" width="118" height="104" rx="8" fill="none" stroke="currentColor" stroke-width="1.6"/>');
        for (var i = 0; i < 6; i++) s.push('<line x1="' + (492 + i * 16) + '" y1="80" x2="' + (492 + i * 16) + '" y2="156" stroke="currentColor" stroke-width="2" opacity=".55"/>');
        s.push('<rect x="472" y="66" width="118" height="104" rx="8" fill="transparent"/></g>');
        s.push('<text x="531" y="185" ' + lbl + '>CDU / PLATE HEX</text>');
        s.push('<text x="531" y="204" ' + chip + ' class="ltc-pid-chipval" id="schCduN">— CDU</text>');
        s.push('<text x="531" y="221" font-size="10" text-anchor="middle" fill="currentColor" opacity=".55" id="schCduDt">ΔT — K</text>');

        // ── technology loop: HEX ⇄ IT racks (blue supply top, red return bottom) ──
        s.push('<path d="M590 92 H 790" class="ltc-pid-supply ltc-flow-supply" marker-end="url(#pidArrS)"/>');
        s.push('<path d="M790 148 H 590" class="ltc-pid-return ltc-flow-return" marker-end="url(#pidArrR)"/>');
        s.push('<text x="690" y="78" ' + val + ' class="ltc-pid-fill-supply" id="schSupplyT">Supply — °C</text>');
        s.push('<text x="690" y="170" ' + val + ' class="ltc-pid-fill-return" id="schReturnT">Return — °C</text>');
        s.push('<text x="690" y="126" font-size="11" font-weight="600" text-anchor="middle" fill="currentColor" opacity=".6" id="schFlowLpm">— LPM</text>');

        // ── IT RACKS (cold plates) — clickable trace group ──
        s.push('<g class="ltc-pid-node" data-ltc-trace="liquidKw" ' + eq + '><rect x="792" y="60" width="170" height="116" rx="8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
            sym('server', 812, 76, 40, 40, '0 0 24 24'), sym('server', 866, 76, 40, 40, '0 0 24 24'), sym('server', 920, 76, 40, 40, '0 0 24 24'),
            sym('server', 812, 122, 40, 40, '0 0 24 24'), sym('server', 866, 122, 40, 40, '0 0 24 24'), sym('server', 920, 122, 40, 40, '0 0 24 24'),
            '<rect x="792" y="60" width="170" height="116" rx="8" fill="transparent"/></g>');
        s.push('<text x="877" y="196" ' + lbl + '>IT RACKS · LIQUID COLD PLATES</text>');
        s.push('<text x="877" y="215" ' + chip + ' class="ltc-pid-chipval" id="schItMw">— MW IT</text>');
        s.push('<text x="877" y="232" font-size="10" text-anchor="middle" fill="currentColor" opacity=".55" id="schCapturePct">— % captured to liquid</text>');
        s.push('</svg>');
        return '<div class="ltc-pid">' + s.join('') + '</div>';
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

            var lbl = el('span', { className: 'ltc-slider-label' });
            lbl.innerHTML = cfg.label + ' ⓘ' + (cfg.preset ?
                ' <span class="ltc-preset-dot" title="Auto-set by the architecture preset — adjust freely"></span>' : '');
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
            valBox.appendChild(mkStepBtn(numbox, -1));
            valBox.appendChild(numbox);
            valBox.appendChild(mkStepBtn(numbox, 1));
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
                // brief edit-feedback pulse on the paired value box
                numbox.classList.add('ltc-just-edited');
                clearTimeout(numbox.__pulseT);
                numbox.__pulseT = setTimeout(function () { numbox.classList.remove('ltc-just-edited'); }, 550);
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
        renderValidation(model);
        renderTornado(model);
        renderScenarioReadout(model);
        renderReportCompare(model);
        renderScenarioInfo(model);
        renderResultsTab(model);
        polishNumbers();
        // Live run stamp — auto-run recomputes constantly; show it.
        var lr = document.getElementById('ltcLastRun');
        if (lr) {
            var now = new Date();
            lr.innerHTML = 'Last run: ' + now.getHours() + ':' + ('0' + now.getMinutes()).slice(-2) + ':' +
                ('0' + now.getSeconds()).slice(-2) + ' <span class="ltc-run-ok">✓ Completed</span>';
        }
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
        setText2('schFlowLpm', _fmtNum(model.flowLpm, 0, true) + ' LPM');
        setText2('schPumpKw', fmt(model.pumpPowerKw, 1) + ' kW');
        setText2('schPumpHead', fmt(model.input.pumpHead, 0) + ' m head · η ' + fmt(model.input.pumpEff, 0) + '%');
        setText2('schCduN', model.cduCount + ' CDU');
        setText2('schCduDt', 'ΔT ' + fmt(model.deltaT, 1) + ' K');
        setText2('schCoolerKw', _fmtNum(model.internals && model.internals.totalCoolingKw != null ? model.internals.totalCoolingKw : (model.totalFacilityKw - model.itKw), 0, true) + ' kW rejected');
        setText2('schItMw', fmt(model.itKw / 1000, 2) + ' MW IT');
        setText2('schCapturePct', fmt(model.effectiveCapture, 1) + ' % captured to liquid');
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

    // ════════════════════════════════════════════════════════
    // Custom − / + steppers (native number-input spinners are hidden by CSS —
    // owner: "button up dan button down jelek"). Steps by the input's real
    // step/min/max and dispatches input+change so bindings + auto-run fire.
    // ════════════════════════════════════════════════════════
    function stepField(input, dir) {
        var step = parseFloat(input.step) || 1;
        var min = input.min !== '' ? parseFloat(input.min) : -Infinity;
        var max = input.max !== '' ? parseFloat(input.max) : Infinity;
        var v = (parseFloat(input.value) || 0) + dir * step;
        v = Math.max(min, Math.min(max, Math.round(v * 1000) / 1000));
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function mkStepBtn(input, dir) {
        var b = el('button', { type: 'button', className: 'ltc-step-btn', textContent: dir > 0 ? '+' : '−' });
        b.setAttribute('aria-label', (dir > 0 ? 'Increase' : 'Decrease') + ' value');
        b.addEventListener('click', function () { stepField(input, dir); });
        return b;
    }
    // Make the DETAILED tab's 23-card output grid traceable (id → model key,
    // mirroring the page's OUTPUT_KEY_BY_ID subset that LTC_TRACE covers).
    var DETAILED_TRACE = { outLiquidLoad:'liquidKw', outAirLoad:'airKw', outFlow:'flowLpm',
        outPump:'pumpPowerKw', outCdu:'cduCount', outPue:'pue', outCop:'systemCop', outWue:'wue',
        outEnergy:'annualGwh', outOpex:'annualOpex', outHeatCredit:'heatReuseCredit',
        outNetOpex:'netOpex', outCarbon:'netCarbonTons', outCarbonAvoided:'avoidedCarbonTons',
        outDesignDensity:'designDensity', outControlIndex:'controlIndex', outFutureFactor:'futureFactor',
        outRackDensity:'rackDensity', outRisk:'riskIndex', outConfidence:'confidence' };
    function traceifyDetailedGrid() {
        Object.keys(DETAILED_TRACE).forEach(function (id) {
            var n = document.getElementById(id);
            if (!n || n.getAttribute('data-ltc-trace')) return;
            n.setAttribute('data-ltc-trace', DETAILED_TRACE[id]);
            n.classList.add('ltc-traceable', 'ltc-res-val');
            n.setAttribute('role', 'button'); n.setAttribute('tabindex', '0');
            /* ƒx badge via CSS ::after — the engine's setText() replaces
               textContent every render and would wipe an injected child. */
        });
    }

    function addSteppersToPanel() {
        document.querySelectorAll('#ltcOtherParamsBody .input-group input[type="number"]').forEach(function (input) {
            if (input.parentNode.classList && input.parentNode.classList.contains('ltc-step-wrap')) return;
            var wrap = el('span', { className: 'ltc-step-wrap' });
            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(mkStepBtn(input, -1));
            wrap.appendChild(input);
            wrap.appendChild(mkStepBtn(input, 1));
        });
    }

    // ════════════════════════════════════════════════════════
    // RZ TRACE — DCMOC-style click-to-trace on headline values.
    // Content = the page's own PARAM_TOOLTIPS metadata (via window.__ltcTermMeta)
    // + live model values; only the dependency map below is newly authored.
    // ════════════════════════════════════════════════════════
    var LTC_TRACE = {
        itKw:            { deps: ['itLoadMw'] },
        liquidKw:        { deps: ['itKw', 'effectiveCapture'] },
        airKw:           { deps: ['itKw', 'liquidKw'] },
        effectiveCapture:{ deps: ['liquidCapture', 'coefHeatTransfer', 'controlIndex'] },
        deltaT:          { deps: ['supplyTemp', 'returnTemp'] },
        flowLpm:         { deps: ['liquidKw', 'deltaT', 'coolantKey'] },
        pumpPowerKw:     { deps: ['pumpHead', 'flowLpm', 'pumpEff'] },
        cduCount:        { deps: ['liquidKw', 'cduUnit', 'redundancy'] },
        totalCoolingKw:  { deps: ['liquidKw', 'airKw', 'pumpPowerKw', 'fanPower'] },
        totalFacilityKw: { deps: ['itKw', 'totalCoolingKw', 'upsEff', 'distLoss'] },
        pue:             { deps: ['totalFacilityKw', 'itKw'] },
        systemCop:       { deps: ['itKw', 'totalCoolingKw'] },
        wue:             { deps: ['climate', 'economizerHours', 'effectiveCapture'] },
        annualGwh:       { deps: ['totalFacilityKw'] },
        annualOpex:      { deps: ['annualGwh', 'elecPrice', 'waterTariff'] },
        netOpex:         { deps: ['annualOpex', 'heatReuseCredit'] },
        netCarbonTons:   { deps: ['annualGwh', 'carbonIntensity', 'avoidedCarbonTons'] },
        riskIndex:       { deps: ['redundancy', 'monitoring', 'controlIndex', 'failureMode'] },
        controlIndex:    { deps: ['controlQuality', 'predictiveGain', 'monitoring'] },
        supplyTemp:      { deps: [] }, returnTemp: { deps: [] },
        heatReuseCredit: { deps: ['heatReuse', 'elecPrice'] },
        avoidedCarbonTons:{ deps: ['heatReuse', 'carbonIntensity'] },
        futureFactor:    { deps: ['coefFutureTech', 'modelYear'] },
        confidence:      { deps: ['monitoring', 'hydraulicMargin', 'coefPipeLoss'] },
        rackDensity:     { deps: ['itLoadMw', 'rackCount'] },
        designDensity:   { deps: ['rackDensityTarget', 'highDensityShare'] },
        annualKwh:       { deps: ['totalFacilityKw'] }
    };
    var TRACE_UNITS = { itKw:'kW', liquidKw:'kW', airKw:'kW', totalCoolingKw:'kW', totalFacilityKw:'kW',
        pumpPowerKw:'kW', flowLpm:'LPM', deltaT:'K', supplyTemp:'°C', returnTemp:'°C', effectiveCapture:'%',
        wue:'L/kWh', annualGwh:'GWh/yr', annualOpex:'$/yr', netOpex:'$/yr', netCarbonTons:'tCO2e/yr',
        avoidedCarbonTons:'tCO2e/yr', heatReuseCredit:'$/yr', itLoadMw:'MW', liquidCapture:'%',
        coefHeatTransfer:'%', pumpHead:'m', pumpEff:'%', cduUnit:'kW', fanPower:'% IT', upsEff:'%',
        distLoss:'%', elecPrice:'$/kWh', waterTariff:'$/m³', carbonIntensity:'kgCO2e/kWh',
        economizerHours:'%', monitoring:'%', controlQuality:'%', predictiveGain:'%', heatReuse:'%',
        controlIndex:'/100', riskIndex:'/100', cduCount:'units' };
    function traceValueOf(key, m) {
        if (!m) return null;
        if (m[key] !== undefined) return m[key];
        if (m.input && m.input[key] !== undefined) return m.input[key];
        if (m.internals && m.internals[key] !== undefined) return m.internals[key];
        return null;
    }
    function traceFmt(key, v) {
        if (v === null || v === undefined) return '—';
        if (typeof v !== 'number') return String(v);
        var u = TRACE_UNITS[key] || '';
        var dec = Math.abs(v) >= 1000 ? 0 : (Math.abs(v) >= 10 ? 1 : (Math.abs(v) >= 1 ? 2 : 3));
        return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dec }) + (u ? ' ' + u : '');
    }
    function traceProvenance(key, m) {
        if (m && m.input && m.input[key] !== undefined) return { cls: 'input', label: 'INPUT' };
        if (LTC_TRACE[key] && LTC_TRACE[key].deps.length) return { cls: 'engine', label: 'ENGINE · models.ltc.compute' };
        return { cls: 'derived', label: 'MODEL' };
    }
    function openTrace(key, crumbs) {
        var m = window.__ltcLastModel;
        if (!m) return;
        crumbs = crumbs || [];
        var meta = (typeof window.__ltcTermMeta === 'function') ? window.__ltcTermMeta(key) : null;
        var spec = LTC_TRACE[key] || { deps: [] };
        var prov = traceProvenance(key, m);
        var pop = document.getElementById('ltcTracePop');
        if (!pop) {
            pop = el('div', { id: 'ltcTracePop', className: 'ltc-trace-pop' });
            document.body.appendChild(pop);
            document.addEventListener('click', function (e) {
                if (!pop.contains(e.target) && !e.target.closest('[data-ltc-trace]')) pop.classList.remove('open');
            });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape') pop.classList.remove('open'); });
        }
        var crumbHtml = crumbs.length ?
            '<div class="ltc-trace-crumbs">' + crumbs.map(function (c, i) {
                return '<button type="button" class="ltc-trace-crumb" data-ckey="' + c + '" data-cidx="' + i + '">' +
                    ((window.__ltcTermMeta && window.__ltcTermMeta(c).title) || c) + '</button>';
            }).join(' › ') + ' › <b>' + (meta ? meta.title : key) + '</b></div>' : '';
        var pills = spec.deps.map(function (d) {
            var dm = window.__ltcTermMeta ? window.__ltcTermMeta(d) : null;
            return '<button type="button" class="ltc-trace-pill" data-tkey="' + d + '" title="' + (dm ? dm.title : d) + ' — klik untuk trace">' +
                '<b>' + traceFmt(d, traceValueOf(d, m)) + '</b><span>' + (dm ? dm.title : d) + '</span></button>';
        }).join('');
        pop.innerHTML =
            '<div class="ltc-trace-head">' +
            '<div><div class="ltc-trace-val">' + traceFmt(key, traceValueOf(key, m)) + '</div>' +
            '<div class="ltc-trace-lbl">' + (meta ? meta.title : key) + '</div></div>' +
            '<span class="ltc-trace-prov ' + prov.cls + '">' + prov.label + '</span>' +
            '<button type="button" class="ltc-trace-x" aria-label="Close">×</button></div>' +
            crumbHtml +
            (meta ? '<p class="ltc-trace-desc">' + meta.desc + '</p>' : '') +
            (meta && meta.formula ? '<div class="ltc-trace-formula">' + meta.formula + '</div>' : '') +
            (pills ? '<div class="ltc-trace-deps-lbl">DIHITUNG DARI — klik untuk telusuri:</div><div class="ltc-trace-deps">' + pills + '</div>' : '') +
            (meta && meta.impact ? '<p class="ltc-trace-impact">' + meta.impact + '</p>' : '') +
            '<div class="ltc-trace-actions">' +
            '<button type="button" class="ltc-trace-open-detail">Open in DETAILED tab</button>' +
            '<button type="button" class="ltc-trace-copy">Copy trace</button></div>';
        pop.classList.add('open');
        pop.querySelector('.ltc-trace-x').addEventListener('click', function () { pop.classList.remove('open'); });
        pop.querySelectorAll('.ltc-trace-pill').forEach(function (b) {
            b.addEventListener('click', function () { openTrace(b.dataset.tkey, crumbs.concat([key])); });
        });
        pop.querySelectorAll('.ltc-trace-crumb').forEach(function (b) {
            b.addEventListener('click', function () { openTrace(b.dataset.ckey, crumbs.slice(0, Number(b.dataset.cidx))); });
        });
        pop.querySelector('.ltc-trace-open-detail').addEventListener('click', function () {
            pop.classList.remove('open');
            var t = document.querySelector('.ltc-tab-btn[data-tab="detailed"]'); if (t) t.click();
            var eq = document.getElementById('equationList');
            var acc = eq && eq.closest('.ltc-acc');
            if (acc && !acc.classList.contains('open')) acc.querySelector('.ltc-acc-head').click();
            if (acc) acc.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        pop.querySelector('.ltc-trace-copy').addEventListener('click', function () {
            var txt = (meta ? meta.title : key) + ' = ' + traceFmt(key, traceValueOf(key, m)) + '\n' +
                (meta ? meta.formula + '\n' : '') +
                spec.deps.map(function (d) {
                    var dm = window.__ltcTermMeta ? window.__ltcTermMeta(d) : null;
                    return '  • ' + (dm ? dm.title : d) + ' = ' + traceFmt(d, traceValueOf(d, m));
                }).join('\n') + '\nSource: LTC lab · models.ltc.compute (shared RZ engine)';
            try { navigator.clipboard.writeText(txt); } catch (e) {}
        });
    }
    function bindTraceDelegation() {
        document.addEventListener('click', function (e) {
            var t = e.target.closest ? e.target.closest('[data-ltc-trace]') : null;
            if (!t) return;
            e.preventDefault();
            openTrace(t.getAttribute('data-ltc-trace'), []);
        });
    }

    // impactParam engine-key → page input id (for clickable fix suggestions)
    var INPUT_ID_BY_KEY = {
        itLoadMw:'inItLoad', liquidCapture:'inLiquidCapture', rackDensityTarget:'inRackDensityTarget',
        supplyTemp:'inSupplyTemp', pumpEff:'inPumpEff', airCop:'inAirCop',
        economizerHours:'inEconomizerHours', controlQuality:'inControlQuality',
        predictiveGain:'inPredictiveGain', coefHeatTransfer:'inCoefHeatTransfer',
        coefPipeLoss:'inCoefPipeLoss', coefFutureTech:'inCoefFutureTech'
    };
    // For an out-of-band metric, find the input moves (±1 step through the REAL
    // engine) that pull it back toward the band. Engine-computed — no heuristics.
    function suggestFixes(model, row) {
        var eng = window.RZEngine, d = eng && eng.data, ml = eng && eng.models && eng.models.ltc;
        if (!ml || !d || !d.ltcCalibration || !d.ltcCalibration.impactParams) return [];
        function metricOf(m) {
            switch (row.key) {
                case 'pue': return m.pue;
                case 'wue': return m.wue;
                case 'deltaT': return m.deltaT;
                case 'supplyTemp': return m.input && m.input.supplyTemp;
                case 'flowIntensity': return m.liquidKw > 0 ? m.flowLpm / m.liquidKw : NaN;
                case 'pumpPct': return m.itKw > 0 ? (m.pumpPowerKw / m.itKw) * 100 : NaN;
            }
            return NaN;
        }
        var base = metricOf(model);
        var target = base > row.hi ? row.hi : row.lo;      // pull toward the violated edge
        var out = [];
        d.ltcCalibration.impactParams.forEach(function (cfg) {
            [1, -1].forEach(function (dir) {
                var inp = Object.assign({}, model.input);
                var nv = (inp[cfg.key] || 0) + dir * cfg.step;
                if (nv < cfg.min || nv > cfg.max) return;
                inp[cfg.key] = nv;
                var alt = metricOf(ml.compute(inp));
                var gain = Math.abs(base - target) - Math.abs(alt - target);
                if (gain > 1e-9) out.push({ key: cfg.key, label: cfg.label, dir: dir, gain: gain });
            });
        });
        out.sort(function (a, b) { return b.gain - a.gain; });
        return out.slice(0, 2);
    }

    // MODEL VALIDATION — render engine validation rows as band bars with a
    // value marker; green in-band, amber out. Single source: models.ltc.validation.
    function renderValidation(model) {
        var host = document.getElementById('ltcValidList');
        if (!host || !model) return;
        var eng = window.RZEngine && window.RZEngine.models && window.RZEngine.models.ltc;
        if (!eng || typeof eng.validation !== 'function') { host.innerHTML = ''; return; }
        var rows = eng.validation(model);
        var inCount = rows.filter(function (r) { return r.inBand; }).length;
        var pill = document.getElementById('ltcValidPill');
        if (pill) {
            pill.textContent = inCount + '/' + rows.length + ' in band';
            pill.className = 'ltc-comp-pill' + (inCount === rows.length ? '' : ' ltc-fail');
        }
        host.innerHTML = rows.map(function (r) {
            var span = r.hi - r.lo;
            var pad = span * 0.35;                       // visual margin beyond the band
            var min = r.lo - pad, max = r.hi + pad;
            var pos = r.value === null ? null : Math.max(0, Math.min(100, (r.value - min) / (max - min) * 100));
            var loPct = (r.lo - min) / (max - min) * 100, hiPct = (r.hi - min) / (max - min) * 100;
            var dec = span < 2 ? 2 : (span < 20 ? 1 : 0);
            return '<div class="ltc-valid-row" title="' + (r.source || '').replace(/"/g, '&quot;') + '">' +
                '<div class="ltc-valid-head"><span class="ltc-valid-lbl">' + r.label + '</span>' +
                '<span class="ltc-valid-val ltc-traceable ' + (r.inBand ? 'ok' : 'warn') + '" data-ltc-trace="' +
                ({ pue:'pue', wue:'wue', deltaT:'deltaT', supplyTemp:'supplyTemp', flowIntensity:'flowLpm', pumpPct:'pumpPowerKw' }[r.key] || r.key) +
                '" role="button" tabindex="0">' +
                (r.value === null ? '—' : r.value.toFixed(dec) + (r.unit ? ' ' + r.unit : '')) + '</span></div>' +
                '<div class="ltc-valid-track">' +
                '<span class="ltc-valid-band" style="left:' + loPct.toFixed(1) + '%;width:' + (hiPct - loPct).toFixed(1) + '%"></span>' +
                (pos === null ? '' : '<span class="ltc-valid-marker ' + (r.inBand ? 'ok' : 'warn') + '" style="left:' + pos.toFixed(1) + '%"></span>') +
                '</div>' +
                '<div class="ltc-valid-range"><span>' + r.lo + '</span><span>' + r.hi + (r.unit ? ' ' + r.unit : '') + '</span></div>' +
                (r.inBand ? '' :
                    '<div class="ltc-valid-fix" data-vkey="' + r.key + '">' +
                    suggestFixes(model, r).map(function (f) {
                        return '<button type="button" class="ltc-fix-chip" data-fkey="' + f.key + '" data-fdir="' + f.dir + '" ' +
                            'title="One engine-verified step that moves ' + r.label + ' toward its band">' +
                            f.label + ' ' + (f.dir > 0 ? '↑' : '↓') + '</button>';
                    }).join('') + '</div>') +
                '</div>';
        }).join('');
        // Clickable fixes: apply ±1 step to the real input → live recompute.
        host.querySelectorAll('.ltc-fix-chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                var eng = window.RZEngine && window.RZEngine.data;
                var cfg = eng && eng.ltcCalibration.impactParams.filter(function (c) { return c.key === chip.dataset.fkey; })[0];
                var input = document.getElementById(INPUT_ID_BY_KEY[chip.dataset.fkey]);
                if (!cfg || !input) return;
                var nv = (parseFloat(input.value) || 0) + Number(chip.dataset.fdir) * cfg.step;
                nv = Math.round((Math.max(cfg.min, Math.min(cfg.max, nv))) * 1000) / 1000;
                var num = document.getElementById('ltcNum_' + INPUT_ID_BY_KEY[chip.dataset.fkey]);
                if (num) {
                    // primary slider: drive the numbox — its handler syncs range,
                    // fill, and the original input (auto-run fires from there).
                    num.value = nv;
                    num.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    input.value = nv;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });
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

        // Coolant thermophysical properties — from the shared engine DATA.coolants
        // (crawled/sourced: cp, rho, viscosity, thermal conductivity).
        var cool = (window.RZEngine && window.RZEngine.data && window.RZEngine.data.coolants &&
                    window.RZEngine.data.coolants[inp.coolantKey]) || {};
        var coolLabel = ({ water: 'Water', pg20: '20% PG', pg30: '30% PG', pg40: '40% PG',
                           dielectric_1p: 'Dielectric 1P', dielectric_2p: 'Dielectric 2P' })[inp.coolantKey] || (inp.coolantKey || '—');
        var c1rows = [
            { lbl: 'Supply Temperature',  val: fmt(inp.supplyTemp, 1) + ' °C', key: 'supplyTemp' },
            { lbl: 'Return Temperature',  val: fmt(inp.returnTemp, 1) + ' °C', key: 'returnTemp' },
            { lbl: 'ΔT',                  val: fmt(model.deltaT, 1) + ' K', key: 'deltaT' },
            { lbl: 'Coolant',             val: coolLabel },
            { lbl: 'Cp',                  val: cool.cp != null ? fmt(cool.cp, 3) + ' kJ/kg·K' : '—' },
            { lbl: 'Density',             val: cool.rho != null ? fmt(cool.rho, 0) + ' kg/m³' : '—' }
        ];
        if (cool.viscosityMpas != null) c1rows.push({ lbl: 'Viscosity', val: fmt(cool.viscosityMpas, 3) + ' mPa·s' });
        if (cool.thermalCondWmk != null) c1rows.push({ lbl: 'Thermal Cond.', val: fmt(cool.thermalCondWmk, 3) + ' W/m·K' });
        c1rows.push({ lbl: 'Volumetric Flow',   val: fmt(model.flowLpm, 0) + ' LPM', key: 'flowLpm' });
        c1rows.push({ lbl: 'Effective Capture', val: fmt(model.effectiveCapture, 1) + '%', key: 'effectiveCapture' });
        c1rows.push({ lbl: 'CDU Count',         val: model.cduCount + ' units', key: 'cduCount' });
        var c1 = resCard('FLOW & TEMPERATURE', c1rows);

        // Card 2: Pump & Hydraulic
        var c2 = resCard('PUMP & HYDRAULIC', [
            { lbl: 'Pump Head',           val: fmt(inp.pumpHead, 1) + ' m' },
            { lbl: 'Pump Power',          val: fmt(model.pumpPowerKw, 2) + ' kW', key: 'pumpPowerKw' },
            { lbl: 'Pump Efficiency',     val: fmt(inp.pumpEff, 1) + '%' },
            { lbl: 'Pipe Loss Factor',    val: fmt(inp.coefPipeLoss, 3) + 'x' },
            { lbl: 'Hydraulic Margin',    val: fmt(inp.hydraulicMargin, 0) + '%' },
            { lbl: 'Liquid COP',          val: fmt(intern.liquidCop || model.liquidCop, 2) }
        ]);

        // Card 3: Performance
        var c3 = resCard('PERFORMANCE', [
            { lbl: 'System COP',          val: fmt(model.systemCop, 2), key: 'systemCop' },
            { lbl: 'PUE',                 val: fmt(model.pue, 4), key: 'pue' },
            { lbl: 'WUE',                 val: fmt(model.wue, 3) + ' L/kWh', key: 'wue' },
            { lbl: 'Total Facility',      val: fmt(model.totalFacilityKw, 0) + ' kW', key: 'totalFacilityKw' },
            { lbl: 'Annual Energy',       val: fmt(model.annualGwh, 2) + ' GWh/yr', key: 'annualGwh' },
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
                var tr = r.key && LTC_TRACE[r.key];
                return '<div class="ltc-res-row">' +
                    '<span class="ltc-res-lbl">' + r.lbl + '</span>' +
                    (tr ? '<span class="ltc-res-val ltc-traceable" data-ltc-trace="' + r.key + '" role="button" tabindex="0">' + r.val + '<i class="ltc-fx">ƒx</i></span>'
                        : '<span class="ltc-res-val">' + r.val + '</span>') +
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
