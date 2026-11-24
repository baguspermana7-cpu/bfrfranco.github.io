/*
 * rz-trend.js — window.RZTrend: the trend and multitrend modal (PRD-CONV-LIVING-PLANT §7 P2; ranges, bands, state header,
 * stats and the phone sheet from PRD-CONV-POINT-STATUS-TREND §4.3). A click on any number that is a point opens its
 * history; more points can be added to compare (up to 8 pens).
 *
 *   register(points, { provider })   points = [{ id, label, unit, base, amp, shape, digits, cls: 'SIM' | 'ENGINE', group,
 *                                  ref, refLabel, hi, lo }]
 *                      provider (optional) = { label, series(id, fromMs, toMs, stepMin) } -> Promise of [{ t, v }] or, for
 *                      long ranges, buckets [{ t, min, avg, max, n }] (drawn as a min–max band + the avg line; stats = min of
 *                      mins, max of maxes, mean of avgs weighted by n), or null = "no history here, use the local model".
 *                      A point without one uses the DEFAULT provider: the database (RZTrend.dbProvider, the Supabase RPC
 *                      conv_point_series, PRD-CONV-POINT-STATUS-TREND §5b) when Supabase is configured and the id is a
 *                      database point, else the local model (js/conv/history.js). A provider that rejects or takes > 4 s
 *                      turns THAT open to the local model for every pen, with the line "Database unreachable — local SIM
 *                      history" and the source "Local model (database unreachable)": one open never mixes two sources.
 *                      ref = the engine plane drawn as a dashed line; hi / lo = legacy alarm lines of a point that has no
 *                      registry limits. A point WITH registry limits (RZPointStatus.limits(id)) gets the normal / warning /
 *                      alarm bands and labelled limit lines from the registry instead (P-5: bands = registry).
 *   open(id, { trigger, range, pens, value, state })
 *                      opens with that point as pen 1. value = the number the page shows: the series' last point is
 *                      pinned to it (P-5) and the header shows it. state = the page's state ('ok' | 'warn' | 'alarm' or
 *                      { state, dir }); without it the header classifies the value.
 *   close(), isOpen(), state()     state() = { pens:[ids], range, cursor, mode: 'modal' | 'sheet' | 'phone' (no rz-sheet.js) } (a gate reads it)
 *   bind(root)         every [data-trend="<point id>"] under root opens its trend on click / tap / Enter / T; the
 *                      element's data-pt-value / data-pt-state (written by js/conv/point-status.js) are passed along.
 *   Ranges: 1H · 8H · 1D · 7D · 30D (RZConvHistory.RANGES), default 1D, remembered for the session, keys 1–5.
 *           Old links keep working: 5m and 1h -> 1H, 8h -> 8H, 24h -> 1D, 7d -> 7D.
 *   Phone (<= 600 px): the trend opens in the house bottom sheet (js/rz-sheet.js) at 88 % height, range bar sticky.
 *   Data: js/conv/history.js (deterministic, labelled SIMULATED). The clock is injectable (RZTrend.now) so a gate
 *   can pin it; nothing else reads the time.
 *   URL: pens and range live in the hash as #trend=<id>,<id>&r=<range>, so a multitrend can be shared and restored.
 *   Keyboard: Esc closes; Tab stays inside; 1–5 pick a range; arrow keys move the cursor; "+" focuses the series picker.
 */
