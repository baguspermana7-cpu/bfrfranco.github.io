/**
 * ResistanceZero — Share Your Results Module
 * Adds shareable URL state + social sharing to all calculators
 *
 * Usage: Include <script src="rz-share-results.js"></script> after calculator IIFE
 *
 * Requirements:
 * - Calculator inputs must have class .calc-input, .calc-select, or .calc-slider
 * - Calculator results must have elements with class containing "-result-value" or "-metric-value"
 * - Calculator must have a <div> with id containing "Results" for placement
 *
 * Configuration (optional, via data attributes on <script> tag):
 * - data-calc-name="TCO Calculator"
 * - data-calc-id="tco"
 * - data-accent-color="#4f46e5"
 */
(function() {
    'use strict';

    // Auto-detect calculator context
    var scriptTag = document.currentScript;
    var calcName = scriptTag ? scriptTag.getAttribute('data-calc-name') || document.title.split('|')[0].trim() : document.title;
    var calcId = scriptTag ? scriptTag.getAttribute('data-calc-id') || 'calc' : 'calc';
    var accentColor = scriptTag ? scriptTag.getAttribute('data-accent-color') || '#4f46e5' : '#4f46e5';

    // Helper: hex to rgb string
    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        return r + ', ' + g + ', ' + b;
    }

    // Inject CSS
    var style = document.createElement('style');
    style.textContent = [
        '.rz-share-bar {',
        '    display: flex;',
        '    align-items: center;',
        '    gap: 10px;',
        '    margin: 20px 0;',
        '    padding: 16px 20px;',
        '    background: linear-gradient(135deg, rgba(' + hexToRgb(accentColor) + ', 0.08), rgba(' + hexToRgb(accentColor) + ', 0.03));',
        '    border: 1px solid rgba(' + hexToRgb(accentColor) + ', 0.2);',
        '    border-radius: 12px;',
        '    flex-wrap: wrap;',
        '}',
        '.rz-share-label {',
        '    font-size: 0.85rem;',
        '    font-weight: 600;',
        '    color: var(--text-primary, #1f2937);',
        '    margin-right: auto;',
        '}',
        '.rz-share-label i { color: ' + accentColor + '; margin-right: 6px; }',
        '.rz-share-btn {',
        '    display: inline-flex;',
        '    align-items: center;',
        '    gap: 6px;',
        '    padding: 8px 14px;',
        '    border: 1px solid rgba(' + hexToRgb(accentColor) + ', 0.3);',
        '    border-radius: 8px;',
        '    background: transparent;',
        '    color: var(--text-primary, #374151);',
        '    font-size: 0.78rem;',
        '    font-weight: 500;',
        '    cursor: pointer;',
        '    transition: all 0.2s;',
        '    font-family: inherit;',
        '}',
        '.rz-share-btn:hover {',
        '    background: ' + accentColor + ';',
        '    color: #fff;',
        '    border-color: ' + accentColor + ';',
        '    transform: translateY(-1px);',
        '}',
        '.rz-share-btn.copied {',
        '    background: #10b981;',
        '    color: #fff;',
        '    border-color: #10b981;',
        '}',
        '.rz-share-btn svg { width: 16px; height: 16px; }',
        '',
        '[data-theme="dark"] .rz-share-bar {',
        '    background: linear-gradient(135deg, rgba(' + hexToRgb(accentColor) + ', 0.12), rgba(' + hexToRgb(accentColor) + ', 0.05));',
        '    border-color: rgba(' + hexToRgb(accentColor) + ', 0.25);',
        '}',
        '[data-theme="dark"] .rz-share-btn {',
        '    color: #e2e8f0;',
        '    border-color: rgba(' + hexToRgb(accentColor) + ', 0.35);',
        '}',
        '',
        '@media (max-width: 600px) {',
        '    .rz-share-bar { padding: 12px 14px; gap: 8px; }',
        '    .rz-share-btn { padding: 6px 10px; font-size: 0.72rem; }',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // Read all calculator inputs and encode as URL params
    function getInputState() {
        var params = new URLSearchParams();
        params.set('calc', calcId);

        var inputs = document.querySelectorAll(
            '.calc-input, .calc-select, .calc-slider, ' +
            '[class*="-input"] input, [class*="-input"] select'
        );
        inputs.forEach(function(el) {
            var id = el.id || el.name;
            if (!id) return;
            var val = el.value;
            if (val !== '' && val !== undefined) {
                params.set(id, val);
            }
        });
        return params;
    }

    // Generate shareable URL
    function getShareUrl() {
        var params = getInputState();
        return window.location.origin + window.location.pathname + '?' + params.toString();
    }

    // Get result summary text for social sharing
    function getResultSummary() {
        var values = [];
        var resultEls = document.querySelectorAll(
            '[class*="-result-value"], [class*="-metric-value"], [class*="-kpi-value"]'
        );
        var labelEls = document.querySelectorAll(
            '[class*="-result-label"], [class*="-metric-label"], [class*="-kpi-label"]'
        );

        var count = Math.min(resultEls.length, labelEls.length, 4);
        for (var i = 0; i < count; i++) {
            var val = resultEls[i].textContent.trim();
            var label = labelEls[i].textContent.trim();
            if (val && val !== '--') {
                values.push(label + ': ' + val);
            }
        }
        return values.join(' | ');
    }

    // Restore state from URL on page load
    function restoreFromUrl() {
        var params = new URLSearchParams(window.location.search);
        if (!params.has('calc') || params.get('calc') !== calcId) return false;

        var restored = false;
        params.forEach(function(val, key) {
            if (key === 'calc') return;
            var el = document.getElementById(key) ||
                     document.querySelector('[name="' + key + '"]');
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                restored = true;
            }
        });

        return restored;
    }

    // Share: X/Twitter
    function shareTwitter() {
        var summary = getResultSummary();
        var text = calcName + ' Results:\n' + summary + '\n\nTry it yourself:';
        var url = 'https://twitter.com/intent/tweet?text=' +
            encodeURIComponent(text) + '&url=' + encodeURIComponent(getShareUrl());
        window.open(url, '_blank', 'width=550,height=420');
    }

    // Share: LinkedIn
    function shareLinkedIn() {
        var url = 'https://www.linkedin.com/sharing/share-offsite/?url=' +
            encodeURIComponent(getShareUrl());
        window.open(url, '_blank', 'width=550,height=420');
    }

    // Share: WhatsApp
    function shareWhatsApp() {
        var summary = getResultSummary();
        var text = calcName + ' Results: ' + summary + '\n\n' + getShareUrl();
        var url = 'https://wa.me/?text=' + encodeURIComponent(text);
        window.open(url, '_blank');
    }

    // Copy shareable link to clipboard
    function copyShareLink() {
        var url = getShareUrl();
        navigator.clipboard.writeText(url).then(function() {
            var btn = document.querySelector('.rz-share-copy');
            if (btn) {
                btn.classList.add('copied');
                var original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(function() {
                    btn.classList.remove('copied');
                    btn.innerHTML = original;
                }, 2000);
            }
        });
    }

    // Generate share card (popup window)
    function generateShareCard() {
        var w = window.open('', '_blank', 'width=600,height=400');
        if (!w) return;

        var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
        html += '<title>' + calcName + ' — Results Card</title>';
        html += '<style>';
        html += 'body{margin:0;padding:40px;font-family:Inter,system-ui,sans-serif;background:#f8fafc;}';
        html += '.card{max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);}';
        html += '.card-header{background:linear-gradient(135deg,' + accentColor + ',#1e293b);padding:24px;color:#fff;}';
        html += '.card-header h2{margin:0 0 4px;font-size:1.2rem;font-weight:700;}';
        html += '.card-header p{margin:0;font-size:0.8rem;opacity:0.8;}';
        html += '.card-body{padding:24px;}';
        html += '.card-kpi{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}';
        html += '.card-kpi-item{background:#f1f5f9;padding:12px;border-radius:8px;text-align:center;}';
        html += '.card-kpi-value{font-size:1.1rem;font-weight:800;color:#1e293b;}';
        html += '.card-kpi-label{font-size:0.7rem;color:#64748b;margin-top:4px;}';
        html += '.card-cta{text-align:center;padding:16px 24px;border-top:1px solid #e5e7eb;}';
        html += '.card-cta a{color:' + accentColor + ';text-decoration:none;font-weight:600;font-size:0.85rem;}';
        html += '.card-brand{text-align:center;padding:8px;font-size:0.65rem;color:#94a3b8;}';
        html += '</style></head><body>';
        html += '<div class="card">';
        html += '<div class="card-header"><h2>' + calcName + '</h2><p>Calculation Results</p></div>';
        html += '<div class="card-body"><div class="card-kpi">';

        // Populate KPIs
        var resultEls = document.querySelectorAll(
            '[class*="-result-value"], [class*="-metric-value"], [class*="-kpi-value"]'
        );
        var labelEls = document.querySelectorAll(
            '[class*="-result-label"], [class*="-metric-label"], [class*="-kpi-label"]'
        );
        var count = Math.min(resultEls.length, labelEls.length, 6);
        for (var i = 0; i < count; i++) {
            var val = resultEls[i].textContent.trim();
            var label = labelEls[i].textContent.trim();
            if (val && val !== '--') {
                html += '<div class="card-kpi-item">';
                html += '<div class="card-kpi-value">' + val + '</div>';
                html += '<div class="card-kpi-label">' + label + '</div>';
                html += '</div>';
            }
        }

        html += '</div></div>';
        html += '<div class="card-cta"><a href="' + getShareUrl() + '" target="_blank">Try this calculator yourself &rarr;</a></div>';
        html += '<div class="card-brand">Generated by ResistanceZero &mdash; resistancezero.com</div>';
        html += '</div></body></html>';

        w.document.write(html);
        w.document.close();
    }

    // Inject share bar into the page
    function injectShareBar() {
        // Find the best insertion point: after results grid, before pro panels
        var targets = [
            document.querySelector('[class*="-narrative"]'),
            document.querySelector('[class*="-results-grid"]'),
            document.querySelector('[class*="-result-card"]:last-of-type'),
            document.querySelector('.calc-results')
        ];

        var target = null;
        for (var i = 0; i < targets.length; i++) {
            if (targets[i]) { target = targets[i]; break; }
        }

        if (!target) return;

        var bar = document.createElement('div');
        bar.className = 'rz-share-bar';
        bar.innerHTML =
            '<div class="rz-share-label">' +
                '<i class="fas fa-share-nodes"></i> Share Your Results' +
            '</div>' +
            '<button class="rz-share-btn" onclick="window.__rzShare.twitter()" title="Share on X/Twitter">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> X' +
            '</button>' +
            '<button class="rz-share-btn" onclick="window.__rzShare.linkedin()" title="Share on LinkedIn">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> LinkedIn' +
            '</button>' +
            '<button class="rz-share-btn" onclick="window.__rzShare.whatsapp()" title="Share on WhatsApp">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp' +
            '</button>' +
            '<button class="rz-share-btn rz-share-copy" onclick="window.__rzShare.copy()" title="Copy link">' +
                '<i class="fas fa-link"></i> Copy Link' +
            '</button>' +
            '<button class="rz-share-btn" onclick="window.__rzShare.card()" title="Generate share card">' +
                '<i class="fas fa-image"></i> Card' +
            '</button>';

        // Insert after target
        if (target.nextSibling) {
            target.parentNode.insertBefore(bar, target.nextSibling);
        } else {
            target.parentNode.appendChild(bar);
        }
    }

    // Expose share functions globally
    window.__rzShare = {
        twitter: shareTwitter,
        linkedin: shareLinkedIn,
        whatsapp: shareWhatsApp,
        copy: copyShareLink,
        card: generateShareCard,
        getUrl: getShareUrl,
        getState: getInputState,
        restore: restoreFromUrl
    };

    // Initialize on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Small delay to let calculator IIFE initialize first
            setTimeout(function() {
                restoreFromUrl();
                injectShareBar();
            }, 300);
        });
    } else {
        setTimeout(function() {
            restoreFromUrl();
            injectShareBar();
        }, 300);
    }
})();
