/**
 * @file pln-energy-dashboard.js
 * @module PLN_ENERGY_DASHBOARD
 * @version 2026-05-01-v6
 *
 * Chart-rendering and choropleth helpers for the PLN Java-Bali Grid Monitor.
 * Provides pure SVG rendering functions plus Leaflet choropleth helpers.
 * No canvas, no third-party chart libraries.
 *
 * Cross-reference: standarization/PLN_DATA_SCHEMA.md (Province aggregates §6)
 *
 * Exposes window.PLN_ENERGY_DASHBOARD:
 *   renderProvinceChoropleth(map, provinceData[, geojsonUrl]) -> Promise<L.GeoJSON>
 *   addChoroplethLegend(map[, position]) -> L.Control
 *   renderStackedAreaSVG(svgEl, series, opts)
 *   renderLineSVG(svgEl, points, opts)
 *   renderBarSegment(container, segments[, opts])
 *   renderBreakdownTable(tableEl, rows, columns)
 *   csvDownload(filename, rows, columns)
 *
 * Dependencies:
 *   - Leaflet (L) must already be loaded for choropleth helpers.
 *   - All other helpers require only a DOM environment.
 */
(function (win) {
  'use strict';

  /* =========================================================
   * INTERNAL HELPERS
   * ========================================================= */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /** Default GeoJSON URL (relative to page root). */
  var DEFAULT_GEOJSON_URL = 'js/pln-indonesia-provinces.geojson';

  /**
   * Carbon-intensity gradient stops (gCO₂/kWh → hex colour).
   * Evenly-spaced 300 gCO₂/kWh per stop — mirrors the electricitymaps.com
   * legend bar (0 / 300 / 600 / 900 / 1200 / 1500). Saturated heat-map
   * tones so each adjacent stop is visually distinct, even at moderate
   * zoom levels.
   */
  var CARBON_STOPS = [
    [0,    '#22c55e'],  // saturated green — clean grid
    [300,  '#fde047'],  // saturated yellow — moderate
    [600,  '#f97316'],  // saturated orange — high
    [900,  '#dc2626'],  // saturated red — very high
    [1200, '#7c2d12'],  // dark brown — coal-heavy
    [1500, '#0c0a09']   // near-black — worst case
  ];

  var CARBON_LEGEND_MIN = 0;
  var CARBON_LEGEND_MAX = 1500;

  function warn(msg) {
    if (win.console && win.console.warn) {
      win.console.warn('[PLN_ENERGY_DASHBOARD] ' + msg);
    }
  }

  /** Linear-interpolate between two hex colours. t ∈ [0,1]. */
  function lerpHex(a, b, t) {
    var ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
    var br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    function pad(n) { var s = Math.round(n).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + pad(ar + (br - ar) * t) + pad(ag + (bg - ag) * t) + pad(ab + (bb - ab) * t);
  }

  /** Pick fill colour for a carbon intensity (gCO₂/kWh) via continuous lerp. */
  function carbonColor(gco2) {
    var v = +gco2;
    if (!isFinite(v)) v = 0;
    if (v <= CARBON_STOPS[0][0]) return CARBON_STOPS[0][1];
    var last = CARBON_STOPS.length - 1;
    if (v >= CARBON_STOPS[last][0]) return CARBON_STOPS[last][1];
    for (var i = 0; i < last; i++) {
      var lo = CARBON_STOPS[i], hi = CARBON_STOPS[i + 1];
      if (v >= lo[0] && v <= hi[0]) {
        var t = (v - lo[0]) / (hi[0] - lo[0]);
        return lerpHex(lo[1], hi[1], t);
      }
    }
    return CARBON_STOPS[0][1];
  }

  /** Legacy alias preserved for callers that still reference `_utilColor`. */
  function utilColor(_pct) { return carbonColor(_pct); }

  /** Escape HTML for popup content. */
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Format number with thousands separator. */
  function fmtNum(v, decimals) {
    if (v === null || v === undefined || isNaN(v)) { return '—'; }
    var d = (decimals !== undefined) ? decimals : 0;
    return (+v).toLocaleString('en-US', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  }

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
    }
    return el;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function fmt1(n) {
    return (typeof n === 'number') ? n.toFixed(1) : String(n);
  }

  /**
   * Compute padded data bounds.
   * @param {number[]} allValues
   * @param {number} [padPct=0.08] fraction to pad above max
   * @returns {{ min: number, max: number }}
   */
  function dataBounds(allValues, padPct) {
    padPct = (padPct === undefined) ? 0.08 : padPct;
    var min = 0;
    var max = Math.max.apply(null, allValues);
    max = max + max * padPct;
    return { min: min, max: max };
  }

  /**
   * Map a data value to an SVG y-coordinate (top=0, bottom=height).
   */
  function toY(value, min, max, height, pad) {
    pad = pad || 0;
    var range = max - min;
    if (range === 0) return height / 2;
    var frac = 1 - ((value - min) / range);
    return pad + frac * (height - pad * 2);
  }

  /**
   * Map an index to SVG x-coordinate.
   */
  function toX(i, n, width, padL, padR) {
    if (n <= 1) return padL;
    return padL + (i / (n - 1)) * (width - padL - padR);
  }

  /**
   * Build a closed SVG area path for a stacked area.
   * @param {number[]} tops      y-coordinates of top edge
   * @param {number[]} bottoms   y-coordinates of bottom edge
   * @param {number[]} xs        x-coordinates
   */
  function buildAreaPath(xs, tops, bottoms) {
    if (!xs.length) return '';
    var d = 'M ' + xs[0] + ' ' + tops[0];
    for (var i = 1; i < xs.length; i++) {
      d += ' L ' + xs[i] + ' ' + tops[i];
    }
    for (var j = xs.length - 1; j >= 0; j--) {
      d += ' L ' + xs[j] + ' ' + bottoms[j];
    }
    d += ' Z';
    return d;
  }

  /**
   * Build an open SVG polyline path.
   * @param {number[]} xs
   * @param {number[]} ys
   */
  function buildLinePath(xs, ys) {
    if (!xs.length) return '';
    var d = 'M ' + xs[0] + ' ' + ys[0];
    for (var i = 1; i < xs.length; i++) {
      d += ' L ' + xs[i] + ' ' + ys[i];
    }
    return d;
  }

  /* =========================================================
   * CHOROPLETH HELPERS (Leaflet required)
   * ========================================================= */

  /**
   * Load the province GeoJSON and add a choropleth overlay to a Leaflet map.
   *
   * @param {L.Map}   map          Leaflet map instance.
   * @param {Object}  provinceData Map of prov key → ProvinceAggregate.
   *                               Shape per PLN_DATA_SCHEMA.md §6.
   * @param {string}  [geojsonUrl] URL of the GeoJSON; defaults to
   *                               'js/pln-indonesia-provinces.geojson'.
   * @returns {Promise<L.GeoJSON|null>}
   */
  function renderProvinceChoropleth(map, provinceData, geojsonUrl) {
    if (!map) { warn('renderProvinceChoropleth: map is required'); return Promise.reject(new Error('map required')); }
    if (!provinceData) { warn('renderProvinceChoropleth: provinceData is null/undefined'); provinceData = {}; }

    var url = geojsonUrl || DEFAULT_GEOJSON_URL;

    return fetch(url)
      .then(function (res) {
        if (!res.ok) { throw new Error('GeoJSON fetch failed: ' + res.status + ' ' + url); }
        return res.json();
      })
      .then(function (gj) {
        var layer = L.geoJSON(gj, {
          style: function (feature) {
            var prov = feature.properties && feature.properties.prov;
            var agg  = (prov && provinceData[prov]) || {};
            var co2  = agg.carbonIntensity !== undefined ? agg.carbonIntensity : 0;
            return {
              fillColor:   carbonColor(co2),
              fillOpacity: 1.0,        // full saturation — match electricitymaps look
              weight:      0,          // base state: no stroke, pixel-perfect adjacency
              color:       'transparent',
              stroke:      false
            };
          },
          onEachFeature: function (feature, lyr) {
            var props    = feature.properties || {};
            var prov     = props.prov  || '';
            var label    = props.label || prov;
            var agg      = provinceData[prov] || {};
            var co2      = agg.carbonIntensity !== undefined ? fmtNum(agg.carbonIntensity, 0) : '—';
            var util     = agg.utilizationPct !== undefined ? fmtNum(agg.utilizationPct, 1) : '—';
            var peakMW   = agg.peakMW        !== undefined ? fmtNum(agg.peakMW, 0)         : '—';
            var instMW   = agg.installedMW   !== undefined ? fmtNum(agg.installedMW, 0)    : '—';
            var stations = agg.stations      !== undefined ? fmtNum(agg.stations, 0)        : '—';
            var plants   = agg.plants        !== undefined ? fmtNum(agg.plants, 0)          : '—';

            lyr.bindPopup(
              '<strong>' + escHtml(label) + '</strong><br>' +
              'Carbon intensity: ' + co2      + ' gCO₂/kWh<br>' +
              'Peak: '             + peakMW   + ' MW<br>' +
              'Installed: '        + instMW   + ' MW<br>' +
              'Utilization: '      + util     + '%<br>' +
              'Stations: '         + stations + '<br>' +
              'Plants: '           + plants
            );

            // Hover effect: bright stroke + bring-to-front + slight brightness lift
            lyr.on('mouseover', function () {
              lyr.setStyle({
                weight:        2.5,
                color:         '#ffffff',
                stroke:        true,
                fillOpacity:   1.0,
                dashArray:     ''
              });
              if (lyr.bringToFront) { try { lyr.bringToFront(); } catch (e) { /* ignore */ } }
            });
            lyr.on('mouseout', function () {
              lyr.setStyle({
                weight:      0,
                color:       'transparent',
                stroke:      false,
                fillOpacity: 1.0
              });
            });
          }
        });
        layer.addTo(map);
        return layer;
      })
      .catch(function (err) {
        warn('renderProvinceChoropleth error: ' + (err && err.message));
        return null;
      });
  }

  /**
   * Add a Leaflet control legend for the utilization colour ramp.
   *
   * @param {L.Map}   map
   * @param {string}  [position='bottomleft']
   * @returns {L.Control|null}
   */
  function addChoroplethLegend(map, position) {
    if (!map) { warn('addChoroplethLegend: map is required'); return null; }

    var ctrl = L.control({ position: position || 'bottomleft' });

    ctrl.onAdd = function () {
      var div = document.createElement('div');
      div.className = 'pjg-choropleth-legend';
      div.style.cssText = [
        'background:rgba(15,23,42,0.88)',
        'border:1px solid rgba(96,165,250,0.25)',
        'border-radius:8px',
        'padding:10px 12px',
        'color:#f1f5f9',
        'min-width:280px',
        'box-shadow:0 4px 12px rgba(0,0,0,0.4)'
      ].join(';');

      var title = document.createElement('div');
      title.style.cssText = 'font-weight:700;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#cbd5e1;margin-bottom:8px;';
      title.textContent = 'Carbon intensity';
      div.appendChild(title);

      // Continuous gradient bar (mirrors electricitymaps.com bottom-right legend)
      var stops = CARBON_STOPS.map(function (s) {
        var pct = ((s[0] - CARBON_LEGEND_MIN) / (CARBON_LEGEND_MAX - CARBON_LEGEND_MIN)) * 100;
        return s[1] + ' ' + pct.toFixed(2) + '%';
      }).join(', ');

      var bar = document.createElement('div');
      bar.style.cssText = [
        'width:100%',
        'height:12px',
        'border-radius:3px',
        'background:linear-gradient(to right, ' + stops + ')',
        'border:1px solid rgba(255,255,255,0.08)'
      ].join(';');
      div.appendChild(bar);

      // Tick labels (0 / 300 / 600 / 900 / 1200 / 1500 gCO₂/kWh)
      var ticks = document.createElement('div');
      ticks.style.cssText = 'display:flex;justify-content:space-between;font-size:9.5px;color:#94a3b8;margin-top:4px;font-family:"JetBrains Mono",monospace;font-weight:600;';
      var tickValues = [0, 300, 600, 900, 1200, 1500];
      tickValues.forEach(function (v) {
        var t = document.createElement('span');
        t.textContent = v;
        ticks.appendChild(t);
      });
      div.appendChild(ticks);

      var unit = document.createElement('div');
      unit.style.cssText = 'font-size:9.5px;color:#64748b;margin-top:2px;text-align:right;font-family:"JetBrains Mono",monospace;';
      unit.textContent = 'gCO₂eq / kWh';
      div.appendChild(unit);

      return div;
    };

    ctrl.addTo(map);
    return ctrl;
  }

  /**
   * Add a prominent floating toggle button on the map that enables/disables
   * the choropleth gradient layer + its legend. Stored as a Leaflet control.
   *
   * @param {L.Map} map
   * @param {{layer: L.GeoJSON, legend: L.Control}} state  references to the
   *        choropleth layer + legend; the toggle adds/removes both.
   * @param {string} [position='topright']  Leaflet position
   * @returns {L.Control|null}
   */
  function addChoroplethToggleButton(map, state, position) {
    if (!map) { warn('addChoroplethToggleButton: map is required'); return null; }

    var ctrl = L.control({ position: position || 'topleft' });
    var btnRef = null;
    var enabled = !!(state && state.layer);

    function updateBtn() {
      if (!btnRef) return;
      btnRef.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      btnRef.title = enabled
        ? 'Hide carbon-intensity gradient overlay on Java + Bali provinces (choropleth)'
        : 'Show carbon-intensity gradient overlay on Java + Bali provinces (choropleth)';
      // Visual: filled when ON, outlined when OFF
      btnRef.style.background = enabled
        ? 'linear-gradient(135deg,#f59e0b,#b45309)'
        : 'rgba(15,23,42,0.85)';
      btnRef.style.color = enabled ? '#fff' : '#cbd5e1';
      btnRef.style.borderColor = enabled ? '#f59e0b' : 'rgba(96,165,250,0.3)';
    }

    ctrl.onAdd = function () {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pjg-choropleth-toggle-btn leaflet-bar';
      btn.innerHTML = '<i class="fas fa-fire" aria-hidden="true"></i> <span>Gradient</span>';
      btn.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:6px',
        'padding:6px 12px',
        'border-radius:6px',
        'border:1px solid rgba(96,165,250,0.3)',
        'background:rgba(15,23,42,0.85)',
        'color:#cbd5e1',
        'font:600 11px/1.1 Inter,system-ui,sans-serif',
        'letter-spacing:0.04em',
        'cursor:pointer',
        'box-shadow:0 2px 6px rgba(0,0,0,0.4)',
        'user-select:none'
      ].join(';');
      btn.setAttribute('aria-label', 'Toggle carbon-intensity gradient overlay');
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');

      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.disableScrollPropagation(btn);
      L.DomEvent.on(btn, 'click', function () {
        if (enabled) {
          // Hide
          if (state.layer && map.hasLayer(state.layer)) { map.removeLayer(state.layer); }
          if (state.legend && state.legend.remove) { try { state.legend.remove(); } catch (_) {} }
          enabled = false;
        } else {
          // Show
          if (state.layer && !map.hasLayer(state.layer)) { state.layer.addTo(map); }
          // Re-mount legend if it was removed
          if (state.legendFactory && (!state.legend || !state.legend._map)) {
            state.legend = state.legendFactory(map);
          }
          enabled = true;
        }
        updateBtn();
        // Mirror state into the side-panel checkbox if present
        var panelBox = document.getElementById('pjg-choropleth-toggle');
        if (panelBox && panelBox.checked !== enabled) {
          panelBox.checked = enabled;
        }
      });

      btnRef = btn;
      updateBtn();
      return btn;
    };

    ctrl.addTo(map);
    return ctrl;
  }

  /* =========================================================
   * STACKED AREA SVG
   * ========================================================= */

  /**
   * Render a stacked area chart into an SVG element.
   * Uses D3-style margin convention. Legend is placed in the top margin
   * (not on the X-axis). Overlay label sits in the right margin so it
   * never clips. All SVG elements are appended directly to svgElement
   * with absolute coordinates derived from the margin offsets.
   *
   * @param {SVGElement} svgElement  target SVG (cleared before render)
   * @param {Array<{id:string, label:string, color:string, values:number[]}>} series
   *   Ordered bottom-to-top. Each series.values array must be same length.
   * @param {Object} opts
   *   @param {number}   [opts.width=720]
   *   @param {number}   [opts.height=240]
   *   @param {Object}   [opts.margin]   {top:32, right:84, bottom:36, left:56}
   *   @param {string[]} [opts.xLabels]  labels for x-axis ticks (non-empty rendered)
   *   @param {string}   [opts.yLabel='TWh']
   *   @param {Object}   [opts.overlayLine]  { values:number[], label:string, color:string }
   *   @param {string}   [opts.legend='top-right']  'top-right'|'top-left'|'none'
   *   @param {boolean}  [opts.showGrid=true]
   *   @param {boolean}  [opts.hoverable=true]
   */
  function renderStackedAreaSVG(svgElement, series, opts) {
    if (!svgElement) { warn('renderStackedAreaSVG: svgElement is null'); return; }
    opts = opts || {};

    var W = opts.width  || 720;
    var H = opts.height || 240;

    var defMargin = { top: 32, right: 84, bottom: 36, left: 56 };
    var margin  = opts.margin  || defMargin;
    var mTop    = (margin.top    !== undefined) ? margin.top    : defMargin.top;
    var mRight  = (margin.right  !== undefined) ? margin.right  : defMargin.right;
    var mBottom = (margin.bottom !== undefined) ? margin.bottom : defMargin.bottom;
    var mLeft   = (margin.left   !== undefined) ? margin.left   : defMargin.left;

    var innerW = W - mLeft - mRight;
    var innerH = H - mTop  - mBottom;

    var xLabels   = opts.xLabels   || [];
    var yLabel    = opts.yLabel    || 'TWh';
    var overlay   = opts.overlayLine || null;
    var legendPos = (opts.legend !== undefined) ? opts.legend : 'top-right';
    var showGrid  = (opts.showGrid  !== false);

    // Clear
    while (svgElement.firstChild) svgElement.removeChild(svgElement.firstChild);

    svgElement.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    if (!series || !series.length || !series[0].values || !series[0].values.length) return;

    var n = series[0].values.length;

    // Build stacked column totals
    var stackedTotals = [];
    for (var i = 0; i < n; i++) {
      var colTotal = 0;
      for (var si = 0; si < series.length; si++) { colTotal += (series[si].values[i] || 0); }
      stackedTotals.push(colTotal);
    }

    // Max for scale — also consider overlay
    var rawMax = Math.max.apply(null, stackedTotals);
    if (overlay && overlay.values && overlay.values.length) {
      var olMax = Math.max.apply(null, overlay.values);
      if (olMax > rawMax) rawMax = olMax;
    }
    // Round up to a nice number
    var niceMax = rawMax > 0 ? (Math.ceil(rawMax * 1.08 / 10) * 10) : 10;

    // Coordinate helpers — return ABSOLUTE svg coordinates
    function absPy(v) {
      // maps data value v → absolute y in the svg
      if (niceMax === 0) return mTop + innerH;
      return mTop + innerH - (v / niceMax) * innerH;
    }
    function absPx(idx) {
      if (n <= 1) return mLeft;
      return mLeft + (idx / (n - 1)) * innerW;
    }

    // Y-axis grid lines + tick labels
    var yTickVals = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];
    for (var ti = 0; ti < yTickVals.length; ti++) {
      var tv   = yTickVals[ti];
      var tyPx = absPy(tv);
      if (showGrid) {
        svgElement.appendChild(svgEl('line', {
          x1: mLeft, x2: mLeft + innerW, y1: tyPx, y2: tyPx,
          stroke: 'rgba(148,163,184,0.18)',
          'stroke-width': '1',
          'stroke-dasharray': '3 3'
        }));
      }
      var tyText = svgEl('text', {
        x: mLeft - 8, y: tyPx + 4,
        fill: 'var(--pjg-text3,#64748b)',
        'font-size': '10',
        'text-anchor': 'end',
        'font-family': 'monospace'
      });
      tyText.textContent = Math.round(tv);
      svgElement.appendChild(tyText);
    }

    // Y-axis rotated label
    var yLblCx = mLeft - 36;
    var yLblCy = mTop + innerH / 2;
    var yLabelEl = svgEl('text', {
      x: yLblCx, y: yLblCy,
      fill: 'var(--pjg-text3,#64748b)',
      'font-size': '11',
      'text-anchor': 'middle',
      'font-family': "'Inter',sans-serif",
      transform: 'rotate(-90,' + yLblCx + ',' + yLblCy + ')'
    });
    yLabelEl.textContent = yLabel;
    svgElement.appendChild(yLabelEl);

    // Build stacked area paths (bottom-to-top accumulation)
    var cumBase = [];
    for (var bi = 0; bi < n; bi++) { cumBase.push(0); }

    for (var si2 = 0; si2 < series.length; si2++) {
      var s     = series[si2];
      var tops2 = [], bots2 = [], axs2 = [];
      for (var xi = 0; xi < n; xi++) {
        var bot = cumBase[xi];
        var top = bot + (s.values[xi] || 0);
        cumBase[xi] = top;
        bots2.push(absPy(bot));
        tops2.push(absPy(top));
        axs2.push(absPx(xi));
      }
      svgElement.appendChild(svgEl('path', {
        d: buildAreaPath(axs2, tops2, bots2),
        fill: s.color,
        opacity: '0.85',
        stroke: 'none'
      }));
    }

    // Overlay line
    if (overlay && overlay.values && overlay.values.length === n) {
      var olPts = [];
      var olLastY = 0;
      for (var oi = 0; oi < n; oi++) {
        var oly = absPy(overlay.values[oi] || 0);
        olPts.push(absPx(oi) + ',' + oly);
        olLastY = oly;
      }
      svgElement.appendChild(svgEl('polyline', {
        points: olPts.join(' '),
        fill: 'none',
        stroke: overlay.color || '#ffffff',
        'stroke-width': '2.5',
        'stroke-dasharray': '5 3',
        opacity: '0.95'
      }));
      // Label at right edge of PLOT AREA (mLeft+innerW+6) — right margin gives clearance
      var olLabelEl = svgEl('text', {
        x: mLeft + innerW + 6,
        y: olLastY,
        fill: overlay.color || '#ffffff',
        'font-size': '11',
        'font-weight': '700',
        'text-anchor': 'start',
        'dominant-baseline': 'middle',
        'font-family': "'Inter',sans-serif"
      });
      olLabelEl.textContent = overlay.label || 'Demand';
      svgElement.appendChild(olLabelEl);
    }

    // X-axis labels — only non-empty entries
    for (var xl = 0; xl < n; xl++) {
      var lbl = xLabels[xl];
      if (lbl === undefined || lbl === null || lbl === '') continue;
      var xTxt = svgEl('text', {
        x: absPx(xl), y: mTop + innerH + 18,
        fill: 'var(--pjg-text3,#64748b)',
        'font-size': '10',
        'text-anchor': 'middle',
        'font-family': "'Inter',sans-serif"
      });
      xTxt.textContent = String(lbl);
      svgElement.appendChild(xTxt);
    }

    // Legend — in top margin, rendered right-to-left from (mLeft+innerW)
    if (legendPos !== 'none') {
      var legendEntries = [];
      if (overlay) {
        legendEntries.push({ label: overlay.label || 'Demand', color: overlay.color || '#fff', dash: true });
      }
      var seriesRev = series.slice().reverse();
      for (var li = 0; li < seriesRev.length; li++) {
        legendEntries.push({ label: seriesRev[li].label, color: seriesRev[li].color, dash: false });
      }
      var legY      = mTop / 2;          // vertical midpoint of top margin
      var swatchW   = 12, swatchH = 12;
      var gapTS     = 4, gapBetween = 14;
      var approxCW  = 6.5;
      var curX      = mLeft + innerW;

      for (var lei = 0; lei < legendEntries.length; lei++) {
        var le    = legendEntries[lei];
        var entryW = swatchW + gapTS + le.label.length * approxCW;
        curX -= entryW;

        if (le.dash) {
          svgElement.appendChild(svgEl('line', {
            x1: curX, x2: curX + swatchW,
            y1: legY + swatchH / 2, y2: legY + swatchH / 2,
            stroke: le.color, 'stroke-width': '2',
            'stroke-dasharray': '4 2'
          }));
        } else {
          svgElement.appendChild(svgEl('rect', {
            x: curX, y: legY,
            width: swatchW, height: swatchH,
            fill: le.color, rx: '2', opacity: '0.88'
          }));
        }
        var leText = svgEl('text', {
          x: curX + swatchW + gapTS,
          y: legY + 9,
          fill: 'var(--pjg-text3,#94a3b8)',
          'font-size': '11',
          'font-family': "'Inter',sans-serif"
        });
        leText.textContent = le.label;
        svgElement.appendChild(leText);
        curX -= gapBetween;
      }
    }

    // Hover catcher (invisible overlay with guide line + tooltip)
    if (opts.hoverable !== false) {
      var hoverG = svgEl('g', { 'class': 'pjg-chart-hover', style: 'display:none' });
      var hGuide = svgEl('line', {
        x1: mLeft, x2: mLeft, y1: mTop, y2: mTop + innerH,
        stroke: 'rgba(148,163,184,0.5)', 'stroke-width': '1'
      });
      hoverG.appendChild(hGuide);

      var ttBg = svgEl('rect', {
        x: 0, y: 0, width: 110, height: 16 + series.length * 14,
        fill: 'rgba(15,23,42,0.88)', rx: '4',
        stroke: 'rgba(148,163,184,0.25)', 'stroke-width': '1'
      });
      var ttG = svgEl('g', { 'class': 'pjg-chart-tt' });
      ttG.appendChild(ttBg);

      var ttLines = [];
      for (var tli = 0; tli < series.length; tli++) {
        var ttTxt = svgEl('text', {
          x: 8, y: 14 + tli * 14,
          fill: series[tli].color, 'font-size': '10',
          'font-family': "'Inter',sans-serif"
        });
        ttTxt.textContent = '';
        ttG.appendChild(ttTxt);
        ttLines.push(ttTxt);
      }
      hoverG.appendChild(ttG);
      svgElement.appendChild(hoverG);

      var hitRect = svgEl('rect', {
        x: mLeft, y: mTop, width: innerW, height: innerH,
        fill: 'transparent', style: 'cursor:crosshair'
      });
      svgElement.appendChild(hitRect);

      hitRect.addEventListener('mousemove', function (e) {
        var rect = hitRect.getBoundingClientRect ? hitRect.getBoundingClientRect() : { left: mLeft, width: innerW };
        var relX = (e.clientX !== undefined ? e.clientX : 0) - (rect.left || 0);
        var idx  = Math.round(clamp(relX / innerW, 0, 1) * (n - 1));
        var gx   = absPx(idx);

        hGuide.setAttribute('x1', gx);
        hGuide.setAttribute('x2', gx);
        hoverG.style.display = '';

        var ttX = (gx + 120 > mLeft + innerW) ? gx - 118 : gx + 8;
        ttG.setAttribute('transform', 'translate(' + ttX + ',' + (mTop + 4) + ')');

        for (var ki = 0; ki < series.length; ki++) {
          ttLines[ki].textContent = series[ki].label + ': ' + fmt1(series[ki].values[idx] || 0);
        }
      });

      hitRect.addEventListener('mouseleave', function () {
        hoverG.style.display = 'none';
      });
    }
  }

  /* =========================================================
   * LINE SVG
   * ========================================================= */

  /**
   * Render a single-series line chart into an SVG element.
   * Uses D3-style margin convention. Reference-line labels are placed
   * at the RIGHT EDGE (not stacked in the upper-left corner). Labels
   * get an anti-overlap nudge and a pill background.
   *
   * For backward-compatible multi-line usage pass an array of
   * { label, color, values, dash? } objects as `points` and opts.multiLine=true.
   *
   * @param {SVGElement}  svgElement   Target SVG (cleared before render).
   * @param {number[]|Array<{label:string,color:string,values:number[],dash?:string}>} points
   * @param {Object} opts
   *   @param {number}   [opts.width=720]
   *   @param {number}   [opts.height=140]
   *   @param {Object}   [opts.margin]   {top:24, right:96, bottom:32, left:56}
   *   @param {string[]} [opts.xLabels]
   *   @param {string}   [opts.yLabel='GWh']
   *   @param {string}   [opts.color='#60a5fa']
   *   @param {boolean}  [opts.fillBelow=false]
   *   @param {Array}    [opts.refLines]   [{y, label, color, dash}]
   *   @param {string}   [opts.legend='top-right']  'top-right'|'none'
   *   @param {boolean}  [opts.multiLine=false]
   */
  function renderLineSVG(svgElement, points, opts) {
    if (!svgElement) { warn('renderLineSVG: svgElement is null'); return; }
    if (!points || (Array.isArray(points) && !points.length)) { warn('renderLineSVG: points is empty'); return; }

    opts = opts || {};

    /* Detect multi-line mode (legacy or explicit) */
    var isMulti = opts.multiLine || (points.length > 0 && typeof points[0] === 'object' && points[0] !== null && !Array.isArray(points[0]) && points[0].values);
    if (isMulti) { return _renderMultiLineSVG(svgElement, points, opts); }

    var W = opts.width  || 720;
    var H = opts.height || 140;

    var defMargin = { top: 24, right: 96, bottom: 32, left: 56 };
    var margin  = opts.margin  || defMargin;
    var mTop    = (margin.top    !== undefined) ? margin.top    : defMargin.top;
    var mRight  = (margin.right  !== undefined) ? margin.right  : defMargin.right;
    var mBottom = (margin.bottom !== undefined) ? margin.bottom : defMargin.bottom;
    var mLeft   = (margin.left   !== undefined) ? margin.left   : defMargin.left;

    var innerW = W - mLeft - mRight;
    var innerH = H - mTop  - mBottom;

    var xLabels   = opts.xLabels   || [];
    var yLabel    = opts.yLabel    || 'GWh';
    var lineColor = opts.color     || '#60a5fa';
    var fillBelow = opts.fillBelow || false;
    var refLines  = opts.refLines  || [];
    var n         = points.length;

    while (svgElement.firstChild) svgElement.removeChild(svgElement.firstChild);

    svgElement.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    /* Compute domain — include ref line values so they're always in range */
    var allVals = points.slice();
    refLines.forEach(function (rl) { if (rl.y !== undefined) allVals.push(rl.y); });
    var bounds = dataBounds(allVals, 0.12);
    if (bounds.max === 0) { bounds.max = 10; }

    /* Absolute coordinate helpers */
    function absPy(v) {
      var range = bounds.max - bounds.min;
      if (range === 0) return mTop + innerH / 2;
      return mTop + innerH - ((v - bounds.min) / range) * innerH;
    }
    function absPx(idx) {
      if (n <= 1) return mLeft;
      return mLeft + (idx / (n - 1)) * innerW;
    }

    /* Y grid + tick labels */
    var yTicks = 5;
    for (var ti = 0; ti <= yTicks; ti++) {
      var tv   = bounds.min + (ti / yTicks) * (bounds.max - bounds.min);
      var tyPx = absPy(tv);
      svgElement.appendChild(svgEl('line', {
        x1: mLeft, x2: mLeft + innerW, y1: tyPx, y2: tyPx,
        stroke: 'rgba(148,163,184,0.15)', 'stroke-width': '1'
      }));
      var tyText = svgEl('text', {
        x: mLeft - 8, y: tyPx + 4,
        fill: 'var(--pjg-text3,#64748b)', 'font-size': '10',
        'text-anchor': 'end', 'font-family': 'monospace'
      });
      tyText.textContent = Math.round(tv);
      svgElement.appendChild(tyText);
    }

    /* Y axis rotated label */
    var yLblCx = mLeft - 36;
    var yLblCy = mTop + innerH / 2;
    var yLblEl2 = svgEl('text', {
      x: yLblCx, y: yLblCy,
      fill: 'var(--pjg-text3,#64748b)', 'font-size': '11',
      'text-anchor': 'middle', 'font-family': "'Inter',sans-serif",
      transform: 'rotate(-90,' + yLblCx + ',' + yLblCy + ')'
    });
    yLblEl2.textContent = yLabel;
    svgElement.appendChild(yLblEl2);

    /* Reference lines — label at RIGHT EDGE, anti-overlap nudge */
    var sortedRefs = refLines.slice().map(function (rl) {
      return { rl: rl, lineY: absPy(rl.y) };
    }).sort(function (a, b) { return a.lineY - b.lineY; });

    var prevLabelY = null;
    for (var ri = 0; ri < sortedRefs.length; ri++) {
      var entry  = sortedRefs[ri];
      var rl     = entry.rl;
      var ryPx   = entry.lineY;
      var labelY = ryPx;

      if (prevLabelY !== null && labelY - prevLabelY < 14) {
        labelY = prevLabelY + 14;
      }
      prevLabelY = labelY;

      svgElement.appendChild(svgEl('line', {
        x1: mLeft, x2: mLeft + innerW, y1: ryPx, y2: ryPx,
        stroke: rl.color || '#f87171',
        'stroke-width': '1',
        'stroke-dasharray': rl.dash || '4 3'
      }));

      if (rl.label) {
        var pillW = rl.label.length * 6.2 + 8;
        svgElement.appendChild(svgEl('rect', {
          x: mLeft + innerW + 4,
          y: labelY - 8,
          width: pillW, height: 13,
          rx: '3',
          fill: rl.color || '#f87171',
          'fill-opacity': '0.18',
          stroke: rl.color || '#f87171',
          'stroke-opacity': '0.4',
          'stroke-width': '1'
        }));
        var rlText = svgEl('text', {
          x: mLeft + innerW + 6,
          y: labelY + 2,
          fill: rl.color || '#f87171',
          'font-size': '10',
          'font-weight': '600',
          'text-anchor': 'start',
          'font-family': "'Inter',sans-serif"
        });
        rlText.textContent = rl.label;
        svgElement.appendChild(rlText);
      }
    }

    /* Data point coordinates */
    var xs = [], ys = [];
    for (var xi = 0; xi < n; xi++) {
      xs.push(absPx(xi));
      ys.push(absPy(points[xi] || 0));
    }

    /* Fill below with linearGradient */
    if (fillBelow) {
      var gradId = 'pjg-lfill-' + Math.floor(Math.random() * 0xffff).toString(16);
      var defs   = svgEl('defs', {});
      var grad   = svgEl('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' });
      var stop1  = svgEl('stop', { offset: '0%',   'stop-color': lineColor, 'stop-opacity': '0.4' });
      var stop2  = svgEl('stop', { offset: '100%', 'stop-color': lineColor, 'stop-opacity': '0'   });
      grad.appendChild(stop1);
      grad.appendChild(stop2);
      defs.appendChild(grad);
      svgElement.appendChild(defs);

      var bottom = mTop + innerH;
      var areaD  = 'M ' + xs[0] + ' ' + bottom;
      for (var ai = 0; ai < n; ai++) { areaD += ' L ' + xs[ai] + ' ' + ys[ai]; }
      areaD += ' L ' + xs[n - 1] + ' ' + bottom + ' Z';
      svgElement.appendChild(svgEl('path', {
        d: areaD, fill: 'url(#' + gradId + ')', stroke: 'none'
      }));
    }

    /* Main line */
    svgElement.appendChild(svgEl('polyline', {
      points: xs.map(function (x, i) { return x + ',' + ys[i]; }).join(' '),
      fill: 'none',
      stroke: lineColor,
      'stroke-width': '2.5',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }));

    /* X-axis labels (non-empty only) */
    for (var xl2 = 0; xl2 < n; xl2++) {
      var lbl2 = xLabels[xl2];
      if (lbl2 === undefined || lbl2 === null || lbl2 === '') continue;
      var xTxt2 = svgEl('text', {
        x: absPx(xl2), y: mTop + innerH + 18,
        fill: 'var(--pjg-text3,#64748b)', 'font-size': '10',
        'text-anchor': 'middle', 'font-family': "'Inter',sans-serif"
      });
      xTxt2.textContent = String(lbl2);
      svgElement.appendChild(xTxt2);
    }
  }

  /**
   * Internal multi-line variant (legacy / opts.multiLine=true).
   * @private
   */
  function _renderMultiLineSVG(svgElement, lines, opts) {
    opts = opts || {};
    var W    = opts.width  || 960;
    var H    = opts.height || 280;
    var padL = opts.padL   !== undefined ? opts.padL : 60;
    var padR = opts.padR   !== undefined ? opts.padR : 20;
    var padT = opts.padT   !== undefined ? opts.padT : 20;
    var padB = opts.padB   !== undefined ? opts.padB : 48;
    var xLabels = opts.xLabels || [];
    var yLabel  = opts.yLabel  || 'GWh';

    while (svgElement.firstChild) svgElement.removeChild(svgElement.firstChild);
    if (!lines || !lines.length) return;

    svgElement.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    var n = lines[0].values.length;
    var allVals = [];
    lines.forEach(function (l) { allVals = allVals.concat(l.values); });
    var bounds = dataBounds(allVals, 0.12);

    var xs = [];
    for (var xi = 0; xi < n; xi++) { xs.push(toX(xi, n, W, padL, padR)); }

    var chartBottom = H - padB + 12;

    /* Grid */
    var yTicks = 5;
    for (var t = 0; t <= yTicks; t++) {
      var yVal = (t / yTicks) * bounds.max;
      var yPx  = toY(yVal, bounds.min, bounds.max, H, padT + (padB - 12));
      svgElement.appendChild(svgEl('line', {
        x1: padL, x2: W - padR, y1: yPx, y2: yPx,
        stroke: 'rgba(148,163,184,0.15)', 'stroke-width': '1'
      }));
      var yText = svgEl('text', {
        x: padL - 8, y: yPx + 4,
        fill: '#64748b', 'font-size': '11', 'text-anchor': 'end',
        'font-family': "'JetBrains Mono', monospace"
      });
      yText.textContent = Math.round(yVal);
      svgElement.appendChild(yText);
    }

    var yLblEl = svgEl('text', {
      x: 14, y: H / 2,
      fill: '#64748b', 'font-size': '11', 'text-anchor': 'middle',
      'font-family': "'Inter', sans-serif",
      transform: 'rotate(-90, 14, ' + (H / 2) + ')'
    });
    yLblEl.textContent = yLabel;
    svgElement.appendChild(yLblEl);

    /* Lines */
    lines.forEach(function (line) {
      var ys = line.values.map(function (v) {
        return toY(v, bounds.min, bounds.max, H, padT + (padB - 12));
      });
      svgElement.appendChild(svgEl('path', {
        d: buildLinePath(xs, ys),
        fill: 'none',
        stroke: line.color,
        'stroke-width': '2.5',
        'stroke-dasharray': line.dash || 'none',
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round'
      }));
      svgElement.appendChild(svgEl('circle', {
        cx: xs[n - 1], cy: ys[n - 1], r: '5',
        fill: line.color, opacity: '0.9'
      }));
    });

    /* X ticks */
    for (var xi2 = 0; xi2 < n; xi2++) {
      svgElement.appendChild(svgEl('line', {
        x1: xs[xi2], x2: xs[xi2],
        y1: chartBottom, y2: chartBottom + 6,
        stroke: '#475569', 'stroke-width': '1'
      }));
      if (xLabels[xi2] !== undefined) {
        var xText = svgEl('text', {
          x: xs[xi2], y: chartBottom + 18,
          fill: '#64748b', 'font-size': '11', 'text-anchor': 'middle',
          'font-family': "'Inter', sans-serif"
        });
        xText.textContent = String(xLabels[xi2]);
        svgElement.appendChild(xText);
      }
    }

    /* Legend */
    var legendY = H - 10;
    lines.forEach(function (line, idx) {
      var lx = padL + idx * 140;
      svgElement.appendChild(svgEl('line', {
        x1: lx, x2: lx + 20, y1: legendY - 4, y2: legendY - 4,
        stroke: line.color, 'stroke-width': '2.5',
        'stroke-dasharray': line.dash || 'none'
      }));
      var lText = svgEl('text', {
        x: lx + 26, y: legendY,
        fill: '#94a3b8', 'font-size': '10',
        'font-family': "'Inter', sans-serif"
      });
      lText.textContent = line.label;
      svgElement.appendChild(lText);
    });
  }

  /* =========================================================
   * BAR SEGMENT (horizontal stacked bar — inline helper)
   * ========================================================= */

  /**
   * Determine whether a hex colour is perceptually light (luminance > 0.6).
   * Used to pick contrasting foreground text inside bar segments.
   * @param {string} hex  e.g. '#facc15'
   * @returns {boolean}
   * @private
   */
  function _isLight(hex) {
    if (!hex || hex[0] !== '#') return false;
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return false;
    var r = parseInt(h.substr(0, 2), 16) / 255;
    var g = parseInt(h.substr(2, 2), 16) / 255;
    var b = parseInt(h.substr(4, 2), 16) / 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 0.6;
  }

  /**
   * Render a horizontal stacked bar with an optional legend row.
   * Two-row layout: bar row + legend row beneath.
   *
   * @param {HTMLElement} container  cleared and filled
   * @param {Array<{id:string, label:string, color:string, pct:number, mw:number}>} segments
   * @param {Object} [opts]
   *   @param {boolean} [opts.showLegend=true]
   *   @param {number}  [opts.height=30]  bar height in px
   */
  function renderBarSegment(container, segments, opts) {
    if (!container) { warn('renderBarSegment: container is null'); return; }
    if (!segments || !segments.length) { warn('renderBarSegment: segments is empty'); return; }
    opts = opts || {};
    var barH       = opts.height !== undefined ? opts.height : 30;
    var showLegend = opts.showLegend !== false;

    container.innerHTML = '';

    var total = 0;
    segments.forEach(function (s) { total += (s.pct || 0); });
    if (total === 0) return;

    /* --- Bar row --- */
    var barRow = document.createElement('div');
    barRow.className = 'pjg-bar-row';
    barRow.style.cssText = [
      'display:flex',
      'height:' + barH + 'px',
      'border-radius:6px',
      'overflow:hidden'
    ].join(';');

    segments.forEach(function (seg) {
      var segPct = seg.pct || 0;
      var flexVal = segPct / total;

      var segDiv = document.createElement('div');
      segDiv.className  = 'pjg-bar-seg';
      if (seg.id) segDiv.setAttribute('data-fuel-id', seg.id);
      segDiv.style.cssText = [
        'flex-grow:' + flexVal.toFixed(6),
        'background:' + seg.color,
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'position:relative',
        'overflow:hidden'
      ].join(';');
      segDiv.title = seg.label + ': ' + segPct + '% (' + (seg.mw || 0) + ' GW)';

      /* Inline label — only when segment is wide enough */
      if (segPct >= 5) {
        var span = document.createElement('span');
        span.className = 'pjg-bar-seg-label';
        span.textContent = seg.label + ' ' + segPct + '%';
        span.style.cssText = [
          'color:' + (_isLight(seg.color) ? '#0f172a' : '#fff'),
          'font-size:10px',
          'font-weight:700',
          'white-space:nowrap',
          'overflow:hidden',
          'text-overflow:ellipsis',
          'padding:0 3px',
          'pointer-events:none'
        ].join(';');
        segDiv.appendChild(span);
      }

      barRow.appendChild(segDiv);
    });

    container.appendChild(barRow);

    /* --- Legend row --- */
    if (showLegend) {
      var legendRow = document.createElement('div');
      legendRow.className = 'pjg-bar-legend';
      legendRow.style.cssText = [
        'display:flex',
        'flex-wrap:wrap',
        'gap:0.6rem',
        'margin-top:0.55rem',
        'font-size:0.78rem'
      ].join(';');

      segments.forEach(function (seg) {
        var item = document.createElement('span');
        item.className = 'pjg-bar-legend-item';
        item.style.cssText = 'display:inline-flex;align-items:center;';

        var swatch = document.createElement('span');
        swatch.className = 'pjg-bar-legend-swatch';
        swatch.style.cssText = [
          'display:inline-block',
          'width:10px',
          'height:10px',
          'border-radius:2px',
          'vertical-align:middle',
          'margin-right:4px',
          'flex-shrink:0',
          'background:' + seg.color
        ].join(';');

        var lblSpan = document.createElement('span');
        lblSpan.textContent = seg.label;
        item.appendChild(swatch);
        item.appendChild(lblSpan);
        legendRow.appendChild(item);
      });

      container.appendChild(legendRow);
    }
  }

  /* =========================================================
   * BREAKDOWN TABLE RENDERER
   * ========================================================= */

  /**
   * Populate a <table> element with thead + tbody from rows + column definitions.
   * Also accepts a bare <tbody> for backward compatibility.
   *
   * @param {HTMLElement} tableEl  Target <table> or <tbody> — cleared and repopulated.
   * @param {Object[]}    rows     Array of data objects.
   * @param {Array<{key:string, label:string, format?:function, fmt?:function, numeric?:boolean}>} columns
   *   format(v) (or legacy fmt(v)) defaults to String(v).
   */
  function renderBreakdownTable(tableEl, rows, columns) {
    if (!tableEl) { warn('renderBreakdownTable: tableEl is null'); return; }
    if (!rows)    { rows = []; }
    if (!columns || !columns.length) { warn('renderBreakdownTable: columns is empty'); return; }

    while (tableEl.firstChild) tableEl.removeChild(tableEl.firstChild);

    var isTable = tableEl.tagName && tableEl.tagName.toLowerCase() === 'table';

    if (isTable) {
      /* Build thead */
      var thead = document.createElement('thead');
      var hr    = document.createElement('tr');
      columns.forEach(function (col) {
        var th = document.createElement('th');
        th.textContent = col.label || col.key;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      tableEl.appendChild(thead);
    }

    /* Build tbody */
    var tbody = document.createElement('tbody');
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      columns.forEach(function (col) {
        var td  = document.createElement('td');
        if (col.numeric) td.className = 'num';
        var val = row[col.key];
        var fmt = col.format || col.fmt;
        td.textContent = (val !== undefined && val !== null)
          ? (typeof fmt === 'function' ? fmt(val) : String(val))
          : '—';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
  }

  /* =========================================================
   * CSV DOWNLOAD
   * ========================================================= */

  /**
   * Trigger a CSV file download in the browser.
   *
   * @param {string}   filename  e.g. 'pln-java-bali-annual.csv'
   * @param {Object[]} rows
   * @param {Array<{key:string, label:string, fmt?:function}>} columns
   */
  function csvDownload(filename, rows, columns) {
    var lines = [];
    // Header
    lines.push(columns.map(function (c) { return '"' + c.label + '"'; }).join(','));
    // Rows
    rows.forEach(function (row) {
      var cells = columns.map(function (col) {
        var val = row[col.key];
        var str = col.fmt ? col.fmt(val) : (val !== undefined && val !== null ? String(val) : '');
        return '"' + String(str).replace(/"/g, '""') + '"';
      });
      lines.push(cells.join(','));
    });

    var csv  = lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* =========================================================
   * EXPORT
   * ========================================================= */

  win.PLN_ENERGY_DASHBOARD = {
    renderProvinceChoropleth: renderProvinceChoropleth,
    addChoroplethLegend:      addChoroplethLegend,
    addChoroplethToggleButton: addChoroplethToggleButton,
    renderStackedAreaSVG:     renderStackedAreaSVG,
    renderLineSVG:            renderLineSVG,
    renderBarSegment:         renderBarSegment,
    renderBreakdownTable:     renderBreakdownTable,
    csvDownload:              csvDownload,
    /* Exposed utilities for testing */
    _utilColor:               utilColor,
    _fmtNum:                  fmtNum
  };

}(typeof window !== 'undefined' ? window : this));
