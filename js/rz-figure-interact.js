/* rz-figure-interact.js — explorable engine figures (K24, pillar pages).
 * A figure built by tools/build-article-diagrams.mjs with `interactive: true` carries data-rzd-node on each node
 * box, data-rzd-edge="a>b" on each connector, and a <script class="rz-figure-detail"> JSON of what each node does.
 * Hover (pointer devices) or focus a node: its connectors and neighbours light up, the rest of the drawing steps back.
 * Click, tap, Enter or Space: a detail panel under the drawing names the node, says what it does, lists what feeds
 * it and what it leads to (each a button that walks the drawing), and links the section that explains it.
 * Nothing is computed here; every word comes from the figure definition. ES5, no dependencies. */
(function (root, doc) {
  'use strict';
  if (!doc || root.__rzFigureInteract) return;
  root.__rzFigureInteract = true;
  var CSS = '' +
    '.rz-figure [data-rzd-node]{cursor:pointer;outline:none}' +
    '.rz-figure svg [data-rzd-edge],.rz-figure svg [data-rzd-node]{transition:opacity 140ms var(--rz-ease-out,ease-out),stroke 140ms var(--rz-ease-out,ease-out)}' +
    '.rz-figure svg.rz-fx-on [data-rzd-edge]{opacity:.28}' +
    '.rz-figure svg.rz-fx-on [data-rzd-edge].rz-fx-hot{opacity:1;stroke:var(--rz-art-accent,#E8B563);stroke-width:1.8}' +
    '.rz-figure svg [data-rzd-node].rz-fx-hot{stroke:var(--rz-art-accent,#E8B563);stroke-width:1.6}' +
    '.rz-figure svg [data-rzd-node].rz-fx-sel{stroke:var(--rz-art-accent,#E8B563);stroke-width:2.4}' +
    '.rz-figure svg [data-rzd-node]:focus-visible{stroke:var(--rz-art-accent,#E8B563);stroke-width:2.4}' +
    '.rz-fx-hint{display:block;margin:.35rem 0 0;font:500 .78rem/1.4 "IBM Plex Mono",ui-monospace,monospace;color:var(--rz-art-muted,#9aa0a6)}' +
    '.rz-fx-panel{margin:.5rem 0 0;padding:.75rem .9rem;border:1px solid var(--rz-art-line,rgba(255,255,255,.14));border-radius:4px;background:var(--rz-art-panel,#16181D);text-align:left}' +
    '.rz-fx-panel[hidden]{display:none}' +
    '.rz-fx-head{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;margin:0 0 .3rem}' +
    '.rz-fx-name{font:600 1rem/1.3 "IBM Plex Sans",system-ui,sans-serif;color:var(--rz-art-strong,#f1f3f5)}' +
    '.rz-fx-sub{font:.8rem/1.3 "IBM Plex Mono",ui-monospace,monospace;color:var(--rz-art-muted,#9aa0a6)}' +
    '.rz-fx-close{margin-left:auto;min-width:32px;min-height:32px;border:1px solid var(--rz-art-line,rgba(255,255,255,.14));border-radius:4px;background:none;color:inherit;cursor:pointer;font:inherit}' +
    '.rz-fx-text{margin:0 0 .5rem;font:.95rem/1.55 "IBM Plex Sans",system-ui,sans-serif;color:var(--rz-art-text,#d6d9de);text-align:left}' +
    '.rz-fx-rel{display:flex;flex-wrap:wrap;gap:.35rem .5rem;align-items:center;margin:0 0 .35rem;font:.8rem/1.4 "IBM Plex Mono",ui-monospace,monospace;color:var(--rz-art-muted,#9aa0a6)}' +
    '.rz-fx-rel button{min-height:32px;padding:0 .55rem;border:1px solid var(--rz-art-line,rgba(255,255,255,.14));border-radius:4px;background:none;color:var(--rz-art-strong,#f1f3f5);font:.85rem/1 "IBM Plex Sans",system-ui,sans-serif;cursor:pointer;transition:border-color 140ms}' +
    '.rz-fx-rel button:hover,.rz-fx-rel button:focus-visible{border-color:var(--rz-art-accent,#E8B563)}' +
    '.rz-fx-see{font:.85rem/1.4 "IBM Plex Sans",system-ui,sans-serif;color:var(--rz-art-accent,#E8B563)}' +
    '@media (prefers-reduced-motion:reduce){.rz-figure svg [data-rzd-edge],.rz-figure svg [data-rzd-node]{transition:none}}';

  function injectCss() {
    if (doc.getElementById('rz-figure-interact-css')) return;
    var st = doc.createElement('style'); st.id = 'rz-figure-interact-css'; st.textContent = CSS; doc.head.appendChild(st);
  }
  function num(el, a) { return parseFloat(el.getAttribute(a)) || 0; }

  /* the texts drawn inside a node box: name is the 600-weight line, the rest are tag / sublabel */
  function labelsOf(svg, rect) {
    var x = num(rect, 'x'), y = num(rect, 'y'), w = num(rect, 'width'), h = num(rect, 'height'), name = '', sub = [];
    var ts = svg.querySelectorAll('text');
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i], tx = num(t, 'x'), ty = num(t, 'y');
      if (tx < x || tx > x + w || ty < y || ty > y + h) continue;
      if (t.getAttribute('font-weight') === '600' && !name) name = t.textContent; else sub.push(t.textContent);
    }
    return { name: name, sub: sub.join(' · ') };
  }

  function wire(fig) {
    var cfgEl = fig.querySelector('script.rz-figure-detail'); if (!cfgEl) return;
    var detail; try { detail = JSON.parse(cfgEl.textContent); } catch (e) { return; }
    var svgs = fig.querySelectorAll('svg'); if (!svgs.length) return;
    var cap = fig.querySelector('figcaption');
    var hint = doc.createElement('span'); hint.className = 'rz-fx-hint';
    hint.textContent = 'Tap or click a box to see what it does and what it connects to.';
    var panel = doc.createElement('div'); panel.className = 'rz-fx-panel'; panel.hidden = true;
    panel.setAttribute('role', 'region'); panel.setAttribute('aria-live', 'polite');
    fig.insertBefore(hint, cap); fig.insertBefore(panel, cap);
    var sel = null;

    function edges(svg) { return svg.querySelectorAll('[data-rzd-edge]'); }
    function nodeEl(svg, id) { return svg.querySelector('[data-rzd-node="' + id + '"]'); }
    function links(svg, id) {
      var inn = [], out = [], es = edges(svg);
      for (var i = 0; i < es.length; i++) { var p = es[i].getAttribute('data-rzd-edge').split('>'); if (p[1] === id) inn.push(p[0]); if (p[0] === id) out.push(p[1]); }
      return { inn: inn, out: out };
    }
    function light(svg, id) {
      var es = edges(svg), ns = svg.querySelectorAll('[data-rzd-node]'), near = {};
      if (id) near[id] = 1;
      for (var i = 0; i < es.length; i++) {
        var p = es[i].getAttribute('data-rzd-edge').split('>'), hot = !!id && (p[0] === id || p[1] === id);
        es[i].classList.toggle('rz-fx-hot', hot); if (hot) { near[p[0]] = 1; near[p[1]] = 1; }
      }
      for (var j = 0; j < ns.length; j++) {
        var nid = ns[j].getAttribute('data-rzd-node');
        ns[j].classList.toggle('rz-fx-hot', !!id && !!near[nid]);
        ns[j].classList.toggle('rz-fx-sel', nid === sel);
      }
      svg.classList.toggle('rz-fx-on', !!id);
    }
    function relButtons(label, ids) {
      if (!ids.length) return '';
      var h = '<span>' + label + '</span>';
      for (var i = 0; i < ids.length; i++) {
        h += '<button type="button" data-fx-go="' + ids[i] + '"></button>';
      }
      return '<div class="rz-fx-rel">' + h + '</div>';
    }
    function visibleSvg() { for (var i = 0; i < svgs.length; i++) if (svgs[i].getBoundingClientRect().width > 0) return svgs[i]; return svgs[0]; }
    function select(id, focusPanel) {
      sel = id;
      for (var k = 0; k < svgs.length; k++) light(svgs[k], id);
      if (!id) { panel.hidden = true; panel.innerHTML = ''; return; }
      var svg = visibleSvg(), el = nodeEl(svg, id), lab = el ? labelsOf(svg, el) : { name: id, sub: '' }, d = detail[id] || {}, ln = links(svg, id);
      panel.innerHTML = '<div class="rz-fx-head"><span class="rz-fx-name"></span><span class="rz-fx-sub"></span><button type="button" class="rz-fx-close" aria-label="Close">×</button></div>' +
        '<p class="rz-fx-text"></p>' + relButtons('Fed by', ln.inn) + relButtons('Leads to', ln.out) +
        (d.see ? '<a class="rz-fx-see"></a>' : '');
      panel.querySelector('.rz-fx-name').textContent = lab.name;
      panel.querySelector('.rz-fx-sub').textContent = lab.sub;
      panel.querySelector('.rz-fx-text').textContent = d.text || '';
      var bs = panel.querySelectorAll('[data-fx-go]');
      for (var b = 0; b < bs.length; b++) { var t = nodeEl(svg, bs[b].getAttribute('data-fx-go')); bs[b].textContent = t ? labelsOf(svg, t).name : bs[b].getAttribute('data-fx-go'); }
      var see = panel.querySelector('.rz-fx-see');
      if (see) { see.href = d.see; var hd = doc.getElementById(d.see.slice(1)); see.textContent = 'Read: ' + (hd ? hd.textContent.replace(/\s+/g, ' ').trim() : 'the section') + ' →'; }
      panel.hidden = false;
      if (focusPanel) { var f = panel.querySelector('[data-fx-go]') || panel.querySelector('.rz-fx-close'); if (f) f.focus(); }
    }
    panel.addEventListener('click', function (e) {
      var go = e.target.closest('[data-fx-go]');
      if (go) { select(go.getAttribute('data-fx-go'), true); return; }
      if (e.target.closest('.rz-fx-close')) { var back = sel; select(null); var n = back && nodeEl(visibleSvg(), back); if (n) n.focus(); }
    });
    for (var s = 0; s < svgs.length; s++) (function (svg) {
      var ns = svg.querySelectorAll('[data-rzd-node]');
      for (var i = 0; i < ns.length; i++) {
        var lab = labelsOf(svg, ns[i]);
        ns[i].setAttribute('tabindex', '0'); ns[i].setAttribute('role', 'button');
        ns[i].setAttribute('aria-label', lab.name + (lab.sub ? ', ' + lab.sub : '') + '. Show details');
      }
      /* the node box sits under its texts and symbol, so pick by position, not by event target */
      function hit(e) {
        var m = svg.getScreenCTM(); if (!m) return null;
        var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; pt = pt.matrixTransform(m.inverse());
        for (var i = 0; i < ns.length; i++) { var r = ns[i]; if (pt.x >= num(r, 'x') && pt.x <= num(r, 'x') + num(r, 'width') && pt.y >= num(r, 'y') && pt.y <= num(r, 'y') + num(r, 'height')) return r.getAttribute('data-rzd-node'); }
        return null;
      }
      /* hover preview for a mouse or pen only; a touch goes straight to click */
      svg.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; var id = hit(e); svg.style.cursor = id ? 'pointer' : ''; light(svg, id || sel); });
      svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch') return; light(svg, sel); });
      /* select on pointerup inside the drawing, not on click: on a phone the synthesized click can land on a path
         outside it (measured: pointerdown on the node's hit rect, click on another element), so the tap was lost */
      var down = null;
      svg.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, id: hit(e) }; });
      svg.addEventListener('pointerup', function (e) {
        var d = down; down = null; if (!d || !d.id || Math.abs(e.clientX - d.x) > 6 || Math.abs(e.clientY - d.y) > 6) return;
        var id = hit(e); if (id === d.id) select(id === sel ? null : id, false);
      });
      svg.addEventListener('keydown', function (e) {
        var id = e.target.getAttribute && e.target.getAttribute('data-rzd-node'); if (!id) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id, true); }
        else if (e.key === 'Escape' && sel) { select(null); }
      });
      svg.addEventListener('focusin', function (e) { var id = e.target.getAttribute && e.target.getAttribute('data-rzd-node'); if (id) light(svg, id); });
      svg.addEventListener('focusout', function () { light(svg, sel); });
    })(svgs[s]);
    fig.setAttribute('data-rz-fx', 'ready');
  }
  function init() { injectCss(); var fs = doc.querySelectorAll('.rz-figure'); for (var i = 0; i < fs.length; i++) wire(fs[i]); }
  root.RZFigureInteract = { version: '3.33.0', init: init };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
