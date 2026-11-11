/**
 * rz-manual-links.js — P17: calculator input groups link to their manual, and the manual links back.
 *
 * On a calculator (body[data-rz-calc]): reads the page's `manual` entry in data/calculators.json
 *   { page: 'manual/capex.html', anchor: 'inputs', groups: '<selector>' }
 * and adds a "Manual" link after each matched group heading (or at the top of a group that has none). The link carries
 * the way back: manual/x.html?from=<calculator page>%23<group id>&g=<group label>#<anchor>.
 *
 * On a manual (main.mn-wrap): when opened with ?from=, shows "Back to <calculator> · <group>" above the content and
 * marks the target section for 2 s (not under reduced motion). `from` must be a bare same-folder-parent page name
 * (^[a-z0-9-]+\.html, optional #id); anything else is ignored.
 */
(function (w, d) {
  'use strict';
  if (!w || !d || w.__rzManualLinks) return;
  w.__rzManualLinks = true;
  var FROM_RE = /^([a-z0-9-]+\.html)(#[A-Za-z][\w-]{0,60})?$/;
  function slug(s) { return String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'group'; }
  function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  function calculator() {
    var calc = d.body.getAttribute('data-rz-calc');
    if (/[?&]embed=/.test(w.location.search || '')) return;
    var page = (w.location.pathname.split('/').pop() || '').toLowerCase();
    fetch('data/calculators.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var e = j && (j.calculators || []).filter(function (x) { return x.calc === calc; })[0];
      if (!e || !e.manual) return;
      var m = e.manual, used = {};
      [].forEach.call(d.querySelectorAll(m.groups), function (g) {
        if (g.querySelector('.rz-manual-link') || (g.nextElementSibling && g.nextElementSibling.classList.contains('rz-manual-link'))) return;
        var heading = g.matches('h1,h2,h3,h4,.section-title,.sc-section-title') ? g : null;
        var label = heading ? text(heading) : (m.groupLabel || 'Inputs');
        var host = heading ? (heading.closest('.section-header') || heading) : g;
        // the heading's own header row (never any ancestor with an id: several groups share one container)
        var anchorEl = heading ? (heading.closest('.section-header') || heading) : g;
        if (!anchorEl.id) { var id = 'grp-' + slug(label), n = 2; while (d.getElementById(id)) id = 'grp-' + slug(label) + '-' + n++; anchorEl.id = id; }
        if (used[anchorEl.id]) return; used[anchorEl.id] = 1;
        var a = d.createElement('a');
        a.className = 'rz-manual-link';
        a.href = m.page + '?from=' + encodeURIComponent(page + '#' + anchorEl.id) + '&g=' + encodeURIComponent(label.slice(0, 60)) + '#' + encodeURIComponent(m.anchor);
        a.textContent = 'Manual \u2192';
        a.setAttribute('aria-label', 'Manual: ' + label);
        a.title = 'How these inputs are used, in the ' + e.title + ' manual';
        if (heading) host.appendChild(a); else g.insertBefore(a, g.firstChild);
      });
      if (!d.getElementById('rzManualLinkCss')) {
        var st = d.createElement('style'); st.id = 'rzManualLinkCss';
        st.textContent = '.rz-manual-link{display:inline-block;margin-left:.625rem;padding:.125rem 0;font:500 .75rem/1.4 var(--rzt-mono,"JetBrains Mono",monospace);letter-spacing:0;text-transform:none;color:var(--rzt-text-2,inherit);text-decoration:none;border-bottom:1px solid currentColor}'
          + '.rz-manual-link:hover{color:var(--rzt-text,inherit)}.rz-manual-link:focus-visible{outline:2px solid var(--rzt-accent,#E8B563);outline-offset:2px}'
          + 'div.input-section>.rz-manual-link,div.cf-tab-content .rz-manual-link:first-child{margin:0 0 .5rem}';
        d.head.appendChild(st);
      }
    }, function () {});
  }

  function manual() {
    var q = new URLSearchParams(w.location.search), from = q.get('from') || '', m = from.match(FROM_RE);
    if (!m) return;
    var group = (q.get('g') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    var main = d.querySelector('main.mn-wrap'); if (!main) return;
    var bar = d.createElement('p');
    bar.className = 'rz-manual-back';
    bar.setAttribute('role', 'navigation'); bar.setAttribute('aria-label', 'Back to the calculator');
    var a = d.createElement('a'); a.href = '../' + m[1] + (m[2] || '');
    a.textContent = '← Back to the calculator';
    bar.appendChild(a);
    if (group) { var s = d.createElement('span'); s.textContent = ' · ' + group; bar.appendChild(s); }
    main.insertBefore(bar, main.firstChild);
    fetch('../data/calculators.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var e = j && (j.calculators || []).filter(function (x) { return x.page === m[1]; })[0];
      if (e) a.textContent = '← Back to ' + e.title;
    }, function () {});
    var st = d.createElement('style');
    st.textContent = '.rz-manual-back{margin:0 0 1rem;padding:.5rem .75rem;border:1px solid var(--line,rgba(127,127,127,.35));border-radius:4px;font-size:.875rem}'
      + '.rz-manual-back a{font-weight:600}.rz-manual-hit{outline:2px solid var(--accent,#E8B563);outline-offset:6px;border-radius:2px;transition:outline-color 400ms ease-out}'
      + '.rz-manual-hit.rz-manual-fade{outline-color:transparent}';
    d.head.appendChild(st);
    var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function mark() {
      var id = decodeURIComponent((w.location.hash || '').slice(1)), t = id && d.getElementById(id);
      if (!t) return;
      t.scrollIntoView({ block: 'start' });
      if (reduce) return;
      t.classList.add('rz-manual-hit');
      setTimeout(function () { t.classList.add('rz-manual-fade'); }, 2000);
      setTimeout(function () { t.classList.remove('rz-manual-hit', 'rz-manual-fade'); }, 2500);
    }
    // the section ids are assigned by rz-manual-toc.js on DOMContentLoaded; mark after it
    setTimeout(mark, 0);
  }

  function start() {
    if (d.body && d.body.hasAttribute('data-rz-calc')) calculator();
    else if (d.querySelector('main.mn-wrap')) manual();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
