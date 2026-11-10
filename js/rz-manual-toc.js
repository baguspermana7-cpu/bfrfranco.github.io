/* rz-manual-toc.js — "On this page" navigation for the technical manuals (K26, owner 2026-11-09: manuals must be
   "intuitive dan menarik utk dibaca"). Built from the manual's own h2 headings, so it can never drift from the page:
   a fixed rail beside the text column where the screen has room, a collapsed disclosure under the header where it
   does not (skipped when the manual already carries a static contents block). The current section is marked with
   aria-current. No dependencies; gate: tools/test-manual-toc.mjs. */
(function () {
  'use strict';
  var doc = document, win = window;
  function init() {
    var main = doc.querySelector('main.mn-wrap');
    if (!main || main.querySelector('.rz-mtoc-rail')) return;
    var heads = [].filter.call(main.querySelectorAll('h2'), function (h) { return h.id !== 'contents-title' && !h.closest('nav'); });
    if (heads.length < 4) return;
    var reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var items = heads.map(function (h) {
      var num = h.querySelector('.mn-num'), label = h.textContent.replace(num ? num.textContent : '', '').replace(/\s+/g, ' ').trim();
      var sec = h.closest('section[id]'), target = sec && sec.querySelector('h2') === h ? sec : h;
      if (!target.id) {
        var base = label.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section';
        var id = base, n = 2; while (doc.getElementById(id)) id = base + '-' + n++;
        target.id = id;
      }
      return { id: target.id, num: num ? num.textContent.trim() : '', label: label, el: target, head: h };
    });
    function list() {
      var ol = doc.createElement('ol');
      items.forEach(function (it) {
        var li = doc.createElement('li'), a = doc.createElement('a');
        a.href = '#' + encodeURIComponent(it.id);
        if (it.num) { var s = doc.createElement('span'); s.className = 'rz-mtoc-num'; s.textContent = it.num; a.appendChild(s); }
        a.appendChild(doc.createTextNode(it.label));
        a.addEventListener('click', function (e) {
          e.preventDefault();
          it.head.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });   // the heading, not its section's padding
          try { history.replaceState(null, '', '#' + it.id); } catch (err) { /* file:// */ }
          var d = a.closest('details'); if (d) d.open = false;
        });
        li.appendChild(a); ol.appendChild(li);
      });
      return ol;
    }
    var rail = doc.createElement('nav');
    rail.className = 'rz-mtoc-rail'; rail.setAttribute('aria-label', 'On this page');
    var cap = doc.createElement('p'); cap.className = 'rz-mtoc-cap'; cap.textContent = 'On this page';
    rail.appendChild(cap); rail.appendChild(list());
    main.appendChild(rail);   // last: it is fixed, and main's first child stays the content (test-telemetry-e2e measures it)
    if (!main.querySelector('nav[aria-labelledby="contents-title"]')) {
      var det = doc.createElement('details'); det.className = 'rz-mtoc-disc';
      var sum = doc.createElement('summary'); sum.textContent = 'On this page · ' + items.length + ' sections';
      det.appendChild(sum);
      var nav = doc.createElement('nav'); nav.setAttribute('aria-label', 'On this page'); nav.appendChild(list()); det.appendChild(nav);
      var head = main.querySelector(':scope > header');
      if (head && head.nextSibling) main.insertBefore(det, head.nextSibling); else main.insertBefore(det, items[0].el);
    }
    var links = [].slice.call(rail.querySelectorAll('a')), offset = 88;
    function layout() {
      var bar = doc.querySelector('.navbar'); offset = Math.round((bar ? bar.getBoundingClientRect().bottom : 64) + 16);
      doc.documentElement.style.setProperty('--rz-mtoc-offset', offset + 'px');
      var colLeft = Infinity;   // the text column's left edge = where the section headings start (layouts differ per manual)
      items.forEach(function (it) { var r = it.head.getBoundingClientRect(); if (r.width) colLeft = Math.min(colLeft, r.left); });
      if (colLeft === Infinity) colLeft = main.getBoundingClientRect().left;
      var room = colLeft - 36, w = Math.min(208, room);   // rail + 24 px gutter + 12 px edge; narrower columns get a narrower rail
      rail.style.top = offset + 'px'; rail.style.width = Math.max(w, 0) + 'px'; rail.style.left = Math.max(colLeft - 24 - w, 0) + 'px';
      rail.hidden = w < 150;   // below 150 px the labels break word by word: the disclosure under the header serves instead
      doc.documentElement.classList.toggle('rz-mtoc-has-rail', !rail.hidden);
    }
    var pending = false;
    function spy() {
      pending = false; var cur = -1;
      for (var i = 0; i < items.length; i++) if (Math.min(items[i].el.getBoundingClientRect().top, items[i].head.getBoundingClientRect().top) <= offset + 48) cur = i;
      links.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    win.addEventListener('scroll', function () { if (!pending) { pending = true; win.requestAnimationFrame(spy); } }, { passive: true });
    win.addEventListener('resize', function () { layout(); spy(); });
    layout(); spy();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
