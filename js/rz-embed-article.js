/**
 * rz-embed-article.js — PRD-P20 part A, calculator side: `?embed=article` turns a calculator into a compact box an
 * article on this site can frame.
 *
 *   - Shown: the units of the ids the page declares on <body data-rz-embed-keep-ids="…"> (its input group or result
 *     row; mirrored in data/calculators.json `embed.keep`, checked by tools/test-embed-article.mjs), plus a title and an
 *     "Open full calculator" link. Everything else is hidden. Nothing is moved, so every listener keeps working.
 *   - Size: a ResizeObserver posts {type:'rz-embed-size', h} to the parent, which must be this origin.
 *   - Frame guard (part A policy): opened on its own, the page goes to the full calculator; framed by another
 *     origin, it renders nothing but a link out and posts no message (Chrome blocks a cross-origin frame from
 *     navigating the top window without a user gesture, so "break out" cannot be the guard).
 *   - "Open full calculator" is the P02 share link (rzScenario.shareLink): the full page opens with the same inputs.
 * The calculator code does not branch on embed mode; this file and the shared consent/scenario scripts do.
 */
(function (w, d) {
  'use strict';
  if (!/[?&]embed=article(&|$)/.test(w.location.search || '')) return;

  function fullUrl() {
    var r = w.rzScenario && w.rzScenario.shareLink ? w.rzScenario.shareLink() : null;
    return r && r.ok ? r.url : w.location.origin + w.location.pathname;
  }

  /* Frame guard. A cross-origin parent throws on .location.origin. */
  var parentOk = false;
  try { parentOk = w.parent !== w && w.parent.location.origin === w.location.origin; } catch (e) { parentOk = false; }
  if (!parentOk) {
    var full = w.location.origin + w.location.pathname;
    if (w.parent === w) { w.location.replace(full); return; }   /* opened on its own: show the real page */
    /* framed by another origin. Chrome blocks a cross-origin frame from navigating the top window without a user
     * gesture, so the guard cannot rely on it: the calculator is not rendered at all, only a link out, and no
     * message is posted. */
    try { w.top.location.href = full; } catch (e) { /* blocked */ }
    var block = function () {
      d.documentElement.setAttribute('data-rz-embed', 'refused');
      d.body.textContent = '';
      var a = d.createElement('a'); a.href = full; a.target = '_top'; a.rel = 'noopener'; a.id = 'rzEmbedRefused';
      a.textContent = 'Open this calculator on its own site';
      d.body.appendChild(a);
    };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', block); else block();
    return;
  }

  d.documentElement.setAttribute('data-rz-embed', 'article');
  var css = d.createElement('style');
  css.textContent =
    'html[data-rz-embed="article"],html[data-rz-embed="article"] body{background:var(--rzt-bg,#fff);overflow:hidden;min-height:0!important;height:auto!important}' +
    '[data-rz-embed-off]{display:none!important}' +
    '[data-rz-embed-path]{display:block!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;' +
    'position:static!important;min-height:0!important;max-width:none!important;width:auto!important;background:none!important;transform:none!important}' +
    '#rzEmbedHead,#rzEmbedFoot{font:500 13px/1.4 var(--rzt-mono,ui-monospace,monospace);padding:8px 12px}' +
    '#rzEmbedHead{border-bottom:1px solid var(--rzt-line,#d0d4da)}' +
    '#rzEmbedFoot{border-top:1px solid var(--rzt-line,#d0d4da)}' +
    '#rzEmbedFoot a{color:inherit;text-decoration:underline;text-underline-offset:3px}' +
    '[data-rz-embed-keep]{margin:0!important;padding:8px 12px!important}';
  d.head.appendChild(css);

  var UNIT = '[data-rz-embed-unit], .input-group, .form-group, .metric-box, .input-row, .field';
  function build() {
    var keep = [].slice.call(d.querySelectorAll('[data-rz-embed-keep]'));
    /* the page declares ids on <body data-rz-embed-keep-ids="a b c">; each id's unit is its input group or result row */
    String(d.body.getAttribute('data-rz-embed-keep-ids') || '').split(/\s+/).forEach(function (id) {
      var el = id && d.getElementById(id);
      if (!el) return;
      var unit = el.closest(UNIT) || el.parentElement;
      if (unit && keep.indexOf(unit) < 0) { unit.setAttribute('data-rz-embed-keep', ''); keep.push(unit); }
    });
    /* a unit inside another kept unit is shown by its parent already */
    keep = keep.filter(function (k) { return !keep.some(function (o) { return o !== k && o.contains(k); }); });
    if (!keep.length) return false;
    var path = [];
    keep.forEach(function (k) { for (var p = k.parentElement; p && p !== d.body; p = p.parentElement) if (path.indexOf(p) < 0) path.push(p); });
    function onPath(el) { return path.indexOf(el) >= 0 || keep.indexOf(el) >= 0; }
    path.concat([d.body]).forEach(function (p) {
      if (p !== d.body) p.setAttribute('data-rz-embed-path', '');
      for (var c = p.firstElementChild; c; c = c.nextElementSibling) {
        if (!onPath(c) && !/^(SCRIPT|STYLE|LINK)$/.test(c.tagName)) c.setAttribute('data-rz-embed-off', '');
      }
    });
    var title = (d.body.getAttribute('data-rz-embed-title') || (d.querySelector('h1') || {}).textContent || d.title || '').trim();
    var head = d.createElement('div'); head.id = 'rzEmbedHead'; head.textContent = 'Try it: ' + title;
    var foot = d.createElement('div'); foot.id = 'rzEmbedFoot';
    var a = d.createElement('a'); a.id = 'rzEmbedOpen'; a.target = '_top'; a.textContent = 'Open full calculator';
    a.href = fullUrl();
    a.addEventListener('click', function () { a.href = fullUrl(); });   /* the inputs as they are at the click */
    foot.appendChild(a);
    d.body.insertBefore(head, d.body.firstChild);
    d.body.appendChild(foot);
    return true;
  }

  function post() {
    var h = Math.ceil(d.documentElement.getBoundingClientRect().height);
    try { w.parent.postMessage({ type: 'rz-embed-size', h: h }, w.location.origin); } catch (e) { /* parent gone */ }
  }

  function start() {
    if (!build()) return;   /* no declared keep: say nothing, the parent's 8 s fallback shows the plain link */
    post();
    if (w.ResizeObserver) new w.ResizeObserver(post).observe(d.body);
    w.addEventListener('load', post);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window, document);