(function (root) {
  'use strict';
  if (!root || !root.document) return;
  var doc = root.document, H = function () { return root.RZConvHistory; }, PS = function () { return root.RZPointStatus; };
  var KEYS = ['1H', '8H', '1D', '7D', '30D'];
  var FALLBACK = { '1H': [60, 1], '8H': [480, 2], '1D': [1440, 5], '7D': [10080, 30], '30D': [43200, 30] };
  var LEGACY = { '5m': '1H', '1h': '1H', '8h': '8H', '24h': '1D', '7d': '7D', '30d': '30D' };
  var NAMES = { '1H': 'Last hour', '8H': 'Last 8 hours', '1D': 'Last day', '7D': 'Last 7 days', '30D': 'Last 30 days' };
  var STORE = 'rz_trend_range';
  var POINTS = {}, ORDER = [], el = null, pens = [], range = '1D', cursorT = null, lastTrigger = null, inerted = [], showTable = false;
  var pinned = {}, headState = null, openFlag = false, mode = 'modal', sheet = null;
  var PROVIDERS = {}, FETCH = {}, openDown = false, openSeq = 0, TIMEOUT_MS = 4000;
  var DB_LABEL = 'Database · simulated samples every 5 min', DOWN_LABEL = 'Local model (database unreachable)', DOWN_LINE = 'Database unreachable — local SIM history';
  /* PRD-CONV-TREND-DESIGN §3.1: pen 1 is ink (state colour only where it is abnormal); compare pens use two validated slots
     that are >= 15 ΔE (OKLab x100) from every state token and from ink, with an end label as the second encoding (the pair is
     >= 19 ΔE apart, measured in tools/test-conv-trend-ranges.mjs D10). No amber, green, red, violet, pink or cyan: those mean state or are off the register. MAX_PENS follows. */
  var SLOT = ['#74a6f0', '#626266'], SLOT_LIGHT = ['#1f5fae', '#8a9099'], MAX_PENS = 1 + SLOT.length;
  var W = 720, Hh = 300, PAD = { l: 52, r: 64, t: 12, b: 34 };   /* W / Hh follow the plot's real width (draw): text stays 10 px on a phone */
  var WORD = { ok: 'Normal', warn: 'Warning', alarm: 'Alarm', info: 'Informational', none: 'No data' };
  var api = {};

  /* State colours are the tokens of css/conv-point.css (one source, PRD §4.1); without that file the state still reads by
     glyph and word. Motion (PRD-CONV-BMS-MOTION M2): opened or closed by POINTER, the modal fades and scales from .97
     (200 ms in, 160 ms out, opacity only under reduced motion); opened by Enter / t / a #trend= link or closed by Escape
     it stays instant (MOTION_STANDARD §1: a keyboard action never animates). The phone sheet moves the way
     js/rz-sheet.js moves. */
  var CSS = '' +
    '.rz-trend{position:fixed;inset:0;z-index:2147482100;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(5,6,8,.62)}' +
    '.rz-trend[hidden]{display:none}' +
    '.rz-trend.rz-trend--anim{transition:opacity 200ms var(--rz-ease-out,cubic-bezier(.23,1,.32,1))}' +
    '.rz-trend.rz-trend--anim .rz-trend-panel{transition:opacity 200ms var(--rz-ease-out,cubic-bezier(.23,1,.32,1)),transform 200ms var(--rz-ease-out,cubic-bezier(.23,1,.32,1))}' +
    '.rz-trend.rz-trend--from,.rz-trend.rz-trend--leave{opacity:0}' +
    '.rz-trend.rz-trend--from .rz-trend-panel,.rz-trend.rz-trend--leave .rz-trend-panel{opacity:0;transform:scale(.97)}' +
    '.rz-trend.rz-trend--leave,.rz-trend.rz-trend--leave .rz-trend-panel{transition-duration:160ms;pointer-events:none}' +
    '@media (prefers-reduced-motion:reduce){.rz-trend.rz-trend--from .rz-trend-panel,.rz-trend.rz-trend--leave .rz-trend-panel{transform:none}' +
    '.rz-trend.rz-trend--anim,.rz-trend.rz-trend--anim .rz-trend-panel{transition-duration:120ms}}' +
    '.rz-trend-panel{--tr-bg:#121316;--tr-panel:#191b1f;--tr-line:rgba(255,255,255,.12);--tr-text:#e8edf5;--tr-mute:#9aa4b2;--tr-acc:#E8B563;--tr-grid:rgba(255,255,255,.07);' +
      'background:var(--tr-bg);color:var(--tr-text);border:1px solid var(--tr-line);border-radius:4px;width:min(1040px,100%);max-height:calc(100vh - 28px);overflow:auto;font:13px/1.4 "IBM Plex Sans",system-ui,sans-serif}' +
    '[data-theme="light"] .rz-trend-panel{--tr-bg:#fff;--tr-panel:#f5f7fa;--tr-line:rgba(20,22,26,.14);--tr-text:#1b2430;--tr-mute:#4b5563;--tr-acc:#7A4800;--tr-grid:rgba(20,22,26,.08)}' +
    '.rz-trend-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid var(--tr-line)}' +
    '.rz-trend-id{min-width:0}' +
    '.rz-trend-head h2{margin:0 0 4px;font-size:14px;font-weight:600;color:var(--tr-mute)}' +
    '.rz-trend-now{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}' +
    '.rz-trend-val{font:600 24px/1.1 "IBM Plex Mono","JetBrains Mono",monospace;font-variant-numeric:tabular-nums}' +
    '.rz-trend-unit{font:13px "IBM Plex Mono","JetBrains Mono",monospace;color:var(--tr-mute);margin-left:-6px}' +
    '.rz-trend-stw{font-weight:600}' +
    '[data-tr-state="ok"]{color:var(--rz-pt-ok,inherit)}[data-tr-state="warn"]{color:var(--rz-pt-warn,inherit)}[data-tr-state="alarm"]{color:var(--rz-pt-alarm,inherit)}' +
    '.rz-trend-tag{display:block}' +
    '.rz-trend-info{position:relative;display:inline-grid;place-items:center;width:22px;height:22px;padding:0;border:1px solid var(--tr-line);border-radius:50%;background:transparent;color:var(--tr-mute);font:600 11px "IBM Plex Sans",system-ui,sans-serif;cursor:help;align-self:center}' +
    '.rz-trend-tip{display:none;position:absolute;left:0;top:28px;z-index:3;width:max-content;max-width:300px;padding:8px 10px;background:var(--tr-bg);border:1px solid var(--tr-line);border-radius:3px;color:var(--tr-text);font:12px/1.5 "IBM Plex Sans",system-ui,sans-serif;text-align:left;white-space:normal}' +
    '.rz-trend-info[aria-expanded="true"] .rz-trend-tip{display:block}@media (hover:hover){.rz-trend-info:hover .rz-trend-tip{display:block}}' +
    '.rz-trend-sim{font:600 9.5px/1.5 "IBM Plex Mono","JetBrains Mono",monospace;letter-spacing:.05em;border:1px solid var(--tr-line);color:var(--tr-mute);padding:0 5px;border-radius:2px;margin-left:8px;white-space:nowrap;display:inline-block}' +
    '.rz-trend-btn{min-height:32px;padding:4px 10px;border:1px solid var(--tr-line);background:transparent;color:var(--tr-text);border-radius:3px;font:inherit;cursor:pointer}' +
    '.rz-trend-btn:focus-visible,.rz-trend-add:focus-visible,.rz-trend-plot:focus-visible,.rz-trend-seg:focus-visible{outline:2px solid var(--tr-acc);outline-offset:1px}' +
    '@media (pointer:coarse){.rz-trend-btn,.rz-trend-seg,.rz-trend-add{min-height:44px}}' +
    '.rz-trend-tools{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--tr-line)}' +
    '.rz-trend-ranges{display:inline-flex;border:1px solid var(--tr-line);border-radius:3px;overflow:hidden}' +
    '.rz-trend-seg{min-width:52px;min-height:34px;padding:4px 12px;border:0;border-left:1px solid var(--tr-line);background:transparent;color:var(--tr-mute);font:600 12.5px "IBM Plex Mono","JetBrains Mono",monospace;cursor:pointer}' +
    '.rz-trend-seg:first-child{border-left:0}' +
    '.rz-trend-seg:hover{color:var(--tr-text)}' +
    '.rz-trend-seg[aria-pressed="true"]{background:var(--tr-panel);color:var(--tr-text);box-shadow:inset 0 -2px 0 var(--tr-acc)}' +
    '.rz-trend-gap{flex:1 1 auto}' +
    '.rz-trend-add{width:auto;flex:0 0 auto;min-height:34px;max-width:100%;padding:4px 8px;background:transparent;color:var(--tr-mute);border:1px solid transparent;border-radius:3px;font:inherit;cursor:pointer}.rz-trend-add:hover{color:var(--tr-text);border-color:var(--tr-line)}' +
    '.rz-trend-tb{min-height:34px;padding:4px 8px;border:1px solid transparent;background:transparent;color:var(--tr-mute);border-radius:3px;font:inherit;cursor:pointer}.rz-trend-tb:hover{color:var(--tr-text);border-color:var(--tr-line)}' +
    '.rz-trend-body{position:relative;padding:10px 14px 12px}' +
    '.rz-trend-hover{position:absolute;z-index:2;pointer-events:none;padding:6px 8px;background:var(--tr-bg);border:1px solid var(--tr-line);border-radius:3px;color:var(--tr-text);font:12px/1.5 "IBM Plex Mono","JetBrains Mono",monospace;white-space:nowrap}' +
    '.rz-trend-read{display:flex;justify-content:space-between;gap:10px;min-height:18px;margin:0 0 6px;color:var(--tr-mute);font:12px "IBM Plex Mono","JetBrains Mono",monospace;font-variant-numeric:tabular-nums}' +
    '.rz-trend-plot{display:block;width:100%;height:auto;touch-action:none;background:transparent}' +
    '.rz-trend-plot .grid{stroke:var(--tr-grid)}.rz-trend-plot .ax{fill:var(--tr-mute);font:10px "IBM Plex Mono","JetBrains Mono",monospace}' +
    '.rz-trend-plot .pen{fill:none;stroke-width:2;stroke-linejoin:round;vector-effect:non-scaling-stroke}.rz-trend-plot .pen-path{stroke:none}' +
    '.rz-trend-plot .pen-seg{fill:none;stroke-width:2;stroke-linejoin:round;vector-effect:non-scaling-stroke}' +
    '.rz-trend-plot .pen-seg[data-st="ok"],.rz-trend-plot .pen-seg[data-st="none"],.rz-trend-plot .pen-seg[data-st="info"]{stroke:var(--tr-text)}.rz-trend-plot .pen-seg[data-st="warn"]{stroke:var(--rz-pt-warn,var(--tr-text))}.rz-trend-plot .pen-seg[data-st="alarm"]{stroke:var(--rz-pt-alarm,var(--tr-text));stroke-width:2.5}' +
    '.rz-trend-plot .pen-now{stroke:var(--tr-mute);stroke-width:1.5;stroke-dasharray:2 3;vector-effect:non-scaling-stroke}' +
    '.rz-trend-plot .now{stroke:var(--tr-bg);stroke-width:2}.rz-trend-plot .now[data-st="ok"],.rz-trend-plot .now[data-st="none"],.rz-trend-plot .now[data-st="info"]{fill:var(--tr-text)}.rz-trend-plot .now[data-st="warn"]{fill:var(--rz-pt-warn,var(--tr-text))}.rz-trend-plot .now[data-st="alarm"]{fill:var(--rz-pt-alarm,var(--tr-text))}' +
    '.rz-trend-plot .rib[data-st="ok"],.rz-trend-plot .rib[data-st="none"]{fill:var(--tr-text);fill-opacity:.12}.rz-trend-plot .rib[data-st="warn"]{fill:var(--rz-pt-warn,var(--tr-text))}.rz-trend-plot .rib[data-st="alarm"]{fill:var(--rz-pt-alarm,var(--tr-text))}' +
    '.rz-trend-plot .ref{stroke:var(--tr-mute);stroke-opacity:.7}.rz-trend-plot .lim{stroke:var(--tr-text);stroke-opacity:.45}' +
    '.rz-trend-plot .band{stroke:none}.rz-trend-plot .band-ok{fill:var(--tr-text);fill-opacity:.05}' +
    '.rz-trend-plot .base{stroke:var(--tr-line)}' +
    '.rz-trend-plot .lline{stroke:var(--tr-text);stroke-width:1;stroke-opacity:.35;vector-effect:non-scaling-stroke}.rz-trend-plot .lline.alarm{stroke-opacity:.6}' +
    '.rz-trend-plot .llab,.rz-trend-plot .endlab,.rz-trend-plot .ref-lab{fill:var(--tr-mute);font:10px "IBM Plex Mono","JetBrains Mono",monospace}' +
    '.rz-trend-plot .cur{stroke:var(--tr-mute);stroke-opacity:.7}' +
    '.rz-trend-stats{margin:8px 0 0;color:var(--tr-mute);font-size:12px;line-height:1.6}' +
    '.rz-trend-stats b{font:500 12.5px "IBM Plex Mono","JetBrains Mono",monospace;font-variant-numeric:tabular-nums;color:var(--tr-text);white-space:nowrap}' +
    '.rz-trend-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}' +
    '.rz-trend-table th,.rz-trend-table td{padding:5px 6px;border-bottom:1px solid var(--tr-line);text-align:right;white-space:nowrap}' +
    '.rz-trend-table th:first-child,.rz-trend-table td:first-child{text-align:left;white-space:normal;min-width:150px}' +
    '.rz-trend-table th{color:var(--tr-mute);font-weight:600;font-size:11.5px}' +
    '.rz-trend-table td{font-family:"IBM Plex Mono","JetBrains Mono",monospace}.rz-trend-table td:first-child{font-family:inherit}' +
    '.rz-trend-sw{display:inline-block;width:18px;height:0;border-top:2px solid;margin-right:6px;vertical-align:middle}' +
    '.rz-trend-x{border:0;background:transparent;color:var(--tr-mute);cursor:pointer;font-size:15px;min-width:28px;min-height:28px}' +
    '.rz-trend-scroll{overflow-x:auto}.rz-trend-scroll[hidden]{display:none}' +
    '.rz-trend-note{margin:8px 0 0;color:var(--tr-mute);font-size:11.5px}' +
    '.rz-trend-down{margin:0 0 6px;color:var(--tr-text);font:600 12px "IBM Plex Mono","JetBrains Mono",monospace}' +
    '.rz-trend-plot .pen-band{stroke:none;fill-opacity:.18}.rz-trend-plot .rz-trend-wait{fill:var(--tr-mute);font:12px "IBM Plex Mono","JetBrains Mono",monospace}' +
    /* phone: the house sheet carries the panel; the range bar sticks under the grip */
    '.rz-trend.rz-trend--sheet{position:static;inset:auto;display:block;padding:0;background:none;z-index:auto}' +
    '.rz-trend--sheet .rz-trend-panel{border:0;border-radius:0;width:auto;max-height:none;overflow:visible;background:transparent}' +
    '.rz-trend--sheet .rz-trend-head{padding:0 0 10px}' +
    '.rz-trend--sheet .rz-trend-tools{position:sticky;top:-14px;z-index:2;margin:0;padding:8px 0;background:var(--rz-sheet-bg,var(--tr-bg))}' +
    '.rz-trend--sheet .rz-trend-body{padding:10px 0 4px}' +
    '.rz-trend.rz-trend--phone{align-items:flex-end;padding:0}' +
    '.rz-trend--phone .rz-trend-panel{height:88vh;max-height:88vh;border-radius:4px 4px 0 0;border-bottom:0}' +
    '.rz-trend--phone .rz-trend-tools{position:sticky;top:0;z-index:2;background:var(--tr-bg)}' +
    '@media (max-width:600px){' +
      '.rz-trend-ranges{display:flex;width:100%}.rz-trend-seg{flex:1 1 0;min-width:0;min-height:44px}' +
      '.rz-trend-btn,.rz-trend-add{min-height:44px}.rz-trend-gap{display:none}.rz-trend-add{flex:1 1 0;min-width:0;width:0}' +
      '.rz-trend-head{flex-wrap:wrap}.rz-trend-id{flex:1 1 0}.rz-trend-val{font-size:21px}.rz-trend-tb,.rz-trend-add,.rz-trend-btn{min-height:44px}.rz-trend-head{position:relative}.rz-trend-info{position:static}.rz-trend-tip{left:0;right:0;top:100%;width:auto;max-width:none}}' +
    '[data-trend]{cursor:pointer}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() { if (doc.getElementById('rz-trend-css')) return; var s = doc.createElement('style'); s.id = 'rz-trend-css'; s.textContent = CSS; doc.head.appendChild(s); }
  function light() { return doc.documentElement.getAttribute('data-theme') === 'light'; }
  function colour(i) { return i ? (light() ? SLOT_LIGHT : SLOT)[(i - 1) % SLOT.length] : 'var(--tr-text)'; }
  /* OD-8: the viewer's local time and the short name of its zone ("GMT+7"; "UTC" only for a UTC viewer) */
  function zoneName(t) {
    try { var z = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date(t)).filter(function (p) { return p.type === 'timeZoneName'; })[0]; if (z) return z.value; } catch (e) { /* old engine */ }
    var o = -new Date(t).getTimezoneOffset(); return 'UTC' + (o >= 0 ? '+' : '-') + Math.floor(Math.abs(o) / 60) + (Math.abs(o) % 60 ? ':' + ('0' + Math.abs(o) % 60).slice(-2) : '');
  }
  function localStamp(t) {
    var d = new Date(t), p = function (n) { return ('0' + n).slice(-2); };
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmt(v, d) { return v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function nowMin() { return Math.floor(api.now() / 60000); }
  function ranges() { return (H() && H().RANGES) || FALLBACK; }
  function normRange(r) {
    if (!r) return null; r = String(r);
    if (ranges()[r]) return r;
    if (ranges()[r.toUpperCase()]) return r.toUpperCase();
    return LEGACY[r.toLowerCase()] || null;
  }
  function remembered() { try { return normRange(root.sessionStorage.getItem(STORE)); } catch (e) { return null; } }
  function setRange(r) { range = r; try { root.sessionStorage.setItem(STORE, r); } catch (e) { /* private mode: the default stands */ } }
  function limitsOf(p) { var s = PS(); return s && s.limits ? s.limits(p.id) : null; }
  function evaluate(v, L, prev) {
    var s = PS(); if (s && s.evaluate) return s.evaluate(v, L, prev);
    return { state: isNum(v) ? (L ? 'ok' : 'info') : 'none', dir: null };
  }
  function digitsOf(p) { return typeof p.digits === 'number' ? p.digits : 1; }

  function register(points, opts) {
    var prov = opts && opts.provider && typeof opts.provider.series === 'function' ? opts.provider : null;
    (points || []).forEach(function (p) { if (!p || !p.id) return; if (!POINTS[p.id]) ORDER.push(p.id); POINTS[p.id] = p; PROVIDERS[p.id] = prov; });
  }

  /* ── series providers ─────────────────────────────────────────────────────────────────────────────────────────── */
  function supa() {
    if (root.rzSupa && root.rzSupa.ready) return root.rzSupa.ready;
    if (root._rzAuth && typeof root._rzAuth.ensureSupabase === 'function') return root._rzAuth.ensureSupabase();
    return Promise.resolve(null);
  }
  function dbConfigured() {
    if (root.rzSupa) return !!root.rzSupa.configured;
    var c = root.RZ_CONFIG;
    return !!(c && c.SUPABASE_URL && c.SUPABASE_ANON && root._rzAuth && typeof root._rzAuth.ensureSupabase === 'function');
  }
  /* the conv database reader is itself a provider: one code path for every source */
  var DB = {
    label: DB_LABEL,
    series: function (id, fromMs, toMs) {
      return supa().then(function (s) {
        if (!s || !s.configured || typeof s.convPointSeries !== 'function') throw new Error('database not configured');
        return s.convPointSeries(id, new Date(fromMs).toISOString(), new Date(toMs).toISOString());
      }).then(function (res) {
        if (!res || res.error || !Array.isArray(res.data)) throw new Error((res && res.error) || 'no answer');
        if (!res.data.length) return null;   /* not a database point (yet): the local model, no warning */
        return res.data.map(function (r) {
          var t = Date.parse(r.t);
          return r.v !== null && r.v !== undefined ? { t: t, v: +r.v } : { t: t, min: +r.v_min, max: +r.v_max, avg: +r.v_mean, n: +r.n };
        });
      });
    }
  };
  function providerFor(id) {
    if (PROVIDERS[id]) return PROVIDERS[id];
    if (!dbConfigured()) return null;
    var s = PS(), ids = s && s.dbIds ? s.dbIds() : null;
    return !ids || ids[id] ? DB : null;
  }
  function normalise(rows, fromMs, toMs) {
    var out = [], bucket = false;
    (rows || []).forEach(function (r) {
      if (!r) return;
      var t = typeof r.t === 'number' ? r.t : Date.parse(r.t);
      if (!isNum(t) || t < fromMs || t >= toMs) return;
      if (isNum(r.min) && isNum(r.max) && isNum(r.avg)) { bucket = true; out.push({ t: t, v: r.avg, min: r.min, max: r.max, avg: r.avg, n: isNum(r.n) && r.n > 0 ? r.n : 1 }); }
      else if (isNum(r.v)) out.push({ t: t, v: r.v });
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return { pts: out, bucket: bucket };
  }
  function fetchSeries(prov, p, fromMs, toMs, stepMin, k) {
    var seq = openSeq, settled = false, f = FETCH[k];
    function fin(fail) {
      if (settled) return; settled = true; clearTimeout(timer);
      if (fail) { delete FETCH[k]; if (seq === openSeq) openDown = true; }   /* a later open asks again */
      if (openFlag && seq === openSeq) draw();
    }
    var timer = setTimeout(function () { fin(true); }, TIMEOUT_MS);
    Promise.resolve().then(function () { return prov.series(p.id, fromMs, toMs, stepMin); }).then(function (rows) {
      if (settled) return;
      if (rows === null || rows === undefined) { f.state = 'none'; fin(false); return; }
      if (!Array.isArray(rows)) throw new Error('provider answered without rows');
      var n = normalise(rows, fromMs, toMs);
      f.state = 'done'; f.pts = n.pts; f.bucket = n.bucket; f.src = prov.label || 'Provider';
      fin(false);
    }).catch(function () { fin(true); });
  }
  function localSeries(p) { var r = ranges()[range], to = nowMin() + 1; return H().series(p, to - r[0], to, r[1]); }
  /* -> { pts, bucket, src: 'local' | 'down' | 'pending' | <provider label> } */
  function sourceOf(p) {
    var prov = openDown ? null : providerFor(p.id);
    if (!prov) return { pts: localSeries(p), bucket: false, src: openDown ? 'down' : 'local' };
    var r = ranges()[range], to = nowMin() + 1, k = p.id + '|' + range + '|' + to + '|' + (prov === DB ? 'db' : 'p'), f = FETCH[k];
    if (!f) { f = FETCH[k] = { state: 'pending' }; fetchSeries(prov, p, (to - r[0]) * 60000, to * 60000, r[1], k); }
    if (f.state === 'done') return { pts: f.pts.map(function (q) { var c = {}, x; for (x in q) c[x] = q[x]; return c; }), bucket: f.bucket, src: f.src };
    if (f.state === 'none') return { pts: localSeries(p), bucket: false, src: 'local' };
    return { pts: [], bucket: false, src: 'pending' };
  }
  function seriesOf(p, s) {
    s = s || sourceOf(p);
    var pts = s.pts, last = pts.length ? pts[pts.length - 1] : null, v = pinned[p.id];
    /* P-5: the trend ends on the number the page shows */
    if (isNum(v) && last) {
      if (s.bucket) pts[pts.length - 1] = { t: last.t, v: v, avg: v, min: Math.min(last.min, v), max: Math.max(last.max, v), n: last.n };
      else pts[pts.length - 1] = { t: last.t, v: v };
    }
    return pts;
  }
  /* stats of raw points, or of buckets: min of mins, max of maxes, mean of avgs weighted by n */
  function statsOf(d) {
    if (!d.bucket) return H().stats(d.pts);
    var n = 0, w = 0, sum = 0, mn = Infinity, mx = -Infinity;
    d.pts.forEach(function (q) { n++; w += q.n; sum += q.avg * q.n; if (q.min < mn) mn = q.min; if (q.max > mx) mx = q.max; });
    if (!n) return { n: 0, min: null, max: null, mean: null, last: null };
    return { n: n, min: mn, max: mx, mean: sum / w, last: d.pts[n - 1].v };
  }
  /* state of every sample, replayed with the deadband: time in warning / alarm and excursions (ok -> off) */
  function stateStats(pts, L) {
    var prev = null, w = 0, a = 0, ex = 0, i;
    if (!L || !pts.length) return null;
    for (i = 0; i < pts.length; i++) {
      var ev = evaluate(pts[i].v, L, prev);
      if (ev.state === 'warn') w++; else if (ev.state === 'alarm') a++;
      if ((ev.state === 'warn' || ev.state === 'alarm') && (!prev || prev.state === 'ok')) ex++;
      prev = ev;
    }
    return { warn: w / pts.length, alarm: a / pts.length, excursions: ex };
  }

  /* axes (PRD-CONV-TREND-DESIGN §3.3): one axis per unit, never two scales on one plot. Units after the first get their
     own panel below (small multiples). Each axis fits its DATA plus 10 % and snaps to nice ticks (1/2/2.5/5 x 10^n);
     a limit outside it is an edge marker, so a 2 K swing is never squeezed flat to show an alarm 20 K away. */
  function niceStep(span, n) {
    var r = span / n, p = Math.pow(10, Math.floor(Math.log10(r))), m = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < m.length; i++) if (m[i] * p >= r) return m[i] * p;
    return 10 * p;
  }
  function layout(data, h0, h1) {
    var units = [], ax = {};
    data.forEach(function (d) { if (units.indexOf(d.p.unit || '') < 0) units.push(d.p.unit || ''); });
    var gap = 14, ph = (h1 - h0 - gap * (units.length - 1)) / units.length;
    units.forEach(function (u, i) {
      var mn = Infinity, mx = -Infinity;
      data.forEach(function (d) {
        if ((d.p.unit || '') !== u) return;
        d.pts.forEach(function (q) { var lo = isNum(q.min) ? q.min : q.v, hi = isNum(q.max) ? q.max : q.v; if (lo < mn) mn = lo; if (hi > mx) mx = hi; });
        if (isNum(d.p.ref)) { mn = Math.min(mn, d.p.ref); mx = Math.max(mx, d.p.ref); }
      });
      if (!isFinite(mn)) { mn = 0; mx = 1; }
      var pad = (mx - mn) * 0.1 || Math.abs(mx) * 0.02 || 1, nT = ph < 120 ? 2 : 4, st = niceStep(mx - mn + 2 * pad, nT);
      var lo = Math.floor((mn - pad) / st + 1e-9) * st, hi = Math.ceil((mx + pad) / st - 1e-9) * st;
      ax[u] = { lo: lo, hi: hi, step: st, top: h0 + i * (ph + gap), bot: h0 + i * (ph + gap) + ph, panel: i };
    });
    return ax;
  }

  /* one neutral band = the normal range (ISA-101: colour is for the abnormal); limits are hairlines with muted labels */
  function bands(L, a, Y, d) {
    var x0 = PAD.l, x1 = W - PAD.r, s = '';
    if (isNum(L.lo_warn) || isNum(L.hi_warn)) {
      var from = isNum(L.lo_warn) ? L.lo_warn : a.lo, to = isNum(L.hi_warn) ? L.hi_warn : a.hi, yt = Y(Math.min(to, a.hi), a), yb = Y(Math.max(from, a.lo), a);
      if (yb > yt) s += '<rect class="band band-ok" data-band="ok" data-from="' + from + '" data-to="' + to + '" x="' + x0 + '" width="' + (x1 - x0) + '" y="' + yt.toFixed(1) + '" height="' + (yb - yt).toFixed(1) + '"/>';
    }
    var LAB = { hi_alarm: 'HH', hi_warn: 'H', lo_warn: 'L', lo_alarm: 'LL' }, WORDS = { hi_alarm: 'High alarm', hi_warn: 'High warning', lo_warn: 'Low warning', lo_alarm: 'Low alarm' };
    var upN = 0, dnN = isNum(L.lo_alarm) && isNum(L.lo_warn) && L.lo_warn < a.lo ? 1 : 0;
    ['hi_alarm', 'hi_warn', 'lo_warn', 'lo_alarm'].forEach(function (k) {
      if (!isNum(L[k])) return;
      var cls = /alarm/.test(k) ? 'alarm' : 'warn', lab = LAB[k] + ' ' + fmt(L[k], d);
      if (L[k] > a.hi) { s += '<text class="llab edge" data-limit="' + k + '" data-v="' + L[k] + '" x="' + (x1 + 5) + '" y="' + (a.top + 8 + 11 * upN++).toFixed(1) + '"><title>' + WORDS[k] + ', above the plotted range</title>' + esc(lab) + ' ↑</text>'; return; }
      if (L[k] < a.lo) { s += '<text class="llab edge" data-limit="' + k + '" data-v="' + L[k] + '" x="' + (x1 + 5) + '" y="' + (a.bot - 2 - 11 * (k === 'lo_alarm' ? 0 : dnN)).toFixed(1) + '"><title>' + WORDS[k] + ', below the plotted range</title>' + esc(lab) + ' ↓</text>'; return; }
      var y = Y(L[k], a);
      s += '<line class="lline ' + cls + '" data-limit="' + k + '" data-v="' + L[k] + '" x1="' + x0 + '" x2="' + x1 + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
      s += '<text class="llab" x="' + (x1 + 5) + '" y="' + (y + 3.5).toFixed(1) + '"><title>' + WORDS[k] + '</title>' + esc(lab) + '</text>';
    });
    return s;
  }
  /* the reference line's label (PRD-SETPOINT-SIM P1: "SP 19.4"), muted ink in the right gutter beside the limit labels;
     it moves by one label row (11 px) away from the plot's middle until its row is free of every label already drawn */
  function refLab(drawn, p, y, a) {
    var taken = [], re = /<text class="(?:llab|ref-lab)[^"]*"[^>]*? y="(-?[\d.]+)"/g, m;
    while ((m = re.exec(drawn))) taken.push(+m[1]);
    var ly = y + 3.5, dir = ly < (a.top + a.bot) / 2 ? -1 : 1, n = 0;
    function busy(v) { for (var i = 0; i < taken.length; i++) if (Math.abs(taken[i] - v) < 11) return true; return false; }
    while (busy(ly) && n < 12) { ly += dir * 11; n++; if (ly < a.top + 8 || ly > a.bot - 2) { dir = -dir; ly = y + 3.5; } }
    return '<text class="ref-lab" data-ref-label="' + esc(p.id) + '" x="' + (W - PAD.r + 5) + '" y="' + ly.toFixed(1) + '">' + esc(p.refLabel) + '</text>';
  }
  /* a pen split where it crosses a limit (interpolated, so the pieces meet ON the line) and coloured by the state of
     each piece; a gap of more than two steps is drawn dotted and muted, never as a straight cliff (G12) */
  function segments(pts, L, step) {
    var cuts = L ? ['lo_alarm', 'lo_warn', 'hi_warn', 'hi_alarm'].map(function (k) { return L[k]; }).filter(isNum) : [];
    var out = [], cur = null;
    function push(st, a, b) {
      if (cur && cur.st === st) { cur.pts.push(b); return; }
      cur = { st: st, pts: [a, b] }; out.push(cur);
    }
    for (var i = 1; i < pts.length; i++) {
      var a = { t: pts[i - 1].t, v: pts[i - 1].v }, b = { t: pts[i].t, v: pts[i].v };
      if (!isNum(a.v) || !isNum(b.v)) continue;
      if (b.t - a.t > 2 * step) { push('gap', a, b); continue; }
      var xs = cuts.filter(function (c) { return (c - a.v) * (c - b.v) < 0; }).sort(function (p, q) { return a.v < b.v ? p - q : q - p; });
      var prev = a;
      xs.concat([null]).forEach(function (c) {
        var nx = c === null ? b : { t: a.t + (c - a.v) / (b.v - a.v) * (b.t - a.t), v: c };
        var st = L ? evaluate((prev.v + nx.v) / 2, L, null).state : 'none';
        push(st, prev, nx); prev = nx;
      });
    }
    return out;
  }

  function draw() {
    var svg = el.querySelector('.rz-trend-plot'), cw = svg.clientWidth || 720;
    W = Math.round(Math.max(320, Math.min(1040, cw))); Hh = cw < 600 ? 240 : 300; PAD.l = cw < 600 ? 36 : 48; PAD.r = cw < 600 ? 58 : 64;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    var data = pens.map(function (id, i) { var p = POINTS[id], so = sourceOf(p); return { p: p, pts: seriesOf(p, so), bucket: so.bucket, src: so.src, i: i }; });
    el.querySelector('.rz-trend-down').hidden = !openDown;
    if (data.some(function (d) { return d.src === 'pending'; })) {   /* nothing drawn until every pen has its one source */
      svg.innerHTML = '<text class="rz-trend-wait" x="' + (W / 2) + '" y="' + (Hh / 2) + '" text-anchor="middle">Reading the database…</text>';
      svg.__t0 = svg.__t1 = 0; drawHead(data[0], limitsOf(data[0].p)); drawStats(data[0], null); drawRead(data[0], null);
      return;
    }
    var r = ranges()[range], step = r[1] * 60000, t1 = (nowMin() + 1) * 60000, t0 = t1 - r[0] * 60000, p0 = data[0].p, L0 = limitsOf(p0);
    var ax = layout(data, PAD.t, Hh - PAD.b), a0 = ax[p0.unit || ''];
    var X = function (t) { return PAD.l + (t - t0) / (t1 - t0) * (W - PAD.l - PAD.r); };
    var Y = function (v, a) { return a.top + (1 - (v - a.lo) / (a.hi - a.lo)) * (a.bot - a.top); };
    var s = L0 ? bands(L0, a0, Y, digitsOf(p0)) : '';
    Object.keys(ax).forEach(function (u) {
      var a = ax[u], dg = 0;
      while (dg < 4 && Math.abs(a.step * Math.pow(10, dg) - Math.round(a.step * Math.pow(10, dg))) > 1e-9) dg++;   /* decimals the step needs: 2.5 -> 1, 0.25 -> 2 */
      for (var v = a.lo; v <= a.hi + a.step / 1e6; v += a.step) {
        var vv = Math.round(v / a.step) * a.step, gy = Y(vv, a);
        s += '<line class="grid" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/>';
        s += '<text class="ax" data-y="' + (+vv.toFixed(6)) + '" x="' + (PAD.l - 5) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end">' + esc(fmt(vv, dg)) + '</text>';
      }
      if (a.panel > 0) s += '<text class="endlab" x="' + (W - PAD.r + 5) + '" y="' + (a.top + 8) + '">' + esc(u) + '</text>';
    });
    s += '<line class="base" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + (Hh - PAD.b) + '" y2="' + (Hh - PAD.b) + '"/>';
    if (r[0] > 1440) {
      /* day ranges: one tick per (n) LOCAL midnight(s) of the viewer (OD-8), never more than fit; setDate keeps DST days right */
      var days = r[0] / 1440, stepD = Math.max(1, Math.ceil(days / (W < 600 ? 3 : 7))), md = new Date(t0);
      if (md.getHours() || md.getMinutes() || md.getSeconds() || md.getMilliseconds()) { md.setHours(24, 0, 0, 0); }
      for (var c = 0; md.getTime() <= t1; md.setDate(md.getDate() + 1), c++) {
        if (c % stepD) continue;
        var tm = md.getTime(), xx = X(tm);
        s += '<text class="ax" data-t="' + tm + '" x="' + xx.toFixed(1) + '" y="' + (Hh - 8) + '" text-anchor="' + (xx > W - PAD.r - 18 ? 'end' : xx < PAD.l + 18 ? 'start' : 'middle') + '">' + (md.getMonth() + 1) + '/' + md.getDate() + '</text>';
      }
    } else for (var k = 0, nT = W < 600 ? 2 : 4; k <= nT; k++) {
      var tt = t0 + k / nT * (t1 - t0), dt = new Date(tt);
      var lab = ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2);
      s += '<text class="ax" data-t="' + Math.round(tt) + '" x="' + X(tt) + '" y="' + (Hh - 8) + '" text-anchor="' + (k === 0 ? 'start' : k === nT ? 'end' : 'middle') + '">' + lab + '</text>';
    }
    var segs0 = [];
    data.forEach(function (d) {
      var a = ax[d.p.unit || ''], pp = function (q, key) { return X(q.t).toFixed(1) + ',' + Y(q[key || 'v'], a).toFixed(1); };
      if (isNum(d.p.ref)) s += '<line class="ref" data-ref="' + esc(d.p.id) + '" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + Y(d.p.ref, a) + '" y2="' + Y(d.p.ref, a) + '"/>';
      if (isNum(d.p.ref) && d.p.refLabel) s += refLab(s, d.p, Y(d.p.ref, a), a);
      if (d.i === 0 && !L0) ['hi', 'lo'].forEach(function (Lk) { if (isNum(d.p[Lk]) && d.p[Lk] >= a.lo && d.p[Lk] <= a.hi) s += '<line class="lim" data-limit="' + Lk + '" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + Y(d.p[Lk], a) + '" y2="' + Y(d.p[Lk], a) + '"/>'; });
      if (d.bucket && d.pts.length) s += '<polygon class="pen-band" data-pen-band="' + esc(d.p.id) + '" style="fill:' + colour(d.i) + '" points="' +
        d.pts.map(function (q) { return pp(q, 'max'); }).concat(d.pts.slice().reverse().map(function (q) { return pp(q, 'min'); })).join(' ') + '"/>';
      /* the whole pen as one polyline (the contract: one per pen, every point); pen 1 is then painted as state segments */
      s += '<polyline class="pen' + (d.i ? '' : ' pen-path') + '" data-pen="' + esc(d.p.id) + '"' + (d.i ? ' style="stroke:' + colour(d.i) + '"' : '') + ' points="' + d.pts.map(function (q) { return pp(q); }).join(' ') + '"/>';
      if (d.i === 0) {
        segs0 = segments(d.pts, L0, step);
        segs0.forEach(function (g) { s += '<polyline class="' + (g.st === 'gap' ? 'pen-now' : 'pen-seg') + '" data-st="' + g.st + '" points="' + g.pts.map(function (q) { return pp(q); }).join(' ') + '"/>'; });
      } else if (d.pts.length) {
        var lq = d.pts[d.pts.length - 1];
        s += '<text class="endlab" x="' + (W - PAD.r + 5) + '" y="' + (Y(lq.v, a) + 3.5).toFixed(1) + '">' + esc(String(d.p.label).slice(0, 9)) + '</text>';
      }
    });
    /* state ribbon under the plot: the same pieces, so time-in-state reads at a glance without colouring the plot */
    var ry = Hh - PAD.b + 5;
    segs0.forEach(function (g) {
      var xa = X(g.pts[0].t), xb = X(g.pts[g.pts.length - 1].t);
      if (g.st !== 'gap') s += '<rect class="rib" data-st="' + g.st + '" x="' + xa.toFixed(1) + '" y="' + ry + '" width="' + Math.max(1, xb - xa).toFixed(1) + '" height="4"/>';
    });
    if (cursorT !== null && cursorT >= t0 && cursorT <= t1) s += '<line class="cur" x1="' + X(cursorT) + '" x2="' + X(cursorT) + '" y1="' + PAD.t + '" y2="' + (Hh - PAD.b) + '"/>';
    var last = data[0].pts[data[0].pts.length - 1];
    if (last && isNum(last.v)) s += '<circle class="now" data-st="' + headEv(data[0], L0).state + '" cx="' + X(last.t).toFixed(1) + '" cy="' + Y(last.v, a0).toFixed(1) + '" r="4"/>';
    svg.innerHTML = s; svg.__t0 = t0; svg.__t1 = t1;
    drawHead(data[0], L0);
    drawStats(data[0], L0);
    drawRead(data[0], L0);
    drawHover(data, ax, X, Y);
    /* compare table: one row per pen, shown once a second series is added or on Table */
    var rows = '';
    data.forEach(function (d) {
      var st = statsOf(d), dg = digitsOf(d.p), at = null;
      if (cursorT !== null) { var best = Infinity; d.pts.forEach(function (q) { var e = Math.abs(q.t - cursorT); if (e < best) { best = e; at = q.v; } }); }
      var Ld = limitsOf(d.p), over = Ld ? stateStats(d.pts, Ld) : null, hiOver = !Ld && typeof d.p.hi === 'number' ? H().aboveLimit(d.pts, d.p.hi) : null;
      var off = over ? over.warn + over.alarm : hiOver;
      rows += '<tr data-row="' + esc(d.p.id) + '"><td><span class="rz-trend-sw" style="border-color:' + colour(d.i) + '"></span>' + esc(d.p.label) +
        ' <span class="rz-trend-sim">' + esc(d.p.cls === 'ENGINE' ? 'sim · engine ref' : 'sim') + '</span></td>' +
        '<td>' + esc(d.p.unit || '') + '</td><td data-k="cursor">' + fmt(at, dg) + '</td><td data-k="last">' + fmt(st.last, dg) + '</td><td data-k="min">' + fmt(st.min, dg) + '</td><td data-k="max">' + fmt(st.max, dg) + '</td><td data-k="mean">' + fmt(st.mean, dg) + '</td>' +
        '<td>' + (off === null || off === undefined ? '—' : fmt(off * 100, 0) + ' %') + '</td>' +
        '<td><button type="button" class="rz-trend-x" data-remove="' + esc(d.p.id) + '" aria-label="Remove ' + esc(d.p.label) + '"' + (pens.length < 2 ? ' disabled' : '') + '>×</button></td></tr>';
    });
    el.querySelector('tbody').innerHTML = rows;
    el.querySelector('.rz-trend-scroll').hidden = pens.length < 2 && !showTable;
    el.querySelector('[data-table]').setAttribute('aria-pressed', showTable ? 'true' : 'false');
    el.querySelector('[data-k="cursor-t"]').textContent = cursorT === null ? 'Cursor' : localStamp(cursorT);
    var sel = el.querySelector('.rz-trend-add'), o = '<option value="">+ Compare</option>', groups = {}, g0 = p0.group || 'Points';
    ORDER.forEach(function (id) { if (pens.indexOf(id) >= 0) return; var p = POINTS[id]; (groups[p.group || 'Points'] = groups[p.group || 'Points'] || []).push(p); });
    /* the pen-1 system first: picking a pen from the same system is one tap (PRD §4.3 Compare) */
    Object.keys(groups).sort(function (a, b) { return (a === g0 ? -1 : 0) - (b === g0 ? -1 : 0); }).forEach(function (g) { o += '<optgroup label="' + esc(g) + '">' + groups[g].map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.label + (p.unit ? ' [' + p.unit + ']' : '')) + '</option>'; }).join('') + '</optgroup>'; });
    sel.innerHTML = o; sel.disabled = pens.length >= MAX_PENS;
    el.querySelectorAll('[data-range]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-range') === range ? 'true' : 'false'); });
    try { root.history.replaceState(null, '', '#trend=' + pens.map(encodeURIComponent).join(',') + '&r=' + range); } catch (e) { /* file:// or sandbox: the link simply is not updated */ }
  }
  /* crosshair reading floats beside the cursor (desktop); the read line below the tools carries it on a phone */
  function drawHover(data, ax, X, Y) {
    var tip = el.querySelector('.rz-trend-hover');
    if (cursorT === null || phone()) { tip.hidden = true; return; }
    var lines = data.map(function (d) {
      var best = Infinity, at = null; d.pts.forEach(function (q) { var e = Math.abs(q.t - cursorT); if (e < best) { best = e; at = q.v; } });
      var L = limitsOf(d.p);
      return esc((pens.length > 1 ? d.p.label + ' ' : '') + fmt(at, digitsOf(d.p)) + (d.p.unit ? ' ' + d.p.unit : '') + (L && d.i === 0 ? ' · ' + WORD[evaluate(at, L, null).state] : ''));
    });
    var svg = el.querySelector('.rz-trend-plot'), k = svg.clientWidth / W, x = X(cursorT) * k;
    tip.innerHTML = '<b>' + esc(localStamp(cursorT)) + '</b><br>' + lines.join('<br>');
    tip.hidden = false;
    tip.style.top = (svg.offsetTop + 8) + 'px';
    tip.style.left = (x > svg.clientWidth * 0.6 ? x - tip.offsetWidth - 10 : x + 10) + 'px';
  }

  function glyph(ev) { return ev.state === 'warn' ? (ev.dir === 'lo' ? ' ▼' : ' ▲') : ev.state === 'alarm' ? ' ◆' : ''; }
  function headEv(d, L) {
    var v = isNum(pinned[d.p.id]) ? pinned[d.p.id] : (d.pts.length ? d.pts[d.pts.length - 1].v : null);
    return headState && pens[0] === headState.id ? headState.ev : evaluate(v, L, null);
  }
  function drawHead(d, L) {
    var p = d.p, v = isNum(pinned[p.id]) ? pinned[p.id] : (d.pts.length ? d.pts[d.pts.length - 1].v : null);
    var ev = headEv(d, L);
    el.querySelector('#rz-trend-title').textContent = p.label + (pens.length > 1 ? ' + ' + (pens.length - 1) + ' compared' : '');
    var val = el.querySelector('.rz-trend-val');
    val.textContent = fmt(v, digitsOf(p)); val.setAttribute('data-tr-state', ev.state);
    el.querySelector('.rz-trend-unit').textContent = p.unit || '';
    var w = el.querySelector('.rz-trend-stw');
    w.textContent = (glyph(ev) ? glyph(ev).slice(1) + ' ' : '') + WORD[ev.state] + (ev.dir ? (ev.dir === 'hi' ? ' high' : ' low') : ''); w.setAttribute('data-tr-state', ev.state);
    var src = d.src === 'down' ? DOWN_LABEL : d.src === 'pending' ? 'Database …' : d.src && d.src !== 'local' ? d.src : (p.cls === 'ENGINE' ? 'SIMULATED · ENGINE REF' : 'SIMULATED');
    el.querySelector('[data-tag="src"]').textContent = src;
    var e = el.querySelector('[data-tag="ev"]');
    e.textContent = L ? 'Limits ' + L.evidenceClass : 'No limits';
    el.querySelector('[data-tag="basis"]').textContent = L ? (L.basis || '') : 'Informational point: no operating limit in the registry';
    el.querySelector('[data-tag="zone"]').textContent = 'Times in ' + zoneName(Date.now()) + (d.src === 'local' || d.src === 'down' ? '. SIMULATED history: a deterministic training series per point, no historian is read.' : '.');
  }
  function drawStats(d, L) {
    var st = statsOf(d), dg = digitsOf(d.p), ss = stateStats(d.pts, L), u = d.p.unit ? ' ' + d.p.unit : '';
    /* one line, values in ink (G9): min · max · mean · time in warning · in alarm · excursions */
    var items = [['min', 'min', fmt(st.min, dg) + u], ['max', 'max', fmt(st.max, dg) + u], ['mean', 'mean', fmt(st.mean, dg) + u],
      ['warn', 'warning', ss ? fmt(ss.warn * 100, 1) + ' %' : '—'], ['alarm', 'alarm', ss ? fmt(ss.alarm * 100, 1) + ' %' : '—'], ['excursions', 'excursions', ss ? String(ss.excursions) : '—']];
    el.querySelector('.rz-trend-stats').innerHTML = items.map(function (x) { return x[0] === 'excursions' ? '<b data-s="excursions">' + esc(x[2]) + '</b> excursions' : x[1] + ' <b data-s="' + x[0] + '">' + esc(x[2]) + '</b>'; }).join(' · ');
  }
  function drawRead(d, L) {
    var r = el.querySelector('.rz-trend-read'), left = NAMES[range] + ' · ' + d.pts.length + ' pts · ' + zoneName(Date.now()), right = '';
    if (cursorT !== null) {
      var best = Infinity, at = null; d.pts.forEach(function (q) { var e = Math.abs(q.t - cursorT); if (e < best) { best = e; at = q.v; } });
      right = localStamp(cursorT) + ' ' + zoneName(cursorT) + ' · ' + fmt(at, digitsOf(d.p)) + (d.p.unit ? ' ' + d.p.unit : '') + (L ? ' · ' + WORD[evaluate(at, L, null).state] : '');
    }
    r.innerHTML = '<span>' + esc(left) + '</span><span data-k="cur-read">' + esc(right) + '</span>';
  }

  function setCursorFromX(clientX) {
    var svg = el.querySelector('.rz-trend-plot'), b = svg.getBoundingClientRect();
    var x = (clientX - b.left) / b.width * W, f = (x - PAD.l) / (W - PAD.l - PAD.r);
    if (f < 0 || f > 1) return;
    cursorT = Math.round((svg.__t0 + f * (svg.__t1 - svg.__t0)) / 60000) * 60000; draw();
  }
  function build() {
    css();
    el = doc.createElement('div'); el.className = 'rz-trend'; el.hidden = true;
    var rb = KEYS.map(function (k, i) { return '<button type="button" class="rz-trend-seg" data-range="' + k + '" aria-pressed="false" title="' + NAMES[k] + ' (key ' + (i + 1) + ')">' + k + '</button>'; }).join('');
    el.innerHTML = '<div class="rz-trend-panel" role="dialog" aria-modal="true" aria-labelledby="rz-trend-title">' +
      '<div class="rz-trend-head"><div class="rz-trend-id"><h2 id="rz-trend-title">Trend</h2>' +
        '<div class="rz-trend-now"><span class="rz-trend-val" aria-live="polite"></span><span class="rz-trend-unit"></span><span class="rz-trend-stw"></span>' +
        '<button type="button" class="rz-trend-info" aria-expanded="false" aria-label="Source, limits and time zone">i<span class="rz-trend-tip" role="tooltip"><span class="rz-trend-tag" data-tag="src"></span><span class="rz-trend-tag" data-tag="ev"></span><span class="rz-trend-tag" data-tag="basis"></span><span class="rz-trend-tag" data-tag="zone"></span></span></button></div></div>' +
        '<button type="button" class="rz-trend-btn" data-close aria-label="Close trend">Close</button></div>' +
      '<div class="rz-trend-tools"><span class="rz-trend-ranges" role="group" aria-label="Time range (keys 1 to 5)">' + rb + '</span><span class="rz-trend-gap"></span>' +
        '<select class="rz-trend-add" aria-label="Add a series to compare"></select>' +
        '<button type="button" class="rz-trend-tb" data-table aria-pressed="false">Table</button>' +
        '<button type="button" class="rz-trend-tb" data-csv aria-label="Export CSV">CSV</button></div>' +
      '<div class="rz-trend-body"><p class="rz-trend-down" role="status" hidden>' + DOWN_LINE + '</p><div class="rz-trend-read"></div>' +
        '<svg class="rz-trend-plot" viewBox="0 0 ' + W + ' ' + Hh + '" tabindex="0" role="img" aria-label="Trend plot. Arrow keys move the cursor."></svg>' +
        '<div class="rz-trend-hover" hidden></div><p class="rz-trend-stats"></p>' +
        '<div class="rz-trend-scroll" hidden><table class="rz-trend-table"><thead><tr><th>Series</th><th>Unit</th><th data-k="cursor-t">Cursor</th><th>Last</th><th>Min</th><th>Max</th><th>Mean</th><th>Off normal</th><th></th></tr></thead><tbody></tbody></table></div>' +
        '</div></div>';
    doc.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (t === el || (t.closest && t.closest('[data-close]'))) { close(e.detail > 0); return; }
      var rg = t.closest && t.closest('[data-range]'); if (rg) { setRange(rg.getAttribute('data-range')); cursorT = null; draw(); return; }
      var rm = t.closest && t.closest('[data-remove]'); if (rm && pens.length > 1) { pens.splice(pens.indexOf(rm.getAttribute('data-remove')), 1); draw(); el.querySelector('.rz-trend-add').focus(); return; }
      var inf = t.closest && t.closest('.rz-trend-info');
      el.querySelectorAll('.rz-trend-info[aria-expanded="true"]').forEach(function (b) { if (b !== inf) b.setAttribute('aria-expanded', 'false'); });
      if (inf) { inf.setAttribute('aria-expanded', inf.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'); return; }
      if (t.closest && t.closest('[data-table]')) { showTable = !showTable; draw(); return; }
      if (t.closest && t.closest('[data-csv]')) exportCsv();
    });
    el.querySelector('.rz-trend-add').addEventListener('change', function (e) { var id = e.target.value; if (id && POINTS[id] && pens.length < MAX_PENS && pens.indexOf(id) < 0) { pens.push(id); draw(); el.querySelector('.rz-trend-add').focus(); } });
    var svg = el.querySelector('.rz-trend-plot'), down = false;
    svg.addEventListener('pointerdown', function (e) { down = true; setCursorFromX(e.clientX); });
    svg.addEventListener('pointermove', function (e) { if (down || e.pointerType === 'mouse') setCursorFromX(e.clientX); });
    root.addEventListener('pointerup', function () { down = false; });
    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); var step = ranges()[range][1] * 60000;
      cursorT = (cursorT === null ? svg.__t1 - step : cursorT) + (e.key === 'ArrowLeft' ? -step : step);
      cursorT = Math.max(svg.__t0, Math.min(svg.__t1 - step, cursorT)); draw();
    });
  }
  function exportCsv() {
    var text = H().csv(pens.map(function (id) {
      var p = POINTS[id], so = openDown ? { pts: localSeries(p), bucket: false, src: 'down' } : sourceOf(p);
      return { label: p.label, unit: p.unit, cls: (p.cls === 'ENGINE' ? 'SIM, ENGINE REF' : 'SIM') + (so.src !== 'local' && so.src !== 'down' ? ', ' + so.src : ''), points: seriesOf(p, so) };
    }));
    api.lastCsv = text;
    try {
      var a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
      a.download = 'trend-' + pens[0].replace(/[^a-z0-9]+/gi, '-') + '-' + range + '.csv'; el.appendChild(a); a.click(); a.remove();   /* inside the panel: a click on <body> reads as an outside click and closes the inspector below */
    } catch (e) { /* a sandboxed frame blocks downloads: the text stays on RZTrend.lastCsv */ }
  }
  function onKey(e) {
    if (!openFlag) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); close(); return; }
    var inField = e.target && /^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName);
    if (!inField && !e.ctrlKey && !e.metaKey && !e.altKey && /^[1-5]$/.test(e.key)) { e.preventDefault(); setRange(KEYS[+e.key - 1]); cursorT = null; draw(); return; }
    if (e.key === '+') { el.querySelector('.rz-trend-add').focus(); return; }
    if (e.key !== 'Tab' || mode === 'sheet') return;   /* the sheet traps Tab itself */
    var f = Array.prototype.slice.call(el.querySelectorAll('button:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    else if (!el.contains(doc.activeElement)) { e.preventDefault(); f[0].focus(); }
  }
  function phone() { try { return !!(root.matchMedia && root.matchMedia('(max-width: 600px)').matches); } catch (e) { return false; } }
  function inertPage(keep) {
    inerted = Array.prototype.slice.call(doc.body.children).filter(function (c) { return keep.indexOf(c) < 0 && !c.hasAttribute('inert') && !/^(SCRIPT|STYLE|LINK)$/.test(c.tagName); });
    inerted.forEach(function (c) { c.setAttribute('inert', ''); c.setAttribute('data-rz-trend-inert', '1'); });
  }
  function open(id, o) {
    if (!POINTS[id] || !H()) return false;
    if (!el) build();
    if (openFlag) close();
    o = o || {};
    pens = [id].concat((o.pens || []).filter(function (x) { return POINTS[x] && x !== id; })).slice(0, MAX_PENS);
    var r = normRange(o.range) || remembered() || range; if (r) range = r;
    if (isNum(o.value)) pinned[id] = o.value;
    headState = null;
    if (o.state) {
      var stt = typeof o.state === 'object' ? o.state.state : o.state;
      if (WORD[stt]) headState = { id: id, ev: { state: stt, dir: typeof o.state === 'object' && o.state.dir ? o.state.dir : null } };
    }
    cursorT = null; lastTrigger = o.trigger || doc.activeElement;
    openSeq++; openDown = false;
    openFlag = true;
    el.classList.remove('rz-trend--sheet', 'rz-trend--phone');
    var panel = el.querySelector('.rz-trend-panel');
    doc.addEventListener('keydown', onKey, true);   /* before the sheet's own listener: Esc is handled here once */
    if (phone()) {
      mode = 'sheet';
      el.hidden = false;
      if (root.RZSheet && root.RZSheet.open) {
        el.classList.add('rz-trend--sheet');
        panel.removeAttribute('role'); panel.removeAttribute('aria-modal');
        sheet = root.RZSheet.open({ content: el, onClose: function () { sheet = null; close(); } });
        sheet.sheet.style.height = '88vh';
        sheet.sheet.setAttribute('aria-labelledby', 'rz-trend-title');
        draw();
        inertPage([sheet.sheet, sheet.scrim]);
        return true;
      }
      mode = 'phone'; el.classList.add('rz-trend--phone');   /* a page without rz-sheet.js: the same shape, without the drag */
    } else mode = 'modal';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    if (el.parentNode !== doc.body) doc.body.appendChild(el);
    var fresh = el.hidden || el.classList.contains('rz-trend--leave');
    stopLeave();
    el.hidden = false;
    if (mode === 'modal' && o.animate && fresh) {   /* M2: from scale .97 + transparent, retargets if it was leaving */
      el.classList.add('rz-trend--anim', 'rz-trend--from'); void el.offsetWidth; el.classList.remove('rz-trend--from');
    } else el.classList.remove('rz-trend--anim');
    draw();
    inertPage([el]);
    el.querySelector('[data-close]').focus();
    return true;
  }
  var leaveT = null;
  function stopLeave() { if (leaveT) { clearTimeout(leaveT); leaveT = null; } if (el) el.classList.remove('rz-trend--leave'); }
  function close(animate) {
    if (!openFlag) return;
    openFlag = false;
    inerted.forEach(function (c) { c.removeAttribute('inert'); c.removeAttribute('data-rz-trend-inert'); }); inerted = [];
    doc.removeEventListener('keydown', onKey, true);
    if (sheet && root.RZSheet) { sheet = null; root.RZSheet.close(); }   /* the sheet exits with the panel still in it */
    else if (mode !== 'sheet') {
      if (animate === true && mode === 'modal' && el.classList.contains('rz-trend--anim')) {   /* M2 exit, the way it came */
        el.classList.add('rz-trend--leave');
        leaveT = setTimeout(function () { leaveT = null; el.classList.remove('rz-trend--leave'); if (!openFlag) el.hidden = true; }, 180);
      } else { stopLeave(); el.hidden = true; }
    }
    try { if (/^#trend=/.test(root.location.hash)) root.history.replaceState(null, '', root.location.pathname + root.location.search); } catch (e) { /* see draw() */ }
    var t = lastTrigger; lastTrigger = null;
    /* a panel that rebuilds its HTML each tick replaced the number while the trend was open: focus its replacement
       (same data-trend / data-point), never the page body (v3.87.0, test-conv-motion MO1) */
    if (t && !t.isConnected && t.getAttribute) {
      var key = t.getAttribute('data-trend') ? '[data-trend="' + t.getAttribute('data-trend') + '"]' : (t.getAttribute('data-point') ? '[data-point="' + t.getAttribute('data-point') + '"]' : null);
      var alt = key ? [].slice.call(doc.querySelectorAll(key)).filter(function (n) { return n.getClientRects().length; })[0] : null;
      if (alt) t = alt;
    }
    if (t && t.isConnected && t.focus) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  }
  function optsOf(t) {
    var o = { trigger: t }, v = t.getAttribute('data-pt-value'), s = t.getAttribute('data-pt-state');
    if (v !== null && v !== '' && isFinite(+v)) o.value = +v;
    if (s) o.state = { state: s, dir: t.getAttribute('data-pt-dir') };
    return o;
  }
  function bind(scope) {
    var host = scope || doc;
    if (host.__rzTrendBound) return; host.__rzTrendBound = true;
    host.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-trend]'); if (!t || (el && el.contains(t))) return;
      var oc = optsOf(t); oc.animate = e.detail > 0;   /* a pointer click animates; Enter on a button also fires click, with detail 0 */
      if (open(t.getAttribute('data-trend'), oc)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== 't' && e.key !== 'T') return;
      var t = e.target.closest && e.target.closest('[data-trend]'); if (!t || (el && el.contains(t))) return;
      /* capture + stop, like the click above: a number inside a basis tile opened the trend AND the tile's basis drawer on
         Enter (v3.82.0), and Escape then closed only the trend. One key opens one dialog. */
      if (open(t.getAttribute('data-trend'), optsOf(t))) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  function fromHash() {
    var m = /^#trend=([^&]+)(?:&r=([A-Za-z0-9]+))?/.exec(root.location.hash || ''); if (!m) return false;
    var ids = m[1].split(',').map(decodeURIComponent).filter(function (x) { return POINTS[x]; });
    return ids.length ? open(ids[0], { pens: ids.slice(1), range: normRange(m[2]) || '1D' }) : false;
  }

  api.register = register; api.open = open; api.close = close; api.bind = bind; api.fromHash = fromHash;
  api.isOpen = function () { return openFlag; };
  api.state = function () { return { pens: pens.slice(), range: range, cursor: cursorT, mode: mode }; };
  api.points = function () { return ORDER.slice(); };
  api.ranges = function () { return KEYS.slice(); };
  api.now = function () { return Date.now(); };
  api.dbProvider = DB;
  api.source = function () { return el && openFlag ? el.querySelector('[data-tag="src"]').textContent : null; };
  api.version = '3.0.0';
  api.slots = function () { return (light() ? SLOT_LIGHT : SLOT).slice(); };
  root.RZTrend = api;
  bind(doc);   /* a page only loads the file: every [data-trend] reading on it opens its trend */
})(typeof window !== 'undefined' ? window : null);
