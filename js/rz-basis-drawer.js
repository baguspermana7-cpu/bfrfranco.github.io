/* ============================================================================
 * rz-basis-drawer.js — ONE basis drawer for every Conventional cockpit
 * ----------------------------------------------------------------------------
 * WHY THIS EXISTS
 * Three cockpits each carried their own hand-written `basisFor` dictionary
 * (datahall.html, dc-conventional.html, datahallAI.html). Every entry restated
 * a formula, an input list and a `source:` string by hand, and nothing checked
 * any of it against the engine. That is how v1.132.0's defect happened: a
 * drawer explained a density it had not derived, citing a snapshot key that has
 * never existed. Copying provenance by hand is the bug, not the typo.
 *
 * This module renders the GENERATED parameter registry instead. A drawer can no
 * longer claim a provenance the registry does not hold, a formula the engine
 * does not implement, or an input that does not move the output — the registry's
 * dependency edges are measured by perturbing the engine, not declared.
 *
 * USAGE
 *   <script src="js/conv-parameters.js" defer></script>
 *   <script src="js/rz-basis-drawer.js" defer></script>
 *   <span data-basis-param="cooling.chws_c" tabindex="0" role="button">CHWS</span>
 * Any element with data-basis-param opens the drawer on click or Enter/Space.
 * RZBasisDrawer.open(id) does the same programmatically.
 *
 * ES5 only (this site is zero-build and its cockpits are ES5).
 * ==========================================================================*/
