/**
 * @file pln-energy-dashboard.js
 * @module PLN_ENERGY_DASHBOARD
 * @version 2026-05-01-v2
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
   * Utilization colour ramp (electricitymaps.com brown-gradient style).
   * Thresholds tested high-to-low; first match wins.
   */
  var UTIL_RAMP = [
    [150, '#450a0a'],
    [100, '#7c2d12'],
    [80,  '#92400e'],
    [60,  '#d97706'],
    [40,  '#fbbf24'],
    [20,  '#fde68a'],
    [0,   '#fef3c7']
  ];

  var LEGEND_ENTRIES = [
    { label: '0 – 20 %',    color: '#fef3c7' },
    { label: '20 – 40 %',   color: '#fde68a' },
    { label: '40 – 60 %',   color: '#fbbf24' },
    { label: '60 – 80 %',   color: '#d97706' },
    { label: '80 – 100 %',  color: '#92400e' },
    { label: '100 – 150 %', color: '#7c2d12' },
    { label: '150 %+',      color: '#450a0a' }
  ];

  function warn(msg) {
    if (win.console && win.console.warn) {
      win.console.warn('[PLN_ENERGY_DASHBOARD] ' + msg);
    }
  }

  /** Pick fill colour for a utilization percentage. */
  function utilColor(pct) {
    var p = +pct || 0;
    for (var i = 0; i < UTIL_RAMP.length; i++) {
      if (p >= UTIL_RAMP[i][0]) { return UTIL_RAMP[i][1]; }
    }
    return UTIL_RAMP[UTIL_RAMP.length - 1][1];
  }

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
            var util = agg.utilizationPct !== undefined ? agg.utilizationPct : 0;
            return {
              fillColor:   utilColor(util),
              fillOpacity: 0.35,
              weight:      1,
              color:       '#1e293b'
            };
          },
          onEachFeature: function (feature, lyr) {
            var props    = feature.properties || {};
            var prov     = props.prov  || '';
            var label    = props.label || prov;
            var agg      = provinceData[prov] || {};
            var util     = agg.utilizationPct !== undefined ? fmtNum(agg.utilizationPct, 1) : '—';
            var peakMW   = agg.peakMW        !== undefined ? fmtNum(agg.peakMW, 0)         : '—';
            var instMW   = agg.installedMW   !== undefined ? fmtNum(agg.installedMW, 0)    : '—';
            var stations = agg.stations      !== undefined ? fmtNum(agg.stations, 0)        : '—';
            var plants   = agg.plants        !== undefined ? fmtNum(agg.plants, 0)          : '—';

            lyr.bindPopup(
              '<strong>' + escHtml(label) + '</strong><br>' +
              'Peak: '        + peakMW   + ' MW<br>' +
              'Installed: '   + instMW   + ' MW<br>' +
              'Utilization: ' + util     + '%<br>'   +
              'Stations: '    + stations + '<br>'    +
              'Plants: '      + plants
            );
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
        'border-radius:6px',
        'padding:8px 12px',
        'font-size:11px',
        'line-height:1.6',
        'color:#f1f5f9',
        'min-width:130px'
      ].join(';');

      var title = document.createElement('div');
      title.style.cssText = 'font-weight:700;margin-bottom:6px;font-size:12px;';
      title.textContent = 'Utilization %';
      div.appendChild(title);

      for (var i = 0; i < LEGEND_ENTRIES.length; i++) {
        var entry  = LEGEND_ENTRIES[i];
        var row    = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0;';

        var swatch = document.createElement('span');
        swatch.style.cssText = [
          'display:inline-block',
          'width:14px', 'height:14px',
          'border-radius:2px',
          'flex-shrink:0',
          'background:' + entry.color
        ].join(';');

        var lbl = document.createElement('span');
        lbl.textContent = entry.label;

        row.appendChild(swatch);
        row.appendChild(lbl);
        div.appendChild(row);
      }
      return div;
    };

    ctrl.addTo(map);
    return ctrl;
  }

  /* =========================================================
   * STACKED AREA SVG
   * ========================================================= */

  /**
   * Render a stacked area chart into an SVG element.
   *
   * @param {SVGElement} svgEl   target SVG (cleared before render)
   * @param {Array<{label:string, color:string, values:number[]}>} series
   *   Ordered bottom-to-top. Each series.values array must be same length.
   * @param {Object} opts
   *   @param {number}   [opts.width=960]
   *   @param {number}   [opts.height=400]
   *   @param {string[]} [opts.xLabels]        labels for x-axis ticks
   *   @param {string}   [opts.yLabel='TWh']
   *   @param {Object}   [opts.overlayLine]    { values:number[], label:string, color:string }
   *   @param {number}   [opts.padL=60]
   *   @param {number}   [opts.padR=20]
   *   @param {number}   [opts.padT=20]
   *   @param {number}   [opts.padB=48]
   */
  function renderStackedAreaSVG(svgElement, series, opts) {
    opts = opts || {};
    var W    = opts.width  || 960;
    var H    = opts.height || 400;
    var padL = opts.padL   !== undefined ? opts.padL : 60;
    var padR = opts.padR   !== undefined ? opts.padR : 20;
    var padT = opts.padT   !== undefined ? opts.padT : 20;
    var padB = opts.padB   !== undefined ? opts.padB : 48;
    var xLabels  = opts.xLabels  || [];
    var yLabel   = opts.yLabel   || 'TWh';
    var overlay  = opts.overlayLine || null;

    // Clear
    while (svgElement.firstChild) svgElement.removeChild(svgElement.firstChild);

    if (!series || !series.length || !series[0].values.length) return;

    var n = series[0].values.length;

    // Build stacked totals (for y-axis scale)
    var stackedTotals = [];
    for (var i = 0; i < n; i++) {
      var total = 0;
      series.forEach(function (s) { total += (s.values[i] || 0); });
      stackedTotals.push(total);
    }

    // Combine with overlay to find max
    var allMax = stackedTotals.slice();
    if (overlay && overlay.values) {
      overlay.values.forEach(function (v) { allMax.push(v); });
    }
    var bounds = dataBounds(allMax, 0.10);

    // x-coordinates
    var xs = [];
    for (var xi = 0; xi < n; xi++) {
      xs.push(toX(xi, n, W, padL, padR));
    }

    // Y grid lines
    var yTicks = 5;
    var yTickStep = bounds.max / yTicks;
    for (var t = 0; t <= yTicks; t++) {
      var yVal = t * yTickStep;
      var yPx  = toY(yVal, bounds.min, bounds.max, H, padT + (padB - 12));
      // grid line
      var gLine = svgEl('line', {
        x1: padL, x2: W - padR, y1: yPx, y2: yPx,
        stroke: 'rgba(148,163,184,0.15)', 'stroke-width': '1'
      });
      svgElement.appendChild(gLine);
      // y label
      var yText = svgEl('text', {
        x: padL - 8, y: yPx + 4,
        fill: '#64748b', 'font-size': '11', 'text-anchor': 'end',
        'font-family': "'JetBrains Mono', monospace"
      });
      yText.textContent = Math.round(yVal);
      svgElement.appendChild(yText);
    }

    // Y axis label
    var yLabelEl = svgEl('text', {
      x: 14, y: H / 2,
      fill: '#64748b', 'font-size': '11', 'text-anchor': 'middle',
      'font-family': "'Inter', sans-serif",
      transform: 'rotate(-90, 14, ' + (H / 2) + ')'
    });
    yLabelEl.textContent = yLabel;
    svgElement.appendChild(yLabelEl);

    // Build stacked areas (bottom-to-top accumulation)
    var stackBase = new Array(n).fill(0);

    series.forEach(function (s) {
      var stackedTops = [];
      for (var i = 0; i < n; i++) {
        stackBase[i] += (s.values[i] || 0);
        stackedTops.push(toY(stackBase[i], bounds.min, bounds.max, H, padT + (padB - 12)));
      }
      // bottoms: current stack minus current series
      var bottoms = [];
      for (var j = 0; j < n; j++) {
        var base = stackBase[j] - (s.values[j] || 0);
        bottoms.push(toY(base, bounds.min, bounds.max, H, padT + (padB - 12)));
      }

      var pathD = buildAreaPath(xs, stackedTops, bottoms);
      var areaPath = svgEl('path', {
        d: pathD,
        fill: s.color,
        opacity: '0.82',
        stroke: 'none'
      });
      svgElement.appendChild(areaPath);
    });

    // Overlay line (demand)
    if (overlay && overlay.values && overlay.values.length === n) {
      var olYs = overlay.values.map(function (v) {
        return toY(v, bounds.min, bounds.max, H, padT + (padB - 12));
      });
      var linePath = svgEl('path', {
        d: buildLinePath(xs, olYs),
        fill: 'none',
        stroke: overlay.color || '#ffffff',
        'stroke-width': '2.5',
        'stroke-dasharray': '6 3',
        opacity: '0.9'
      });
      svgElement.appendChild(linePath);
      // Overlay label at last point
      var olLabel = svgEl('text', {
        x: xs[n - 1] + 6,
        y: olYs[n - 1],
        fill: overlay.color || '#ffffff',
        'font-size': '11',
        'font-family': "'Inter', sans-serif",
        'dominant-baseline': 'middle'
      });
      olLabel.textContent = overlay.label || 'Demand';
      svgElement.appendChild(olLabel);
    }

    // X-axis ticks and labels
    for (var xi2 = 0; xi2 < n; xi2++) {
      var xPos = xs[xi2];
      var tickLine = svgEl('line', {
        x1: xPos, x2: xPos,
        y1: H - padB + 12, y2: H - padB + 18,
        stroke: '#475569', 'stroke-width': '1'
      });
      svgElement.appendChild(tickLine);

      if (xLabels[xi2] !== undefined) {
        var xText = svgEl('text', {
          x: xPos, y: H - padB + 30,
          fill: '#64748b', 'font-size': '11', 'text-anchor': 'middle',
          'font-family': "'Inter', sans-serif"
        });
        xText.textContent = String(xLabels[xi2]);
        svgElement.appendChild(xText);
      }
    }

    // Legend (bottom)
    var legendX = padL;
    var legendY = H - 10;
    series.slice().reverse().forEach(function (s, idx) {
      var lx = legendX + idx * 110;
      if (lx + 100 > W) return; // overflow protection
      var dot = svgEl('rect', {
        x: lx, y: legendY - 8, width: 12, height: 8,
        fill: s.color, rx: '2', opacity: '0.85'
      });
      svgElement.appendChild(dot);
      var lText = svgEl('text', {
        x: lx + 16, y: legendY,
        fill: '#94a3b8', 'font-size': '10',
        'font-family': "'Inter', sans-serif"
      });
      lText.textContent = s.label;
      svgElement.appendChild(lText);
    });
  }

  /* =========================================================
   * LINE SVG
   * ========================================================= */

  /**
   * Render a single-series line chart into an SVG element.
   * Accepts points as a flat number[] for the primary series.
   * Use opts.refLines for reference lines (e.g. carbon-intensity thresholds).
   *
   * For backward-compatible multi-line usage pass an array of
   * { label, color, values, dash? } objects as `points` and opts.multiLine=true.
   *
   * @param {SVGElement}  svgElement   Target SVG (cleared before render).
   * @param {number[]|Array<{label:string,color:string,values:number[],dash?:string}>} points
   *   Flat number[] for single-series; object array when opts.multiLine=true.
   * @param {Object} opts
   *   @param {number}   [opts.width=960]
   *   @param {number}   [opts.height=280]
   *   @param {string[]} [opts.xLabels]
   *   @param {string}   [opts.yLabel='GWh']
   *   @param {string}   [opts.color='#60a5fa']      Single-series stroke colour.
   *   @param {boolean}  [opts.fillBelow=false]       Fill below the line.
   *   @param {Array}    [opts.refLines]              [{y, label, color, dash}]
   *   @param {number}   [opts.padL=60]
   *   @param {number}   [opts.padR=20]
   *   @param {number}   [opts.padT=20]
   *   @param {number}   [opts.padB=48]
   *   @param {boolean}  [opts.multiLine=false]       Treat points as line-series array.
   */
  function renderLineSVG(svgElement, points, opts) {
    if (!svgElement) { warn('renderLineSVG: svgElement is null'); return; }
    if (!points || (Array.isArray(points) && !points.length)) { warn('renderLineSVG: points is empty'); return; }

    opts = opts || {};

    /* Detect multi-line mode (legacy or explicit) */
    var isMulti = opts.multiLine || (points.length > 0 && typeof points[0] === 'object' && points[0] !== null && !Array.isArray(points[0]) && points[0].values);
    if (isMulti) { return _renderMultiLineSVG(svgElement, points, opts); }

    var W    = opts.width  || 960;
    var H    = opts.height || 280;
    var padL = opts.padL   !== undefined ? opts.padL : 60;
    var padR = opts.padR   !== undefined ? opts.padR : 20;
    var padT = opts.padT   !== undefined ? opts.padT : 20;
    var padB = opts.padB   !== undefined ? opts.padB : 48;
    var xLabels   = opts.xLabels   || [];
    var yLabel    = opts.yLabel    || 'GWh';
    var lineColor = opts.color     || '#60a5fa';
    var fillBelow = opts.fillBelow || false;
    var refLines  = opts.refLines  || [];
    var n         = points.length;

    while (svgElement.firstChild) svgElement.removeChild(svgElement.firstChild);

    svgElement.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    /* Compute domain — include ref lines in scale */
    var allVals = points.slice();
    refLines.forEach(function (rl) { allVals.push(rl.y); });
    var bounds = dataBounds(allVals, 0.12);

    var xs = [];
    for (var xi = 0; xi < n; xi++) { xs.push(toX(xi, n, W, padL, padR)); }

    var chartBottom = H - padB + 12;

    /* Y grid */
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

    /* Y label */
    var yLblEl = svgEl('text', {
      x: 14, y: H / 2,
      fill: '#64748b', 'font-size': '11', 'text-anchor': 'middle',
      'font-family': "'Inter', sans-serif",
      transform: 'rotate(-90, 14, ' + (H / 2) + ')'
    });
    yLblEl.textContent = yLabel;
    svgElement.appendChild(yLblEl);

    /* Reference lines */
    for (var ri = 0; ri < refLines.length; ri++) {
      var rl   = refLines[ri];
      var ryPx = toY(rl.y, bounds.min, bounds.max, H, padT + (padB - 12));
      svgElement.appendChild(svgEl('line', {
        x1: padL, x2: W - padR, y1: ryPx, y2: ryPx,
        stroke: rl.color || '#f87171',
        'stroke-width': '1',
        'stroke-dasharray': rl.dash || '5 3'
      }));
      if (rl.label) {
        var rlText = svgEl('text', {
          x: padL + 4, y: ryPx - 3,
          fill: rl.color || '#f87171', 'font-size': '9'
        });
        rlText.textContent = rl.label;
        svgElement.appendChild(rlText);
      }
    }

    /* Point y-pixels */
    var ys = points.map(function (v) {
      return toY(v, bounds.min, bounds.max, H, padT + (padB - 12));
    });

    /* Fill below */
    if (fillBelow) {
      var fillPts = [padL + ',' + chartBottom];
      for (var fi = 0; fi < n; fi++) { fillPts.push(xs[fi] + ',' + ys[fi]); }
      fillPts.push((W - padR) + ',' + chartBottom);
      svgElement.appendChild(svgEl('polygon', {
        points: fillPts.join(' '),
        fill: lineColor, 'fill-opacity': '0.12'
      }));
    }

    /* Line */
    svgElement.appendChild(svgEl('path', {
      d: buildLinePath(xs, ys),
      fill: 'none',
      stroke: lineColor,
      'stroke-width': '2.5',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }));

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
   * Render a horizontal stacked bar into a container element.
   * Segments are rendered as coloured divs.
   *
   * @param {HTMLElement} container  cleared and filled
   * @param {Array<{label:string, color:string, pct:number}>} segments
   * @param {Object} [opts]
   *   @param {string} [opts.height='18px']
   *   @param {number} [opts.borderRadius=4]
   */
  function renderBarSegment(container, segments, opts) {
    if (!container) { warn('renderBarSegment: container is null'); return; }
    if (!segments || !segments.length) { warn('renderBarSegment: segments is empty'); return; }
    opts = opts || {};
    var h  = opts.height        || '18px';
    var br = opts.borderRadius  !== undefined ? opts.borderRadius : 4;

    while (container.firstChild) container.removeChild(container.firstChild);

    var total = 0;
    segments.forEach(function (s) { total += s.pct; });
    if (total === 0) return;

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;width:100%;height:' + h + ';border-radius:' + br + 'px;overflow:hidden;gap:1px;';

    segments.forEach(function (seg) {
      var portion = (seg.pct / total) * 100;
      var div = document.createElement('div');
      div.style.cssText = 'width:' + portion.toFixed(2) + '%;background:' + seg.color + ';';
      div.title = seg.label + ': ' + seg.pct.toFixed(1) + '%';
      bar.appendChild(div);
    });

    container.appendChild(bar);
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
