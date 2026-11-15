/**
 * rz-embed.js — PRD-P20 part A, article side. Turns
 *   <div data-rz-embed="pue-calculator.html" data-rz-embed-title="PUE calculator"></div>
 * into a same-origin iframe, created after the article has loaded (idle) or when the box comes within 1600 px of the viewport, whichever is first, of `<page>?embed=article`, sized by the frame's own size messages.
 *
 *   - Only a calculator listed in data/calculators.json may be named (the list is inlined below by the gate check:
 *     tools/test-embed-article.mjs asserts it equals the registry), so an article cannot frame an arbitrary page.
 *   - A size message counts only when it comes from THIS origin AND from this box's own iframe window.
 *   - Before the first size message the box keeps a reserved height and says "Loading calculator…"; after 8 s with
 *     no message the iframe is replaced by a plain link with "The interactive version could not load."
 *   - Without JavaScript the box's own <noscript>/link fallback (authored in the article) is what shows.
 */
(function (w, d) {
  'use strict';
  /* page -> inputs it shows (data/calculators.json embed.keep minus the result); tia-942-checklist and
   * rfs-readiness-workbench are excluded, reason in the registry */
  var INPUTS = {'capex-calculator.html': 2, 'opex-calculator.html': 3, 'tco-calculator.html': 3, 'roi-calculator.html': 3, 'pue-calculator.html': 3, 'carbon-footprint.html': 3, 'cx-calculator.html': 3, 'spares-readiness-calculator.html': 1, 'tier-advisor.html': 3};
  var PAGES = Object.keys(INPUTS);
  var TIMEOUT_MS = 8000;
  /* reserved height ~ the box it will become (head 40 + 86 per input + result and link 100), so the resize on the
   * first size message is a few px, not a jump (CLS); measured boxes: 295-405 px */
  function reserve(page) { return 40 + 86 * INPUTS[page] + 100; }

  function fallback(box, page, title) {
    box.textContent = '';
    var p = d.createElement('p'); p.className = 'rz-embed-fallback';
    p.appendChild(d.createTextNode('The interactive version could not load. '));
    var a = d.createElement('a'); a.href = page; a.textContent = 'Open the ' + title; p.appendChild(a);
    box.appendChild(p);
    box.setAttribute('data-rz-embed-state', 'fallback');
    box.style.minHeight = '';
  }

  function mount(box) {
    if (box.getAttribute('data-rz-embed-state')) return;
    var page = box.getAttribute('data-rz-embed') || '';
    var title = box.getAttribute('data-rz-embed-title') || 'calculator';
    if (PAGES.indexOf(page) < 0) { box.setAttribute('data-rz-embed-state', 'refused'); return; }
    var base = (d.querySelector('base[href]') ? '' : w.location.pathname.replace(/[^/]*$/, ''));
    var src = base + page + '?embed=article';
    box.setAttribute('data-rz-embed-state', 'loading');
    var RESERVE_PX = reserve(page);
    box.style.minHeight = RESERVE_PX + 'px';
    box.style.position = 'relative';
    box.textContent = '';
    /* the note sits ON the reserved area, not above it, so adding the frame does not grow the box (CLS) */
    var note = d.createElement('p'); note.className = 'rz-embed-loading'; note.textContent = 'Loading calculator…';
    note.style.cssText = 'position:absolute;left:12px;top:12px;margin:0;pointer-events:none';
    var f = d.createElement('iframe');
    f.src = src; f.title = 'Interactive ' + title;   /* no loading=lazy: when to load is decided above; a lazy frame appended off screen would not load and the 8 s fallback would fire */
    f.setAttribute('scrolling', 'no');
    f.style.cssText = 'display:block;width:100%;height:' + RESERVE_PX + 'px;border:1px solid var(--rz-line-tier-2,#d0d4da);border-radius:4px;background:transparent';
    box.appendChild(note);
    var got = false, timer = null;
    /* the 8 s clock starts when the frame is actually requested, not when an off-screen box is found */
    function load() { if (f.parentNode) return; box.appendChild(f); timer = setTimeout(function () { if (!got) fallback(box, page, title); }, TIMEOUT_MS); }
    /* load once the article itself has loaded and the browser is idle, or earlier if the reader nears the box:
     * the resize from the reserved height then happens long before the box is on screen (CLS) */
    var io = null;
    function early() { if (io) io.disconnect(); load(); }
    if (w.IntersectionObserver) {
      io = new w.IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) early(); }, { rootMargin: '1600px 0px' });
      io.observe(box);
    }
    if (!io) load();
    function onMsg(e) {
      if (e.origin !== w.location.origin || e.source !== f.contentWindow) return;
      var m = e.data;
      if (!m || m.type !== 'rz-embed-size' || !(m.h > 0) || m.h > 20000) return;
      if (!got) { got = true; clearTimeout(timer); if (note.parentNode) note.parentNode.removeChild(note); box.setAttribute('data-rz-embed-state', 'ready'); box.style.minHeight = ''; }
      f.style.height = Math.ceil(m.h) + 'px';
    }
    w.addEventListener('message', onMsg);
  }

  function start() { [].forEach.call(d.querySelectorAll('[data-rz-embed]'), mount); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
  w.RZEmbed = { mount: mount, PAGES: PAGES.slice(), TIMEOUT_MS: TIMEOUT_MS };
})(window, document);
