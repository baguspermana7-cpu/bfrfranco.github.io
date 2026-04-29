/* PLN tooltip v2026-04-29-v3 — rich-metadata hover panel for SVG SLD nodes + Leaflet markers.
 * Used by pln-java-grid.html, pln-java-grid-jakarta-banten.html, pln-java-grid-jabar.html.
 */
(function (global) {
    'use strict';

    var TOOLTIP_ID = 'pln-tooltip-floater';
    var STYLE_ID = 'pln-tooltip-style';
    var SHOW_DELAY_DEFAULT = 80;
    var HIDE_DELAY = 120;
    var EDGE_PAD = 16;

    var floaterEl = null;
    var styleInjected = false;
    var showTimer = null;
    var hideTimer = null;
    var currentTarget = null;
    var attachedRecords = [];

    function isTouchDevice() {
        return ('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0);
    }

    function injectStyles() {
        if (styleInjected || typeof document === 'undefined') return;
        styleInjected = true;
        var css = ''
            + '.pln-tt{position:fixed;z-index:9999;max-width:320px;padding:0.7rem 0.85rem;'
            + 'background:rgba(8,15,30,0.96);border:1px solid #3b82f6;border-radius:12px;'
            + 'color:#cbd5e1;font:0.78rem/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
            + 'box-shadow:0 12px 28px rgba(0,0,0,0.4);backdrop-filter:blur(10px);'
            + '-webkit-backdrop-filter:blur(10px);opacity:0;transform:translateY(4px);'
            + 'transition:opacity 0.16s ease,transform 0.16s ease;pointer-events:none;}'
            + '.pln-tt.is-visible{opacity:1;transform:translateY(0);pointer-events:auto;}'
            + '.pln-tt-header{display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;margin-bottom:0.4rem;}'
            + '.pln-tt-name{font:700 0.92rem/1.3 inherit;color:#f1f5f9;flex:1 1 auto;}'
            + '.pln-tt-kv{display:inline-block;padding:0.1rem 0.45rem;border-radius:999px;font-size:0.7rem;font-weight:600;}'
            + '.pln-tt-kv-500{background:rgba(59,130,246,0.18);color:#93c5fd;}'
            + '.pln-tt-kv-275{background:rgba(167,139,250,0.18);color:#c4b5fd;}'
            + '.pln-tt-kv-150{background:rgba(248,113,113,0.18);color:#fca5a5;}'
            + '.pln-tt-kv-70{background:rgba(245,158,11,0.18);color:#fcd34d;}'
            + '.pln-tt-kv-20{background:rgba(20,184,166,0.18);color:#5eead4;}'
            + '.pln-tt-conf{display:inline-block;padding:0.05rem 0.35rem;border-radius:4px;font-size:0.62rem;font-weight:700;letter-spacing:0.04em;}'
            + '.pln-tt-conf-hi,.pln-tt-conf-high{background:rgba(34,197,94,0.18);color:#86efac;}'
            + '.pln-tt-conf-med,.pln-tt-conf-medium{background:rgba(245,158,11,0.18);color:#fcd34d;}'
            + '.pln-tt-conf-low{background:rgba(239,68,68,0.18);color:#fca5a5;}'
            + '.pln-tt-loc{font-size:0.7rem;color:#94a3b8;margin-bottom:0.45rem;}'
            + '.pln-tt-meta{width:100%;border-collapse:collapse;margin:0 0 0.4rem;}'
            + '.pln-tt-meta th{text-align:left;font-weight:600;color:#94a3b8;padding:0.12rem 0.5rem 0.12rem 0;width:40%;}'
            + '.pln-tt-meta td{color:#e2e8f0;padding:0.12rem 0;}'
            + '.pln-tt-served{margin-top:0.35rem;}'
            + '.pln-tt-h{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:0.2rem;}'
            + '.pln-tt-served ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:0.25rem;}'
            + '.pln-tt-served li{padding:0.08rem 0.4rem;background:rgba(59,130,246,0.12);border-radius:4px;font-size:0.7rem;color:#cbd5e1;}'
            + '.pln-tt-notes{margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid rgba(148,163,184,0.18);font-size:0.72rem;color:#cbd5e1;font-style:italic;}'
            + '.pln-tt-footer{margin-top:0.45rem;padding-top:0.4rem;border-top:1px solid rgba(148,163,184,0.18);font-size:0.68rem;color:#94a3b8;}'
            + '.pln-tt-footer a{color:#93c5fd;text-decoration:none;}'
            + '.pln-tt-footer a:hover{text-decoration:underline;}'
            + '.pln-tt-src{color:#cbd5e1;font-weight:600;}'
            + '[data-theme="light"] .pln-tt{background:rgba(255,255,255,0.97);border-color:#3b82f6;color:#1e293b;}'
            + '[data-theme="light"] .pln-tt-name{color:#0f172a;}'
            + '[data-theme="light"] .pln-tt-loc,[data-theme="light"] .pln-tt-meta th,[data-theme="light"] .pln-tt-h,[data-theme="light"] .pln-tt-footer{color:#475569;}'
            + '[data-theme="light"] .pln-tt-meta td,[data-theme="light"] .pln-tt-notes{color:#1e293b;}'
            + '@media (max-width:700px){.pln-tt{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;'
            + 'max-width:100%!important;width:100%!important;max-height:60vh;overflow-y:auto;border-radius:14px 14px 0 0;'
            + 'transform:translateY(100%);transition:transform 0.22s ease,opacity 0.22s ease;}'
            + '.pln-tt.is-visible{transform:translateY(0);}}';
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = css;
        document.head.appendChild(style);
    }

    function ensureFloater() {
        if (floaterEl) return floaterEl;
        injectStyles();
        floaterEl = document.createElement('div');
        floaterEl.id = TOOLTIP_ID;
        floaterEl.className = 'pln-tt';
        floaterEl.setAttribute('role', 'tooltip');
        floaterEl.setAttribute('aria-live', 'polite');
        floaterEl.addEventListener('mouseenter', function () {
            if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        });
        floaterEl.addEventListener('mouseleave', function () {
            scheduleHide();
        });
        document.body.appendChild(floaterEl);
        return floaterEl;
    }

    function setText(el, text) {
        el.textContent = (text === null || typeof text === 'undefined' || text === '') ? '—' : String(text);
    }

    function makeEl(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (typeof text !== 'undefined') e.textContent = String(text);
        return e;
    }

    function osmTypeFromId(osmId) {
        if (!osmId) return null;
        var s = String(osmId);
        if (s.indexOf('node/') === 0 || s.charAt(0) === 'n') return 'node';
        if (s.indexOf('way/') === 0 || s.charAt(0) === 'w') return 'way';
        if (s.indexOf('relation/') === 0 || s.charAt(0) === 'r') return 'relation';
        return 'node';
    }

    function osmIdNumeric(osmId) {
        if (!osmId) return '';
        var s = String(osmId);
        var slash = s.indexOf('/');
        if (slash >= 0) return s.substring(slash + 1);
        return s.replace(/^[a-z]/, '');
    }

    function confLabel(c) {
        if (!c) return '';
        var s = String(c).toLowerCase();
        if (s === 'high' || s === 'hi') return 'HI';
        if (s === 'medium' || s === 'med') return 'MED';
        if (s === 'low') return 'LOW';
        return s.toUpperCase();
    }

    function tierFromMva(mva) {
        if (typeof mva !== 'number' || mva <= 0) return '';
        if (mva >= 1000) return 'Tier-1 (≥1000 MVA)';
        if (mva >= 500) return 'Tier-2 (500-999 MVA)';
        if (mva >= 200) return 'Tier-3 (200-499 MVA)';
        return 'Tier-4 (<200 MVA)';
    }

    function provDisplay(prov) {
        if (!prov) return '';
        if (typeof prov === 'string') return prov;
        if (prov.name) return prov.name;
        return '';
    }

    function fmtLatLng(lat, lng) {
        if (typeof lat !== 'number' || typeof lng !== 'number') return '';
        return lat.toFixed(4) + ', ' + lng.toFixed(4);
    }

    function buildPanel(data) {
        var el = ensureFloater();
        el.innerHTML = '';

        var d = data || {};
        var voltage = d.voltage;
        var conf = String(d.confidence || '').toLowerCase();
        var isPlant = d.kind === 'plant';

        var header = makeEl('div', 'pln-tt-header');
        header.appendChild(makeEl('span', 'pln-tt-name', d.name || 'Unknown'));
        if (voltage) {
            header.appendChild(makeEl('span', 'pln-tt-kv pln-tt-kv-' + voltage, voltage + ' kV'));
        }
        if (conf) {
            header.appendChild(makeEl('span', 'pln-tt-conf pln-tt-conf-' + conf, confLabel(conf)));
        }
        el.appendChild(header);

        var locParts = [];
        var prov = provDisplay(d.prov);
        if (prov) locParts.push(prov);
        var ll = fmtLatLng(d.lat, d.lng);
        if (ll) locParts.push(ll);
        if (locParts.length) {
            el.appendChild(makeEl('div', 'pln-tt-loc', locParts.join(' · ')));
        }

        var table = makeEl('table', 'pln-tt-meta');
        var tbody = document.createElement('tbody');
        function addRow(label, value) {
            var tr = document.createElement('tr');
            tr.appendChild(makeEl('th', null, label));
            var td = document.createElement('td');
            setText(td, value);
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        var capacity = isPlant
            ? ((typeof d.mw === 'number' ? d.mw : (d.mw || '—')) + ' MW')
            : ((typeof d.mva === 'number' ? d.mva : (d.mva || '—')) + ' MVA');
        addRow('Capacity', capacity);
        addRow('Commissioned', d.year || '—');
        addRow('Operator', d.operator || '—');
        if (d.fuel) addRow('Fuel', d.fuel);
        if (!isPlant && typeof d.mva === 'number' && d.mva > 0) {
            addRow('Tier', tierFromMva(d.mva));
        }
        table.appendChild(tbody);
        el.appendChild(table);

        if (d.served_areas && d.served_areas.length) {
            var served = makeEl('div', 'pln-tt-served');
            served.appendChild(makeEl('div', 'pln-tt-h', 'Serves'));
            var ul = document.createElement('ul');
            for (var i = 0; i < d.served_areas.length; i++) {
                ul.appendChild(makeEl('li', null, d.served_areas[i]));
            }
            served.appendChild(ul);
            el.appendChild(served);
        }

        if (d.notes) {
            el.appendChild(makeEl('div', 'pln-tt-notes', d.notes));
        }

        var footer = makeEl('div', 'pln-tt-footer');
        footer.appendChild(document.createTextNode('Source: '));
        footer.appendChild(makeEl('span', 'pln-tt-src', d.source || 'unknown'));
        if (d.osm_id) {
            footer.appendChild(document.createTextNode(' · '));
            var aOsm = document.createElement('a');
            aOsm.href = 'https://www.openstreetmap.org/' + osmTypeFromId(d.osm_id) + '/' + osmIdNumeric(d.osm_id);
            aOsm.target = '_blank';
            aOsm.rel = 'noopener';
            aOsm.textContent = 'OSM ↗';
            footer.appendChild(aOsm);
        }
        if (d.wikidata) {
            footer.appendChild(document.createTextNode(' · '));
            var aWd = document.createElement('a');
            aWd.href = 'https://www.wikidata.org/wiki/' + d.wikidata;
            aWd.target = '_blank';
            aWd.rel = 'noopener';
            aWd.textContent = 'Wikidata ↗';
            footer.appendChild(aWd);
        }
        if (typeof d.lat === 'number' && typeof d.lng === 'number') {
            footer.appendChild(document.createTextNode(' · '));
            var aMap = document.createElement('a');
            aMap.href = 'https://www.google.com/maps/?q=' + d.lat + ',' + d.lng;
            aMap.target = '_blank';
            aMap.rel = 'noopener';
            aMap.textContent = 'Map ↗';
            footer.appendChild(aMap);
        }
        el.appendChild(footer);

        return el;
    }

    function positionAt(el, x, y) {
        if (global.innerWidth <= 700) {
            el.style.left = '';
            el.style.top = '';
            return;
        }
        var rect = el.getBoundingClientRect();
        var vw = global.innerWidth;
        var vh = global.innerHeight;
        var left = x + 14;
        var top = y - rect.height - 14;
        if (left + rect.width > vw - EDGE_PAD) left = x - rect.width - 14;
        if (left < EDGE_PAD) left = EDGE_PAD;
        if (top < EDGE_PAD) top = y + 18;
        if (top + rect.height > vh - EDGE_PAD) top = vh - rect.height - EDGE_PAD;
        el.style.left = Math.round(left) + 'px';
        el.style.top = Math.round(top) + 'px';
    }

    function showAt(data, x, y) {
        var el = buildPanel(data);
        el.style.left = '-9999px';
        el.style.top = '-9999px';
        el.classList.add('is-visible');
        positionAt(el, x, y);
    }

    function hide() {
        if (!floaterEl) return;
        floaterEl.classList.remove('is-visible');
        currentTarget = null;
    }

    function scheduleShow(data, x, y, delay) {
        if (showTimer) clearTimeout(showTimer);
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        var d = (typeof delay === 'number') ? delay : SHOW_DELAY_DEFAULT;
        showTimer = setTimeout(function () {
            showTimer = null;
            showAt(data, x, y);
        }, d);
    }

    function scheduleHide() {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
            hideTimer = null;
            hide();
        }, HIDE_DELAY);
    }

    function detectVariant(target) {
        if (target && typeof target.on === 'function' && typeof target.getLatLng === 'function') return 'leaflet';
        if (target && typeof target.on === 'function' && typeof target.getLatLngs === 'function') return 'leaflet';
        if (target && target.nodeType === 1) return 'svg';
        return 'svg';
    }

    function attachSvg(target, data, opts) {
        if (!target || target.nodeType !== 1) return;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '0');
        var delay = (opts && typeof opts.delayMs === 'number') ? opts.delayMs : SHOW_DELAY_DEFAULT;

        var onEnter = function (e) {
            currentTarget = target;
            scheduleShow(data, e.clientX, e.clientY, delay);
        };
        var onMove = function (e) {
            if (currentTarget !== target) return;
            if (floaterEl && floaterEl.classList.contains('is-visible')) {
                positionAt(floaterEl, e.clientX, e.clientY);
            }
        };
        var onLeave = function () { scheduleHide(); };
        var onPointerDown = function (e) {
            if (!isTouchDevice()) return;
            e.stopPropagation();
            currentTarget = target;
            scheduleShow(data, e.clientX, e.clientY, 0);
        };
        var onFocus = function () {
            var r = target.getBoundingClientRect();
            currentTarget = target;
            scheduleShow(data, r.right, r.top, 0);
        };
        var onBlur = function () { scheduleHide(); };
        var onKey = function (e) {
            if (e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                hide();
            }
        };

        target.addEventListener('mouseenter', onEnter);
        target.addEventListener('mousemove', onMove);
        target.addEventListener('mouseleave', onLeave);
        target.addEventListener('pointerdown', onPointerDown);
        target.addEventListener('focus', onFocus);
        target.addEventListener('blur', onBlur);
        target.addEventListener('keydown', onKey);

        attachedRecords.push({
            target: target,
            variant: 'svg',
            handlers: { onEnter: onEnter, onMove: onMove, onLeave: onLeave, onPointerDown: onPointerDown, onFocus: onFocus, onBlur: onBlur, onKey: onKey }
        });
    }

    function attachLeaflet(target, data, opts) {
        if (!target || typeof target.on !== 'function') return;
        var delay = (opts && typeof opts.delayMs === 'number') ? opts.delayMs : SHOW_DELAY_DEFAULT;

        var onOver = function (e) {
            var oe = e && e.originalEvent;
            var x = oe ? oe.clientX : 0;
            var y = oe ? oe.clientY : 0;
            currentTarget = target;
            scheduleShow(data, x, y, delay);
        };
        var onOut = function () { scheduleHide(); };
        var onClick = function (e) {
            var oe = e && e.originalEvent;
            var x = oe ? oe.clientX : 0;
            var y = oe ? oe.clientY : 0;
            currentTarget = target;
            scheduleShow(data, x, y, 0);
        };

        target.on('mouseover', onOver);
        target.on('mouseout', onOut);
        target.on('click', onClick);

        var domEl = null;
        if (typeof target.getElement === 'function') {
            try { domEl = target.getElement(); } catch (e) { domEl = null; }
        }
        var keyboardHandlers = null;
        if (domEl && domEl.nodeType === 1) {
            if (!domEl.hasAttribute('tabindex')) domEl.setAttribute('tabindex', '0');
            var onFocus = function () {
                var r = domEl.getBoundingClientRect();
                currentTarget = target;
                scheduleShow(data, r.right, r.top, 0);
            };
            var onBlur = function () { scheduleHide(); };
            var onKey = function (e) {
                if (e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    hide();
                }
            };
            domEl.addEventListener('focus', onFocus);
            domEl.addEventListener('blur', onBlur);
            domEl.addEventListener('keydown', onKey);
            keyboardHandlers = { domEl: domEl, onFocus: onFocus, onBlur: onBlur, onKey: onKey };
        }

        attachedRecords.push({
            target: target,
            variant: 'leaflet',
            handlers: { onOver: onOver, onOut: onOut, onClick: onClick },
            keyboard: keyboardHandlers
        });
    }

    function attach(target, data, opts) {
        if (!target) return;
        ensureFloater();
        opts = opts || {};
        var variant = opts.variant || detectVariant(target);
        if (variant === 'leaflet') attachLeaflet(target, data, opts);
        else attachSvg(target, data, opts);
    }

    function detach(target) {
        if (!target) return;
        for (var i = attachedRecords.length - 1; i >= 0; i--) {
            var rec = attachedRecords[i];
            if (rec.target !== target) continue;
            if (rec.variant === 'svg') {
                var h = rec.handlers;
                target.removeEventListener('mouseenter', h.onEnter);
                target.removeEventListener('mousemove', h.onMove);
                target.removeEventListener('mouseleave', h.onLeave);
                target.removeEventListener('pointerdown', h.onPointerDown);
                target.removeEventListener('focus', h.onFocus);
                target.removeEventListener('blur', h.onBlur);
                target.removeEventListener('keydown', h.onKey);
            } else {
                var hl = rec.handlers;
                try { target.off('mouseover', hl.onOver); } catch (e) { /* ignore */ }
                try { target.off('mouseout', hl.onOut); } catch (e) { /* ignore */ }
                try { target.off('click', hl.onClick); } catch (e) { /* ignore */ }
                if (rec.keyboard) {
                    var k = rec.keyboard;
                    k.domEl.removeEventListener('focus', k.onFocus);
                    k.domEl.removeEventListener('blur', k.onBlur);
                    k.domEl.removeEventListener('keydown', k.onKey);
                }
            }
            attachedRecords.splice(i, 1);
        }
    }

    if (typeof document !== 'undefined') {
        document.addEventListener('pointerdown', function (e) {
            if (!isTouchDevice()) return;
            if (!floaterEl || !floaterEl.classList.contains('is-visible')) return;
            if (floaterEl.contains(e.target)) return;
            if (currentTarget && currentTarget.nodeType === 1 && currentTarget.contains(e.target)) return;
            hide();
        }, true);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hide();
        });
    }

    global.PLNTooltip = {
        attach: attach,
        detach: detach,
        _hide: hide
    };
})(typeof window !== 'undefined' ? window : this);
