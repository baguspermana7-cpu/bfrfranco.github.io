/**
 * Cockpit tab activation for render gates.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every render gate on this site measures what is VISIBLE, and every tabbed cockpit hides its
 * inactive panels with `display:none`. The two facts together mean a gate walks a ten-tab page,
 * measures the one panel that happens to be open, finds nothing wrong, and reports PASS.
 *
 * On datahallAI.html the default tab is `dash`, which contains ZERO <svg> elements — so
 * tools/audit-legibility.mjs has been running --strict against that page in the ship gate,
 * finding nothing, while eight tabs carried ~2,050 labels below the legibility floor and ~200
 * overlapping label pairs. The gate was not misconfigured; it was structurally blind.
 *
 * THREE RULES, EACH FIXING SOMETHING THAT ALREADY WENT WRONG
 * ---------------------------------------------------------
 * 1. ASSERT, NEVER ATTEMPT. tools/_uiux_dcai_probe.mjs does `if (btn) btn.click()`. A renamed or
 *    missing tab is silent there, so eight tabs' worth of "evidence" can be captured from one
 *    panel and nothing says so. Every activation here throws.
 * 2. WAIT FOR A REAL BOX, NOT A TIMER. Panels are drawn at parse time into a hidden container,
 *    so the first getBoundingClientRect() after the panel becomes visible is the first honest
 *    layout. A fixed sleep either wastes time or measures the pre-layout state.
 * 3. YIELD TWO FRAMES. Level-of-detail runs on tab activation and must have applied its classes
 *    before a gate reads font sizes; measuring in between produces a page of nonsense that looks
 *    like a finding.
 */

/**
 * Declared tab sets. A page with no entry here is measured as it loads, exactly as before —
 * adding a page is deliberate, and so is declaring that a page has nothing to activate.
 */
export const TAB_SETS = Object.freeze({
    'datahallAI.html': Object.freeze({
        cockpit: 'dc-ai',
        bar: '#tabs',
        attr: 'data-t',
        panelPrefix: 'p-',
        subBar: '#elecTabs',
        subAttr: 'data-ep',
        subPanelPrefix: 'ep-',
        diagrams: Object.freeze([
            { tab: 'over', selector: '#bldgSvg', label: 'building isometric' },
            { tab: 'over', selector: '#floorSvg', label: 'floor plan' },
            { tab: 'hall', selector: '#hSvg', label: 'data hall' },
            { tab: 'rack', selector: '#rackSvg', label: 'rack architecture' },
            { tab: 'cool', selector: '#coolSvg', label: 'cooling P&ID' },
            { tab: 'elec', sub: 'overview', selector: '#elecOvSvg', label: 'electrical overview' },
            { tab: 'elec', sub: 'dh01', selector: '#elecDH1Svg', label: 'DH-01 SLD' },
            { tab: 'elec', sub: 'dh02', selector: '#elecDH2Svg', label: 'DH-02 SLD' },
            { tab: 'elec', sub: 'dh03', selector: '#elecDH3Svg', label: 'DH-03 SLD' },
            { tab: 'elec', sub: 'dh04', selector: '#elecDH4Svg', label: 'DH-04 SLD' },
            { tab: 'net', selector: '#netSvg', label: 'network fabric' },
            { tab: 'fire', selector: '#fireSvg', label: 'fire mimic' },
            { tab: 'bms', selector: '#bmsSvg', label: 'BMS architecture' },
        ]),
    }),
});

/**
 * Pages that are deliberately NOT in TAB_SETS, with the reason. A missing entry should be a
 * recorded decision, not an oversight — that distinction is the whole point of this file.
 */
export const NO_TAB_SET = Object.freeze({
    'chiller-plant.html': 'single #pidSvg, no tab system',
    'fire-system.html': 'single #fire-svg, no tab system',
    'water-system.html': 'single #water-svg, no tab system',
    'EPMS_Telemetry.html': 'single svg#viewport, no tab system',
    'fuel-system.html': 'HTML/CSS mimic — no SVG process diagram exists to measure',
    'ict.html': 'no architecture diagram exists yet',
    'datahall.html': 'rack field is HTML; no SVG process diagram exists',
});

/**
 * Activate the tab (and electrical sub-tab) an entry lives on, then wait until its diagram has
 * really laid out. Throws on anything unexpected — see rule 1 above.
 */
export async function activateTab(page, set, entry) {
    if (entry.tab) {
        const outcome = await page.evaluate((spec) => {
            const btn = document.querySelector(`${spec.bar} [${spec.attr}="${spec.key}"]`);
            if (!btn) return { ok: false, why: `no ${spec.attr}="${spec.key}" button in ${spec.bar}` };
            btn.click();
            const panel = document.getElementById(spec.panelId);
            if (!panel) return { ok: false, why: `no panel #${spec.panelId}` };
            if (!panel.classList.contains('on')) {
                return { ok: false, why: `#${spec.panelId} did not become .on after click` };
            }
            const box = panel.getBoundingClientRect();
            if (box.width < 2 || box.height < 2) {
                return { ok: false, why: `#${spec.panelId} is .on but has a ${Math.round(box.width)}x${Math.round(box.height)} box` };
            }
            return { ok: true };
        }, { bar: set.bar, attr: set.attr, key: entry.tab, panelId: set.panelPrefix + entry.tab });
        if (!outcome.ok) throw new Error(`activateTab(${entry.tab}): ${outcome.why}`);
    }

    if (entry.sub) {
        const outcome = await page.evaluate((spec) => {
            const btn = document.querySelector(`${spec.bar} [${spec.attr}="${spec.key}"]`);
            if (!btn) return { ok: false, why: `no ${spec.attr}="${spec.key}" button in ${spec.bar}` };
            btn.click();
            const panel = document.getElementById(spec.panelId);
            if (!panel) return { ok: false, why: `no sub-panel #${spec.panelId}` };
            if (!panel.classList.contains('on')) {
                return { ok: false, why: `#${spec.panelId} did not become .on after click` };
            }
            return { ok: true };
        }, { bar: set.subBar, attr: set.subAttr, key: entry.sub, panelId: set.subPanelPrefix + entry.sub });
        if (!outcome.ok) throw new Error(`activateTab(${entry.tab}/${entry.sub}): ${outcome.why}`);
    }

    /* Rule 2 — the diagram must have text with a real box before anything measures it. */
    await page.waitForFunction((selector) => {
        const svg = document.querySelector(selector);
        if (!svg) return false;
        const text = svg.querySelector('text');
        if (!text) return true;                     // a diagram with no labels is legitimately ready
        return text.getBoundingClientRect().height > 0;
    }, { timeout: 10000 }, entry.selector);

    /* Rule 3 — two frames, so any level-of-detail pass triggered by the tab change has applied. */
    await page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
}

/** Flatten the declared diagrams for a page, or null when the page declares no tab set. */
export function diagramsFor(page) {
    const set = TAB_SETS[page];
    if (!set) return null;
    return set.diagrams.map((entry) => ({ ...entry, page, set }));
}
