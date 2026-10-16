/* rz-journal-filter.js — the journal's one filter: topic chips, series chips, tag buttons,
 * search and sort over the cards tools/build-journal.py rendered into the page.
 *
 * Reads nothing but the DOM: every card carries data-topic / data-series / data-tags /
 * data-date / data-read and its title + excerpt, so the page works without a fetch and the
 * grid is complete HTML for crawlers and for no-JS readers (the toolbar is static markup too;
 * this file only wires it). State lives in the URL (?topic=&series=&tag=&q=&sort=) so a
 * filtered view is a link and the back button undoes a chip. Chips are <button aria-pressed>;
 * a chip whose count falls to zero under the other filters is disabled, never hidden
 * (ANTI_VIBECODE §D: Jakob, Pragnanz). "/" focuses the search field; Escape clears it.
 *
 * Exposed for the gate: window.RZJournalFilter = { state, apply, visible }.
 */
(function () {
  'use strict';
  if (window.__rzJournalFilter) return;
  window.__rzJournalFilter = true;

  var tool = document.querySelector('[data-journal-filter]');
  var grid = document.querySelector('[data-journal-grid]');
  if (!tool || !grid) return;

  var cards = [].slice.call(grid.querySelectorAll('.jcard'));
  var total = cards.length;
  var scope = tool.getAttribute('data-scope') || 'all';
  var search = tool.querySelector('input[name="q"]');
  var sort = tool.querySelector('select[name="sort"]');
  var topicChips = [].slice.call(tool.querySelectorAll('.jchip[data-topic]'));
  var seriesChips = [].slice.call(tool.querySelectorAll('.jchip[data-series]'));
  var countEl = tool.querySelector('[data-journal-count]');
  var clearBtn = tool.querySelector('.jtool-clear');
  var tagHost = tool.querySelector('[data-journal-tag]');
  var empty = document.querySelector('[data-journal-empty]');

  var state = { q: '', topic: '', series: '', tag: '', sort: 'new' };

  function fromUrl() {
    var p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.topic = p.get('topic') || '';
    state.series = p.get('series') || '';
    state.tag = (p.get('tag') || '').toLowerCase();
    state.sort = p.get('sort') || 'new';
  }
  function toUrl(push) {
    var p = new URLSearchParams();
    if (state.topic) p.set('topic', state.topic);
    if (state.series) p.set('series', state.series);
    if (state.tag) p.set('tag', state.tag);
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'new') p.set('sort', state.sort);
    var qs = p.toString(), url = location.pathname + (qs ? '?' + qs : '') + location.hash;
    try { history[push ? 'pushState' : 'replaceState'](null, '', url); } catch (e) { /* file: URLs */ }
  }

  function words(s) { return s.toLowerCase().split(/\s+/).filter(Boolean); }
  function haystack(card) {
    if (!card.__hay) {
      var t = card.querySelector('.jcard-title'), x = card.querySelector('.jcard-excerpt');
      card.__hay = ((t ? t.textContent : '') + ' ' + (x ? x.textContent : '') + ' ' + (card.getAttribute('data-tags') || '').replace(/\|/g, ' ')).toLowerCase();
    }
    return card.__hay;
  }
  function tagsOf(card) { return (card.getAttribute('data-tags') || '').split('|'); }

  /* does the card pass every filter except the one named in `skip` (for chip counts) */
  function passes(card, skip) {
    if (skip !== 'topic' && state.topic && card.getAttribute('data-topic') !== state.topic) return false;
    if (skip !== 'series' && state.series && card.getAttribute('data-series') !== state.series) return false;
    if (state.tag && tagsOf(card).indexOf(state.tag) < 0) return false;
    if (state.q) {
      var hay = haystack(card), ws = words(state.q);
      for (var i = 0; i < ws.length; i++) if (hay.indexOf(ws[i]) < 0) return false;
    }
    return true;
  }

  function order(a, b) {
    var da = a.getAttribute('data-date'), db = b.getAttribute('data-date');
    var ra = +a.getAttribute('data-read'), rb = +b.getAttribute('data-read');
    if (state.sort === 'old') return da < db ? -1 : da > db ? 1 : 0;
    if (state.sort === 'long') return rb - ra || (da < db ? 1 : -1);
    if (state.sort === 'short') return ra - rb || (da < db ? 1 : -1);
    return da > db ? -1 : da < db ? 1 : 0;
  }

  function setChips(chips, key) {
    chips.forEach(function (c) {
      var v = c.getAttribute('data-' + key);
      var on = v === state[key];
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      var n = 0;
      for (var i = 0; i < cards.length; i++) if (passes(cards[i], key) && (!v || cards[i].getAttribute('data-' + key) === v)) n++;
      var ne = c.querySelector('.jchip-n');
      if (ne) ne.textContent = n;
      c.disabled = !on && n === 0;
    });
  }

  function apply() {
    var shown = cards.filter(function (c) { return passes(c); }).sort(order);
    cards.forEach(function (c) { c.hidden = shown.indexOf(c) < 0; });
    shown.forEach(function (c) { grid.appendChild(c); });
    setChips(topicChips, 'topic');
    setChips(seriesChips, 'series');
    if (search && search.value !== state.q) search.value = state.q;
    if (sort && sort.value !== state.sort) sort.value = state.sort;
    if (countEl) countEl.textContent = shown.length;
    var active = !!(state.q || state.topic || state.series || state.tag || state.sort !== 'new');
    if (clearBtn) clearBtn.hidden = !active;
    if (tagHost) {
      tagHost.hidden = !state.tag;
      if (state.tag) tagHost.querySelector('span').textContent = state.tag;
    }
    if (empty) empty.hidden = shown.length > 0;
    grid.setAttribute('aria-busy', 'false');
    return shown.length;
  }

  function set(patch, push) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) state[k] = patch[k];
    toUrl(push);
    apply();
  }

  topicChips.forEach(function (c) {
    c.addEventListener('click', function () { set({ topic: c.getAttribute('data-topic') === state.topic ? '' : c.getAttribute('data-topic') }, true); });
  });
  seriesChips.forEach(function (c) {
    c.addEventListener('click', function () { set({ series: c.getAttribute('data-series') === state.series ? '' : c.getAttribute('data-series') }, true); });
  });
  grid.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.jtag') : null;
    if (!b) return;
    e.preventDefault();
    set({ tag: b.getAttribute('data-tag') }, true);
    tool.scrollIntoView({ block: 'nearest' });
  });
  if (tagHost) tagHost.querySelector('button').addEventListener('click', function () { set({ tag: '' }, true); });
  if (search) {
    var t;
    search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { set({ q: search.value.trim() }, false); }, 120); });
    search.addEventListener('keydown', function (e) { if (e.key === 'Escape') { search.value = ''; set({ q: '' }, false); } });
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      var a = document.activeElement, tag = a && a.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (a && a.isContentEditable)) return;
      e.preventDefault();
      search.focus();
    });
  }
  if (sort) sort.addEventListener('change', function () { set({ sort: sort.value }, true); });
  var clearAll = function () { set({ q: '', topic: '', series: '', tag: '', sort: 'new' }, true); if (search) search.focus(); };
  if (clearBtn) clearBtn.addEventListener('click', clearAll);
  if (empty) { var eb = empty.querySelector('button'); if (eb) eb.addEventListener('click', clearAll); }
  tool.addEventListener('submit', function (e) { e.preventDefault(); });
  window.addEventListener('popstate', function () { fromUrl(); apply(); });

  fromUrl();
  if (scope.indexOf('series:') === 0) state.series = '';
  apply();

  window.RZJournalFilter = {
    state: state,
    apply: apply,
    set: set,
    total: total,
    visible: function () { return cards.filter(function (c) { return !c.hidden; }).length; }
  };
})();