(function (root) {
    'use strict';
    if (root.RZBasisDrawer) return;

    var EVIDENCE_NOTE = {
        MEASURED: 'Read from a calibrated instrument.',
        DERIVED: 'Computed from other registered parameters.',
        SIMULATED: 'Produced by a deterministic model, not measured.',
        ADOPTED: 'A project decision that has been formally adopted.',
        ASSUMED: 'An engineering assumption pending confirmation. NOT measured, NOT vendor-approved.',
        VENDOR: 'From a vendor submittal or data sheet.',
        STANDARD: 'From a published standard.',
        UNAVAILABLE: 'No source exists for this value in the current basis.'
    };
    var EVIDENCE_COLOR = {
        MEASURED: '#3f9d6b', DERIVED: '#4b8fd0', SIMULATED: '#8b7bd0',
        ADOPTED: '#3f9d6b', ASSUMED: '#d99a2b', VENDOR: '#4b8fd0',
        STANDARD: '#4b8fd0', UNAVAILABLE: '#e4564a'
    };

    var index = null;

    function registry() {
        return root.RZ_CONV_PARAMETERS || null;
    }

    function byId(id) {
        var reg = registry();
        if (!reg) return null;
        if (!index) {
            index = {};
            for (var i = 0; i < reg.parameters.length; i++) {
                index[reg.parameters[i].id] = reg.parameters[i];
            }
        }
        return index[id] || null;
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* Format for display without inventing precision: integers stay integers, and a
       fractional value keeps at most three decimals. A drawer that rounds differently from
       the KPI it explains is the mismatch tools/_dcmoc_trace_parity_probe.mjs exists to
       catch, so this deliberately does no unit conversion — it shows the registered value. */
    function fmt(value, unit) {
        var text;
        if (typeof value === 'number') {
            text = (Math.round(value) === value)
                ? String(value)
                : String(Math.round(value * 1000) / 1000);
            text = text.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        } else {
            text = String(value);
        }
        return unit ? text + ' ' + unit : text;
    }

    function ensureHost() {
        var host = document.getElementById('rz-basis-drawer');
        if (host) return host;
        host = document.createElement('div');
        host.id = 'rz-basis-drawer';
        host.setAttribute('role', 'dialog');
        host.setAttribute('aria-modal', 'true');
        host.setAttribute('aria-hidden', 'true');
        host.setAttribute('aria-labelledby', 'rz-basis-drawer-title');
        host.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:9000', 'display:none',
            'align-items:center', 'justify-content:center',
            'background:rgba(3,7,14,.62)', 'padding:16px',
            'font-family:"IBM Plex Sans",system-ui,sans-serif'
        ].join(';');
        host.innerHTML = '<div id="rz-basis-drawer-panel" style="max-width:640px;width:100%;'
            + 'max-height:86vh;overflow:auto;background:#0f1621;color:#dbe5f0;'
            + 'border:1px solid #2b3a52;border-radius:6px;padding:18px 20px;'
            + 'box-shadow:0 18px 48px rgba(0,0,0,.55)"></div>';
        document.body.appendChild(host);

        host.addEventListener('click', function (event) {
            if (event.target === host) close();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && host.style.display === 'flex') close();
        });
        return host;
    }

    var lastFocus = null;

    function close() {
        var host = document.getElementById('rz-basis-drawer');
        if (!host) return;
        host.style.display = 'none';
        host.setAttribute('aria-hidden', 'true');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        lastFocus = null;
    }

    function row(key, value) {
        return '<div style="display:flex;gap:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
            + '<div style="flex:0 0 148px;color:#8fa2b8;font-size:12px">' + esc(key) + '</div>'
            + '<div style="flex:1;font-size:12.5px;font-family:\'JetBrains Mono\',monospace">' + value + '</div>'
            + '</div>';
    }

    function depLink(id) {
        var target = byId(id);
        var label = target && target.label ? target.label : id;
        return '<button type="button" data-basis-goto="' + esc(id) + '" style="background:none;'
            + 'border:none;padding:0;margin:0 8px 4px 0;color:#67b7f0;cursor:pointer;'
            + 'font:inherit;text-decoration:underline dotted">' + esc(label) + '</button>';
    }

    function render(id) {
        var p = byId(id);
        var panel = document.getElementById('rz-basis-drawer-panel');
        if (!panel) return;
        if (!p) {
            /* Fail loudly. A drawer that shrugs is how an unbound KPI stayed invisible. */
            panel.innerHTML = '<h2 id="rz-basis-drawer-title" style="margin:0 0 8px;font-size:16px">'
                + 'Basis unavailable</h2><p style="font-size:13px;color:#c9d4e2">No registry entry for '
                + '<code>' + esc(id) + '</code>. Either the parameter is not registered, or '
                + '<code>js/conv-parameters.js</code> did not load. Nothing is being guessed here.</p>';
            return;
        }
        var evidence = p.evidenceClass || 'UNAVAILABLE';
        var html = '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:6px">'
            + '<h2 id="rz-basis-drawer-title" style="margin:0;font-size:16px;flex:1">'
            + esc(p.label || p.id) + '</h2>'
            + '<span style="flex:0 0 auto;font-size:10.5px;font-weight:700;letter-spacing:.06em;'
            + 'padding:3px 8px;border-radius:3px;color:#0f1621;background:'
            + (EVIDENCE_COLOR[evidence] || '#8fa2b8') + '">' + esc(evidence) + '</span></div>'
            + '<div style="font-size:11.5px;color:#8fa2b8;margin-bottom:12px">' + esc(p.id) + '</div>';

        html += row('Value', '<b style="color:#fff">' + esc(fmt(p.value, p.unit)) + '</b>');
        html += row('Kind', esc(p.kind) + (p.kind === 'authored'
            ? ' <span style="color:#8fa2b8">(a constant written into the engine)</span>'
            : ' <span style="color:#8fa2b8">(computed, not stored)</span>'));
        html += row('Scope', esc(p.scope) + ' <span style="color:#8fa2b8">'
            + '(a ratio must take both ends from the same scope)</span>');
        if (p.formula) html += row('Formula', esc(p.formula));

        if (p.deps && p.deps.length) {
            var links = '';
            for (var i = 0; i < p.deps.length; i++) links += depLink(p.deps[i]);
            html += row('Derived from', links);
        }
        if (p.dependsOnInputs && p.dependsOnInputs.length) {
            html += row('Measured inputs',
                '<span style="color:#c9d4e2">' + esc(p.dependsOnInputs.join(', ')) + '</span>'
                + '<div style="color:#8fa2b8;font-size:11px;margin-top:4px">Obtained by recomputing '
                + 'the engine once per input with only that input changed. These edges are measured, '
                + 'not declared.</div>');
        }

        html += row('Evidence', '<span style="color:#c9d4e2">'
            + esc(EVIDENCE_NOTE[evidence] || '') + '</span>');
        if (p.source) {
            var src = esc(p.source.ref || '');
            if (p.source.section) src += ' &middot; ' + esc(p.source.section);
            if (p.source.asOf) src += ' &middot; as of ' + esc(p.source.asOf);
            html += row('Source', src);
            if (p.source.method) html += row('Method', '<span style="color:#c9d4e2">' + esc(p.source.method) + '</span>');
        } else if (p.kind === 'authored') {
            html += row('Source', '<span style="color:#e4564a">UNSOURCED</span>');
        }

        var consumers = (p.consumers || []).map(function (c) { return c.page; }).join(', ');
        html += row('Shown on', consumers ? esc(consumers)
            : '<span style="color:#d99a2b">no cockpit renders this</span>');
        html += row('Asserted by', (p.tests || []).length
            ? esc(p.tests.join(', '))
            : '<span style="color:#d99a2b">no gate asserts this</span>');

        html += '<div style="margin-top:14px;display:flex;gap:10px;justify-content:flex-end">'
            + '<button type="button" data-basis-close style="background:#1c2838;color:#dbe5f0;'
            + 'border:1px solid #2b3a52;border-radius:4px;padding:7px 14px;cursor:pointer;'
            + 'font:inherit;font-size:12.5px">Close</button></div>';

        panel.innerHTML = html;
        panel.scrollTop = 0;
    }

    function open(id) {
        var host = ensureHost();
        if (!lastFocus) lastFocus = document.activeElement;
        render(id);
        host.style.display = 'flex';
        host.setAttribute('aria-hidden', 'false');
        var closeBtn = host.querySelector('[data-basis-close]');
        if (closeBtn && closeBtn.focus) closeBtn.focus();
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        while (target && target !== document.body) {
            if (target.hasAttribute && target.hasAttribute('data-basis-close')) { close(); return; }
            if (target.hasAttribute && target.hasAttribute('data-basis-goto')) {
                render(target.getAttribute('data-basis-goto'));
                return;
            }
            if (target.hasAttribute && target.hasAttribute('data-basis-param')) {
                open(target.getAttribute('data-basis-param'));
                return;
            }
            target = target.parentElement;
        }
    });
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var el = event.target;
        if (el && el.hasAttribute && el.hasAttribute('data-basis-param')) {
            event.preventDefault();
            open(el.getAttribute('data-basis-param'));
        }
    });

    root.RZBasisDrawer = {
        open: open,
        close: close,
        get: byId,
        /* Exposed so a gate can assert the page's markup and the registry agree. */
        ids: function () {
            var reg = registry();
            if (!reg) return [];
            var out = [];
            for (var i = 0; i < reg.parameters.length; i++) out.push(reg.parameters[i].id);
            return out;
        }
    };
}(window));
