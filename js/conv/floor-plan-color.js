/*
 * floor-plan-color.js — window.RZFloorPlanColor: the OKLCH arithmetic of js/conv/floor-plan.js (split out of it so each file
 * stays under 800 lines, PRD-DATAHALL-BMS-ISO). parseColor(css) -> [r,g,b]; rgbToOklch([r,g,b]) -> {L,C,h};
 * oklchHex(L, C, h) -> '#rrggbb' with chroma reduced (never clipped per channel) until it fits sRGB. Load it BEFORE
 * floor-plan.js. ES5, no state.
 */
(function (global) {
  'use strict';
  if (global.RZFloorPlanColor) return;
  function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function fromLin(c) { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, c)) * 255); }
  function parseColor(s) {
    s = String(s || '').replace(/^\s+|\s+$/g, '');
    var m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) { var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) { var t = m[1]; return [parseInt(t.charAt(0) + t.charAt(0), 16), parseInt(t.charAt(1) + t.charAt(1), 16), parseInt(t.charAt(2) + t.charAt(2), 16)]; }
    m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(s);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
  }
  function cbrt(x) { return x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3); }
  function rgbToOklch(rgb) {
    var r = toLin(rgb[0]), g = toLin(rgb[1]), b = toLin(rgb[2]);
    var l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    var a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    var bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    var h = Math.atan2(bb, a) * 180 / Math.PI;
    return { L: L, C: Math.sqrt(a * a + bb * bb), h: h < 0 ? h + 360 : h };
  }
  function oklchToLin(L, C, h) {
    var a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    var s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  function inGamut(v) { return v[0] >= -0.0005 && v[0] <= 1.0005 && v[1] >= -0.0005 && v[1] <= 1.0005 && v[2] >= -0.0005 && v[2] <= 1.0005; }
  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16); }
  /* L and hue are kept; chroma is reduced until the colour fits sRGB (never clipped per channel, which shifts hue). */
  function oklchHex(L, C, h) {
    var lo = 0, hi = C, v = oklchToLin(L, C, h);
    if (!inGamut(v)) {
      for (var i = 0; i < 24; i++) { var mid = (lo + hi) / 2; if (inGamut(oklchToLin(L, mid, h))) lo = mid; else hi = mid; }
      v = oklchToLin(L, lo, h);
    }
    return '#' + hex2(fromLin(v[0])) + hex2(fromLin(v[1])) + hex2(fromLin(v[2]));
  }

  global.RZFloorPlanColor = { parseColor: parseColor, rgbToOklch: rgbToOklch, oklchHex: oklchHex };
})(window);
