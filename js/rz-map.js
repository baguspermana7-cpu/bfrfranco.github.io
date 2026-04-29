/* RZMap v2026-04-29-v3 — shared Leaflet wrapper. Used by dc-market-tracker.html, pln-java-grid.html.
 * v3: optional tooltipData on marker/line specs auto-wires window.PLNTooltip if loaded. */
(function (global) {
    'use strict';

    var TILE_URLS = {
        'carto-dark':  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        'carto-light': 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    };
    var TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/">OSM</a>';

    var VOLTAGE_COLORS = { 500: '#3b82f6', 275: '#a78bfa', 150: '#f87171' };
    var VOLTAGE_DEFAULT = '#94a3b8';
    var LINE_WEIGHTS = { 500: 3, 275: 2.5, 150: 2 };
    var LINE_DASH = { 500: '14 8', 275: '10 6', 150: '6 4' };

    var FUEL_ICONS = {
        coal:    'fa-fire',
        gas:     'fa-wind',
        hydro:   'fa-water',
        geo:     'fa-temperature-arrow-up',
        solar:   'fa-sun',
        biomass: 'fa-leaf',
        wind:    'fa-fan'
    };

    function leafletReady() {
        if (typeof L === 'undefined') {
            if (!leafletReady._warned) {
                console.warn('[RZMap] Leaflet (L) is not loaded. RZMap calls will be no-ops.');
                leafletReady._warned = true;
            }
            return false;
        }
        return true;
    }

    function voltageColor(v) {
        return VOLTAGE_COLORS[v] || VOLTAGE_DEFAULT;
    }

    function stationRadius(mva) {
        var m = (typeof mva === 'number' && mva > 0) ? mva : 500;
        return Math.max(5, Math.min(18, Math.sqrt(m) * 0.35));
    }

    function buildPlantIcon(fuel) {
        var iconClass = FUEL_ICONS[fuel] || 'fa-bolt';
        return L.divIcon({
            className: 'rzm-plant rzm-plant-' + (fuel || 'unknown'),
            html: '<i class="fas ' + iconClass + '"></i>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
    }

    function ensureLayerGroup(buckets, key, map) {
        if (!buckets[key]) {
            buckets[key] = L.layerGroup().addTo(map);
        }
        return buckets[key];
    }

    function attachTooltipIfAvailable(layer, spec) {
        if (!layer || !spec || !spec.tooltipData) return;
        if (typeof global.PLNTooltip === 'undefined' || !global.PLNTooltip || typeof global.PLNTooltip.attach !== 'function') return;
        try {
            global.PLNTooltip.attach(layer, spec.tooltipData, { variant: 'leaflet' });
        } catch (e) {
            if (typeof console !== 'undefined' && console.warn) console.warn('[RZMap] PLNTooltip.attach failed', e);
        }
    }

    function addStation(spec, ctx) {
        var color = voltageColor(spec.voltage);
        var radius = stationRadius(spec.mva);
        var baseStyle = {
            radius: radius,
            color: color,
            fillColor: color,
            weight: 1.5,
            opacity: 0.9,
            fillOpacity: 0.7
        };
        var marker = L.circleMarker([spec.lat, spec.lng], baseStyle);
        if (spec.label) marker.options.alt = spec.label;
        if (spec.popupHtml) marker.bindPopup(spec.popupHtml, { maxWidth: 280 });

        marker.on('mouseover', function () {
            this.setStyle({ fillOpacity: 0.95, weight: 2.5 });
        });
        marker.on('mouseout', function () {
            this.setStyle({ fillOpacity: 0.7, weight: 1.5 });
        });

        if (ctx.opts.layers && ctx.opts.layers.voltage && spec.voltage) {
            var grp = ensureLayerGroup(ctx.voltageGroups, spec.voltage, ctx.map);
            grp.addLayer(marker);
        } else {
            marker.addTo(ctx.map);
        }
        if (spec.id) ctx.markersById[spec.id] = marker;
        ctx.markers.push(marker);
        attachTooltipIfAvailable(marker, spec);
        return marker;
    }

    function addPlant(spec, ctx) {
        var icon = buildPlantIcon(spec.fuel);
        var marker = L.marker([spec.lat, spec.lng], {
            icon: icon,
            alt: spec.label || ('Power plant ' + (spec.fuel || ''))
        });
        if (spec.popupHtml) marker.bindPopup(spec.popupHtml, { maxWidth: 280 });
        if (spec.label) marker.options.title = spec.label;

        if (ctx.opts.layers && ctx.opts.layers.fuel && spec.fuel) {
            var grp = ensureLayerGroup(ctx.fuelGroups, spec.fuel, ctx.map);
            grp.addLayer(marker);
        } else {
            marker.addTo(ctx.map);
        }
        if (spec.id) ctx.markersById[spec.id] = marker;
        ctx.markers.push(marker);
        attachTooltipIfAvailable(marker, spec);
        return marker;
    }

    function addMarkerInternal(spec, ctx) {
        if (!leafletReady() || !ctx || !ctx.map) return null;
        if (spec.kind === 'plant') return addPlant(spec, ctx);
        return addStation(spec, ctx);
    }

    function addLineInternal(spec, ctx) {
        if (!leafletReady() || !ctx || !ctx.map) return null;
        if (!spec.coords || !spec.coords.length) return null;
        var v = spec.voltage;
        var color = voltageColor(v);
        var weight = LINE_WEIGHTS[v] || 2;
        var dash = LINE_DASH[v] || null;
        var line = L.polyline(spec.coords, {
            color: color,
            weight: weight,
            opacity: 0.85,
            dashArray: dash,
            className: 'rzm-line rzm-line-' + (v || 'na')
        });

        if (ctx.opts.layers && ctx.opts.layers.voltage && v) {
            var grp = ensureLayerGroup(ctx.voltageGroups, v, ctx.map);
            grp.addLayer(line);
        } else {
            line.addTo(ctx.map);
        }
        if (spec.id) ctx.linesById[spec.id] = line;
        ctx.lines.push(line);
        attachTooltipIfAvailable(line, spec);
        return line;
    }

    function buildLayerControl(ctx) {
        if (!ctx.opts.layers) return;
        var overlays = {};
        var has = false;
        if (ctx.opts.layers.voltage) {
            if (ctx.voltageGroups[500]) { overlays['500 kV'] = ctx.voltageGroups[500]; has = true; }
            if (ctx.voltageGroups[275]) { overlays['275 kV'] = ctx.voltageGroups[275]; has = true; }
            if (ctx.voltageGroups[150]) { overlays['150 kV'] = ctx.voltageGroups[150]; has = true; }
        }
        if (ctx.opts.layers.fuel) {
            var fuelKeys = Object.keys(ctx.fuelGroups);
            for (var i = 0; i < fuelKeys.length; i++) {
                var k = fuelKeys[i];
                var label = k.charAt(0).toUpperCase() + k.slice(1);
                overlays[label] = ctx.fuelGroups[k];
                has = true;
            }
        }
        if (has) {
            ctx.layerControl = L.control.layers(null, overlays, { collapsed: false }).addTo(ctx.map);
        }
    }

    function attachA11y(container, markerCount) {
        if (!container) return;
        container.setAttribute('role', 'application');
        container.setAttribute('aria-label', 'Interactive map. Use arrow keys to pan.');
        var sr = document.createElement('p');
        sr.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
        sr.textContent = 'Map contains ' + markerCount + ' marker' + (markerCount === 1 ? '' : 's') + '.';
        sr.setAttribute('data-rzm-srcount', '1');
        if (container.parentNode) {
            container.parentNode.insertBefore(sr, container.nextSibling);
        }
    }

    function initImpl(containerId, opts) {
        if (!leafletReady()) return null;
        opts = opts || {};
        var container = document.getElementById(containerId);
        if (!container) {
            console.warn('[RZMap] container #' + containerId + ' not found');
            return null;
        }

        var tileKey = opts.tile || 'carto-dark';
        var tileUrl = TILE_URLS[tileKey] || TILE_URLS['carto-dark'];

        var mapOpts = {
            zoomControl: true,
            attributionControl: true,
            worldCopyJump: opts.worldCopyJump !== false
        };
        if (typeof opts.minZoom === 'number') mapOpts.minZoom = opts.minZoom;
        if (typeof opts.maxZoom === 'number') mapOpts.maxZoom = opts.maxZoom;
        if (!opts.fitBounds) {
            mapOpts.center = opts.center || [0, 0];
            mapOpts.zoom = (typeof opts.zoom === 'number') ? opts.zoom : 2;
        }

        var map = L.map(containerId, mapOpts);

        L.tileLayer(tileUrl, {
            attribution: TILE_ATTR,
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        var ctx = {
            map: map,
            opts: opts,
            container: container,
            markers: [],
            lines: [],
            markersById: {},
            linesById: {},
            voltageGroups: {},
            fuelGroups: {},
            layerControl: null
        };

        var srcMarkers = opts.markers || [];
        for (var i = 0; i < srcMarkers.length; i++) addMarkerInternal(srcMarkers[i], ctx);
        var srcLines = opts.lines || [];
        for (var j = 0; j < srcLines.length; j++) addLineInternal(srcLines[j], ctx);

        buildLayerControl(ctx);

        if (opts.fitBounds) {
            try { map.fitBounds(opts.fitBounds); } catch (e) { /* ignore bad bounds */ }
        }

        attachA11y(container, ctx.markers.length);

        setTimeout(function () {
            try { map.invalidateSize(); } catch (e) { /* ignore */ }
        }, 60);

        return {
            map: map,
            addMarker: function (spec) { return addMarkerInternal(spec, ctx); },
            addLine: function (spec) { return addLineInternal(spec, ctx); },
            setMarkerVisible: function (id, visible) {
                if (!leafletReady()) return null;
                var m = ctx.markersById[id];
                if (!m) return null;
                if (visible && !ctx.map.hasLayer(m)) ctx.map.addLayer(m);
                if (!visible && ctx.map.hasLayer(m)) ctx.map.removeLayer(m);
                return m;
            },
            setLineVisible: function (id, visible) {
                if (!leafletReady()) return null;
                var ln = ctx.linesById[id];
                if (!ln) return null;
                if (visible && !ctx.map.hasLayer(ln)) ctx.map.addLayer(ln);
                if (!visible && ctx.map.hasLayer(ln)) ctx.map.removeLayer(ln);
                return ln;
            },
            fitBounds: function (b) {
                if (!leafletReady() || !b) return null;
                try { ctx.map.fitBounds(b); } catch (e) { /* ignore */ }
                return null;
            },
            setView: function (center, zoom) {
                if (!leafletReady() || !center) return null;
                ctx.map.setView(center, (typeof zoom === 'number') ? zoom : ctx.map.getZoom());
                return null;
            },
            refresh: function () {
                if (!leafletReady()) return null;
                try { ctx.map.invalidateSize(); } catch (e) { /* ignore */ }
                return null;
            },
            destroy: function () {
                if (!leafletReady()) return null;
                try { ctx.map.remove(); } catch (e) { /* ignore */ }
                ctx.markers = [];
                ctx.lines = [];
                ctx.markersById = {};
                ctx.linesById = {};
                ctx.voltageGroups = {};
                ctx.fuelGroups = {};
                ctx.layerControl = null;
                var sr = ctx.container && ctx.container.parentNode
                    ? ctx.container.parentNode.querySelector('p[data-rzm-srcount="1"]')
                    : null;
                if (sr && sr.parentNode) sr.parentNode.removeChild(sr);
                return null;
            }
        };
    }

    global.RZMap = {
        init: function (containerId, opts) { return initImpl(containerId, opts); }
    };
})(typeof window !== 'undefined' ? window : this);
